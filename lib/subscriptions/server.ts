import { createClient } from "@/lib/supabase/server";
import { OWNER_PLANS, OwnerPlan } from "./plans";

export async function getCurrentUserSubscription() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      user: null,
      subscription: null,
      plan: "free" as OwnerPlan,
      limits: OWNER_PLANS.free,
    };
  }

  const { data: subscription } = await supabase
    .from("owner_subscriptions")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  const active =
    subscription?.status === "active" || subscription?.status === "trialing";

  const plan = active ? ((subscription?.plan || "free") as OwnerPlan) : "free";

  return {
    user,
    subscription,
    plan,
    limits: OWNER_PLANS[plan],
  };
}

export async function canCreateListing() {
  const supabase = await createClient();
  const { user, limits } = await getCurrentUserSubscription();

  if (!user) {
    return {
      allowed: false,
      reason: "You must be signed in.",
      currentCount: 0,
      limit: limits.listingLimit,
    };
  }

  const { count } = await supabase
    .from("listings")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .neq("status", "rented");

  const currentCount = count || 0;

  return {
    allowed: currentCount < limits.listingLimit,
    reason:
      currentCount >= limits.listingLimit
        ? `Your ${limits.name} plan allows ${limits.listingLimit} active listing(s). Upgrade to add more.`
        : null,
    currentCount,
    limit: limits.listingLimit,
  };
}

export async function getOwnerPlanByUserId(userId: string) {
  const supabase = await createClient();

  const { data } = await supabase
    .from("owner_subscriptions")
    .select("plan,status")
    .eq("user_id", userId)
    .maybeSingle();

  if (!data || !["active", "trialing"].includes(data.status)) {
    return "free" as OwnerPlan;
  }

  return (data.plan || "free") as OwnerPlan;
}