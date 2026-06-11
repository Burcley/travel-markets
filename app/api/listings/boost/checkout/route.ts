import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

const BOOST_OPTIONS: Record<
  string,
  { days: number; amount: number; name: string; rank: number }
> = {
  "1": {
    days: 1,
    amount: 299,
    name: "1-Day Featured Boost",
    rank: 100,
  },
  "7": {
    days: 7,
    amount: 999,
    name: "7-Day Featured Boost",
    rank: 200,
  },
  "30": {
    days: 30,
    amount: 2499,
    name: "30-Day Featured Boost",
    rank: 300,
  },
};

export async function POST(request: NextRequest) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json(
        { error: "Missing STRIPE_SECRET_KEY environment variable" },
        { status: 500 }
      );
    }

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

    const body = await request.json().catch(() => null);
    const listingId = body?.listingId as string | undefined;
    const boostDays = String(body?.days || "7");

    if (!listingId) {
      return NextResponse.json(
        { error: "Missing listingId" },
        { status: 400 }
      );
    }

    const boost = BOOST_OPTIONS[boostDays];

    if (!boost) {
      return NextResponse.json(
        { error: "Invalid boost option" },
        { status: 400 }
      );
    }

    const { data: listing, error: listingError } = await supabase
      .from("listings")
      .select("id, title, user_id")
      .eq("id", listingId)
      .maybeSingle();

    if (listingError) {
      console.error("BOOST LISTING SELECT ERROR:", listingError);

      return NextResponse.json(
        { error: listingError.message },
        { status: 500 }
      );
    }

    if (!listing) {
      return NextResponse.json(
        { error: "Listing not found" },
        { status: 404 }
      );
    }

    if (listing.user_id !== user.id) {
      return NextResponse.json(
        { error: "You can only boost your own listing." },
        { status: 403 }
      );
    }

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: user.email || undefined,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "cad",
            unit_amount: boost.amount,
            product_data: {
              name: boost.name,
              description: `Feature "${listing.title || "Listing"}" for ${
                boost.days
              } day${boost.days === 1 ? "" : "s"} on Travel Markets.`,
            },
          },
        },
      ],
      metadata: {
        type: "listing_boost",
        listing_id: listing.id,
        user_id: user.id,
        boost_days: String(boost.days),
        boost_rank: String(boost.rank),
      },
      success_url: `${appUrl}/my-listings?boost=success`,
      cancel_url: `${appUrl}/my-listings?boost=cancelled`,
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Stripe checkout URL missing." },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error("BOOST CHECKOUT ERROR:", error);

    return NextResponse.json(
      { error: error?.message || "Failed to create boost checkout" },
      { status: 500 }
    );
  }
}