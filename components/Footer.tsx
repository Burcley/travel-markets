"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Building2,
  ChevronDown,
  GraduationCap,
  Globe2,
  HelpCircle,
  Home,
  Mail,
  MapPin,
  ShieldCheck,
} from "lucide-react";
import {
  Currency,
  Language,
  usePreferences,
} from "@/components/preferences/PreferencesProvider";

const FACEBOOK_URL =
  "https://www.facebook.com/profile.php?id=61591102028180";
const X_URL = "https://x.com/travel_markets";
const INSTAGRAM_URL =
  "https://www.instagram.com/official_travelmarkets/";

const languages: { label: string; value: Language }[] = [
  { label: "English (CA)", value: "en" },
  { label: "Français (CA)", value: "fr" },
];

const currencies: { label: string; value: Currency }[] = [
  { label: "CAD", value: "CAD" },
  { label: "USD", value: "USD" },
  { label: "EUR", value: "EUR" },
  { label: "GBP", value: "GBP" },
  { label: "NGN", value: "NGN" },
  { label: "AUD", value: "AUD" },
  { label: "NZD", value: "NZD" },
  { label: "INR", value: "INR" },
  { label: "CNY", value: "CNY" },
  { label: "JPY", value: "JPY" },
  { label: "AED", value: "AED" },
  { label: "ZAR", value: "ZAR" },
  { label: "GHS", value: "GHS" },
  { label: "KES", value: "KES" },
  { label: "CHF", value: "CHF" },
  { label: "MXN", value: "MXN" },
  { label: "BRL", value: "BRL" },
  { label: "PHP", value: "PHP" },
  { label: "SGD", value: "SGD" },
  { label: "HKD", value: "HKD" },
];

const popularSearches: [string, string][] = [
  ["popularOshawa", "/search?city=Oshawa"],
  ["popularToronto", "/search?city=Toronto"],
  ["popularDurham", "/search?city=Durham"],
  ["popularCampus", "/search"],
];

const students: [string, string][] = [
  ["searchListings", "/search"],
  ["savedListings", "/saved-listings"],
  ["savedSearches", "/saved-searches"],
  ["recentlyViewed", "/recently-viewed"],
  ["messages", "/messages"],
];

const landlords: [string, string][] = [
  ["forLandlords", "/landlords"],
  ["postListing", "/post"],
  ["pricing", "/billing"],
  ["dashboard", "/dashboard"],
  ["manageListings", "/my-listings"],
];

const support: [string, string][] = [
  ["helpCentre", "/faq"],
  ["safetyCentre", "/safety"],
  ["contactSupport", "/contact"],
  ["reportIssue", "/reports"],
  ["privacyPolicy", "/privacy"],
  ["termsOfService", "/terms"],
];

const company: [string, string][] = [
  ["about", "/about"],
  ["marketplace", "/search"],
  ["landlordResources", "/landlords"],
  ["trustSafety", "/safety"],
];

type FooterTranslator = (key: string) => string;

