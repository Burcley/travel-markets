export type OwnerPlan = "free" | "premium" | "elite" | "legacy_premium";
export type CheckoutOwnerPlan = "premium" | "elite";
export type AnalyticsLevel = "basic" | "listing" | "portfolio";
export type OwnerBadge = "premium" | "elite" | null;

export type OwnerPlanEntitlements = {
  slug: OwnerPlan;
  displayName: string;
  publicName: string;
  tagline: string;
  price: string;
  priceCents: number;
  priceId: string | null;
  activeListingLimit: number | null;
  monthlyBoosts: number;
  searchWeight: number;
  badge: OwnerBadge;
  analyticsLevel: AnalyticsLevel;
  prioritySupport: boolean;
  homepageEligible: boolean;
  featuredOwnerProfile: boolean;
  features: string[];
  cta: string;
  cardBadge?: string;
};

function envPrice(...keys: string[]) {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }

  return null;
}

const premiumPriceId = envPrice(
  "NEXT_PUBLIC_STRIPE_PREMIUM_PRICE_ID",
  "STRIPE_PREMIUM_PRICE_ID"
);
const elitePriceId = envPrice(
  "NEXT_PUBLIC_STRIPE_ELITE_PRICE_ID",
  "STRIPE_ELITE_PRICE_ID"
);
const legacyPremiumPriceId = envPrice("STRIPE_LEGACY_PREMIUM_PRICE_ID");

export const OWNER_PLAN_ENTITLEMENTS: Record<OwnerPlan, OwnerPlanEntitlements> = {
  free: {
    slug: "free",
    displayName: "Free",
    publicName: "Free",
    tagline: "Perfect for your first property",
    price: "$0",
    priceCents: 0,
    priceId: null,
    activeListingLimit: 1,
    monthlyBoosts: 0,
    searchWeight: 0,
    badge: null,
    analyticsLevel: "basic",
    prioritySupport: false,
    homepageEligible: false,
    featuredOwnerProfile: false,
    cta: "Your current plan",
    features: [
      "List 1 active property",
      "Receive student inquiries",
      "Message interested students",
      "Accept viewing requests",
      "Build your landlord profile",
    ],
  },
  premium: {
    slug: "premium",
    displayName: "Premium",
    publicName: "Premium",
    tagline: "Get more inquiries and fill vacancies faster",
    price: "$19.99/month",
    priceCents: 1999,
    priceId: premiumPriceId,
    activeListingLimit: 5,
    monthlyBoosts: 2,
    searchWeight: 1,
    badge: "premium",
    analyticsLevel: "listing",
    prioritySupport: true,
    homepageEligible: false,
    featuredOwnerProfile: false,
    cta: "Increase My Visibility",
    cardBadge: "Most Popular",
    features: [
      "List up to 5 active properties",
      "Appear ahead of Free listings",
      "2 featured boosts every month",
      "Premium landlord badge",
      "See how students engage with your listings",
      "Priority support",
    ],
  },
  elite: {
    slug: "elite",
    displayName: "Elite",
    publicName: "Elite",
    tagline: "Scale your student rental portfolio",
    price: "$49.99/month",
    priceCents: 4999,
    priceId: elitePriceId,
    activeListingLimit: null,
    monthlyBoosts: 10,
    searchWeight: 2,
    badge: "elite",
    analyticsLevel: "portfolio",
    prioritySupport: true,
    homepageEligible: true,
    featuredOwnerProfile: true,
    cta: "Grow My Portfolio",
    cardBadge: "For Property Managers",
    features: [
      "Unlimited active properties",
      "Highest search priority",
      "10 featured boosts every month",
      "Elite landlord badge",
      "Homepage feature eligibility",
      "Portfolio-wide analytics",
      "Priority support",
    ],
  },
  legacy_premium: {
    slug: "legacy_premium",
    displayName: "Elite",
    publicName: "Elite",
    tagline: "Grandfathered Elite-level access",
    price: "$29.99/month legacy",
    priceCents: 2999,
    priceId: null,
    activeListingLimit: null,
    monthlyBoosts: 10,
    searchWeight: 2,
    badge: "elite",
    analyticsLevel: "portfolio",
    prioritySupport: true,
    homepageEligible: true,
    featuredOwnerProfile: true,
    cta: "Manage billing",
    cardBadge: "Grandfathered",
    features: [
      "Unlimited active properties",
      "Highest search priority",
      "10 featured boosts every month",
      "Elite landlord badge",
      "Homepage feature eligibility",
      "Portfolio-wide analytics",
      "Priority support",
    ],
  },
} as const;

// Backwards-compatible export for existing components.
export const OWNER_PLANS = OWNER_PLAN_ENTITLEMENTS;

export const CHECKOUT_OWNER_PLANS: CheckoutOwnerPlan[] = ["premium", "elite"];

export function normalizeOwnerPlan(value?: string | null): OwnerPlan {
  if (value === "pro") return "premium";
  if (value === "premium" || value === "elite" || value === "legacy_premium") {
    return value;
  }

  return "free";
}

export function getPlanEntitlements(plan?: string | null) {
  return OWNER_PLAN_ENTITLEMENTS[normalizeOwnerPlan(plan)];
}

export function getPublicPlan(plan?: string | null): Exclude<OwnerPlan, "legacy_premium"> {
  const normalized = normalizeOwnerPlan(plan);
  return normalized === "legacy_premium" ? "elite" : normalized;
}

export function getOwnerPlanLabel(plan?: string | null) {
  return getPlanEntitlements(plan).displayName;
}

export function getOwnerBadgeLabel(plan?: string | null) {
  const badge = getPlanEntitlements(plan).badge;

  if (badge === "premium") return "Premium Landlord";
  if (badge === "elite") return "Elite Property Manager";

  return null;
}

export function isCheckoutOwnerPlan(value: unknown): value is CheckoutOwnerPlan {
  return value === "premium" || value === "elite";
}

export function getStripePriceIdForPlan(plan: CheckoutOwnerPlan) {
  return OWNER_PLAN_ENTITLEMENTS[plan].priceId;
}

export function planFromPriceId(priceId?: string | null): OwnerPlan {
  if (!priceId) return "free";

  if (priceId === premiumPriceId) return "premium";
  if (priceId === elitePriceId) return "elite";

  // Legacy Stripe price mapping. Keep this until old subscribers have been
  // migrated in Stripe: old Pro gets Premium entitlements, old Premium gets
  // Elite-level grandfathered entitlements without changing their charge.
  if (priceId === process.env.STRIPE_PRO_PRICE_ID) return "premium";
  if (priceId === process.env.STRIPE_LEGACY_PRO_PRICE_ID) return "premium";
  if (
    priceId === legacyPremiumPriceId ||
    (priceId === process.env.STRIPE_PREMIUM_PRICE_ID && priceId !== premiumPriceId)
  ) {
    return "legacy_premium";
  }

  return "free";
}

export function subscriptionStatusHasPaidAccess(
  status?: string | null,
  currentPeriodEnd?: string | null
) {
  if (status !== "active" && status !== "trialing") return false;

  if (!currentPeriodEnd) return true;

  return new Date(currentPeriodEnd).getTime() > Date.now();
}
