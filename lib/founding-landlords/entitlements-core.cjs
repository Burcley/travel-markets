function isFoundingLandlordRole(role) {
  return ["owner", "landlord", "host"].includes(String(role || "").toLowerCase());
}

function getFoundingBenefitState(profile, now = new Date()) {
  const accountStatus = String((profile && profile.account_status) || "active").toLowerCase();
  const isLandlord =
    !(profile && profile.is_admin) &&
    isFoundingLandlordRole(profile && profile.role) &&
    !["banned", "suspended", "disabled", "test"].includes(accountStatus);
  const isConfirmedFounder =
    isLandlord &&
    profile &&
    profile.founding_status === "confirmed" &&
    profile.is_founding_landlord === true;
  const benefitsDisabled = Boolean(profile && profile.founding_benefits_disabled);
  const freePeriodEndsAt =
    (profile && profile.founding_free_fee_period_ends_at) || null;
  const freePeriodEndMs = freePeriodEndsAt
    ? new Date(freePeriodEndsAt).getTime()
    : Number.NaN;
  const hasValidFreePeriodEnd = Number.isFinite(freePeriodEndMs);
  const freePeriodActive =
    Boolean(isConfirmedFounder) &&
    !benefitsDisabled &&
    hasValidFreePeriodEnd &&
    freePeriodEndMs > now.getTime();
  const freePeriodEnded =
    Boolean(isConfirmedFounder) &&
    !benefitsDisabled &&
    hasValidFreePeriodEnd &&
    freePeriodEndMs <= now.getTime();

  return {
    isLandlord,
    isConfirmedFounder: Boolean(isConfirmedFounder),
    benefitsDisabled,
    freePeriodActive,
    freePeriodEnded,
    freePeriodStartedAt:
      (profile && profile.founding_benefits_started_at) || null,
    freePeriodEndsAt,
    lifetimeDiscountPercentage:
      profile && typeof profile.founding_discount_percentage === "number"
        ? profile.founding_discount_percentage
        : null,
  };
}

function getFoundingBoostEntitlementState({
  benefit,
  monthlyFreeBoosts,
  monthlyBoostsUsed,
  now = new Date(),
}) {
  const includedTotal = benefit.freePeriodActive
    ? Math.max(0, Math.floor(Number(monthlyFreeBoosts ?? 0)))
    : 0;
  const includedUsed = Math.max(0, Math.floor(Number(monthlyBoostsUsed ?? 0)));
  const monthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
  );
  const nextResetDate = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)
  );

  return {
    eligible: benefit.freePeriodActive && includedTotal > 0,
    includedTotal,
    includedUsed,
    includedAvailable: Math.max(0, includedTotal - includedUsed),
    monthStart: monthStart.toISOString().slice(0, 10),
    nextResetDate: nextResetDate.toISOString(),
  };
}

function getFoundingCouponAction({ targetCouponId, existingCouponIds }) {
  if (!targetCouponId) {
    return {
      targetCouponId: null,
      shouldApply: false,
      reason: "not_eligible",
    };
  }

  const uniqueExistingCouponIds = Array.from(
    new Set((existingCouponIds || []).filter(Boolean))
  );
  const alreadyApplied =
    uniqueExistingCouponIds.length === 1 &&
    uniqueExistingCouponIds[0] === targetCouponId;

  return {
    targetCouponId,
    shouldApply: !alreadyApplied,
    reason: alreadyApplied ? "already_applied" : "replace_existing",
  };
}

module.exports = {
  getFoundingCouponAction,
  getFoundingBoostEntitlementState,
  getFoundingBenefitState,
  isFoundingLandlordRole,
};
