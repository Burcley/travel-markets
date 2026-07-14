export type BoostOptionSlug = "boost_7_day" | "boost_14_day" | "boost_30_day";
export type BoostSource =
  | "included"
  | "purchased_7_day"
  | "purchased_14_day"
  | "purchased_30_day"
  | "legacy";

export const INCLUDED_BOOST_DURATION_DAYS = 7;

export const PURCHASED_BOOST_OPTIONS: Record<
  BoostOptionSlug,
  {
    slug: BoostOptionSlug;
    source: Exclude<BoostSource, "included" | "legacy">;
    durationDays: number;
    name: string;
    priceLabel: string;
    fallbackAmountCents: number;
    priceEnvKey: string;
  }
> = {
  boost_7_day: {
    slug: "boost_7_day",
    source: "purchased_7_day",
    durationDays: 7,
    name: "7-Day Featured Boost",
    priceLabel: "$9.99 CAD",
    fallbackAmountCents: 999,
    priceEnvKey: "STRIPE_BOOST_7_DAY_PRICE_ID",
  },
  boost_14_day: {
    slug: "boost_14_day",
    source: "purchased_14_day",
    durationDays: 14,
    name: "14-Day Featured Boost",
    priceLabel: "$16.99 CAD",
    fallbackAmountCents: 1699,
    priceEnvKey: "STRIPE_BOOST_14_DAY_PRICE_ID",
  },
  boost_30_day: {
    slug: "boost_30_day",
    source: "purchased_30_day",
    durationDays: 30,
    name: "30-Day Featured Boost",
    priceLabel: "$24.99 CAD",
    fallbackAmountCents: 2499,
    priceEnvKey: "STRIPE_BOOST_30_DAY_PRICE_ID",
  },
};

export function isBoostOptionSlug(value: unknown): value is BoostOptionSlug {
  return (
    value === "boost_7_day" ||
    value === "boost_14_day" ||
    value === "boost_30_day"
  );
}

export function getBoostOption(value: unknown) {
  if (!isBoostOptionSlug(value)) return null;
  return PURCHASED_BOOST_OPTIONS[value];
}

export function getBoostPriceId(option: BoostOptionSlug) {
  return process.env[PURCHASED_BOOST_OPTIONS[option].priceEnvKey]?.trim() || null;
}

export function boostRankForDuration(days: number) {
  if (days >= 30) return 300;
  if (days >= 14) return 240;
  return 200;
}

export function sourceLabel(source?: string | null) {
  if (source === "included") return "Included monthly boost";
  if (source === "purchased_14_day") return "Purchased 14-day boost";
  if (source === "purchased_30_day") return "Purchased 30-day boost";
  if (source === "purchased_7_day") return "Purchased 7-day boost";
  return "Boost";
}
