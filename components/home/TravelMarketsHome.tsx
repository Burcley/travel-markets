"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  Bath,
  BedDouble,
  Bookmark,
  Building2,
  Crown,
  Heart,
  Loader2,
  Map,
  MapPin,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Star,
  Users,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { HomeListing } from "@/types/home-listing";
import ListingMap from "./ListingMap";
import TrendingListings from "./TrendingListings";
import TrendingLocations from "./TrendingLocations";

type Props = {
  initialListings: HomeListing[];
  initialPage: number;
  hasMore: boolean;
  totalCount: number;
  trendingListings?: any[];
  trendingCities?: any[];
};

type SortOption = "newest" | "price-low" | "price-high" | "trust-high";
type VerifiedOption = "" | "true";
type TrustOption = "" | "elite" | "trusted" | "basic" | "new";

export default function TravelMarketsHome({
  initialListings,
  initialPage,
  hasMore,
  totalCount,
  trendingListings = [],
  trendingCities = [],
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [isPending, startTransition] = useTransition();
  const hasMounted = useRef(false);

  const [listings, setListings] = useState(initialListings);
  const [page, setPage] = useState(initialPage);
  const [loadingMore, setLoadingMore] = useState(false);
  const [canLoadMore, setCanLoadMore] = useState(hasMore);
  const [activeListingId, setActiveListingId] = useState<string | null>(null);

  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [city, setCity] = useState(searchParams.get("city") || "");
  const [campus, setCampus] = useState(searchParams.get("campus") || "");
  const [bedrooms, setBedrooms] = useState(searchParams.get("bedrooms") || "");
  const [bathrooms, setBathrooms] = useState(searchParams.get("bathrooms") || "");
  const [guests, setGuests] = useState(searchParams.get("guests") || "");
  const [maxPrice, setMaxPrice] = useState(searchParams.get("maxPrice") || "");

  const [verifiedOnly, setVerifiedOnly] = useState<VerifiedOption>(
    (searchParams.get("verified") as VerifiedOption) || ""
  );

  const [trustLevel, setTrustLevel] = useState<TrustOption>(
    (searchParams.get("trust") as TrustOption) || ""
  );

  const [sort, setSort] = useState<SortOption>(
    (searchParams.get("sort") as SortOption) || "newest"
  );

  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [savingSearch, setSavingSearch] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [mobileMapOpen, setMobileMapOpen] = useState(false);

  useEffect(() => {
    setListings(initialListings);
    setPage(initialPage);
    setCanLoadMore(hasMore);
  }, [initialListings, initialPage, hasMore]);

  useEffect(() => {
    const trimmed = query.trim();

    if (trimmed.length < 2) {
      setSuggestions([]);
      setSuggestionsOpen(false);
      return;
    }

    const controller = new AbortController();

    async function loadSuggestions() {
      try {
        setLoadingSuggestions(true);

        const response = await fetch(
          `/api/search-suggestions?q=${encodeURIComponent(trimmed)}`,
          { signal: controller.signal }
        );

        if (!response.ok) return;

        const data = await response.json();
        setSuggestions(Array.isArray(data.suggestions) ? data.suggestions : []);
        setSuggestionsOpen(true);
      } catch (error: any) {
        if (error?.name !== "AbortError") {
          console.error("SUGGESTIONS ERROR:", error);
        }
      } finally {
        setLoadingSuggestions(false);
      }
    }

    const timeout = window.setTimeout(loadSuggestions, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [query]);

  function buildSearchUrl() {
    const params = new URLSearchParams();

    if (query.trim()) params.set("q", query.trim());
    if (city.trim()) params.set("city", city.trim());
    if (campus.trim()) params.set("campus", campus.trim());
    if (bedrooms) params.set("bedrooms", bedrooms);
    if (bathrooms) params.set("bathrooms", bathrooms);
    if (guests) params.set("guests", guests);
    if (maxPrice) params.set("maxPrice", maxPrice);
    if (verifiedOnly) params.set("verified", verifiedOnly);
    if (trustLevel) params.set("trust", trustLevel);
    if (sort !== "newest") params.set("sort", sort);

    params.set("page", "1");

    const queryString = params.toString();
    return queryString ? `/search?${queryString}` : "/search";
  }

  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true;
      return;
    }

    const timeout = window.setTimeout(() => {
      setSuggestionsOpen(false);

      startTransition(() => {
        router.push(buildSearchUrl());
      });
    }, 550);

    return () => window.clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    query,
    city,
    campus,
    bedrooms,
    bathrooms,
    guests,
    maxPrice,
    verifiedOnly,
    trustLevel,
    sort,
  ]);

  function handleSearch() {
    setSuggestionsOpen(false);
    setMobileFiltersOpen(false);

    startTransition(() => {
      router.push(buildSearchUrl());
    });
  }

  function selectSuggestion(value: string) {
    setQuery(value);
    setSuggestionsOpen(false);

    const params = new URLSearchParams(searchParams.toString());
    params.set("q", value);
    params.set("page", "1");

    startTransition(() => {
      router.push(`/search?${params.toString()}`);
    });
  }

  function handleReset() {
    setQuery("");
    setCity("");
    setCampus("");
    setBedrooms("");
    setBathrooms("");
    setGuests("");
    setMaxPrice("");
    setVerifiedOnly("");
    setTrustLevel("");
    setSort("newest");
    setSuggestions([]);
    setSuggestionsOpen(false);
    setMobileFiltersOpen(false);

    startTransition(() => {
      router.push("/search");
    });
  }

  async function saveSearch() {
    try {
      setSavingSearch(true);

      const response = await fetch("/api/saved-searches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: query || city || campus || "Saved Search",
          name: query || city || campus || "Saved Search",
          query: query.trim() || null,
          city: city.trim() || null,
          campus: campus.trim() || null,
          bedrooms: bedrooms ? Number(bedrooms) : null,
          bathrooms: bathrooms ? Number(bathrooms) : null,
          guests: guests ? Number(guests) : null,
          max_price: maxPrice ? Number(maxPrice) : null,
          verified_only: verifiedOnly === "true",
          trust_level: trustLevel || null,
          sort,
          alerts_enabled: true,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || "Failed to save search.");
        return;
      }

      alert("Search saved successfully with alerts on.");
      router.push("/saved-searches");
    } catch (error) {
      console.error("SAVE SEARCH ERROR:", error);
      alert("Failed to save search.");
    } finally {
      setSavingSearch(false);
    }
  }

  async function loadMoreListings() {
    try {
      setLoadingMore(true);

      const params = new URLSearchParams(searchParams.toString());
      const nextPage = page + 1;
      params.set("page", String(nextPage));

      const response = await fetch(`/api/search-listings?${params.toString()}`);
      if (!response.ok) return;

      const data = await response.json();

      if (!data.listings?.length) {
        setCanLoadMore(false);
        return;
      }

      setListings((prev) => {
        const existingIds = new Set(prev.map((item) => item.id));
        const unique = data.listings.filter(
          (item: HomeListing) => !existingIds.has(item.id)
        );
        return [...prev, ...unique];
      });

      setPage(nextPage);
      setCanLoadMore(data.hasMore);
    } catch (error) {
      console.error("LOAD MORE ERROR:", error);
    } finally {
      setLoadingMore(false);
    }
  }

  async function toggleSave(listingId: string, saved?: boolean) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/auth";
      return;
    }

    setListings((prev) =>
      prev.map((item) =>
        item.id === listingId ? { ...item, is_saved: !saved } : item
      )
    );

    if (saved) {
      await supabase
        .from("saved_listings")
        .delete()
        .eq("listing_id", listingId)
        .eq("user_id", user.id);
    } else {
      await supabase.from("saved_listings").insert({
        listing_id: listingId,
        user_id: user.id,
      });
    }
  }

  function getOwnerBadge(listing: any) {
    if (listing.owner_badge) return listing.owner_badge;
    if (listing.owner_plan === "premium") return "Premium Owner";
    if (listing.owner_plan === "pro") return "Pro Owner";
    return null;
  }

  function getTrustData(listing: any) {
    const score =
      listing.owner_trust_score ??
      listing.trust_score ??
      listing.profiles?.trust_score ??
      null;

    const level =
      listing.owner_trust_level ??
      listing.trust_level ??
      listing.profiles?.trust_level ??
      "new";

    const verified =
      listing.owner_is_verified ??
      listing.is_verified ??
      listing.identity_verified ??
      listing.profiles?.is_verified ??
      false;

    const label =
      level === "elite"
        ? "Elite"
        : level === "trusted"
        ? "Trusted"
        : level === "basic"
        ? "Basic"
        : "New";

    const className =
      level === "elite"
        ? "bg-emerald-400 text-black"
        : level === "trusted"
        ? "bg-emerald-500 text-black"
        : level === "basic"
        ? "bg-blue-500 text-white"
        : "bg-zinc-700 text-white";

    return { score, level, verified, label, className };
  }

  const activeFilterCount = [
    city,
    campus,
    bedrooms,
    bathrooms,
    guests,
    maxPrice,
    verifiedOnly,
    trustLevel,
    sort !== "newest" ? sort : "",
  ].filter(Boolean).length;

  const chips = [
    { label: "Oshawa", action: () => setCity("Oshawa") },
    { label: "Toronto", action: () => setCity("Toronto") },
    { label: "Trent", action: () => setCampus("Trent University") },
    { label: "Verified", action: () => setVerifiedOnly("true") },
    { label: "Under $1000", action: () => setMaxPrice("1000") },
    { label: "Trusted", action: () => setTrustLevel("trusted") },
  ];

  return (
    <main className="min-h-screen bg-[#050505] pb-24 text-white lg:pb-0">
      {/* MOBILE AIRBNB STYLE */}
      <section className="lg:hidden">
        <div className="sticky top-0 z-40 border-b border-white/10 bg-[#050505]/95 px-4 py-3 backdrop-blur-xl">
          <div className="relative">
            <div className="flex items-center gap-3 rounded-full border border-white/10 bg-white px-4 py-3 text-black shadow-xl">
              <Search size={18} className="shrink-0 text-black/60" />

              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSuggestionsOpen(true);
                }}
                onFocus={() => {
                  if (suggestions.length > 0) setSuggestionsOpen(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSearch();
                }}
                placeholder="Where to?"
                className="min-w-0 flex-1 bg-transparent text-[15px] font-semibold outline-none placeholder:text-black/50"
              />

              {(loadingSuggestions || isPending) && (
                <Loader2 size={16} className="animate-spin text-black/50" />
              )}

              <button
                type="button"
                onClick={() => setMobileFiltersOpen(true)}
                className="relative shrink-0 rounded-full border border-black/10 bg-black px-3 py-2 text-white"
              >
                <SlidersHorizontal size={16} />
                {activeFilterCount > 0 && (
                  <span className="absolute -right-1 -top-1 rounded-full bg-red-500 px-1.5 text-[10px] font-black text-white">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </div>

            {suggestionsOpen && suggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-[calc(100%+10px)] z-50 overflow-hidden rounded-3xl border border-white/10 bg-zinc-950 shadow-2xl">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => selectSuggestion(suggestion)}
                    className="flex w-full items-center gap-3 border-b border-white/5 px-4 py-3 text-left text-sm text-white/80"
                  >
                    <MapPin size={15} className="shrink-0 text-white/40" />
                    <span className="line-clamp-1">{suggestion}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {chips.map((chip) => (
              <button
                key={chip.label}
                type="button"
                onClick={chip.action}
                className="shrink-0 rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-xs font-semibold text-white/80"
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>

        <div className="px-4 py-4">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/35">
                Travel Markets
              </p>

              <h1 className="mt-1 text-[22px] font-bold leading-tight tracking-tight">
                Find campus stays
              </h1>

              <p className="mt-1 truncate text-xs text-white/45">
                {listings.length} listing{listings.length === 1 ? "" : "s"}
                {city ? ` • ${city}` : ""}
                {campus ? ` • ${campus}` : ""}
              </p>
            </div>

            {isPending && (
              <Loader2 size={18} className="shrink-0 animate-spin text-white/40" />
            )}
          </div>

          {listings.length === 0 ? (
            <div className="rounded-[1.6rem] border border-white/10 bg-white/[0.04] p-8 text-center">
              <h3 className="text-lg font-bold">No stays found</h3>
              <p className="mt-2 text-sm text-white/50">
                Try another city, campus, or price.
              </p>
            </div>
          ) : (
            <div className="grid gap-5">
              {listings.map((listing, index) => {
                const trust = getTrustData(listing as any);
                const ownerBadge = getOwnerBadge(listing as any);
                const isFeatured = Boolean((listing as any).is_featured);
                const ownerPlan = (listing as any).owner_plan || "free";

                return (
                  <motion.article
                    key={listing.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.025 }}
                    className="overflow-hidden rounded-[1.65rem] border border-white/10 bg-white/[0.035]"
                  >
                    <div className="relative aspect-[1.18/1] overflow-hidden bg-white/5">
                      <Link href={`/listings/${listing.id}`}>
                        {listing.image_url ? (
                          <Image
                            src={listing.image_url}
                            alt={listing.title || "Travel Markets listing"}
                            fill
                            sizes="100vw"
                            className="object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-white/35">
                            No image
                          </div>
                        )}
                      </Link>

                      <button
                        type="button"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          toggleSave(listing.id, listing.is_saved);
                        }}
                        className="absolute right-3 top-3 rounded-full bg-black/55 p-2.5 backdrop-blur"
                      >
                        <Heart
                          size={19}
                          className={
                            listing.is_saved
                              ? "fill-white text-white"
                              : "text-white"
                          }
                        />
                      </button>

                      <div className="absolute left-3 top-3 flex max-w-[75%] flex-wrap gap-1.5">
                        {isFeatured && (
                          <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-black">
                            Featured
                          </span>
                        )}

                        <span className="rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-bold text-white backdrop-blur">
                          {listing.status || "available"}
                        </span>
                      </div>

                      <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-2">
                        <div className="min-w-0">
                          {ownerBadge && (
                            <div
                              className={`mb-1 inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black ${
                                ownerPlan === "premium"
                                  ? "bg-yellow-400 text-black"
                                  : "bg-purple-500 text-white"
                              }`}
                            >
                              {ownerPlan === "premium" ? (
                                <Crown size={11} />
                              ) : (
                                <Sparkles size={11} />
                              )}
                              <span className="truncate">{ownerBadge}</span>
                            </div>
                          )}

                          <div
                            className={`inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black ${trust.className}`}
                          >
                            {trust.verified ? (
                              <ShieldCheck size={11} />
                            ) : (
                              <Star size={11} />
                            )}
                            <span className="truncate">{trust.label}</span>
                            {trust.score !== null && (
                              <span>{trust.score}/100</span>
                            )}
                          </div>
                        </div>

                        <div className="shrink-0 rounded-full bg-white px-3 py-1.5 text-xs font-black text-black shadow-lg">
                          ${listing.price ?? "Ask"}/mo
                        </div>
                      </div>
                    </div>

                    <Link href={`/listings/${listing.id}`} className="block p-3.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <h2 className="line-clamp-1 text-[15px] font-bold leading-tight">
                            {listing.title || "Untitled listing"}
                          </h2>

                          <p className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-white/55">
                            <MapPin size={13} className="shrink-0" />
                            <span className="truncate">
                              {listing.city || "City hidden"}
                              {listing.campus ? ` • ${listing.campus}` : ""}
                            </span>
                          </p>
                        </div>

                        {trust.verified && (
                          <span className="shrink-0 rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] font-black text-emerald-300">
                            ✓
                          </span>
                        )}
                      </div>

                      <div className="mt-3 grid grid-cols-3 gap-2 text-[11px] text-white/65">
                        <span className="flex min-w-0 items-center justify-center gap-1 rounded-xl bg-white/5 px-2 py-2">
                          <BedDouble size={13} />
                          <span className="truncate">{listing.bedrooms ?? "-"} bed</span>
                        </span>

                        <span className="flex min-w-0 items-center justify-center gap-1 rounded-xl bg-white/5 px-2 py-2">
                          <Bath size={13} />
                          <span className="truncate">{listing.bathrooms ?? "-"} bath</span>
                        </span>

                        <span className="flex min-w-0 items-center justify-center gap-1 rounded-xl bg-white/5 px-2 py-2">
                          <Users size={13} />
                          <span className="truncate">{listing.guests ?? "-"} guest</span>
                        </span>
                      </div>

                      <p className="mt-3 flex items-center gap-1.5 text-[11px] text-white/40">
                        <Building2 size={13} className="shrink-0" />
                        <span className="truncate">
                          Address unlocks after approved viewing
                        </span>
                      </p>
                    </Link>
                  </motion.article>
                );
              })}
            </div>
          )}

          {canLoadMore && (
            <div className="mt-7 flex justify-center">
              <button
                onClick={loadMoreListings}
                disabled={loadingMore}
                className="rounded-full border border-white/10 bg-white/[0.06] px-6 py-3 text-sm font-bold text-white disabled:opacity-50"
              >
                {loadingMore ? "Loading..." : "Show more"}
              </button>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setMobileMapOpen(true)}
          className="fixed bottom-5 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-black text-black shadow-2xl"
        >
          <Map size={17} />
          Map
        </button>
      </section>

      {/* DESKTOP */}
      <section className="relative hidden overflow-hidden border-b border-white/10 lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.16),transparent_35%),radial-gradient(circle_at_top_right,rgba(56,189,248,0.12),transparent_30%)]" />

        <div className="relative mx-auto max-w-7xl px-8 py-16">
          <div className="max-w-3xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 backdrop-blur">
              <Sparkles size={16} />
              Premium rentals near campus
            </div>

            <h1 className="text-6xl font-semibold tracking-tight">
              Find your next stay with{" "}
              <span className="text-white/70">Travel Markets</span>
            </h1>

            <p className="mt-5 max-w-2xl text-lg leading-7 text-white/60">
              Search verified rentals, preview locations safely, book viewings,
              and unlock exact addresses only after approval.
            </p>
          </div>

          <div className="mt-10 rounded-3xl border border-white/10 bg-white/[0.06] p-4 shadow-2xl backdrop-blur-xl">
            <div className="grid gap-3 lg:grid-cols-[1.5fr_1fr_1fr_0.8fr_auto]">
              <SearchInput
                query={query}
                setQuery={setQuery}
                isPending={isPending}
                loadingSuggestions={loadingSuggestions}
                suggestions={suggestions}
                suggestionsOpen={suggestionsOpen}
                setSuggestionsOpen={setSuggestionsOpen}
                selectSuggestion={selectSuggestion}
                handleSearch={handleSearch}
              />

              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="City"
                className="rounded-2xl bg-black/40 px-4 py-3 text-sm outline-none ring-1 ring-white/10 placeholder:text-white/35"
              />

              <input
                value={campus}
                onChange={(e) => setCampus(e.target.value)}
                placeholder="Campus"
                className="rounded-2xl bg-black/40 px-4 py-3 text-sm outline-none ring-1 ring-white/10 placeholder:text-white/35"
              />

              <input
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                placeholder="Max price"
                type="number"
                className="rounded-2xl bg-black/40 px-4 py-3 text-sm outline-none ring-1 ring-white/10 placeholder:text-white/35"
              />

              <button
                onClick={handleSearch}
                className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-white/90"
              >
                {isPending ? "Searching..." : "Search"}
              </button>
            </div>

            <DesktopFilters
              bedrooms={bedrooms}
              setBedrooms={setBedrooms}
              bathrooms={bathrooms}
              setBathrooms={setBathrooms}
              guests={guests}
              setGuests={setGuests}
              sort={sort}
              setSort={setSort}
              verifiedOnly={verifiedOnly}
              setVerifiedOnly={setVerifiedOnly}
              trustLevel={trustLevel}
              setTrustLevel={setTrustLevel}
              handleReset={handleReset}
              saveSearch={saveSearch}
              savingSearch={savingSearch}
            />
          </div>
        </div>
      </section>

      <section className="mx-auto hidden max-w-7xl gap-6 px-8 py-8 lg:grid lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <TrendingLocations cities={trendingCities} />
          <TrendingListings listings={trendingListings} />

          <div className="mb-5 flex items-end justify-between">
            <div>
              <h2 className="text-2xl font-semibold">Featured stays</h2>

              <p className="mt-1 text-sm text-white/50">
                {listings.length} visible listing
                {listings.length === 1 ? "" : "s"}
                {typeof totalCount === "number" && totalCount > listings.length
                  ? ` of ${totalCount}`
                  : ""}
              </p>
            </div>

            {isPending && (
              <div className="flex items-center gap-2 text-sm text-white/40">
                <Loader2 size={15} className="animate-spin" />
                Updating...
              </div>
            )}
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            {listings.map((listing, index) => {
              const trust = getTrustData(listing as any);
              const ownerBadge = getOwnerBadge(listing as any);
              const isFeatured = Boolean((listing as any).is_featured);
              const ownerPlan = (listing as any).owner_plan || "free";

              return (
                <DesktopListingCard
                  key={listing.id}
                  listing={listing}
                  index={index}
                  trust={trust}
                  ownerBadge={ownerBadge}
                  isFeatured={isFeatured}
                  ownerPlan={ownerPlan}
                  activeListingId={activeListingId}
                  setActiveListingId={setActiveListingId}
                  toggleSave={toggleSave}
                />
              );
            })}
          </div>

          {canLoadMore && (
            <div className="mt-10 flex justify-center">
              <button
                onClick={loadMoreListings}
                disabled={loadingMore}
                className="rounded-2xl border border-white/10 bg-white/[0.06] px-6 py-4 text-sm font-semibold text-white transition hover:bg-white/10 disabled:opacity-50"
              >
                {loadingMore ? "Loading more..." : "Load more listings"}
              </button>
            </div>
          )}
        </div>

        <div className="sticky top-24 h-[calc(100vh-7rem)]">
          <ListingMap
            listings={listings}
            activeListingId={activeListingId}
            setActiveListingId={setActiveListingId}
            query={query}
            city={city}
            campus={campus}
          />
        </div>
      </section>

      {mobileFiltersOpen && (
        <MobileFilters
          city={city}
          setCity={setCity}
          campus={campus}
          setCampus={setCampus}
          maxPrice={maxPrice}
          setMaxPrice={setMaxPrice}
          bedrooms={bedrooms}
          setBedrooms={setBedrooms}
          bathrooms={bathrooms}
          setBathrooms={setBathrooms}
          guests={guests}
          setGuests={setGuests}
          sort={sort}
          setSort={setSort}
          verifiedOnly={verifiedOnly}
          setVerifiedOnly={setVerifiedOnly}
          trustLevel={trustLevel}
          setTrustLevel={setTrustLevel}
          close={() => setMobileFiltersOpen(false)}
          handleReset={handleReset}
          handleSearch={handleSearch}
          saveSearch={saveSearch}
          savingSearch={savingSearch}
        />
      )}

      {mobileMapOpen && (
        <div className="fixed inset-0 z-[99999] bg-[#050505] lg:hidden">
          <div className="flex h-16 items-center justify-between border-b border-white/10 px-4">
            <div className="min-w-0">
              <h3 className="truncate text-base font-bold">Map view</h3>
              <p className="truncate text-xs text-white/45">
                Approximate locations only
              </p>
            </div>

            <button
              type="button"
              onClick={() => setMobileMapOpen(false)}
              className="rounded-full border border-white/10 bg-white/5 p-2 text-white"
            >
              <X size={18} />
            </button>
          </div>

          <div className="h-[calc(100vh-4rem)]">
            <ListingMap
              listings={listings}
              activeListingId={activeListingId}
              setActiveListingId={setActiveListingId}
              query={query}
              city={city}
              campus={campus}
            />
          </div>
        </div>
      )}
    </main>
  );
}

function SearchInput({
  query,
  setQuery,
  isPending,
  loadingSuggestions,
  suggestions,
  suggestionsOpen,
  setSuggestionsOpen,
  selectSuggestion,
  handleSearch,
}: any) {
  return (
    <div className="relative">
      <div className="flex items-center gap-3 rounded-2xl bg-black/40 px-4 py-3 ring-1 ring-white/10">
        <Search size={18} className="text-white/50" />

        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSuggestionsOpen(true);
          }}
          onFocus={() => {
            if (suggestions.length > 0) setSuggestionsOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSearch();
            if (e.key === "Escape") setSuggestionsOpen(false);
          }}
          placeholder="Search city, campus, or listing"
          className="w-full bg-transparent text-sm outline-none placeholder:text-white/35"
        />

        {(loadingSuggestions || isPending) && (
          <Loader2 size={16} className="animate-spin text-white/40" />
        )}
      </div>

      {suggestionsOpen && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-[calc(100%+10px)] z-50 overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 shadow-2xl">
          {suggestions.map((suggestion: string) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => selectSuggestion(suggestion)}
              className="flex w-full items-center gap-3 border-b border-white/5 px-4 py-3 text-left text-sm text-white/80 hover:bg-white/10"
            >
              <MapPin size={15} className="text-white/40" />
              <span className="line-clamp-1">{suggestion}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function DesktopFilters(props: any) {
  return (
    <>
      <div className="mt-4 grid gap-3 lg:grid-cols-4">
        <FilterSelect value={props.bedrooms} onChange={props.setBedrooms}>
          <option value="">Bedrooms</option>
          <option value="1">1+ Bedroom</option>
          <option value="2">2+ Bedrooms</option>
          <option value="3">3+ Bedrooms</option>
        </FilterSelect>

        <FilterSelect value={props.bathrooms} onChange={props.setBathrooms}>
          <option value="">Bathrooms</option>
          <option value="1">1+ Bathroom</option>
          <option value="2">2+ Bathrooms</option>
        </FilterSelect>

        <FilterSelect value={props.guests} onChange={props.setGuests}>
          <option value="">Guests</option>
          <option value="1">1+ Guest</option>
          <option value="2">2+ Guests</option>
          <option value="3">3+ Guests</option>
        </FilterSelect>

        <FilterSelect value={props.sort} onChange={props.setSort}>
          <option value="newest">Newest</option>
          <option value="trust-high">Highest Trust</option>
          <option value="price-low">Price: Low to High</option>
          <option value="price-high">Price: High to Low</option>
        </FilterSelect>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr_auto_auto]">
        <FilterSelect value={props.verifiedOnly} onChange={props.setVerifiedOnly}>
          <option value="">All Owners</option>
          <option value="true">Verified Owners Only</option>
        </FilterSelect>

        <FilterSelect value={props.trustLevel} onChange={props.setTrustLevel}>
          <option value="">All Trust Levels</option>
          <option value="elite">Elite Owners</option>
          <option value="trusted">Trusted Owners</option>
          <option value="basic">Basic Trust</option>
          <option value="new">New Owners</option>
        </FilterSelect>

        <button
          onClick={props.handleReset}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80 hover:bg-white/10"
        >
          <SlidersHorizontal size={16} />
          Reset filters
        </button>

        <button
          onClick={props.saveSearch}
          disabled={props.savingSearch}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-sky-500/20 bg-sky-500/10 px-4 py-3 text-sm font-medium text-sky-300 hover:bg-sky-500/20 disabled:opacity-50"
        >
          {props.savingSearch ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Bookmark size={16} />
          )}
          {props.savingSearch ? "Saving..." : "Save Search"}
        </button>
      </div>
    </>
  );
}

function FilterSelect({ value, onChange, children }: any) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-2xl bg-black/40 px-4 py-3 text-sm outline-none ring-1 ring-white/10"
    >
      {children}
    </select>
  );
}

function DesktopListingCard({
  listing,
  index,
  trust,
  ownerBadge,
  isFeatured,
  ownerPlan,
  activeListingId,
  setActiveListingId,
  toggleSave,
}: any) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      onMouseEnter={() => setActiveListingId(listing.id)}
      onMouseLeave={() => setActiveListingId(null)}
      className={`group overflow-hidden rounded-3xl border bg-white/[0.04] transition duration-300 hover:-translate-y-1 hover:bg-white/[0.07] ${
        activeListingId === listing.id
          ? "border-white/35"
          : isFeatured
          ? "border-yellow-400/40"
          : ownerPlan === "premium"
          ? "border-yellow-400/30"
          : ownerPlan === "pro"
          ? "border-purple-400/30"
          : "border-white/10"
      }`}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-white/5">
        {listing.image_url ? (
          <Image
            src={listing.image_url}
            alt={listing.title || "Travel Markets listing"}
            fill
            sizes="(max-width: 1024px) 50vw, 33vw"
            className="object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-white/30">
            No image
          </div>
        )}

        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            toggleSave(listing.id, listing.is_saved);
          }}
          className="absolute right-3 top-3 rounded-full bg-black/55 p-2 backdrop-blur hover:bg-black/80"
        >
          <Heart
            size={19}
            className={listing.is_saved ? "fill-white text-white" : "text-white"}
          />
        </button>

        <div className="absolute left-3 top-3 flex flex-wrap gap-2">
          {isFeatured && (
            <span className="rounded-full bg-yellow-400 px-3 py-1 text-xs font-black text-black shadow-lg">
              ⭐ Featured
            </span>
          )}

          <span className="rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white backdrop-blur">
            {listing.status || "available"}
          </span>
        </div>

        <div className="absolute bottom-12 left-3 flex max-w-[92%] flex-wrap gap-2">
          {ownerBadge && (
            <div
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-black shadow-lg ${
                ownerPlan === "premium"
                  ? "bg-yellow-400 text-black"
                  : "bg-purple-500 text-white"
              }`}
            >
              {ownerPlan === "premium" ? <Crown size={14} /> : <Sparkles size={14} />}
              {ownerBadge}
            </div>
          )}

          <div
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-black shadow-lg ${trust.className}`}
          >
            {trust.verified ? <ShieldCheck size={14} /> : <Star size={14} />}
            {trust.label}
            {trust.score !== null && <span>{trust.score}/100</span>}
          </div>
        </div>

        <div className="absolute bottom-3 left-3 rounded-full bg-white px-3 py-1 text-sm font-bold text-black shadow-lg">
          ${listing.price ?? "Ask"}/mo
        </div>
      </div>

      <Link href={`/listings/${listing.id}`} className="block p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="line-clamp-1 text-base font-semibold">
            {listing.title}
          </h3>

          {trust.verified && (
            <span className="shrink-0 rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] font-black text-emerald-300">
              ✓ Verified
            </span>
          )}
        </div>

        <div className="mt-2 flex items-center gap-2 text-sm text-white/50">
          <MapPin size={15} />
          <span className="line-clamp-1">
            {listing.city || "City hidden"}
            {listing.campus ? ` • ${listing.campus}` : ""}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 text-xs text-white/60">
          <span className="inline-flex items-center gap-1 rounded-xl bg-white/5 px-2 py-2">
            <BedDouble size={14} />
            {listing.bedrooms ?? "-"} bed
          </span>

          <span className="inline-flex items-center gap-1 rounded-xl bg-white/5 px-2 py-2">
            <Bath size={14} />
            {listing.bathrooms ?? "-"} bath
          </span>

          <span className="inline-flex items-center gap-1 rounded-xl bg-white/5 px-2 py-2">
            <Users size={14} />
            {listing.guests ?? "-"}
          </span>
        </div>

        <div className="mt-4 flex items-center gap-2 text-xs text-white/40">
          <Building2 size={14} />
          Exact address unlocks after approved viewing
        </div>
      </Link>
    </motion.div>
  );
}

