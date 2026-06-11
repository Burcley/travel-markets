export type OwnerPlan = "free" | "pro" | "premium";

export const OWNER_PLANS = {
  free: {
    name: "Free",
    price: "$0",
    priceId: null,
    listingLimit: 1,
    featuredBoosts: 0,
    priorityRank: 0,
    features: [
      "1 active listing",
      "Basic search visibility",
      "Messaging",
      "Viewing requests",
    ],
  },
  pro: {
    name: "Pro",
    price: "$9.99/month",
    priceId: process.env.STRIPE_PRO_PRICE_ID!,
    listingLimit: 5,
    featuredBoosts: 2,
    priorityRank: 10,
    features: [
      "Up to 5 active listings",
      "Higher search ranking",
      "2 featured boosts/month",
      "Saved search visibility",
      "Owner dashboard insights",
    ],
  },
  premium: {
    name: "Premium",
    price: "$29.99/month",
    priceId: process.env.STRIPE_PREMIUM_PRICE_ID!,
    listingLimit: 25,
    featuredBoosts: 10,
    priorityRank: 30,
    features: [
      "Up to 25 active listings",
      "Maximum search ranking",
      "10 featured boosts/month",
      "Premium owner badge",
      "Priority homepage placement",
      "Advanced analytics",
    ],
  },
} as const;

export function planFromPriceId(priceId?: string | null): OwnerPlan {
  if (!priceId) return "free";

  if (priceId === process.env.STRIPE_PRO_PRICE_ID) return "pro";
  if (priceId === process.env.STRIPE_PREMIUM_PRICE_ID) return "premium";

  return "free";
}