import { createAdminClient } from "@/lib/supabase/admin";
import {
  getFoundingBoostEntitlementState,
  getFoundingBenefitState,
  isFoundingLandlordRole,
  type FoundingBoostEntitlementState,
  type FoundingBenefitState,
} from "@/lib/founding-landlords/entitlements";

export type FoundingStatus =
  | "not_eligible"
  | "reserved"
  | "pending_verification"
  | "pending_listing"
  | "confirmed"
  | "disqualified";

export type FoundingLandlordProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
  account_status: string | null;
  is_admin: boolean | null;
  is_founding_landlord: boolean | null;
  founding_landlord_number: number | null;
  founding_status: FoundingStatus | null;
  founding_reserved_at: string | null;
  founding_reservation_expires_at: string | null;
  founding_confirmed_at: string | null;
  founding_benefits_started_at: string | null;
  founding_free_fee_period_ends_at: string | null;
  founding_discount_percentage: number | null;
  founding_referral_code: string | null;
  founding_benefits_disabled: boolean | null;
  founding_benefits_disabled_reason: string | null;
};

export type FoundingPublicStats = {
  isActive: boolean;
  maxPositions: number;
  confirmedCount: number;
  reservedCount: number;
  availablePositions: number;
};

export function isLandlordRole(role?: string | null) {
  return isFoundingLandlordRole(role);
}

export async function getFoundingPublicStats() {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("get_founding_landlord_public_stats");

  if (error) {
    console.error("FOUNDING PUBLIC STATS ERROR:", error);
    return {
      isActive: false,
      maxPositions: 30,
      confirmedCount: 0,
      reservedCount: 0,
      availablePositions: 0,
    } satisfies FoundingPublicStats;
  }

  const stats = (data || {}) as Partial<FoundingPublicStats>;

  return {
    isActive: Boolean(stats.isActive),
    maxPositions: Number(stats.maxPositions ?? 30),
    confirmedCount: Number(stats.confirmedCount ?? 0),
    reservedCount: Number(stats.reservedCount ?? 0),
    availablePositions: Number(stats.availablePositions ?? 0),
  } satisfies FoundingPublicStats;
}

export async function reserveAndEvaluateFoundingLandlord({
  userId,
  referralCode,
}: {
  userId: string;
  referralCode?: string | null;
}) {
  const admin = createAdminClient();

  const { data: reserveResult, error: reserveError } = await admin.rpc(
    "try_reserve_founding_landlord",
    {
      p_user_id: userId,
      p_referral_code: referralCode || null,
    }
  );

  if (reserveError) {
    console.error("FOUNDING RESERVATION ERROR:", reserveError);
    throw new Error("FOUNDING_RESERVATION_FAILED");
  }

  const reserve = (reserveResult || {}) as {
    ok?: boolean;
    code?: string;
  };

  if (!reserve.ok) {
    return reserve;
  }

  const { data: evaluationResult, error: evaluationError } = await admin.rpc(
    "evaluate_founding_landlord",
    {
      p_user_id: userId,
    }
  );

  if (evaluationError) {
    console.error("FOUNDING EVALUATION ERROR:", evaluationError);
    throw new Error("FOUNDING_EVALUATION_FAILED");
  }

  return (evaluationResult || reserveResult || {}) as Record<string, unknown>;
}

export async function getFoundingProfile(userId: string) {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("profiles")
    .select(
      [
        "id",
        "full_name",
        "email",
        "role",
        "account_status",
        "is_admin",
        "is_founding_landlord",
        "founding_landlord_number",
        "founding_status",
        "founding_reserved_at",
        "founding_reservation_expires_at",
        "founding_confirmed_at",
        "founding_benefits_started_at",
        "founding_free_fee_period_ends_at",
        "founding_discount_percentage",
        "founding_referral_code",
        "founding_benefits_disabled",
        "founding_benefits_disabled_reason",
      ].join(", ")
    )
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("FOUNDING PROFILE ERROR:", error);
  }

  return (data || null) as FoundingLandlordProfile | null;
}

export async function getFoundingBenefitStatus(
  userId: string
): Promise<FoundingBenefitState> {
  const profile = await getFoundingProfile(userId);

  return getFoundingBenefitState(profile);
}

export async function getFoundingListingEntitlement(userId: string) {
  const benefit = await getFoundingBenefitStatus(userId);

  return {
    ...benefit,
    hasUnlimitedListings: benefit.freePeriodActive,
    listingLimit: benefit.freePeriodActive ? null : undefined,
  };
}

export async function getFoundingBoostEntitlement(
  userId: string
): Promise<FoundingBoostEntitlementState> {
  const admin = createAdminClient();
  const benefit = await getFoundingBenefitStatus(userId);
  const monthStart = new Date();
  const monthStartValue = new Date(
    Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth(), 1)
  )
    .toISOString()
    .slice(0, 10);

  const [{ data: config }, { count: monthlyBoostsUsed }] = await Promise.all([
    admin
      .from("founding_landlord_program_config")
      .select("monthly_free_boosts")
      .eq("id", true)
      .maybeSingle(),
    admin
      .from("founding_landlord_monthly_boost_redemptions")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", userId)
      .eq("source", "founding_monthly")
      .eq("month_start", monthStartValue),
  ]);

  return getFoundingBoostEntitlementState({
    benefit,
    monthlyFreeBoosts:
      typeof config?.monthly_free_boosts === "number"
        ? config.monthly_free_boosts
        : 2,
    monthlyBoostsUsed: monthlyBoostsUsed || 0,
    now: monthStart,
  });
}

export async function getFoundingProgress(userId: string) {
  const admin = createAdminClient();

  const [
    { count: activeListings },
    { count: approvedIdentitySubmissions },
    { count: approvedLandlordSubmissions },
    { count: assistanceRequests },
    { count: feedbackItems },
    { count: monthlyBoostsUsed },
    { count: referralRewards },
  ] = await Promise.all([
    admin
      .from("listings")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .in("status", ["available", "pending"]),
    admin
      .from("verification_submissions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("verification_type", "identity")
      .eq("status", "approved"),
    admin
      .from("verification_submissions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("verification_type", "property_relationship")
      .eq("status", "approved"),
    admin
      .from("founding_landlord_assistance_requests")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", userId),
    admin
      .from("founding_landlord_feedback")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", userId),
    admin
      .from("founding_landlord_monthly_boost_redemptions")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", userId)
      .eq("source", "founding_monthly")
      .eq("month_start", new Date().toISOString().slice(0, 7) + "-01"),
    admin
      .from("founding_landlord_referrals")
      .select("id", { count: "exact", head: true })
      .eq("referrer_id", userId)
      .eq("status", "rewarded"),
  ]);
  const accountVerified =
    (approvedIdentitySubmissions || 0) > 0 &&
    (approvedLandlordSubmissions || 0) > 0;

  return {
    hasLandlordVerification: accountVerified,
    hasApprovedPublishedListing: accountVerified,
    activeListings: activeListings || 0,
    verifiedListings: 0,
    assistanceRequests: assistanceRequests || 0,
    feedbackItems: feedbackItems || 0,
    monthlyBoostsUsed: monthlyBoostsUsed || 0,
    referralRewards: referralRewards || 0,
  };
}
