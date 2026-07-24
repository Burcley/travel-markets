import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { boostRankForDuration, type BoostSource } from "@/lib/boosts/config";
import { getOwnerPlanLabel, planFromPriceId } from "@/lib/subscriptions/plans";
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

type StripeInvoiceWithSubscription = Stripe.Invoice & {
  subscription?: string | { id?: string | null } | null;
};

function getSiteUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://travelmarkets.ca"
  );
}

async function getUserProfile(userId: string) {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("id, email, full_name")
    .eq("id", userId)
    .maybeSingle();

  return data;
}

async function createBillingNotification({
  userId,
  title,
  message,
  type = "billing",
  href = "/billing",
}: {
  userId: string;
  title: string;
  message: string;
  type?: string;
  href?: string;
}) {
  try {
    await supabaseAdmin.from("notifications").insert({
      user_id: userId,
      title,
      message,
      type,
      href,
      is_read: false,
    });
  } catch (error) {
    console.error("Billing notification insert failed:", error);
  }
}

async function sendBillingEmail({
  userId,
  subject,
  heading,
  body,
  buttonText = "Open Billing",
  buttonUrl = `${getSiteUrl()}/billing`,
}: {
  userId: string;
  subject: string;
  heading: string;
  body: string;
  buttonText?: string;
  buttonUrl?: string;
}) {
  try {
    if (!process.env.RESEND_API_KEY) return;

    const profile = await getUserProfile(userId);
    const email = profile?.email;

    if (!email) return;

    const fromEmail =
      process.env.RESEND_FROM_EMAIL || "Travel Markets <noreply@travelmarkets.ca>";

    const html = `
      <div style="font-family: Arial, sans-serif; background:#050505; padding:32px; color:#ffffff;">
        <div style="max-width:560px; margin:0 auto; background:#111111; border:1px solid #262626; border-radius:20px; padding:28px;">
          <h1 style="margin:0 0 16px; font-size:26px;">${heading}</h1>
          <p style="color:#cfcfcf; line-height:1.6; font-size:15px;">${body}</p>
          <a href="${buttonUrl}" style="display:inline-block; margin-top:22px; background:#ffffff; color:#000000; padding:12px 18px; border-radius:12px; text-decoration:none; font-weight:700;">
            ${buttonText}
          </a>
          <p style="margin-top:28px; color:#777777; font-size:12px;">
            Travel Markets
          </p>
        </div>
      </div>
    `;

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: email,
        subject,
        html,
      }),
    });
  } catch (error) {
    console.error("Billing email failed:", error);
  }
}

function getUserIdFromSubscription(subscription: Stripe.Subscription) {
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

function getSubscriptionPeriodStart(subscription: StripeSubscriptionWithPeriods) {
  return (
    subscription?.current_period_start ||
    subscription?.items?.data?.[0]?.current_period_start ||
    null
  );
}

function getSubscriptionPeriodEnd(subscription: StripeSubscriptionWithPeriods) {
  return (
    subscription?.current_period_end ||
    subscription?.items?.data?.[0]?.current_period_end ||
    null
  );
}

async function syncSubscription(subscriptionId: string) {
  const subscription = (await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ["customer", "items.data.price"],
  })) as StripeSubscriptionWithPeriods;

  const userId = getUserIdFromSubscription(subscription);

  if (!userId) {
    throw new Error("Missing user_id on Stripe subscription metadata.");
  }

  await applyFoundingDiscountToSubscription({
    stripe,
    subscription,
    userId,
  });

  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id || null;

  const priceId = subscription.items?.data?.[0]?.price?.id || null;
  const plan = planFromPriceId(priceId);

  const active =
    subscription.status === "active" || subscription.status === "trialing";

  const periodStart = getSubscriptionPeriodStart(subscription);
  const periodEnd = getSubscriptionPeriodEnd(subscription);
  const periodStartIso = periodStart
    ? new Date(periodStart * 1000).toISOString()
    : null;
  const periodEndIso = periodEnd
    ? new Date(periodEnd * 1000).toISOString()
    : null;

  const { data: existingSubscription } = await supabaseAdmin
    .from("owner_subscriptions")
    .select("current_period_start, plan")
    .eq("user_id", userId)
    .maybeSingle();

  const existingPeriodStart = existingSubscription?.current_period_start
    ? new Date(existingSubscription.current_period_start).getTime()
    : null;
  const nextPeriodStart = periodStartIso
    ? new Date(periodStartIso).getTime()
    : null;
  const billingPeriodChanged =
    existingPeriodStart !== null &&
    nextPeriodStart !== null &&
    existingPeriodStart !== nextPeriodStart;

  const { error } = await supabaseAdmin.from("owner_subscriptions").upsert(
    {
      user_id: userId,
      plan: active ? plan : existingSubscription?.plan || plan || "free",
      status: subscription.status,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.id,
      stripe_price_id: priceId,
      current_period_start: periodStartIso,
      current_period_end: periodEndIso,
      cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
      ...(billingPeriodChanged
        ? {
            included_monthly_boosts_used: 0,
            monthly_boosts_used: 0,
            included_monthly_boosts_reset_at: periodStartIso,
          }
        : {}),
    },
    { onConflict: "user_id" }
  );

  if (error) {
    throw error;
  }

  return {
    userId,
    plan,
    planLabel: getOwnerPlanLabel(plan),
    status: subscription.status,
    active,
    cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
  };
}

