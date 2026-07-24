import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  getStripePriceIdForPlan,
  isCheckoutOwnerPlan,
  type CheckoutOwnerPlan,
} from "@/lib/subscriptions/plans";
import {
  ensureFoundingStripeCoupon,
  getFoundingStripeBenefit,
} from "@/lib/founding-landlords/stripe";

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
    const plan = body?.plan as CheckoutOwnerPlan | undefined;

    if (!isCheckoutOwnerPlan(plan)) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    const selectedPriceId = getStripePriceIdForPlan(plan);

    if (!selectedPriceId) {
      return NextResponse.json(
        { error: `Missing Stripe price ID for ${plan}` },
        { status: 400 }
      );
    }

    if (!selectedPriceId.startsWith("price_")) {
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

    const admin = createAdminClient();

    const { data: profile } = await admin
      .from("profiles")
      .select("role, is_admin, account_status")
      .eq("id", user.id)
      .maybeSingle();

    const role = String(profile?.role || "").toLowerCase();
    const isOwner =
      profile?.is_admin || ["owner", "landlord", "host", "admin"].includes(role);

    if (!isOwner || role === "student") {
      return NextResponse.json(
        { error: "Only landlord accounts can purchase owner plans." },
        { status: 403 }
      );
    }

    if (["banned", "suspended", "disabled"].includes(String(profile?.account_status || "").toLowerCase())) {
      return NextResponse.json(
        { error: "This account cannot start a subscription." },
        { status: 403 }
      );
    }

    const { data: existingSub, error: subError } = await admin
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

      const { error: upsertError } = await admin
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

    const foundingBenefit = await getFoundingStripeBenefit(user.id);
    const foundingCouponId = foundingBenefit.eligible
      ? await ensureFoundingStripeCoupon({
          stripe,
          benefit: foundingBenefit,
        })
      : null;

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: "subscription",
      customer: customerId,
      line_items: [
        {
          price: selectedPriceId,
          quantity: 1,
        },
      ],
      success_url: `${appUrl}/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/billing?canceled=true`,
      metadata: {
        user_id: user.id,
        plan,
        founding_landlord_benefit: foundingBenefit.eligible
          ? foundingBenefit.phase
          : "none",
        founding_landlord_coupon_id: foundingCouponId || "",
      },
      subscription_data: {
        metadata: {
          user_id: user.id,
          plan,
          founding_landlord_benefit: foundingBenefit.eligible
            ? foundingBenefit.phase
            : "none",
          founding_landlord_coupon_id: foundingCouponId || "",
        },
      },
      ...(foundingCouponId
        ? {
            discounts: [
              {
                coupon: foundingCouponId,
              },
            ],
          }
        : {}),
    };

    const session = await stripe.checkout.sessions.create(sessionParams);

    if (!session.url) {
      return NextResponse.json(
        { error: "Stripe did not return a checkout URL." },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (error: unknown) {
    console.error("SUBSCRIPTION CHECKOUT ERROR:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error && error.message
            ? error.message
            :
          "Failed to create subscription checkout. Check terminal logs.",
      },
      { status: 500 }
    );
  }
}
