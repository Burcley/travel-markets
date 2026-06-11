import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json(
        { error: "Missing STRIPE_SECRET_KEY environment variable" },
        { status: 500 }
      );
    }

    const body = await request.json();
    const listingId = body?.listingId;

    if (!listingId) {
      return NextResponse.json(
        { error: "Missing listingId" },
        { status: 400 }
      );
    }

    const { data: listing, error: listingError } = await supabase
      .from("listings")
      .select("id, user_id, owner_id, title")
      .eq("id", listingId)
      .maybeSingle();

    if (listingError) {
      return NextResponse.json(
        { error: listingError.message },
        { status: 500 }
      );
    }

    if (!listing) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    const listingOwnerId = listing.owner_id || listing.user_id;

    if (listingOwnerId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: user.email || undefined,
      line_items: [
        {
          price_data: {
            currency: "cad",
            product_data: {
              name: `7-Day Boost: ${listing.title || "Travel Markets Listing"}`,
              description:
                "Featured placement on Travel Markets search results.",
            },
            unit_amount: 799,
          },
          quantity: 1,
        },
      ],
      metadata: {
        type: "listing_boost",
        listing_id: listing.id,
        user_id: user.id,
        owner_id: user.id,
        boost_days: "7",
      },
      success_url: `${siteUrl}/listings/${listing.id}/boost?success=1`,
      cancel_url: `${siteUrl}/listings/${listing.id}/boost?canceled=1`,
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Stripe did not return a checkout URL" },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error("CREATE BOOST CHECKOUT ERROR:", error);

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Failed to create Stripe checkout session. Check server logs.",
      },
      { status: 500 }
    );
  }
}