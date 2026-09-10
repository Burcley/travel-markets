"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Bell,
  Building2,
  CalendarDays,
  CheckCircle2,
  HeartHandshake,
  Loader2,
  LockKeyhole,
  MapPin,
  MessageCircle,
  Search,
  ShieldCheck,
} from "lucide-react";
import ListingCard from "@/components/ListingCard";
import Money from "@/components/Money";
import type { HomeListing } from "@/types/home-listing";
import {
  buildBrockMapUrl,
  buildBrockSearchUrl,
  BROCK_SEARCH_FILTERS,
} from "@/lib/brock/search-links";
import type { BrockAnalyticsEvent } from "@/lib/brock/analytics";

type Props = {
  listings: HomeListing[];
  totalCount: number;
  minPrice: number | null;
};

type Attribution = {
  sessionId: string;
  source: string | null;
  medium: string | null;
  campaign: string | null;
  content: string | null;
  referrer: string | null;
  landingPage: string;
};

const attributionKey = "tm_brock_attribution";

function createSessionId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `brock-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getAttribution(): Attribution {
  const fallback: Attribution = {
    sessionId: createSessionId(),
    source: null,
    medium: null,
    campaign: null,
    content: null,
    referrer: typeof document === "undefined" ? null : document.referrer || null,
    landingPage:
      typeof window === "undefined"
        ? "/brock"
        : `${window.location.pathname}${window.location.search}`,
  };

  if (typeof window === "undefined") return fallback;

  const params = new URLSearchParams(window.location.search);
  const existing = window.sessionStorage.getItem(attributionKey);
  const parsed = existing ? (JSON.parse(existing) as Partial<Attribution>) : {};
  const attribution: Attribution = {
    sessionId: parsed.sessionId || fallback.sessionId,
    source: params.get("utm_source") || parsed.source || null,
    medium: params.get("utm_medium") || parsed.medium || null,
    campaign: params.get("utm_campaign") || parsed.campaign || null,
    content: params.get("utm_content") || parsed.content || null,
    referrer: parsed.referrer || fallback.referrer,
    landingPage: parsed.landingPage || fallback.landingPage,
  };

  window.sessionStorage.setItem(attributionKey, JSON.stringify(attribution));
  return attribution;
}

function trackBrockEvent(
  event: BrockAnalyticsEvent,
  extra: { listingId?: string; metadata?: Record<string, unknown> } = {}
) {
  if (typeof window === "undefined") return;

  const attribution = getAttribution();
  const payload = JSON.stringify({
    event,
    listingId: extra.listingId,
    sessionId: attribution.sessionId,
    source: attribution.source,
    medium: attribution.medium,
    campaign: attribution.campaign,
    content: attribution.content,
    referrer: attribution.referrer,
    landingPage: attribution.landingPage,
    metadata: extra.metadata || {},
  });

  if (navigator.sendBeacon) {
    navigator.sendBeacon(
      "/api/analytics/brock",
      new Blob([payload], { type: "application/json" })
    );
    return;
  }

  fetch("/api/analytics/brock", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true,
  }).catch(() => undefined);
}

export default function BrockLandingClient({ listings, totalCount, minPrice }: Props) {
  const listingsRef = useRef<HTMLElement | null>(null);
  const [budget, setBudget] = useState("");
  const [moveIn, setMoveIn] = useState("");
  const [roomType, setRoomType] = useState("");
  const [commute, setCommute] = useState("");
  const [savingSearch, setSavingSearch] = useState(false);
  const [savedSearch, setSavedSearch] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const searchUrl = useMemo(
    () => buildBrockSearchUrl({ budget, moveIn, roomType, commute }),
    [budget, moveIn, roomType, commute]
  );
  const mapUrl = buildBrockMapUrl();
  const collageImages = listings
    .map((listing) => listing.cover_image_url || listing.image_url)
    .filter(Boolean)
    .slice(0, 3) as string[];

  useEffect(() => {
    getAttribution();
    trackBrockEvent("brock_page_view", { metadata: { listingCount: totalCount } });
  }, [totalCount]);

  useEffect(() => {
    listings.slice(0, 6).forEach((listing, index) => {
      trackBrockEvent("brock_listing_impression", {
        listingId: listing.id,
        metadata: { index },
      });
    });
  }, [listings]);

  function browseListings() {
    listingsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function startSearch() {
    trackBrockEvent("brock_search_started", {
      metadata: { budget, moveIn, roomType, commute },
    });
    trackBrockEvent("brock_search_completed", {
      metadata: { destination: searchUrl },
    });
    window.location.href = searchUrl;
  }

  async function saveBrockSearch() {
    try {
      setSavingSearch(true);
      setSaveError(null);

      const response = await fetch("/api/saved-searches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Brock University housing",
          city: BROCK_SEARCH_FILTERS.city,
          campus: BROCK_SEARCH_FILTERS.campus,
          max_price: budget ? Number(budget) : null,
          bedrooms: roomType ? Number(roomType) : null,
          alerts_enabled: true,
        }),
      });

      if (response.status === 401) {
        trackBrockEvent("brock_signup_started", {
          metadata: { intent: "save_brock_search" },
        });
        window.sessionStorage.setItem("tm_after_auth_redirect", "/brock");
        window.location.href = "/auth?next=/brock";
        return;
      }

      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Search could not be saved.");

      setSavedSearch(true);
      trackBrockEvent("brock_saved_search_created");
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : "Search could not be saved."
      );
    } finally {
      setSavingSearch(false);
    }
  }

  return (
    <main className="bg-[#050505] text-white">
      <section className="relative overflow-hidden border-b border-white/10 px-4 py-10 sm:px-6 lg:px-8 lg:py-16">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1fr_0.92fr] lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-pink-400/20 bg-pink-500/10 px-4 py-2 text-sm font-bold text-pink-100">
              <MapPin className="h-4 w-4" />
              Student housing near Brock University
            </div>
            <h1 className="mt-6 max-w-3xl text-5xl font-black leading-[0.98] tracking-tight sm:text-6xl lg:text-7xl">
              Find your place near Brock.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-300">
              Browse student rentals near Brock University, compare prices and
              commute times, and connect directly with landlords.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={browseListings}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-pink-500 px-6 py-4 font-black text-white shadow-lg shadow-pink-500/20 transition hover:bg-pink-400"
              >
                Browse available housing
                <ArrowRight className="h-5 w-5" />
              </button>
              <Link
                href={mapUrl}
                onClick={() =>
                  trackBrockEvent("brock_search_started", {
                    metadata: { destination: "map" },
                  })
                }
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-6 py-4 font-bold text-white transition hover:bg-white/10"
              >
                Explore on map
                <MapPin className="h-5 w-5" />
              </Link>
            </div>

            <div className="mt-7 flex flex-wrap gap-3 text-sm text-zinc-300">
              {[
                ["Student-focused rentals", CheckCircle2],
                ["Address privacy", LockKeyhole],
                ["Direct landlord messaging", MessageCircle],
              ].map(([label, Icon]) => (
                <span
                  key={label as string}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2"
                >
                  <Icon className="h-4 w-4 text-pink-200" />
                  {label as string}
                </span>
              ))}
            </div>
          </div>

          <div className="relative min-h-[420px]">
            {collageImages.length > 0 ? (
              <div className="relative h-[420px]">
                <div className="absolute inset-x-6 top-0 h-72 overflow-hidden rounded-[2rem] border border-white/10 bg-zinc-900 shadow-2xl">
                  <Image
                    src={collageImages[0]}
                    alt="Brock area student rental"
                    fill
                    priority
                    sizes="(max-width: 1024px) 90vw, 520px"
                    className="object-cover"
                  />
                </div>
                {collageImages[1] && (
                  <div className="absolute bottom-8 left-0 h-44 w-56 overflow-hidden rounded-3xl border border-white/10 bg-zinc-900 shadow-2xl">
                    <Image
                      src={collageImages[1]}
                      alt="Brock rental interior"
                      fill
                      sizes="224px"
                      className="object-cover"
                    />
                  </div>
                )}
                {collageImages[2] && (
                  <div className="absolute bottom-0 right-0 h-52 w-64 overflow-hidden rounded-3xl border border-white/10 bg-zinc-900 shadow-2xl">
                    <Image
                      src={collageImages[2]}
                      alt="Brock rental room"
                      fill
                      sizes="256px"
                      className="object-cover"
                    />
                  </div>
                )}
                {listings[0] && (
                  <div className="absolute bottom-20 left-8 max-w-[250px] rounded-2xl border border-white/10 bg-black/85 p-4 shadow-2xl backdrop-blur">
                    <p className="line-clamp-1 font-bold">{listings[0].title}</p>
                    <p className="mt-1 text-sm text-zinc-300">
                      {listings[0].price == null ? (
                        "Ask for price"
                      ) : (
                        <>
                          <Money amountCAD={listings[0].price} />/month
                        </>
                      )}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex h-[420px] flex-col justify-end rounded-[2rem] border border-white/10 bg-zinc-950 p-8 shadow-2xl">
                <Building2 className="h-12 w-12 text-pink-200" />
                <p className="mt-5 text-2xl font-black">Brock rentals are coming in.</p>
                <p className="mt-2 text-zinc-400">
                  Save the search now and watch the live marketplace as new verified
                  rentals are added.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="border-b border-white/10 px-4 py-5 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl gap-3 overflow-x-auto pb-2">
          {totalCount > 0 && (
            <MarketMetric label="Available rentals" value={String(totalCount)} />
          )}
          {minPrice != null && (
            <MarketMetric
              label="Starting from"
              value={<><Money amountCAD={minPrice} />/month</>}
            />
          )}
          <MarketMetric label="Area" value="Near Brock University" />
        </div>
      </section>

      <section className="px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-black/30 sm:p-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-black text-pink-200">What are you looking for?</p>
              <div className="mt-4 grid gap-3 md:grid-cols-4">
                <SearchField
                  label="Monthly budget"
                  value={budget}
                  onChange={setBudget}
                  placeholder="Max CAD"
                  type="number"
                />
                <SearchField
                  label="Move-in date"
                  value={moveIn}
                  onChange={setMoveIn}
                  placeholder="Anytime"
                  type="month"
                />
                <SelectField
                  label="Room type"
                  value={roomType}
                  onChange={setRoomType}
                  options={[
                    ["", "Any room"],
                    ["1", "Private room"],
                    ["2", "2+ bedrooms"],
                    ["3", "3+ bedrooms"],
                  ]}
                />
                <SelectField
                  label="Max commute"
                  value={commute}
                  onChange={setCommute}
                  options={[
                    ["", "Any distance"],
                    ["15", "Up to 15 min"],
                    ["30", "Up to 30 min"],
                    ["45", "Up to 45 min"],
                  ]}
                />
              </div>
            </div>
            <button
              type="button"
              onClick={startSearch}
              className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-white px-6 py-4 font-black text-black transition hover:bg-zinc-200"
            >
              <Search className="h-5 w-5" />
              Show matching rentals
            </button>
          </div>
        </div>
      </section>

      <section ref={listingsRef} id="brock-listings" className="px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-3xl font-black tracking-tight sm:text-4xl">
                Available near Brock
              </h2>
              <p className="mt-2 text-zinc-400">
                Student rentals currently available around Brock University.
              </p>
            </div>
            <Link
              href={buildBrockSearchUrl()}
              className="inline-flex items-center gap-2 font-bold text-pink-200 hover:text-pink-100"
            >
              View all Brock rentals
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {listings.length > 0 ? (
            <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {listings.slice(0, 6).map((listing) => (
                <div
                  key={listing.id}
                  onClick={() =>
                    trackBrockEvent("brock_listing_click", {
                      listingId: listing.id,
                    })
                  }
                >
                  <ListingCard listing={listing} />
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-8 rounded-[2rem] border border-dashed border-white/15 bg-zinc-950 p-8">
              <h3 className="text-2xl font-black">No rentals match this search right now.</h3>
              <p className="mt-3 max-w-2xl text-zinc-400">
                Brock-area inventory changes as landlords publish listings. You can
                explore nearby Niagara rentals or save this search for alerts.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/search?city=St.+Catharines&sort=newest"
                  className="inline-flex items-center justify-center rounded-2xl bg-white px-5 py-3 font-bold text-black"
                >
                  Explore nearby Niagara rentals
                </Link>
                <button
                  type="button"
                  onClick={saveBrockSearch}
                  className="inline-flex items-center justify-center rounded-2xl border border-white/15 px-5 py-3 font-bold text-white hover:bg-white/10"
                >
                  Save this search
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-stretch">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-8">
              <h2 className="text-3xl font-black tracking-tight">
                Know how close you&apos;ll be.
              </h2>
            <p className="mt-4 text-lg leading-8 text-zinc-300">
              Compare rentals by distance and commute so you can choose what works
              for classes, transit and everyday life.
            </p>
            <Link
              href={mapUrl}
              className="mt-7 inline-flex items-center gap-2 rounded-2xl bg-pink-500 px-5 py-3 font-black text-white hover:bg-pink-400"
            >
              Explore Brock rentals on map
              <MapPin className="h-5 w-5" />
            </Link>
          </div>
          <div className="relative min-h-[320px] overflow-hidden rounded-[2rem] border border-white/10 bg-zinc-950 p-6">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(236,72,153,0.18),transparent_35%),radial-gradient(circle_at_75%_65%,rgba(14,165,233,0.12),transparent_34%)]" />
            <div className="relative flex h-full flex-col justify-between">
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-black/50 px-3 py-2 text-sm text-zinc-200">
                <MapPin className="h-4 w-4 text-pink-200" />
                Brock University, St. Catharines
              </div>
              <div className="grid grid-cols-3 gap-3">
                {listings.slice(0, 3).map((listing, index) => (
                  <Link
                    key={listing.id}
                    href={`/listings/${listing.id}`}
                    onClick={() =>
                      trackBrockEvent("brock_listing_click", {
                        listingId: listing.id,
                        metadata: { source: "map_preview", index },
                      })
                    }
                    className="rounded-2xl border border-white/10 bg-black/70 p-4 transition hover:border-pink-300/50"
                  >
                    <p className="line-clamp-2 text-sm font-bold">{listing.title}</p>
                    <p className="mt-2 text-xs text-zinc-400">{listing.city}</p>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <h2 className="text-3xl font-black tracking-tight">Built for student housing.</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-4">
            {[
              ["Browse with confidence", "Verified landlord identity where applicable.", ShieldCheck],
              ["Protect your privacy", "Exact addresses remain protected by Travel Markets.", LockKeyhole],
              ["Connect directly", "Message landlords and send inquiries through the marketplace.", MessageCircle],
              ["Request viewings", "Ask for in-person, video tour, or video-call options.", CalendarDays],
            ].map(([title, copy, Icon]) => (
              <div key={title as string} className="rounded-3xl border border-white/10 bg-zinc-950 p-5">
                <Icon className="h-6 w-6 text-pink-200" />
                <h3 className="mt-4 font-black">{title as string}</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-400">{copy as string}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl rounded-[2rem] border border-pink-300/20 bg-pink-500/10 p-8 sm:p-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-3xl font-black tracking-tight">
                Still looking for the right place?
              </h2>
              <p className="mt-3 max-w-2xl text-zinc-300">
                Save your Brock housing search and keep track of matching rentals.
              </p>
              {saveError && <p className="mt-3 text-sm text-red-300">{saveError}</p>}
            </div>
            <button
              type="button"
              onClick={saveBrockSearch}
              disabled={savingSearch || savedSearch}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-6 py-4 font-black text-black transition hover:bg-zinc-200 disabled:opacity-60"
            >
              {savingSearch ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : savedSearch ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : (
                <Bell className="h-5 w-5" />
              )}
              {savedSearch ? "Brock search saved" : "Save my Brock search"}
            </button>
          </div>
        </div>
      </section>

      <section className="px-4 pb-16 pt-8 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 rounded-[2rem] border border-white/10 bg-zinc-950 p-8 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <HeartHandshake className="h-8 w-8 text-pink-200" />
            <h2 className="mt-4 text-3xl font-black tracking-tight">
              Your next place could be closer than you think.
            </h2>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href={buildBrockSearchUrl()}
              className="inline-flex items-center justify-center rounded-2xl bg-pink-500 px-5 py-3 font-black text-white hover:bg-pink-400"
            >
              Browse Brock housing
            </Link>
            <Link
              href={mapUrl}
              className="inline-flex items-center justify-center rounded-2xl border border-white/15 px-5 py-3 font-bold text-white hover:bg-white/10"
            >
              View on map
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

function MarketMetric({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="min-w-[190px] rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-zinc-500">{label}</p>
      <p className="mt-1 text-lg font-black">{value}</p>
    </div>
  );
}

function SearchField({
  label,
  value,
  onChange,
  placeholder,
  type,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-bold uppercase tracking-[0.12em] text-zinc-500">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-2 h-14 w-full rounded-2xl border border-white/10 bg-black px-4 text-white outline-none transition placeholder:text-zinc-600 focus:border-pink-300 focus:ring-4 focus:ring-pink-500/15"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<[string, string]>;
}) {
  return (
    <label className="block">
      <span className="text-xs font-bold uppercase tracking-[0.12em] text-zinc-500">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-14 w-full rounded-2xl border border-white/10 bg-black px-4 text-white outline-none transition focus:border-pink-300 focus:ring-4 focus:ring-pink-500/15"
      >
        {options.map(([optionValue, labelText]) => (
          <option key={optionValue || "all"} value={optionValue}>
            {labelText}
          </option>
        ))}
      </select>
    </label>
  );
}
