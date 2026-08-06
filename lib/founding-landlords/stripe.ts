import Stripe from "stripe";
import { getFoundingCouponAction } from "@/lib/founding-landlords/entitlements";
import { createAdminClient } from "@/lib/supabase/admin";

export type FoundingStripeBenefit =
  | {
      eligible: false;
      reason: string;
    }
  | {
      eligible: true;
      phase: "free_fee_period" | "lifetime_discount";
      couponId: string;
      percentOff: 100 | 25;
      freeFeePeriodEndsAt: string | null;
      discountPercentage: number;
    };

type FoundingStripeProfile = {
  id: string;
  founding_status: string | null;
  is_founding_landlord: boolean | null;
  founding_benefits_started_at: string | null;
  founding_free_fee_period_ends_at: string | null;
  founding_discount_percentage: number | null;
  founding_benefits_disabled: boolean | null;
};

const FOUNDER_FREE_FEE_COUPON_ID =
  "tm_founding_landlord_100_12m";

const FOUNDER_LIFETIME_COUPON_ID =
  "tm_founding_landlord_25_lifetime";

export const FOUNDER_COUPON_IDS = [
  FOUNDER_FREE_FEE_COUPON_ID,
  FOUNDER_LIFETIME_COUPON_ID,
];

export async function getFoundingStripeBenefit(
  userId: string
): Promise<FoundingStripeBenefit> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select(
      "id, founding_status, is_founding_landlord, founding_benefits_started_at, founding_free_fee_period_ends_at, founding_discount_percentage, founding_benefits_disabled"
    )
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("FOUNDING STRIPE PROFILE ERROR:", error);
    return { eligible: false, reason: "PROFILE_READ_FAILED" };
  }

  const profile = data as FoundingStripeProfile | null;

  if (
    !profile ||
    profile.founding_status !== "confirmed" ||
    !profile.is_founding_landlord ||
    profile.founding_benefits_disabled
  ) {
    return { eligible: false, reason: "NOT_CONFIRMED_FOUNDER" };
  }

  const freeFeeEndsAt = profile.founding_free_fee_period_ends_at;
  const freeFeeStillActive = freeFeeEndsAt
    ? new Date(freeFeeEndsAt).getTime() > Date.now()
    : false;

  if (freeFeeStillActive) {
    return {
      eligible: true,
      phase: "free_fee_period",
      couponId: FOUNDER_FREE_FEE_COUPON_ID,
      percentOff: 100,
      freeFeePeriodEndsAt: freeFeeEndsAt,
      discountPercentage: profile.founding_discount_percentage || 25,
    };
  }

  return {
    eligible: true,
    phase: "lifetime_discount",
    couponId: FOUNDER_LIFETIME_COUPON_ID,
    percentOff: 25,
    freeFeePeriodEndsAt: freeFeeEndsAt,
    discountPercentage: profile.founding_discount_percentage || 25,
  };
}

export async function ensureFoundingStripeCoupon({
  stripe,
  benefit,
}: {
  stripe: Stripe;
  benefit: Extract<FoundingStripeBenefit, { eligible: true }>;
}) {
  try {
    const existing = await stripe.coupons.retrieve(benefit.couponId);
    if (!existing.deleted) return existing.id;
  } catch (error) {
    const stripeError = error as { statusCode?: number; code?: string };
    if (stripeError.statusCode !== 404 && stripeError.code !== "resource_missing") {
      throw error;
    }
  }

  const coupon =
    benefit.phase === "free_fee_period"
      ? await stripe.coupons.create({
          id: benefit.couponId,
          name: "TM Founder 12-month fee waiver",
          percent_off: 100,
          duration: "repeating",
          duration_in_months: 12,
          metadata: {
            travel_markets_benefit: "founding_landlord",
            phase: "free_fee_period",
          },
        })
      : await stripe.coupons.create({
          id: benefit.couponId,
          name: "TM Founder lifetime 25% discount",
          percent_off: 25,
          duration: "forever",
          metadata: {
            travel_markets_benefit: "founding_landlord",
            phase: "lifetime_discount",
          },
        });

  return coupon.id;
}

function getSubscriptionDiscountCouponIds(subscription: Stripe.Subscription) {
  type DiscountWithCoupon = {
    coupon?: {
      id?: string | null;
    } | null;
  };
  const subscriptionWithDiscounts = subscription as unknown as {
    discount?: DiscountWithCoupon | null;
    discounts?: Array<string | DiscountWithCoupon> | null;
  };
  const discounts = subscriptionWithDiscounts.discounts || [];
  const couponIds = discounts
    .map((discount) => {
      if (typeof discount === "string") return null;
      return discount.coupon?.id || null;
    })
    .filter((id): id is string => Boolean(id));

  if (subscriptionWithDiscounts.discount?.coupon?.id) {
    couponIds.push(subscriptionWithDiscounts.discount.coupon.id);
  }

  return Array.from(new Set(couponIds));
}

export function hasNonFounderDiscount(subscription: Stripe.Subscription) {
  return getSubscriptionDiscountCouponIds(subscription).some(
    (couponId) => !FOUNDER_COUPON_IDS.includes(couponId)
  );
}

export async function applyFoundingDiscountToSubscription({
  stripe,
  subscription,
  userId,
}: {
  stripe: Stripe;
  subscription: Stripe.Subscription;
  userId: string;
}) {
  const benefit = await getFoundingStripeBenefit(userId);

  if (!benefit.eligible) return { applied: false, benefit };

  const couponId = await ensureFoundingStripeCoupon({ stripe, benefit });
  const existingCouponIds = getSubscriptionDiscountCouponIds(subscription);
  const couponAction = getFoundingCouponAction({
    targetCouponId: couponId,
    existingCouponIds,
  });

  if (!couponAction.shouldApply) {
    return { applied: false, benefit };
  }

  await stripe.subscriptions.update(subscription.id, {
    discounts: [{ coupon: couponId }],
    metadata: {
      ...subscription.metadata,
      founding_landlord_benefit: benefit.phase,
      founding_landlord_coupon_id: couponId,
    },
  } as Stripe.SubscriptionUpdateParams);

  const admin = createAdminClient();
  await admin.from("founding_landlord_benefit_events").insert({
    owner_id: userId,
    event_type: "stripe_discount_applied",
    metadata: {
      subscriptionId: subscription.id,
      couponId,
      phase: benefit.phase,
      percentOff: benefit.percentOff,
    },
  });

  return { applied: true, benefit };
}
