import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

export async function POST() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: subscription, error: subscriptionError } = await supabase
      .from("owner_subscriptions")
      .select("stripe_customer_id")
      .eq("owner_id", user.id)
      .maybeSingle();

    if (subscriptionError) {
      return NextResponse.json(
        { error: subscriptionError.message },
        { status: 500 }
      );
    }

    if (!subscription?.stripe_customer_id) {
      return NextResponse.json(
        { error: "No Stripe customer found for this account." },
        { status: 404 }
      );
    }

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      "http://localhost:3000";

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: `${appUrl}/billing`,
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (error: any) {
    console.error("BILLING PORTAL ERROR:", error);

    return NextResponse.json(
      { error: error?.message || "Failed to open billing portal" },
      { status: 500 }
    );
  }
}