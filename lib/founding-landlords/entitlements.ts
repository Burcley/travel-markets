export type FoundingBenefitProfile = {
  role?: string | null;
  account_status?: string | null;
  is_admin?: boolean | null;
  founding_status?: string | null;
  is_founding_landlord?: boolean | null;
  founding_benefits_started_at?: string | null;
  founding_free_fee_period_ends_at?: string | null;
  founding_discount_percentage?: number | null;
  founding_benefits_disabled?: boolean | null;
};

export type FoundingBenefitState = {
  isLandlord: boolean;
  isConfirmedFounder: boolean;
  benefitsDisabled: boolean;
  freePeriodActive: boolean;
  freePeriodEnded: boolean;
  freePeriodStartedAt: string | null;
  freePeriodEndsAt: string | null;
  lifetimeDiscountPercentage: number | null;
};

export type FoundingBoostEntitlementState = {
  eligible: boolean;
  includedTotal: number;
  includedUsed: number;
  includedAvailable: number;
  monthStart: string | null;
  nextResetDate: string | null;
};

export type FoundingCouponAction = {
  targetCouponId: string | null;
  shouldApply: boolean;
  reason: "not_eligible" | "already_applied" | "replace_existing";
};

export function isFoundingLandlordRole(role?: string | null) {
  return ["owner", "landlord", "host"].includes(String(role || "").toLowerCase());
}

export function getFoundingBenefitState(
  profile: FoundingBenefitProfile | null | undefined,
  now: Date = new Date()
): FoundingBenefitState {
  const accountStatus = String(profile?.account_status || "active").toLowerCase();
  const isLandlord =
    !profile?.is_admin &&
    isFoundingLandlordRole(profile?.role) &&
    !["banned", "suspended", "disabled", "test"].includes(accountStatus);
  const isConfirmedFounder =
    isLandlord &&
    profile?.founding_status === "confirmed" &&
    profile?.is_founding_landlord === true;
  const benefitsDisabled = profile?.founding_benefits_disabled === true;
  const freePeriodEndsAt = profile?.founding_free_fee_period_ends_at || null;
  const freePeriodEndMs = freePeriodEndsAt
    ? new Date(freePeriodEndsAt).getTime()
    : Number.NaN;
  const hasValidFreePeriodEnd = Number.isFinite(freePeriodEndMs);
  const freePeriodActive =
    isConfirmedFounder &&
    !benefitsDisabled &&
    hasValidFreePeriodEnd &&
    freePeriodEndMs > now.getTime();
  const freePeriodEnded =
    isConfirmedFounder &&
    !benefitsDisabled &&
    hasValidFreePeriodEnd &&
    freePeriodEndMs <= now.getTime();

  return {
    isLandlord,
    isConfirmedFounder,
    benefitsDisabled,
    freePeriodActive,
    freePeriodEnded,
    freePeriodStartedAt: profile?.founding_benefits_started_at || null,
    freePeriodEndsAt,
    lifetimeDiscountPercentage:
      typeof profile?.founding_discount_percentage === "number"
        ? profile.founding_discount_percentage
        : null,
  };
}

export function getFoundingCouponAction({
  targetCouponId,
  existingCouponIds,
}: {
  targetCouponId?: string | null;
  existingCouponIds?: string[] | null;
}): FoundingCouponAction {
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

export function getFoundingBoostEntitlementState({
  benefit,
  monthlyFreeBoosts,
  monthlyBoostsUsed,
  now = new Date(),
}: {
  benefit: FoundingBenefitState;
  monthlyFreeBoosts?: number | null;
  monthlyBoostsUsed?: number | null;
  now?: Date;
}): FoundingBoostEntitlementState {
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