async function activateListingBoost(session: Stripe.Checkout.Session) {
  const listingId = session.metadata?.listing_id;
  const userId = session.metadata?.user_id;
  const boostDays = Number(session.metadata?.boost_days || 7);
  const boostSource = String(
    session.metadata?.boost_source || "purchased_7_day"
  ) as BoostSource;

  if (!listingId || !userId) {
    throw new Error("Missing listing_id or user_id in boost metadata.");
  }

  if (![7, 14, 30].includes(boostDays)) {
    throw new Error("Invalid boost_days in boost metadata.");
  }

  const { data: listing, error: listingReadError } = await supabaseAdmin
    .from("listings")
    .select("id, user_id, title, status, boost_until")
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

  if (
    !["available", "pending"].includes(String(listing.status || "")) ||
    (listing.boost_until && new Date(listing.boost_until).getTime() > Date.now())
  ) {
    await supabaseAdmin.rpc("increment_purchased_boost_credit", {
      p_user_id: userId,
    }).then(async ({ error }) => {
      if (!error) return;

      await supabaseAdmin.from("owner_subscriptions").upsert(
        {
          user_id: userId,
          purchased_boost_credits: 1,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );
    });

    await createBillingNotification({
      userId,
      title: "Boost credit saved",
      message:
        "Your boost purchase was saved as a credit because the listing is not currently eligible.",
      type: "listing_boost_credit",
      href: "/dashboard/boosts",
    });

    return;
  }

  const boostUntil = new Date();
  boostUntil.setDate(boostUntil.getDate() + boostDays);

  const boostRank = boostRankForDuration(boostDays);

  const { error: boostInsertError } = await supabaseAdmin
    .from("listing_boosts")
    .insert({
      owner_id: userId,
      listing_id: listingId,
      source: boostSource,
      duration_days: boostDays,
      started_at: new Date().toISOString(),
      expires_at: boostUntil.toISOString(),
      status: "active",
      stripe_checkout_session_id: session.id,
      stripe_payment_intent_id:
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.payment_intent?.id || null,
    });

  if (boostInsertError) {
    if (boostInsertError.code === "23505") {
      return;
    }

    throw boostInsertError;
  }

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

  await createBillingNotification({
    userId,
    title: "Listing boost activated",
    message: `Your listing "${listing.title || "Untitled listing"}" has been boosted for ${boostDays} day(s).`,
    type: "listing_boost",
    href: `/dashboard/boosts`,
  });

  await sendBillingEmail({
    userId,
    subject: "Your Travel Markets listing boost is active",
    heading: "Listing boost activated",
    body: `Your listing "${listing.title || "Untitled listing"}" has been boosted for ${boostDays} day(s). It will receive higher visibility on Travel Markets.`,
    buttonText: "View Listing",
    buttonUrl: `${getSiteUrl()}/listings/${listingId}`,
  });
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const { data: existingSubscription } = await supabaseAdmin
    .from("owner_subscriptions")
    .select("user_id")
    .eq("stripe_subscription_id", subscription.id)
    .maybeSingle();

  const userId = existingSubscription?.user_id;

  const { error } = await supabaseAdmin
    .from("owner_subscriptions")
    .update({
      plan: "free",
      status: "canceled",
      stripe_price_id: null,
      current_period_start: null,
      current_period_end: null,
      cancel_at_period_end: false,
    })
    .eq("stripe_subscription_id", subscription.id);

  if (error) {
    throw error;
  }

  if (userId) {
    await createBillingNotification({
      userId,
      title: "Subscription canceled",
      message:
        "Your Travel Markets owner subscription has been canceled and your account has been moved to the Free plan.",
      type: "subscription_canceled",
      href: "/billing",
    });

    await sendBillingEmail({
      userId,
      subject: "Your Travel Markets subscription was canceled",
      heading: "Subscription canceled",
      body:
        "Your Travel Markets owner subscription has been canceled and your account has been moved to the Free plan. You can reactivate or upgrade anytime from Billing.",
    });
  }
}

async function handleInvoicePaymentSucceeded(invoice: StripeInvoiceWithSubscription) {
  const subscriptionId =
    typeof invoice.subscription === "string"
      ? invoice.subscription
      : invoice.subscription?.id;

  if (!subscriptionId) return;

  const subscriptionResult = await syncSubscription(subscriptionId);

  await createBillingNotification({
    userId: subscriptionResult.userId,
    title: "Payment successful",
    message: `Your Travel Markets ${subscriptionResult.planLabel} subscription payment was successful.`,
    type: "payment_success",
    href: "/billing",
  });

  await sendBillingEmail({
    userId: subscriptionResult.userId,
    subject: "Travel Markets payment successful",
    heading: "Payment successful",
    body: `Your Travel Markets ${subscriptionResult.planLabel} subscription payment was successful. Your owner plan is active.`,
  });
}

async function handleInvoicePaymentFailed(invoice: StripeInvoiceWithSubscription) {
  const subscriptionId =
    typeof invoice.subscription === "string"
      ? invoice.subscription
      : invoice.subscription?.id;

  if (!subscriptionId) return;

  const { data: existingSubscription } = await supabaseAdmin
    .from("owner_subscriptions")
    .select("user_id")
    .eq("stripe_subscription_id", subscriptionId)
    .maybeSingle();

  const { error } = await supabaseAdmin
    .from("owner_subscriptions")
    .update({
      status: "past_due",
    })
    .eq("stripe_subscription_id", subscriptionId);

  if (error) {
    throw error;
  }

  const userId = existingSubscription?.user_id;

  if (userId) {
    await createBillingNotification({
      userId,
      title: "Payment failed",
      message:
        "Your Travel Markets subscription payment failed. Please update your billing method to avoid losing owner plan benefits.",
      type: "payment_failed",
      href: "/billing",
    });

    await sendBillingEmail({
      userId,
      subject: "Travel Markets payment failed",
      heading: "Payment failed",
      body:
        "Your Travel Markets subscription payment failed. Please update your billing method to keep your owner plan active.",
    });
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

    const { error: eventInsertError } = await supabaseAdmin
      .from("stripe_webhook_events")
      .insert({
        id: event.id,
        type: event.type,
      });

    if (eventInsertError) {
      if (eventInsertError.code === "23505") {
        return NextResponse.json({ received: true, duplicate: true });
      }

      throw eventInsertError;
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      if (session.mode === "subscription" && session.subscription) {
        const subscriptionResult = await syncSubscription(
          String(session.subscription)
        );

        await createBillingNotification({
          userId: subscriptionResult.userId,
          title: "Owner plan activated",
          message: `Your Travel Markets ${subscriptionResult.planLabel} owner plan is now active.`,
          type: "subscription_started",
          href: "/billing",
        });

        await sendBillingEmail({
          userId: subscriptionResult.userId,
          subject: "Your Travel Markets owner plan is active",
          heading: "Owner plan activated",
          body: `Your Travel Markets ${subscriptionResult.planLabel} owner plan is now active. You can manage your plan anytime from Billing.`,
        });
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
      const subscription = event.data.object as Stripe.Subscription;
      const subscriptionResult = await syncSubscription(subscription.id);

      if (event.type === "customer.subscription.updated") {
        if (subscriptionResult.cancelAtPeriodEnd) {
          await createBillingNotification({
            userId: subscriptionResult.userId,
            title: "Subscription cancellation scheduled",
            message:
              "Your subscription is set to cancel at the end of your current billing period.",
            type: "subscription_cancel_scheduled",
            href: "/billing",
          });

          await sendBillingEmail({
            userId: subscriptionResult.userId,
            subject: "Travel Markets subscription cancellation scheduled",
            heading: "Cancellation scheduled",
            body:
              "Your subscription is set to cancel at the end of your current billing period. You will keep your plan benefits until then.",
          });
        } else if (subscriptionResult.active) {
          await createBillingNotification({
            userId: subscriptionResult.userId,
            title: "Subscription updated",
            message: `Your Travel Markets owner plan is now ${subscriptionResult.planLabel}.`,
            type: "subscription_updated",
            href: "/billing",
          });
        }
      }
    }

    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as Stripe.Subscription;
      await handleSubscriptionDeleted(subscription);
    }

    if (event.type === "invoice.payment_succeeded") {
      const invoice = event.data.object as StripeInvoiceWithSubscription;
      await handleInvoicePaymentSucceeded(invoice);
    }

    if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object as StripeInvoiceWithSubscription;
      await handleInvoicePaymentFailed(invoice);
    }

    return NextResponse.json({ received: true });
  } catch (error: unknown) {
    console.error("STRIPE WEBHOOK ERROR:", error);
    const message = error instanceof Error ? error.message : "Webhook failed";

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
