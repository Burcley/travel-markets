import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { canManageListings } from "@/lib/role-access";
import {
  getEffectivePlanFromSubscription,
  getPlanEntitlements,
  getOwnerSubscription,
} from "@/lib/subscriptions/server";

const boostErrorMessages: Record<string, string> = {
  LISTING_NOT_FOUND: "Listing not found.",
  NOT_OWNER: "You can only boost your own listings.",
  LISTING_NOT_ACTIVE: "Publish this listing before boosting it.",
  LISTING_ALREADY_BOOSTED: "This listing already has an active boost.",
  NO_INCLUDED_BOOSTS: "You have used all included boosts for this billing cycle.",
  SUBSCRIPTION_NOT_ELIGIBLE:
    "Monthly boosts are included with Premium and Elite plans.",
  SUBSCRIPTION_INACTIVE:
    "Your subscription must be active to use included monthly boosts.",
  FOUNDING_NOT_ELIGIBLE: "Founding Landlord benefits are not active for this account.",
  FOUNDING_NO_BOOSTS:
    "You have used your Founding Landlord boosts for this month.",
};

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const admin = createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (!canManageListings(profile)) {
    return NextResponse.json(
      { error: "Boost tools are available to landlord accounts." },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);
  const listingId = String(body?.listingId || "");

  if (!listingId) {
    return NextResponse.json({ error: "Missing listing ID." }, { status: 400 });
  }

  const { data: foundingBoostData, error: foundingBoostError } =
    await admin.rpc("activate_founding_listing_boost", {
      p_owner_id: user.id,
      p_listing_id: listingId,
    });

  if (foundingBoostError) {
    console.error("FOUNDING BOOST RPC ERROR:", foundingBoostError);
  }

  const foundingBoost = foundingBoostData as {
    ok?: boolean;
    code?: string;
    remainingMonthly?: number;
    expiresAt?: string;
    boostId?: string;
    source?: string;
  } | null;

  if (foundingBoost?.ok) {
    await admin.from("notifications").insert({
      user_id: user.id,
      title: "Founding Landlord boost activated",
      message:
        "Your free Founding Landlord 7-day listing boost is now active.",
      type: "listing_boost",
      href: `/listings/${listingId}`,
      is_read: false,
    });

    return NextResponse.json({
      ok: true,
      remaining: foundingBoost.remainingMonthly,
      expiresAt: foundingBoost.expiresAt,
      boostId: foundingBoost.boostId,
      source: foundingBoost.source,
      message:
        "Your Founding Landlord boost is active for 7 days.",
    });
  }

  const subscription = await getOwnerSubscription(user.id);
  const plan = getEffectivePlanFromSubscription(subscription);
  const entitlements = getPlanEntitlements(plan);

  if (entitlements.monthlyBoosts <= 0) {
    return NextResponse.json(
      {
        error: boostErrorMessages.SUBSCRIPTION_NOT_ELIGIBLE,
        code: "SUBSCRIPTION_NOT_ELIGIBLE",
      },
      { status: 403 }
    );
  }

  const { data, error } = await admin.rpc("activate_included_listing_boost", {
    p_owner_id: user.id,
    p_listing_id: listingId,
    p_monthly_allowance: entitlements.monthlyBoosts,
    p_billing_period_start: subscription?.current_period_start || null,
    p_billing_period_end: subscription?.current_period_end || null,
  });

  if (error) {
    console.error("INCLUDED BOOST RPC ERROR:", error);
    return NextResponse.json(
      { error: "We could not boost this listing. Please try again." },
      { status: 500 }
    );
  }

  const result = data as {
    ok?: boolean;
    code?: string;
    remaining?: number;
    expiresAt?: string;
    boostId?: string;
  } | null;

  if (!result?.ok) {
    const code = result?.code || "BOOST_FAILED";
    return NextResponse.json(
      {
        error: boostErrorMessages[code] || "We could not boost this listing.",
        code,
      },
      { status: code === "NO_INCLUDED_BOOSTS" ? 409 : 400 }
    );
  }

  await admin.from("notifications").insert({
    user_id: user.id,
    title: "Boost activated",
    message:
      "Listing boosted successfully. It will receive increased visibility for 7 days.",
    type: "listing_boost",
    href: `/listings/${listingId}`,
    is_read: false,
  });

  return NextResponse.json({
    ok: true,
    remaining: result.remaining,
    expiresAt: result.expiresAt,
    boostId: result.boostId,
    message:
      "Listing boosted successfully. It will receive increased visibility for 7 days.",
  });
}
