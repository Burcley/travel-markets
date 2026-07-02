"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import ListingCard from "./ListingCard";
import LogoutButton from "./LogoutButton";
import RecentlyViewedListings from "./RecentlyViewedListings";
import SavedSearches from "./SavedSearches";

type Listing = {
  id: string;
  title: string;
  city: string | null;
  campus: string | null;
  price: number | null;
  status: string | null;
  created_at: string;
  cover_image: string | null;
  latitude: number | null;
  longitude: number | null;
};

const LISTINGS_PER_PAGE = 12;

const ListingMap = dynamic(
  () => import("./ListingMap").then((mod) => mod.default),
  { ssr: false }
) as any;

export default function ListingsExplorer({
  initialListings,
  userEmail,
}: {
  initialListings: Listing[];
  userEmail: string | null;
}) {
  const t = useTranslations("finalBatchD.listingsExplorer");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("newest");
  const [status, setStatus] = useState("all");
  const [mobileView, setMobileView] = useState<"list" | "map">("list");
  const [visibleCount, setVisibleCount] = useState(LISTINGS_PER_PAGE);
  const [hoveredListingId, setHoveredListingId] = useState<string | null>(null);

  function applySavedSearch(data: any) {
    setSearch(data.search);
    setSort(data.sort);
    setStatus(data.status);
  }

  const filtered = useMemo(() => {
    let result = [...initialListings];

    if (search.trim()) {
      const q = search.toLowerCase();

      result = result.filter(
        (listing) =>
          listing.title?.toLowerCase().includes(q) ||
          listing.city?.toLowerCase().includes(q) ||
          listing.campus?.toLowerCase().includes(q)
      );
    }

    if (status !== "all") {
      result = result.filter((listing) => listing.status === status);
    }

    if (sort === "price_low") {
      result.sort((a, b) => (a.price || 0) - (b.price || 0));
    }

    if (sort === "price_high") {
      result.sort((a, b) => (b.price || 0) - (a.price || 0));
    }

    if (sort === "newest") {
      result.sort(
        (a, b) =>
          new Date(b.created_at).getTime() -
          new Date(a.created_at).getTime()
      );
    }

    return result;
  }, [initialListings, search, sort, status]);

  const visibleListings = filtered.slice(0, visibleCount);

  const hasMore = visibleCount < filtered.length;

  function resetVisibleCount() {
    setVisibleCount(LISTINGS_PER_PAGE);
  }

  return (
    <main className="min-h-screen bg-black pb-24 text-white lg:pb-0">
      <section className="border-b border-zinc-800 px-5 py-6">
        <div className="mx-auto max-w-[1600px]">
          <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div>
              <h1 className="text-3xl font-bold">
                {t("title")}
              </h1>

              <p className="mt-1 text-sm text-zinc-400">
                {t("subtitle")}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {userEmail ? (
                <>
                  <span className="rounded-full border border-zinc-800 px-4 py-2 text-sm text-zinc-400">
                    {userEmail}
                  </span>

                  <LogoutButton />

                  <Link
                    href="/post"
                    className="rounded-full bg-white px-5 py-2 text-sm font-bold text-black"
                  >
                    {t("postListing")}
                  </Link>
                </>
              ) : (
                <Link
                  href="/auth"
                  className="rounded-full bg-white px-5 py-2 text-sm font-bold text-black"
                >
                  {t("loginSignup")}
                </Link>
              )}
            </div>
          </div>

          <div className="grid gap-3 rounded-3xl border border-zinc-800 bg-zinc-950 p-3 lg:grid-cols-[1fr_180px_180px]">
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                resetVisibleCount();
              }}
              placeholder={t("searchPlaceholder")}
              className="h-12 rounded-2xl border border-zinc-800 bg-black px-4 outline-none placeholder:text-zinc-500"
            />

            <select
              value={sort}
              onChange={(e) => {
                setSort(e.target.value);
                resetVisibleCount();
              }}
              className="h-12 rounded-2xl border border-zinc-800 bg-black px-4 outline-none"
            >
              <option value="newest">{t("newest")}</option>
              <option value="price_low">{t("priceLowHigh")}</option>
              <option value="price_high">{t("priceHighLow")}</option>
            </select>

            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                resetVisibleCount();
              }}
              className="h-12 rounded-2xl border border-zinc-800 bg-black px-4 outline-none"
            >
              <option value="all">{t("allStatus")}</option>
              <option value="available">{t("available")}</option>
              <option value="pending">{t("pending")}</option>
              <option value="rented">{t("rented")}</option>
            </select>
          </div>

          <p className="mt-4 text-sm text-zinc-500">
            {t("showing", {
              visible: visibleListings.length,
              total: filtered.length,
            })}
          </p>
        </div>
      </section>

      {mobileView === "list" && <RecentlyViewedListings />}

      {mobileView === "list" && (
        <SavedSearches
          currentSearch={search}
          currentSort={sort}
          currentStatus={status}
          onApply={applySavedSearch}
        />
      )}

      <section className="mx-auto max-w-[1600px] px-5 py-6 lg:grid lg:grid-cols-[52%_48%] lg:gap-6">
        <div className={mobileView === "map" ? "hidden lg:block" : "block"}>
          {visibleListings.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-zinc-800 bg-zinc-950 p-10 text-center">
              <h2 className="text-xl font-bold">{t("emptyTitle")}</h2>

              <p className="mt-2 text-sm text-zinc-400">
                {t("emptyText")}
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {visibleListings.map((listing) => (
                  <ListingCard
                    key={listing.id}
                    listing={listing}
                    isActive={hoveredListingId === listing.id}
                    onHover={() => setHoveredListingId(listing.id)}
                    onLeave={() => setHoveredListingId(null)}
                  />
                ))}
              </div>

              {hasMore && (
                <div className="mt-10 flex justify-center">
                  <button
                    onClick={() =>
                      setVisibleCount((current) => current + LISTINGS_PER_PAGE)
                    }
                    className="rounded-full border border-zinc-700 px-8 py-3 text-sm font-bold hover:bg-white hover:text-black"
                  >
                    {t("loadMore")}
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        <aside
          className={`h-[calc(100vh-210px)] min-h-[620px] overflow-hidden rounded-[2rem] border border-zinc-800 bg-zinc-950 shadow-2xl lg:sticky lg:top-6 ${
            mobileView === "list" ? "hidden lg:block" : "block"
          }`}
        >
          <ListingMap
            listings={visibleListings}
            hoveredListingId={hoveredListingId}
          />
        </aside>
      </section>

      <div className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 rounded-full border border-zinc-700 bg-zinc-950 p-1 shadow-2xl lg:hidden">
        <button
          onClick={() => setMobileView("list")}
          className={`rounded-full px-6 py-3 text-sm font-bold ${
            mobileView === "list"
              ? "bg-white text-black"
              : "text-zinc-400"
          }`}
        >
          {t("list")}
        </button>

        <button
          onClick={() => setMobileView("map")}
          className={`rounded-full px-6 py-3 text-sm font-bold ${
            mobileView === "map"
              ? "bg-white text-black"
              : "text-zinc-400"
          }`}
        >
          {t("map")}
        </button>
      </div>
    </main>
  );
}
