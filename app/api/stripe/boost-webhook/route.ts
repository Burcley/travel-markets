import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { planFromPriceId } from "@/lib/subscriptions/plans";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

function getUserIdFromSubscription(subscription: any) {
  if (subscription?.metadata?.user_id) {
    return subscription.metadata.user_id;
  }

  if (
    subscription?.customer &&
    typeof subscription.customer !== "string" &&
    !subscription.customer.deleted
  ) {
    return subscription.customer.metadata?.user_id || null;
  }

  return null;
}

async function syncSubscription(subscriptionId: string) {
  const subscription: any = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ["customer", "items.data.price"],
  });

  const userId = getUserIdFromSubscription(subscription);

  if (!userId) {
    throw new Error("Missing user_id on Stripe subscription metadata.");
  }

  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id || null;

  const priceId = subscription.items?.data?.[0]?.price?.id || null;
  const plan = planFromPriceId(priceId);

  const active =
    subscription.status === "active" || subscription.status === "trialing";

  const { error } = await supabaseAdmin.from("owner_subscriptions").upsert(
    {
      user_id: userId,
      plan: active ? plan : "free",
      status: subscription.status,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.id,
      stripe_price_id: priceId,
      current_period_start: subscription.current_period_start
        ? new Date(subscription.current_period_start * 1000).toISOString()
        : null,
      current_period_end: subscription.current_period_end
        ? new Date(subscription.current_period_end * 1000).toISOString()
        : null,
      cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
    },
    { onConflict: "user_id" }
  );

  if (error) {
    throw error;
  }
}

async function activateListingBoost(session: Stripe.Checkout.Session) {
  const listingId = session.metadata?.listing_id;
  const userId = session.metadata?.user_id;
  const boostDays = Number(session.metadata?.boost_days || 7);

  if (!listingId || !userId) {
    throw new Error("Missing listing_id or user_id in boost metadata.");
  }

  if (![1, 7, 30].includes(boostDays)) {
    throw new Error("Invalid boost_days in boost metadata.");
  }

  const { data: listing, error: listingReadError } = await supabaseAdmin
    .from("listings")
    .select("id, user_id")
    .eq("id", listingId)
    .maybeSingle();

  if (listingReadError) {
    throw listingReadError;
  }

  if (!listing) {
    throw new Error(`Listing not found for boost: ${listingId}`);
  }

  if (listing.user_id !== userId) {
    throw new Error("Boost user_id does not match listing.user_id.");
  }

  const boostUntil = new Date();
  boostUntil.setDate(boostUntil.getDate() + boostDays);

  const boostRank = boostDays === 30 ? 300 : boostDays === 7 ? 200 : 100;

  const { data: updatedRows, error: updateError } = await supabaseAdmin
    .from("listings")
    .update({
      boost_until: boostUntil.toISOString(),
      boost_rank: boostRank,
      is_featured: true,
    })
    .eq("id", listingId)
    .eq("user_id", userId)
    .select("id, is_featured, boost_until, boost_rank");

  if (updateError) {
    throw updateError;
  }

  if (!updatedRows || updatedRows.length === 0) {
    throw new Error("Boost payment succeeded but no listing row was updated.");
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get("stripe-signature");

    if (!signature) {
      return NextResponse.json(
        { error: "Missing Stripe signature" },
        { status: 400 }
      );
    }

    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      return NextResponse.json(
        { error: "Missing STRIPE_WEBHOOK_SECRET" },
        { status: 500 }
      );
    }

    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      if (session.mode === "subscription" && session.subscription) {
        await syncSubscription(String(session.subscription));
      }

      if (
        session.mode === "payment" &&
        session.metadata?.type === "listing_boost"
      ) {
        await activateListingBoost(session);
      }
    }

    if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.resumed"
    ) {
      const subscription = event.data.object as any;
      await syncSubscription(subscription.id);
    }

    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as any;

      const { error } = await supabaseAdmin
        .from("owner_subscriptions")
        .update({
          plan: "free",
          status: "canceled",
          stripe_price_id: null,
          cancel_at_period_end: false,
        })
        .eq("stripe_subscription_id", subscription.id);

      if (error) {
        throw error;
      }
    }

    if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object as any;

      const subscriptionId =
        typeof invoice.subscription === "string"
          ? invoice.subscription
          : invoice.subscription?.id;

      if (subscriptionId) {
        const { error } = await supabaseAdmin
          .from("owner_subscriptions")
          .update({
            status: "past_due",
          })
          .eq("stripe_subscription_id", subscriptionId);

        if (error) {
          throw error;
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error("STRIPE WEBHOOK ERROR:", error);

    return NextResponse.json(
      { error: error?.message || "Webhook failed" },
      { status: 500 }
    );
  }
}