export default function Footer() {
  const router = useRouter();
  const t = useTranslations("footer");
  const { language, currency, setLanguage, setCurrency } = usePreferences();
  const [languageOpen, setLanguageOpen] = useState(false);
  const [currencyOpen, setCurrencyOpen] = useState(false);

  const languageLabel =
    languages.find((item) => item.value === language)?.label || "English (CA)";

  function handleLanguageChange(item: {
    label: string;
    value: Language;
  }) {
    setLanguage(item.value);
    document.cookie = `NEXT_LOCALE=${item.value};path=/;max-age=31536000;samesite=lax`;
    setLanguageOpen(false);
    router.refresh();
  }

  return (
    <footer className="border-t border-white/10 bg-[#050505] text-white">
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-6 sm:p-8">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div>
              <p className="inline-flex rounded-full border border-red-500/20 bg-red-500/10 px-4 py-2 text-xs font-bold uppercase tracking-widest text-red-300">
                {t("ctaBadge")}
              </p>

              <h2 className="mt-5 max-w-2xl text-3xl font-black tracking-tight sm:text-4xl">
                {t("ctaTitle")}
              </h2>

              <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-400">
                {t("ctaText")}
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row lg:justify-end">
              <Link
                href="/search"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-black text-black transition hover:bg-zinc-200"
              >
                <Home size={18} />
                {t("findHousing")}
              </Link>

              <Link
                href="/landlords"
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] px-5 py-3 text-sm font-bold text-white transition hover:bg-white/10"
              >
                <Building2 size={18} />
                {t("listProperty")}
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-12 grid gap-10 lg:grid-cols-[1.1fr_2fr]">
          <div>
            <Link href="/" className="inline-flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-red-600 text-lg font-black text-white shadow-lg shadow-red-600/20">
                TM
              </div>

              <div>
                <p className="text-xl font-black">Travel Markets</p>
                <p className="text-xs text-zinc-500">
                  {t("marketplaceLabel")}
                </p>
              </div>
            </Link>

            <p className="mt-5 max-w-sm text-sm leading-6 text-zinc-400">
              {t("brandDescription")}
            </p>

            <div className="mt-6 grid gap-3 text-sm text-zinc-400">
              <div className="flex items-center gap-3">
                <ShieldCheck size={18} className="text-emerald-400" />
                {t("protectedAddresses")}
              </div>

              <div className="flex items-center gap-3">
                <GraduationCap size={18} className="text-red-400" />
                {t("builtForStudents")}
              </div>

              <div className="flex items-center gap-3">
                <MapPin size={18} className="text-sky-400" />
                {t("campusFocused")}
              </div>
            </div>
          </div>

          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <FooterGroup title={t("popular")} links={popularSearches} t={t} />
            <FooterGroup title={t("students")} links={students} t={t} />
            <FooterGroup title={t("landlords")} links={landlords} t={t} />
            <FooterGroup title={t("support")} links={support} t={t} />
          </div>
        </div>

        <div className="mt-10 grid gap-8 border-t border-white/10 pt-8 lg:grid-cols-[1fr_3fr]">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wide text-zinc-300">
              {t("company")}
            </h3>

            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
              {company.map(([label, href]) => (
                <Link
                  key={`${label}-${href}`}
                  href={href}
                  className="text-sm text-zinc-500 transition hover:text-white"
                >
                  {t(label)}
                </Link>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <MiniCard
              icon={<ShieldCheck size={18} />}
              title={t("trustFirst")}
              text={t("trustFirstText")}
            />

            <MiniCard
              icon={<HelpCircle size={18} />}
              title={t("supportReady")}
              text={t("supportReadyText")}
            />

            <MiniCard
              icon={<Mail size={18} />}
              title={t("stayConnected")}
              text={t("stayConnectedText")}
            />
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-6 border-t border-white/10 pt-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-zinc-500">
            <span>© {new Date().getFullYear()} Travel Markets.</span>

            <Link href="/privacy" className="transition hover:text-white">
              {t("privacy")}
            </Link>

            <span>·</span>

            <Link href="/terms" className="transition hover:text-white">
              {t("terms")}
            </Link>

            <span>·</span>

            <Link href="/safety" className="transition hover:text-white">
              {t("safety")}
            </Link>
          </div>

          <div className="flex flex-wrap items-center gap-5 text-sm font-semibold text-zinc-300">
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setLanguageOpen((current) => !current);
                  setCurrencyOpen(false);
                }}
                className="inline-flex items-center gap-2 transition hover:text-white"
              >
                <Globe2 size={18} />
                {languageLabel}
                <ChevronDown size={14} />
              </button>

              {languageOpen && (
                <div className="absolute bottom-9 left-0 z-50 max-h-72 w-52 overflow-y-auto rounded-2xl border border-white/10 bg-[#090909] p-2 shadow-2xl">
                  {languages.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => handleLanguageChange(item)}
                      className={`block w-full rounded-xl px-3 py-2 text-left text-sm transition ${
                        language === item.value
                          ? "bg-white text-black"
                          : "text-zinc-300 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setCurrencyOpen((current) => !current);
                  setLanguageOpen(false);
                }}
                className="inline-flex items-center gap-2 transition hover:text-white"
              >
                <span className="text-lg font-black">$</span>
                {currency}
                <ChevronDown size={14} />
              </button>

              {currencyOpen && (
                <div className="absolute bottom-9 left-0 z-50 max-h-72 w-36 overflow-y-auto rounded-2xl border border-white/10 bg-[#090909] p-2 shadow-2xl">
                  {currencies.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => {
                        setCurrency(item.value);
                        setCurrencyOpen(false);
                      }}
                      className={`block w-full rounded-xl px-3 py-2 text-left text-sm transition ${
                        currency === item.value
                          ? "bg-white text-black"
                          : "text-zinc-300 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="hidden h-5 w-px bg-white/10 sm:block" />

            <SocialLink href={FACEBOOK_URL} label="Facebook">
              <span className="text-lg font-black">f</span>
            </SocialLink>

            <SocialLink href={X_URL} label="X">
              <span className="text-lg font-black">𝕏</span>
            </SocialLink>

            <SocialLink href={INSTAGRAM_URL} label="Instagram">
              <InstagramSvg />
            </SocialLink>
          </div>
        </div>

        <p className="mt-5 text-xs leading-5 text-zinc-600">
          {t("legalNote")}
        </p>
      </section>
    </footer>
  );
}

function FooterGroup({
  title,
  links,
  t,
}: {
  title: string;
  links: [string, string][];
  t: FooterTranslator;
}) {
  return (
    <div>
      <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-zinc-300">
        {title}
      </h3>

      <div className="space-y-3">
        {links.map(([label, href]) => (
          <Link
            key={`${label}-${href}`}
            href={href}
            className="block text-sm text-zinc-500 transition hover:text-white"
          >
            {t(label)}
          </Link>
        ))}
      </div>
    </div>
  );
}

function MiniCard({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <div className="mb-3 inline-flex rounded-xl bg-white/10 p-2 text-red-300">
        {icon}
      </div>

      <h4 className="font-bold text-white">{title}</h4>
      <p className="mt-2 text-xs leading-5 text-zinc-500">{text}</p>
    </div>
  );
}

function SocialLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-zinc-400 transition hover:border-white/20 hover:bg-white/10 hover:text-white"
    >
      {children}
    </Link>
  );
}

function InstagramSvg() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}
