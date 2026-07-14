import { createClient } from "@/lib/supabase/server";
import {
  getPlanEntitlements,
  normalizeOwnerPlan,
  subscriptionStatusHasPaidAccess,
  type AnalyticsLevel,
  type OwnerPlan,
} from "./plans";

export type OwnerSubscriptionRecord = {
  user_id?: string | null;
  plan?: string | null;
  status?: string | null;
  current_period_start?: string | null;
  current_period_end?: string | null;
  cancel_at_period_end?: boolean | null;
  included_monthly_boosts_used?: number | null;
  monthly_boosts_used?: number | null;
  purchased_boost_credits?: number | null;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  stripe_price_id?: string | null;
  legacy_plan?: string | null;
};

const ACTIVE_LISTING_STATUSES = ["available", "pending"];

const analyticsOrder: Record<AnalyticsLevel, number> = {
  basic: 0,
  listing: 1,
  portfolio: 2,
};

function getBoostsUsed(subscription?: OwnerSubscriptionRecord | null) {
  return Math.max(
    0,
    Number(
      subscription?.included_monthly_boosts_used ??
        subscription?.monthly_boosts_used ??
        0
    )
  );
}

export function getEffectivePlanFromSubscription(
  subscription?: OwnerSubscriptionRecord | null
): OwnerPlan {
  if (
    !subscriptionStatusHasPaidAccess(
      subscription?.status,
      subscription?.current_period_end
    )
  ) {
    return "free";
  }

  return normalizeOwnerPlan(subscription?.plan);
}

export async function getOwnerSubscription(userId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("owner_subscriptions")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("OWNER SUBSCRIPTION READ ERROR:", error);
  }

  return (data || null) as OwnerSubscriptionRecord | null;
}

export async function getEffectiveOwnerPlan(userId: string) {
  const subscription = await getOwnerSubscription(userId);
  return getEffectivePlanFromSubscription(subscription);
}

export { getPlanEntitlements };

export async function getCurrentUserSubscription() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const plan = "free" as OwnerPlan;

    return {
      user: null,
      subscription: null,
      plan,
      limits: getPlanEntitlements(plan),
      entitlements: getPlanEntitlements(plan),
      remainingMonthlyBoosts: 0,
    };
  }

  const subscription = await getOwnerSubscription(user.id);
  const plan = getEffectivePlanFromSubscription(subscription);
  const entitlements = getPlanEntitlements(plan);
  const remainingMonthlyBoosts = Math.max(
    0,
    entitlements.monthlyBoosts - getBoostsUsed(subscription)
  );

  return {
    user,
    subscription,
    plan,
    limits: entitlements,
    entitlements,
    remainingMonthlyBoosts,
  };
}

export async function countActiveOwnerListings({
  userId,
  excludeListingId,
}: {
  userId: string;
  excludeListingId?: string | null;
}) {
  const supabase = await createClient();
  let query = supabase
    .from("listings")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .in("status", ACTIVE_LISTING_STATUSES);

  if (excludeListingId) {
    query = query.neq("id", excludeListingId);
  }

  const { count, error } = await query;

  if (error) {
    console.error("ACTIVE LISTING COUNT ERROR:", error);
  }

  return count || 0;
}

export async function canCreateOrActivateListing({
  userId,
  excludeListingId,
}: {
  userId: string;
  excludeListingId?: string | null;
}) {
  const plan = await getEffectiveOwnerPlan(userId);
  const entitlements = getPlanEntitlements(plan);
  const currentCount = await countActiveOwnerListings({
    userId,
    excludeListingId,
  });
  const limit = entitlements.activeListingLimit;
  const allowed = limit === null || currentCount < limit;

  return {
    allowed,
    reason: allowed
      ? null
      : `Your ${entitlements.displayName} plan allows ${
          limit ?? "unlimited"
        } active listing${limit === 1 ? "" : "s"}. Upgrade to publish more listings.`,
    code: allowed ? null : "ACTIVE_LISTING_LIMIT_REACHED",
    currentCount,
    limit,
    plan,
    entitlements,
  };
}

// Backwards-compatible helper used by older pages.
export async function canCreateListing() {
  const { user } = await getCurrentUserSubscription();

  if (!user) {
    const entitlements = getPlanEntitlements("free");

    return {
      allowed: false,
      reason: "You must be signed in.",
      currentCount: 0,
      limit: entitlements.activeListingLimit,
    };
  }

  return canCreateOrActivateListing({ userId: user.id });
}

export async function getRemainingMonthlyBoosts(userId: string) {
  const subscription = await getOwnerSubscription(userId);
  const plan = getEffectivePlanFromSubscription(subscription);
  const entitlements = getPlanEntitlements(plan);

  return Math.max(0, entitlements.monthlyBoosts - getBoostsUsed(subscription));
}

export async function canUseBoost(userId: string) {
  const remaining = await getRemainingMonthlyBoosts(userId);

  return {
    allowed: remaining > 0,
    remaining,
  };
}

export async function canAccessAnalytics(
  userId: string,
  analyticsLevel: AnalyticsLevel
) {
  const plan = await getEffectiveOwnerPlan(userId);
  const entitlements = getPlanEntitlements(plan);

  return (
    analyticsOrder[entitlements.analyticsLevel] >= analyticsOrder[analyticsLevel]
  );
}

export async function getOwnerPlanByUserId(userId: string) {
  return getEffectiveOwnerPlan(userId);
}
