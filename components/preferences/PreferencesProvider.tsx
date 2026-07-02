"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type Language = "en" | "fr";
type StoredLanguage = Language | "en-CA" | "fr-CA";

export type Currency =
  | "CAD"
  | "USD"
  | "EUR"
  | "GBP"
  | "NGN"
  | "AUD"
  | "NZD"
  | "INR"
  | "CNY"
  | "JPY"
  | "AED"
  | "ZAR"
  | "GHS"
  | "KES"
  | "CHF"
  | "MXN"
  | "BRL"
  | "PHP"
  | "SGD"
  | "HKD"
  | "SAR"
  | "QAR"
  | "PKR"
  | "BDT";

type PreferencesContextType = {
  language: Language;
  currency: Currency;
  rates: Record<string, number>;
  isRatesLoading: boolean;
  setLanguage: (language: Language) => void;
  setCurrency: (currency: Currency) => void;
  convertFromCAD: (amountCAD: number) => number;
};

const PreferencesContext = createContext<PreferencesContextType | null>(null);

const validLanguages: Language[] = ["en", "fr"];

const validCurrencies: Currency[] = [
  "CAD",
  "USD",
  "EUR",
  "GBP",
  "NGN",
  "AUD",
  "NZD",
  "INR",
  "CNY",
  "JPY",
  "AED",
  "ZAR",
  "GHS",
  "KES",
  "CHF",
  "MXN",
  "BRL",
  "PHP",
  "SGD",
  "HKD",
  "SAR",
  "QAR",
  "PKR",
  "BDT",
];

export function PreferencesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [language, setLanguageState] = useState<Language>("en");
  const [currency, setCurrencyState] = useState<Currency>("CAD");
  const [rates, setRates] = useState<Record<string, number>>({ CAD: 1 });
  const [isRatesLoading, setIsRatesLoading] = useState(true);

  function normalizeLanguage(language: StoredLanguage): Language {
    if (language === "fr-CA") return "fr";
    if (language === "en-CA") return "en";
    return language;
  }

  useEffect(() => {
    const savedLanguage = document.cookie
      .split("; ")
      .find((item) => item.startsWith("NEXT_LOCALE="))
      ?.split("=")[1] as StoredLanguage | undefined;
    const savedCurrency = localStorage.getItem("tm-currency") as Currency | null;

    if (savedLanguage) {
      const normalizedLanguage = normalizeLanguage(savedLanguage);

      if (validLanguages.includes(normalizedLanguage)) {
        setLanguageState(normalizedLanguage);
      }
    }

    if (savedCurrency && validCurrencies.includes(savedCurrency)) {
      setCurrencyState(savedCurrency);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadRates() {
      try {
        setIsRatesLoading(true);

        const res = await fetch("/api/exchange-rates", {
          cache: "no-store",
        });

        if (!res.ok) {
          throw new Error("Failed to load exchange rates");
        }

        const data = await res.json();

        if (!cancelled && data?.rates) {
          const nextRates = validCurrencies.reduce<Record<string, number>>(
            (acc, code) => {
              const rate = code === "CAD" ? 1 : Number(data.rates[code]);

              if (Number.isFinite(rate) && rate > 0) {
                acc[code] = rate;
              }

              return acc;
            },
            { CAD: 1 }
          );

          setRates({
            CAD: 1,
            ...nextRates,
          });
        }
      } catch (error) {
        console.error("Exchange rate error:", error);

        if (!cancelled) {
          setRates({ CAD: 1 });
        }
      } finally {
        if (!cancelled) {
          setIsRatesLoading(false);
        }
      }
    }

    loadRates();

    return () => {
      cancelled = true;
    };
  }, []);

  function setLanguage(language: Language) {
    const nextLanguage = normalizeLanguage(language);

    setLanguageState(nextLanguage);
    document.cookie = `NEXT_LOCALE=${nextLanguage};path=/;max-age=31536000;samesite=lax`;
  }

  function setCurrency(currency: Currency) {
    setCurrencyState(currency);
    localStorage.setItem("tm-currency", currency);
  }

  function convertFromCAD(amountCAD: number) {
    const rate = rates[currency] ?? 1;
    return amountCAD * rate;
  }

  const value = useMemo(
    () => ({
      language,
      currency,
      rates,
      isRatesLoading,
      setLanguage,
      setCurrency,
      convertFromCAD,
    }),
    [language, currency, rates, isRatesLoading]
  );

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const context = useContext(PreferencesContext);

  if (!context) {
    throw new Error("usePreferences must be used inside PreferencesProvider");
  }

  return context;
}
