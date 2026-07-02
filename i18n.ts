import { getRequestConfig } from "next-intl/server";

export const locales = ["en", "fr", "es", "de", "pt", "zh", "hi", "ar"] as const;

export type Locale = (typeof locales)[number];

export default getRequestConfig(async ({ locale }) => {
  const safeLocale: Locale =
    locale && locales.includes(locale as Locale) ? (locale as Locale) : "en";

  return {
    locale: safeLocale,
    messages: (await import(`./messages/${safeLocale}.json`)).default,
  };
});
