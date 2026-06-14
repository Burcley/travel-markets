"use client";

import Image from "next/image";
import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  Bath,
  BedDouble,
  Building2,
  Heart,
  Loader2,
  MapPin,
  Search,
  SlidersHorizontal,
  Sparkles,
  Users,
  Bookmark,
  Crown,
  ShieldCheck,
  Star,
  Map,
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
        headers: {
          "Content-Type": "application/json",
        },
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
        console.error("SAVE SEARCH API ERROR:", data);
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
        ? "Elite Owner"
        : level === "trusted"
        ? "Trusted Owner"
        : level === "basic"
        ? "Basic Trust"
        : "New Owner";

    const className =
      level === "elite"
        ? "bg-emerald-400 text-black"
        : level === "trusted"
        ? "bg-emerald-500 text-black"
        : level === "basic"
        ? "bg-blue-500 text-white"
        : "bg-zinc-700 text-white";

    return {
      score,
      level,
      verified,
      label,
      className,
    };
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

  return (
    <main className="min-h-screen bg-[#050505] pb-20 text-white lg:pb-0">
      <section className="relative overflow-hidden border-b border-white/10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.14),transparent_35%),radial-gradient(circle_at_top_right,rgba(56,189,248,0.1),transparent_30%)]" />

        <div className="relative mx-auto max-w-7xl px-4 py-7 sm:px-6 sm:py-12 lg:px-8 lg:py-16">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="max-w-3xl"
          >
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 backdrop-blur sm:mb-5 sm:px-4 sm:py-2 sm:text-sm">
              <Sparkles size={14} />
              Premium rentals near campus
            </div>

            <h1 className="max-w-[760px] text-3xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
              Find your next stay with{" "}
              <span className="text-white/70">Travel Markets</span>
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/60 sm:mt-5 sm:text-lg sm:leading-7">
              Search verified rentals, book viewings, and unlock exact addresses
              only after approval.
            </p>
          </motion.div>

          <div className="mt-6 rounded-[1.6rem] border border-white/10 bg-white/[0.06] p-3 shadow-2xl backdrop-blur-xl sm:mt-10 sm:rounded-3xl sm:p-4">
            <div className="grid gap-3 lg:grid-cols-[1.5fr_1fr_1fr_0.8fr_auto]">
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
                    <div className="border-b border-white/10 px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-white/35">
                      Suggestions
                    </div>

                    {suggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => selectSuggestion(suggestion)}
                        className="flex w-full items-center gap-3 border-b border-white/5 px-4 py-3 text-left text-sm text-white/80 transition hover:bg-white/10"
                      >
                        <MapPin size={15} className="text-white/40" />
                        <span className="line-clamp-1">{suggestion}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="City"
                className="hidden rounded-2xl bg-black/40 px-4 py-3 text-sm outline-none ring-1 ring-white/10 placeholder:text-white/35 lg:block"
              />

              <input
                value={campus}
                onChange={(e) => setCampus(e.target.value)}
                placeholder="Campus"
                className="hidden rounded-2xl bg-black/40 px-4 py-3 text-sm outline-none ring-1 ring-white/10 placeholder:text-white/35 lg:block"
              />

              <input
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                placeholder="Max price"
                type="number"
                className="hidden rounded-2xl bg-black/40 px-4 py-3 text-sm outline-none ring-1 ring-white/10 placeholder:text-white/35 lg:block"
              />

              <button
                onClick={handleSearch}
                className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-white/90"
              >
                {isPending ? "Searching..." : "Search"}
              </button>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 lg:hidden">
              <button
                type="button"
                onClick={() => setMobileFiltersOpen(true)}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10"
              >
                <SlidersHorizontal size={16} />
                Filters
                {activeFilterCount > 0 && (
                  <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-black text-black">
                    {activeFilterCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setMobileMapOpen(true)}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10"
              >
                <Map size={16} />
                Map
              </button>
            </div>

            <div className="mt-4 hidden gap-3 lg:grid lg:grid-cols-4">
              <select
                value={bedrooms}
                onChange={(e) => setBedrooms(e.target.value)}
                className="rounded-2xl bg-black/40 px-4 py-3 text-sm outline-none ring-1 ring-white/10"
              >
                <option value="">Bedrooms</option>
                <option value="1">1+ Bedroom</option>
                <option value="2">2+ Bedrooms</option>
                <option value="3">3+ Bedrooms</option>
              </select>

              <select
                value={bathrooms}
                onChange={(e) => setBathrooms(e.target.value)}
                className="rounded-2xl bg-black/40 px-4 py-3 text-sm outline-none ring-1 ring-white/10"
              >
                <option value="">Bathrooms</option>
                <option value="1">1+ Bathroom</option>
                <option value="2">2+ Bathrooms</option>
              </select>

              <select
                value={guests}
                onChange={(e) => setGuests(e.target.value)}
                className="rounded-2xl bg-black/40 px-4 py-3 text-sm outline-none ring-1 ring-white/10"
              >
                <option value="">Guests</option>
                <option value="1">1+ Guest</option>
                <option value="2">2+ Guests</option>
                <option value="3">3+ Guests</option>
              </select>

              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortOption)}
                className="rounded-2xl bg-black/40 px-4 py-3 text-sm outline-none ring-1 ring-white/10"
              >
                <option value="newest">Newest</option>
                <option value="trust-high">Highest Trust</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
              </select>
            </div>

            <div className="mt-4 hidden gap-3 lg:grid lg:grid-cols-[1fr_1fr_auto_auto]">
              <select
                value={verifiedOnly}
                onChange={(e) => setVerifiedOnly(e.target.value as VerifiedOption)}
                className="rounded-2xl bg-black/40 px-4 py-3 text-sm outline-none ring-1 ring-white/10"
              >
                <option value="">All Owners</option>
                <option value="true">Verified Owners Only</option>
              </select>

              <select
                value={trustLevel}
                onChange={(e) => setTrustLevel(e.target.value as TrustOption)}
                className="rounded-2xl bg-black/40 px-4 py-3 text-sm outline-none ring-1 ring-white/10"
              >
                <option value="">All Trust Levels</option>
                <option value="elite">Elite Owners</option>
                <option value="trusted">Trusted Owners</option>
                <option value="basic">Basic Trust</option>
                <option value="new">New Owners</option>
              </select>

              <button
                onClick={handleReset}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80 hover:bg-white/10"
              >
                <SlidersHorizontal size={16} />
                Reset filters
              </button>

              <button
                onClick={saveSearch}
                disabled={savingSearch}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-sky-500/20 bg-sky-500/10 px-4 py-3 text-sm font-medium text-sky-300 transition hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {savingSearch ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Bookmark size={16} />
                )}
                {savingSearch ? "Saving..." : "Save Search"}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-5 sm:px-6 sm:py-8 lg:grid-cols-[1.1fr_0.9fr] lg:px-8">
        <div>
          <div className="hidden lg:block">
            <TrendingLocations cities={trendingCities} />
            <TrendingListings listings={trendingListings} />
          </div>

          <div className="mb-4 flex items-end justify-between sm:mb-5">
            <div>
              <h2 className="text-xl font-semibold sm:text-2xl">
                Featured stays
              </h2>

              <p className="mt-1 text-xs text-white/50 sm:text-sm">
                {listings.length} visible listing
                {listings.length === 1 ? "" : "s"}
                {typeof totalCount === "number" && totalCount > listings.length
                  ? ` of ${totalCount}`
                  : ""}
              </p>
            </div>

            {isPending && (
              <div className="flex items-center gap-2 text-xs text-white/40 sm:text-sm">
                <Loader2 size={15} className="animate-spin" />
                Updating...
              </div>
            )}
          </div>

          {listings.length === 0 ? (
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-7 text-center sm:p-10">
              <h3 className="text-lg font-semibold sm:text-xl">
                No listings found
              </h3>

              <p className="mt-2 text-sm text-white/50">
                Try another city, campus, price range, or trust filter.
              </p>
            </div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
                {listings.map((listing, index) => {
                  const isFeatured = Boolean((listing as any).is_featured);
                  const ownerPlan = (listing as any).owner_plan || "free";
                  const ownerBadge = getOwnerBadge(listing);
                  const trust = getTrustData(listing as any);

                  return (
                    <motion.div
                      key={listing.id}
                      initial={{ opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.03 }}
                      onMouseEnter={() => setActiveListingId(listing.id)}
                      onMouseLeave={() => setActiveListingId(null)}
                      className={`group overflow-hidden rounded-[1.4rem] border bg-white/[0.04] transition duration-300 hover:-translate-y-1 hover:bg-white/[0.07] sm:rounded-3xl ${
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
                            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
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
                          className="absolute right-3 top-3 rounded-full bg-black/55 p-2 backdrop-blur transition hover:bg-black/80"
                        >
                          <Heart
                            size={18}
                            className={
                              listing.is_saved
                                ? "fill-white text-white"
                                : "text-white"
                            }
                          />
                        </button>

                        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5 sm:gap-2">
                          {isFeatured && (
                            <span className="rounded-full bg-yellow-400 px-2.5 py-1 text-[10px] font-black text-black shadow-lg sm:px-3 sm:text-xs">
                              ⭐ Featured
                            </span>
                          )}

                          <span className="rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-medium text-white backdrop-blur sm:px-3 sm:text-xs">
                            {listing.status || "available"}
                          </span>
                        </div>

                        <div className="absolute bottom-11 left-3 flex max-w-[92%] flex-wrap gap-1.5 sm:bottom-12 sm:gap-2">
                          {ownerBadge && (
                            <div
                              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black shadow-lg sm:gap-2 sm:px-3 sm:text-xs ${
                                ownerPlan === "premium"
                                  ? "bg-yellow-400 text-black"
                                  : "bg-purple-500 text-white"
                              }`}
                            >
                              {ownerPlan === "premium" ? (
                                <Crown size={12} />
                              ) : (
                                <Sparkles size={12} />
                              )}
                              {ownerBadge}
                            </div>
                          )}

                          <div
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black shadow-lg sm:gap-2 sm:px-3 sm:text-xs ${trust.className}`}
                          >
                            {trust.verified ? (
                              <ShieldCheck size={12} />
                            ) : (
                              <Star size={12} />
                            )}
                            {trust.label}
                            {trust.score !== null && (
                              <span className="opacity-80">
                                {trust.score}/100
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="absolute bottom-3 left-3 rounded-full bg-white px-3 py-1 text-xs font-bold text-black shadow-lg sm:text-sm">
                          ${listing.price ?? "Ask"}/mo
                        </div>
                      </div>

                      <Link
                        href={`/listings/${listing.id}`}
                        className="block p-3.5 sm:p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="line-clamp-1 text-sm font-semibold sm:text-base">
                            {listing.title}
                          </h3>

                          {trust.verified && (
                            <span className="shrink-0 rounded-full bg-emerald-500/10 px-2 py-1 text-[9px] font-black text-emerald-300 sm:text-[10px]">
                              ✓ Verified
                            </span>
                          )}
                        </div>

                        <div className="mt-2 flex items-center gap-2 text-xs text-white/50 sm:text-sm">
                          <MapPin size={14} />

                          <span className="line-clamp-1">
                            {listing.city || "City hidden"}
                            {listing.campus ? ` • ${listing.campus}` : ""}
                          </span>
                        </div>

                        <div className="mt-3 grid grid-cols-3 gap-2 text-[11px] text-white/60 sm:mt-4 sm:text-xs">
                          <span className="inline-flex items-center justify-center gap-1 rounded-xl bg-white/5 px-2 py-2">
                            <BedDouble size={13} />
                            {listing.bedrooms ?? "-"} bed
                          </span>

                          <span className="inline-flex items-center justify-center gap-1 rounded-xl bg-white/5 px-2 py-2">
                            <Bath size={13} />
                            {listing.bathrooms ?? "-"} bath
                          </span>

                          <span className="inline-flex items-center justify-center gap-1 rounded-xl bg-white/5 px-2 py-2">
                            <Users size={13} />
                            {listing.guests ?? "-"}
                          </span>
                        </div>

                        <div className="mt-3 flex items-center gap-2 text-[11px] text-white/40 sm:mt-4 sm:text-xs">
                          <Building2 size={13} />
                          Exact address unlocks after approved viewing
                        </div>
                      </Link>
                    </motion.div>
                  );
                })}
              </div>

              {canLoadMore && (
                <div className="mt-8 flex justify-center sm:mt-10">
                  <button
                    onClick={loadMoreListings}
                    disabled={loadingMore}
                    className="rounded-2xl border border-white/10 bg-white/[0.06] px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50 sm:py-4"
                  >
                    {loadingMore ? "Loading more..." : "Load more listings"}
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        <div className="hidden lg:sticky lg:top-24 lg:block lg:h-[calc(100vh-7rem)]">
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
        <div className="fixed inset-0 z-[99999] bg-black/70 backdrop-blur-sm lg:hidden">
          <div className="absolute inset-x-0 bottom-0 max-h-[90vh] overflow-y-auto rounded-t-[2rem] border border-white/10 bg-[#080808] p-4 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold">Filters</h3>
                <p className="text-xs text-white/45">
                  Refine your rental search
                </p>
              </div>

              <button
                type="button"
                onClick={() => setMobileFiltersOpen(false)}
                className="rounded-full border border-white/10 bg-white/5 p-2 text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid gap-3">
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

              <select
                value={bedrooms}
                onChange={(e) => setBedrooms(e.target.value)}
                className="rounded-2xl bg-black/40 px-4 py-3 text-sm outline-none ring-1 ring-white/10"
              >
                <option value="">Bedrooms</option>
                <option value="1">1+ Bedroom</option>
                <option value="2">2+ Bedrooms</option>
                <option value="3">3+ Bedrooms</option>
              </select>

              <select
                value={bathrooms}
                onChange={(e) => setBathrooms(e.target.value)}
                className="rounded-2xl bg-black/40 px-4 py-3 text-sm outline-none ring-1 ring-white/10"
              >
                <option value="">Bathrooms</option>
                <option value="1">1+ Bathroom</option>
                <option value="2">2+ Bathrooms</option>
              </select>

              <select
                value={guests}
                onChange={(e) => setGuests(e.target.value)}
                className="rounded-2xl bg-black/40 px-4 py-3 text-sm outline-none ring-1 ring-white/10"
              >
                <option value="">Guests</option>
                <option value="1">1+ Guest</option>
                <option value="2">2+ Guests</option>
                <option value="3">3+ Guests</option>
              </select>

              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortOption)}
                className="rounded-2xl bg-black/40 px-4 py-3 text-sm outline-none ring-1 ring-white/10"
              >
                <option value="newest">Newest</option>
                <option value="trust-high">Highest Trust</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
              </select>

              <select
                value={verifiedOnly}
                onChange={(e) => setVerifiedOnly(e.target.value as VerifiedOption)}
                className="rounded-2xl bg-black/40 px-4 py-3 text-sm outline-none ring-1 ring-white/10"
              >
                <option value="">All Owners</option>
                <option value="true">Verified Owners Only</option>
              </select>

              <select
                value={trustLevel}
                onChange={(e) => setTrustLevel(e.target.value as TrustOption)}
                className="rounded-2xl bg-black/40 px-4 py-3 text-sm outline-none ring-1 ring-white/10"
              >
                <option value="">All Trust Levels</option>
                <option value="elite">Elite Owners</option>
                <option value="trusted">Trusted Owners</option>
                <option value="basic">Basic Trust</option>
                <option value="new">New Owners</option>
              </select>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  onClick={handleReset}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white/80 hover:bg-white/10"
                >
                  Reset
                </button>

                <button
                  onClick={handleSearch}
                  className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-black hover:bg-zinc-200"
                >
                  Apply
                </button>
              </div>

              <button
                onClick={saveSearch}
                disabled={savingSearch}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-sky-500/20 bg-sky-500/10 px-4 py-3 text-sm font-medium text-sky-300 transition hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {savingSearch ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Bookmark size={16} />
                )}
                {savingSearch ? "Saving..." : "Save Search"}
              </button>
            </div>
          </div>
        </div>
      )}

      {mobileMapOpen && (
        <div className="fixed inset-0 z-[99999] bg-[#050505] lg:hidden">
          <div className="flex h-16 items-center justify-between border-b border-white/10 px-4">
            <div>
              <h3 className="text-base font-bold">Map view</h3>
              <p className="text-xs text-white/45">
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