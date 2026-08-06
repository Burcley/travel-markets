import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { applyFoundingDiscountToSubscription } from "@/lib/founding-landlords/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

type FounderSubscriptionRow = {
  user_id: string;
  stripe_subscription_id: string | null;
  status: string | null;
};

type FounderProfileRow = {
  id: string;
  founding_free_fee_period_ends_at: string | null;
};

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;

  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json(
      { error: "Stripe is not configured." },
      { status: 500 }
    );
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const supabase = createAdminClient();
  const now = new Date().toISOString();

  const { data: founders, error: foundersError } = await supabase
    .from("profiles")
    .select("id, founding_free_fee_period_ends_at")
    .eq("founding_status", "confirmed")
    .eq("is_founding_landlord", true)
    .or("founding_benefits_disabled.is.null,founding_benefits_disabled.eq.false")
    .not("founding_free_fee_period_ends_at", "is", null)
    .lte("founding_free_fee_period_ends_at", now)
    .limit(100);

  if (foundersError) {
    console.error("Founding billing transition profile scan failed:", foundersError);

    return NextResponse.json(
      { error: "Failed to scan Founding Landlord billing transitions." },
      { status: 500 }
    );
  }

  const founderRows = ((founders || []) as FounderProfileRow[]).filter(
    (founder) => founder.id
  );

  if (founderRows.length === 0) {
    return NextResponse.json({
      success: true,
      checkedFounders: 0,
      checkedSubscriptions: 0,
      updatedSubscriptions: 0,
      skippedSubscriptions: 0,
      failedSubscriptions: 0,
    });
  }

  const founderIds = founderRows.map((founder) => founder.id);
  const { data: subscriptions, error: subscriptionsError } = await supabase
    .from("owner_subscriptions")
    .select("user_id, stripe_subscription_id, status")
    .in("user_id", founderIds)
    .in("status", ["active", "trialing"]);

  if (subscriptionsError) {
    console.error(
      "Founding billing transition subscription scan failed:",
      subscriptionsError
    );

    return NextResponse.json(
      { error: "Failed to scan Founding Landlord subscriptions." },
      { status: 500 }
    );
  }

  const subscriptionRows = ((subscriptions || []) as FounderSubscriptionRow[]).filter(
    (subscription) => subscription.user_id && subscription.stripe_subscription_id
  );
  let updatedSubscriptions = 0;
  let skippedSubscriptions = 0;
  let failedSubscriptions = 0;

  for (const subscriptionRow of subscriptionRows) {
    try {
      const subscription = await stripe.subscriptions.retrieve(
        subscriptionRow.stripe_subscription_id as string,
        { expand: ["discounts", "items.data.price"] }
      );
      const result = await applyFoundingDiscountToSubscription({
        stripe,
        subscription,
        userId: subscriptionRow.user_id,
      });

      if (result.applied) {
        updatedSubscriptions += 1;
      } else {
        skippedSubscriptions += 1;
      }
    } catch (error) {
      failedSubscriptions += 1;
      console.error("Founding billing transition subscription failed:", {
        userId: subscriptionRow.user_id,
        stripeSubscriptionId: subscriptionRow.stripe_subscription_id,
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return NextResponse.json({
    success: failedSubscriptions === 0,
    checkedFounders: founderRows.length,
    checkedSubscriptions: subscriptionRows.length,
    updatedSubscriptions,
    skippedSubscriptions,
    failedSubscriptions,
  });
}
