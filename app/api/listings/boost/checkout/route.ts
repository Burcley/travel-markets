import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import {
  getBoostOption,
  getBoostPriceId,
  isBoostOptionSlug,
} from "@/lib/boosts/config";
import { createClient } from "@/lib/supabase/server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

function appUrl(request: NextRequest) {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    request.headers.get("origin") ||
    "https://travel-markets.vercel.app"
  ).replace(/\/$/, "");
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const listingId = String(body?.listingId || "");
    const optionSlug = body?.option || body?.slug || body?.boostOption;

    if (!listingId) {
      return NextResponse.json({ error: "Missing listing ID." }, { status: 400 });
    }

    if (!isBoostOptionSlug(optionSlug)) {
      return NextResponse.json(
        { error: "Choose a valid boost option." },
        { status: 400 }
      );
    }

    const option = getBoostOption(optionSlug);

    if (!option) {
      return NextResponse.json({ error: "Invalid boost option." }, { status: 400 });
    }

    const { data: listing, error } = await supabase
      .from("listings")
      .select("id, title, user_id, status, boost_until")
      .eq("id", listingId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!listing) {
      return NextResponse.json({ error: "Listing not found." }, { status: 404 });
    }

    if (listing.user_id !== user.id) {
      return NextResponse.json(
        { error: "You can only boost your own listing." },
        { status: 403 }
      );
    }

    if (!["available", "pending"].includes(String(listing.status || ""))) {
      return NextResponse.json(
        { error: "Publish this listing before boosting it." },
        { status: 400 }
      );
    }

    if (listing.boost_until && new Date(listing.boost_until).getTime() > Date.now()) {
      return NextResponse.json(
        { error: "This listing already has an active boost." },
        { status: 409 }
      );
    }

    const priceId = getBoostPriceId(option.slug);
    const lineItem: Stripe.Checkout.SessionCreateParams.LineItem = priceId
      ? {
          price: priceId,
          quantity: 1,
        }
      : {
          quantity: 1,
          price_data: {
            currency: "cad",
            unit_amount: option.fallbackAmountCents,
            product_data: {
              name: option.name,
              description: `Feature "${listing.title || "Listing"}" for ${
                option.durationDays
              } days.`,
            },
          },
        };

    const baseUrl = appUrl(request);
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: user.email || undefined,
      line_items: [lineItem],
      metadata: {
        type: "listing_boost",
        listing_id: listing.id,
        user_id: user.id,
        boost_option: option.slug,
        boost_source: option.source,
        boost_days: String(option.durationDays),
      },
      success_url: `${baseUrl}/dashboard/boosts?boost=checkout_success`,
      cancel_url: `${baseUrl}/dashboard/boosts?boost=checkout_cancelled`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to create boost checkout";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
