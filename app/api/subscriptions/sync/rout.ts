import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { planFromPriceId } from "@/lib/subscriptions/plans";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

function getPeriodStart(subscription: any) {
  return (
    subscription.current_period_start ||
    subscription.items?.data?.[0]?.current_period_start ||
    null
  );
}

function getPeriodEnd(subscription: any) {
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

    const subscription: any = await stripe.subscriptions.retrieve(
      existingSub.stripe_subscription_id,
      {
        expand: ["customer", "items.data.price"],
      }
    );

    const priceId = subscription.items?.data?.[0]?.price?.id || null;
    const plan = planFromPriceId(priceId);

    const periodStart = getPeriodStart(subscription);
    const periodEnd = getPeriodEnd(subscription);

    const active =
      subscription.status === "active" || subscription.status === "trialing";

    const { error: updateError } = await supabaseAdmin
      .from("owner_subscriptions")
      .update({
        plan: active ? plan : "free",
        status: subscription.status,
        stripe_price_id: priceId,
        current_period_start: periodStart
          ? new Date(periodStart * 1000).toISOString()
          : null,
        current_period_end: periodEnd
          ? new Date(periodEnd * 1000).toISOString()
          : null,
        cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
      })
      .eq("user_id", user.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ synced: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to sync subscription." },
      { status: 500 }
    );
  }
}