function MobileFilters(props: any) {
  return (
    <div className="fixed inset-0 z-[99999] bg-black/70 backdrop-blur-sm lg:hidden">
      <div className="absolute inset-x-0 bottom-0 max-h-[92vh] overflow-y-auto rounded-t-[2rem] border border-white/10 bg-[#080808] p-4 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div className="min-w-0">
            <h3 className="truncate text-lg font-bold">Filters</h3>
            <p className="truncate text-xs text-white/45">
              Choose what fits your stay
            </p>
          </div>

          <button
            type="button"
            onClick={props.close}
            className="rounded-full border border-white/10 bg-white/5 p-2 text-white"
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid gap-3">
          <MobileInput value={props.city} onChange={props.setCity} placeholder="City" />
          <MobileInput value={props.campus} onChange={props.setCampus} placeholder="Campus" />
          <MobileInput value={props.maxPrice} onChange={props.setMaxPrice} placeholder="Max price" type="number" />

          <FilterSelect value={props.bedrooms} onChange={props.setBedrooms}>
            <option value="">Bedrooms</option>
            <option value="1">1+ Bedroom</option>
            <option value="2">2+ Bedrooms</option>
            <option value="3">3+ Bedrooms</option>
          </FilterSelect>

          <FilterSelect value={props.bathrooms} onChange={props.setBathrooms}>
            <option value="">Bathrooms</option>
            <option value="1">1+ Bathroom</option>
            <option value="2">2+ Bathrooms</option>
          </FilterSelect>

          <FilterSelect value={props.guests} onChange={props.setGuests}>
            <option value="">Guests</option>
            <option value="1">1+ Guest</option>
            <option value="2">2+ Guests</option>
            <option value="3">3+ Guests</option>
          </FilterSelect>

          <FilterSelect value={props.sort} onChange={props.setSort}>
            <option value="newest">Newest</option>
            <option value="trust-high">Highest Trust</option>
            <option value="price-low">Price: Low to High</option>
            <option value="price-high">Price: High to Low</option>
          </FilterSelect>

          <FilterSelect value={props.verifiedOnly} onChange={props.setVerifiedOnly}>
            <option value="">All Owners</option>
            <option value="true">Verified Owners Only</option>
          </FilterSelect>

          <FilterSelect value={props.trustLevel} onChange={props.setTrustLevel}>
            <option value="">All Trust Levels</option>
            <option value="elite">Elite Owners</option>
            <option value="trusted">Trusted Owners</option>
            <option value="basic">Basic Trust</option>
            <option value="new">New Owners</option>
          </FilterSelect>

          <div className="sticky bottom-0 mt-2 grid grid-cols-2 gap-3 bg-[#080808] pt-3">
            <button
              onClick={props.handleReset}
              className="rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white"
            >
              Reset
            </button>

            <button
              onClick={props.handleSearch}
              className="rounded-full bg-white px-4 py-3 text-sm font-black text-black"
            >
              Apply
            </button>
          </div>

          <button
            onClick={props.saveSearch}
            disabled={props.savingSearch}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-sky-500/20 bg-sky-500/10 px-4 py-3 text-sm font-bold text-sky-300 disabled:opacity-50"
          >
            {props.savingSearch ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Bookmark size={16} />
            )}
            {props.savingSearch ? "Saving..." : "Save Search"}
          </button>
        </div>
      </div>
    </div>
  );
}

function MobileInput({ value, onChange, placeholder, type = "text" }: any) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      type={type}
      className="rounded-2xl bg-black/40 px-4 py-3 text-sm outline-none ring-1 ring-white/10 placeholder:text-white/35"
    />
  );
}