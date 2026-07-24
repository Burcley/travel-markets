import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { planFromPriceId } from "@/lib/subscriptions/plans";
import { applyFoundingDiscountToSubscription } from "@/lib/founding-landlords/stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

type StripeSubscriptionWithPeriods = Stripe.Subscription & {
  current_period_start?: number | null;
  current_period_end?: number | null;
};

function getPeriodStart(subscription: StripeSubscriptionWithPeriods) {
  return (
    subscription.current_period_start ||
    subscription.items?.data?.[0]?.current_period_start ||
    null
  );
}

function getPeriodEnd(subscription: StripeSubscriptionWithPeriods) {
  return (
    subscription.current_period_end ||
    subscription.items?.data?.[0]?.current_period_end ||
    null
  );
}

export async function POST() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: existingSub, error: readError } = await supabaseAdmin
      .from("owner_subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (readError) {
      return NextResponse.json({ error: readError.message }, { status: 500 });
    }

    if (!existingSub?.stripe_subscription_id) {
      return NextResponse.json({
        synced: false,
        reason: "No Stripe subscription ID found.",
      });
    }

    const subscription = await stripe.subscriptions.retrieve(
      existingSub.stripe_subscription_id,
      {
        expand: ["customer", "items.data.price"],
      }
    );

    await applyFoundingDiscountToSubscription({
      stripe,
      subscription,
      userId: user.id,
    });

    const priceId = subscription.items?.data?.[0]?.price?.id || null;
    const plan = planFromPriceId(priceId);

    const periodStart = getPeriodStart(subscription);
    const periodEnd = getPeriodEnd(subscription);
    const periodStartIso = periodStart
      ? new Date(periodStart * 1000).toISOString()
      : null;
    const periodEndIso = periodEnd
      ? new Date(periodEnd * 1000).toISOString()
      : null;

    const active =
      subscription.status === "active" || subscription.status === "trialing";
    const periodChanged =
      periodStartIso &&
      existingSub.current_period_start &&
      new Date(existingSub.current_period_start).getTime() !==
        new Date(periodStartIso).getTime();

    const { error: updateError } = await supabaseAdmin
      .from("owner_subscriptions")
      .update({
        plan: active ? plan : existingSub.plan || "free",
        status: subscription.status,
        stripe_price_id: priceId,
        current_period_start: periodStartIso,
        current_period_end: periodEndIso,
        cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
        ...(periodChanged
          ? {
              included_monthly_boosts_used: 0,
              monthly_boosts_used: 0,
              included_monthly_boosts_reset_at: periodStartIso,
            }
          : {}),
      })
      .eq("user_id", user.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ synced: true });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to sync subscription.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
