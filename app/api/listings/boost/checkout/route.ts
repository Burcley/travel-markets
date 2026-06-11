import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2025-04-30.basil",
});

const BOOST_OPTIONS: Record<string, { days: number; amount: number; name: string }> = {
  "1": { days: 1, amount: 499, name: "1 Day Boost" },
  "7": { days: 7, amount: 1999, name: "7 Day Boost" },
  "30": { days: 30, amount: 4999, name: "30 Day Boost" },
};

export async function POST(request: NextRequest) {
  try {
    const { listingId, days } = await request.json();

    const option = BOOST_OPTIONS[String(days)];

    if (!listingId || !option) {
      return NextResponse.json({ error: "Invalid boost option" }, { status: 400 });
    }

    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: listing } = await supabase
      .from("listings")
      .select("id, title, user_id")
      .eq("id", listingId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!listing) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Travel Markets ${option.name}`,
              description: `Boost "${listing.title}" for ${option.days} day(s).`,
            },
            unit_amount: option.amount,
          },
          quantity: 1,
        },
      ],
      success_url: `${appUrl}/my-listings?boost=success`,
      cancel_url: `${appUrl}/my-listings?boost=canceled`,
      metadata: {
        type: "listing_boost",
        listing_id: listing.id,
        user_id: user.id,
        boost_days: String(option.days),
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error("BOOST CHECKOUT ERROR:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to create boost checkout" },
      { status: 500 }
    );
  }
}