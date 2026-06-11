import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import { OWNER_PLANS, OwnerPlan } from "@/lib/subscriptions/plans";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

function getAppUrl(request: NextRequest) {
  const envUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.VERCEL_URL;

  if (envUrl) {
    const cleanUrl = envUrl.startsWith("http")
      ? envUrl
      : `https://${envUrl}`;

    if (!cleanUrl.includes("localhost")) {
      return cleanUrl.replace(/\/$/, "");
    }
  }

  const origin = request.headers.get("origin");

  if (origin && !origin.includes("localhost")) {
    return origin.replace(/\/$/, "");
  }

  const host = request.headers.get("host");

  if (host && !host.includes("localhost")) {
    return `https://${host}`;
  }

  return "https://travel-markets.vercel.app";
}

export async function POST(request: NextRequest) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json(
        { error: "Missing STRIPE_SECRET_KEY environment variable" },
        { status: 500 }
      );
    }

    const body = await request.json().catch(() => null);
    const plan = body?.plan as OwnerPlan | undefined;

    if (!plan || !["pro", "premium"].includes(plan)) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    const selectedPlan = OWNER_PLANS[plan];

    if (!selectedPlan?.priceId) {
      return NextResponse.json(
        { error: `Missing Stripe price ID for ${plan}` },
        { status: 400 }
      );
    }

    if (!selectedPlan.priceId.startsWith("price_")) {
      return NextResponse.json(
        {
          error: `Invalid Stripe Price ID for ${plan}. It must start with price_, not prod_.`,
        },
        { status: 400 }
      );
    }

    const appUrl = getAppUrl(request);
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Unauthorized. Please log in again." },
        { status: 401 }
      );
    }

    const { data: existingSub, error: subError } = await supabase
      .from("owner_subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (subError) {
      console.error("OWNER SUBSCRIPTION SELECT ERROR:", subError);

      return NextResponse.json(
        {
          error:
            "Could not read owner_subscriptions table. Make sure the Supabase SQL was created.",
        },
        { status: 500 }
      );
    }

    let customerId = existingSub?.stripe_customer_id || null;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email || undefined,
        metadata: {
          user_id: user.id,
        },
      });

      customerId = customer.id;

      const { error: upsertError } = await supabase
        .from("owner_subscriptions")
        .upsert(
          {
            user_id: user.id,
            plan: existingSub?.plan || "free",
            status: existingSub?.status || "inactive",
            stripe_customer_id: customerId,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );

      if (upsertError) {
        console.error("OWNER SUBSCRIPTION UPSERT ERROR:", upsertError);

        return NextResponse.json(
          {
            error:
              upsertError.message ||
              "Could not create owner subscription record.",
          },
          { status: 500 }
        );
      }
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [
        {
          price: selectedPlan.priceId,
          quantity: 1,
        },
      ],
      success_url: `${appUrl}/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/billing?canceled=true`,
      metadata: {
        user_id: user.id,
        plan,
      },
      subscription_data: {
        metadata: {
          user_id: user.id,
          plan,
        },
      },
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Stripe did not return a checkout URL." },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error("SUBSCRIPTION CHECKOUT ERROR:", error);

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Failed to create subscription checkout. Check terminal logs.",
      },
      { status: 500 }
    );
  }
}