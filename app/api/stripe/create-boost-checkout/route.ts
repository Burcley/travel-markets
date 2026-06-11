import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2025-04-30.basil",
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!process.env.STRIPE_SECRET_KEY?.startsWith("sk_test_")) {
      return NextResponse.json(
        { error: "Invalid STRIPE_SECRET_KEY in .env.local" },
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

    const { data: listing, error } = await supabase
      .from("listings")
      .select("id, user_id, title")
      .eq("id", listingId)
      .maybeSingle();

    if (error) throw error;

    if (!listing) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    if (listing.user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

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
        listing_id: listing.id,
        user_id: user.id,
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