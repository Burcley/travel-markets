import {
  CHECKOUT_OWNER_PLANS,
  OWNER_PLAN_ENTITLEMENTS,
  type CheckoutOwnerPlan,
} from "@/lib/subscriptions/plans";

export type FoundingPricingRow = {
  plan: CheckoutOwnerPlan;
  planName: string;
  regularPriceCents: number;
  foundingPriceCents: number;
  savingsCents: number;
  billingFrequency: "month";
  discountPercentage: number;
};

export function formatCurrencyFromCents(cents: number) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
  }).format(cents / 100);
}

export function getFoundingPricingRows(discountPercentage?: number | null) {
  const normalizedDiscount = Math.min(
    100,
    Math.max(0, Math.round(Number(discountPercentage ?? 25)))
  );
  const multiplier = (100 - normalizedDiscount) / 100;

  return CHECKOUT_OWNER_PLANS.map((plan): FoundingPricingRow => {
    const entitlement = OWNER_PLAN_ENTITLEMENTS[plan];
    const foundingPriceCents = Math.round(entitlement.priceCents * multiplier);

    return {
      plan,
      planName: entitlement.publicName,
      regularPriceCents: entitlement.priceCents,
      foundingPriceCents,
      savingsCents: entitlement.priceCents - foundingPriceCents,
      billingFrequency: "month",
      discountPercentage: normalizedDiscount,
    };
  });
}
