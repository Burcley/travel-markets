export const SUPPORTED_CURRENCIES = [
  "CAD", "USD", "EUR", "GBP", "AUD", "NZD", "CHF",
  "AED", "SAR", "QAR", "INR", "PKR", "BDT",
  "NGN", "GHS", "KES", "ZAR", "JPY", "CNY",
  "HKD", "SGD", "MXN", "BRL",
] as const;

export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number];

export function formatMoney(amount: number, currency: CurrencyCode, locale = "en-CA") {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "JPY" ? 0 : 2,
  }).format(amount);
}