import type { Currency } from "@/components/preferences/PreferencesProvider";

const ratesFromCAD: Record<Currency, number> = {
  CAD: 1,
  USD: 0.73,
  EUR: 0.68,
  GBP: 0.58,
  NGN: 1120,
  AUD: 1.1,
  NZD: 1.2,
  INR: 61,
  CNY: 5.3,
  JPY: 115,
  AED: 2.68,
  ZAR: 13.3,
  GHS: 11.1,
  KES: 94,
  CHF: 0.65,
  MXN: 13.4,
  BRL: 4.05,
  PHP: 42.7,
  SGD: 0.98,
  HKD: 5.72,
  SAR: 2.74,
  QAR: 2.66,
  PKR: 203,
  BDT: 80,
};

const currencySymbols: Record<Currency, string> = {
  CAD: "$",
  USD: "$",
  EUR: "€",
  GBP: "£",
  NGN: "₦",
  AUD: "A$",
  NZD: "NZ$",
  INR: "₹",
  CNY: "¥",
  JPY: "¥",
  AED: "د.إ",
  ZAR: "R",
  GHS: "₵",
  KES: "KSh",
  CHF: "CHF",
  MXN: "$",
  BRL: "R$",
  PHP: "₱",
  SGD: "S$",
  HKD: "HK$",
  SAR: "﷼",
  QAR: "ر.ق",
  PKR: "₨",
  BDT: "৳",
};

const zeroDecimalCurrencies: Currency[] = [
  "NGN",
  "INR",
  "CNY",
  "JPY",
  "ZAR",
  "GHS",
  "KES",
  "PHP",
];

export function convertFromCAD(priceInCAD: number, currency: Currency) {
  return priceInCAD * ratesFromCAD[currency];
}

export function formatCurrency(
  priceInCAD: number | null | undefined,
  currency: Currency
) {
  const value = convertFromCAD(Number(priceInCAD || 0), currency);

  const rounded = zeroDecimalCurrencies.includes(currency)
    ? Math.round(value)
    : Math.round(value * 100) / 100;

  return `${currencySymbols[currency]}${rounded.toLocaleString()} ${currency}`;
}
