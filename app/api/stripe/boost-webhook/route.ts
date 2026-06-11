import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { planFromPriceId } from "@/lib/subscriptions/plans";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

function getSubscriptionCustomerUserId(subscription: any) {
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

  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id || null;

  const priceId = subscription.items?.data?.[0]?.price?.id || null;
  const plan = planFromPriceId(priceId);
  const userId = getSubscriptionCustomerUserId(subscription);

  if (!userId) {
    console.error("SUBSCRIPTION ERROR: Missing user_id", subscriptionId);
    return;
  }

  const currentPeriodStart = subscription.current_period_start
    ? new Date(subscription.current_period_start * 1000).toISOString()
    : null;

  const currentPeriodEnd = subscription.current_period_end
    ? new Date(subscription.current_period_end * 1000).toISOString()
    : null;

  const { error } = await supabaseAdmin.from("owner_subscriptions").upsert(
    {
      user_id: userId,
      plan:
        subscription.status === "active" || subscription.status === "trialing"
          ? plan
          : "free",
      status: subscription.status,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.id,
      stripe_price_id: priceId,
      current_period_start: currentPeriodStart,
      current_period_end: currentPeriodEnd,
      cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (error) {
    console.error("OWNER SUBSCRIPTION WEBHOOK UPSERT ERROR:", error);
    throw error;
  }
}

async function activateListingBoost(session: Stripe.Checkout.Session) {
  const listingId = session.metadata?.listing_id;
  const userId = session.metadata?.user_id || session.metadata?.owner_id;
  const boostDays = Number(session.metadata?.boost_days || 7);

  if (!listingId || !userId) {
    console.error("BOOST ERROR: Missing listing_id or user_id metadata");
    return;
  }

  if (![1, 7, 30].includes(boostDays)) {
    console.error("BOOST ERROR: Invalid boost_days metadata", boostDays);
    return;
  }

  const boostUntil = new Date();
  boostUntil.setDate(boostUntil.getDate() + boostDays);

  const boostRank = boostDays === 30 ? 300 : boostDays === 7 ? 200 : 100;

  const { error } = await supabaseAdmin
    .from("listings")
    .update({
      boost_until: boostUntil.toISOString(),
      boost_rank: boostRank,
      is_featured: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", listingId)
    .or(`user_id.eq.${userId},owner_id.eq.${userId}`);

  if (error) {
    console.error("SUPABASE BOOST UPDATE ERROR:", error);
    throw error;
  }
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET || ""
    );
  } catch (error: any) {
    console.error("STRIPE WEBHOOK SIGNATURE ERROR:", error.message);

    return NextResponse.json(
      { error: "Invalid webhook signature" },
      { status: 400 }
    );
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
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

        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.resumed": {
        const subscription = event.data.object as any;
        await syncSubscription(subscription.id);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as any;

        await supabaseAdmin
          .from("owner_subscriptions")
          .update({
            plan: "free",
            status: "canceled",
            stripe_price_id: null,
            cancel_at_period_end: false,
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_subscription_id", subscription.id);

        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as any;

        const subscriptionId =
          typeof invoice.subscription === "string"
            ? invoice.subscription
            : invoice.subscription?.id;

        if (subscriptionId) {
          await supabaseAdmin
            .from("owner_subscriptions")
            .update({
              status: "past_due",
              updated_at: new Date().toISOString(),
            })
            .eq("stripe_subscription_id", subscriptionId);
        }

        break;
      }

      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error("STRIPE WEBHOOK PROCESSING ERROR:", error);

    return NextResponse.json(
      { error: error?.message || "Webhook processing failed" },
      { status: 500 }
    );
  }
}