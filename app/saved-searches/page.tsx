"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bell, BellOff, Bookmark, Loader2, Search, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type SavedSearch = {
  id: string;
  name: string | null;
  title: string | null;
  query: string | null;
  city: string | null;
  campus: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  guests: number | null;
  min_price: number | null;
  max_price: number | null;
  sort: string | null;
  alerts_enabled: boolean | null;
  created_at: string;
};

export default function SavedSearchesPage() {
  const supabase = createClient();

  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);

  useEffect(() => {
    loadSavedSearches();
  }, []);

  async function loadSavedSearches() {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("saved_searches")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      setSavedSearches((data || []) as SavedSearch[]);
    } catch (error) {
      console.error("LOAD SAVED SEARCHES ERROR:", error);
    } finally {
      setLoading(false);
    }
  }

  async function toggleAlerts(item: SavedSearch) {
    try {
      setWorkingId(item.id);

      const { error } = await supabase
        .from("saved_searches")
        .update({ alerts_enabled: !item.alerts_enabled })
        .eq("id", item.id);

      if (error) throw error;

      await loadSavedSearches();
    } catch (error) {
      console.error("TOGGLE ALERT ERROR:", error);
      alert("Failed to update alert.");
    } finally {
      setWorkingId(null);
    }
  }

  async function deleteSavedSearch(id: string) {
    if (!confirm("Delete this saved search?")) return;

    try {
      setWorkingId(id);

      const { error } = await supabase
        .from("saved_searches")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setSavedSearches((prev) => prev.filter((item) => item.id !== id));
    } catch (error) {
      console.error("DELETE SAVED SEARCH ERROR:", error);
      alert("Failed to delete saved search.");
    } finally {
      setWorkingId(null);
    }
  }

  function buildSearchUrl(item: SavedSearch) {
    const params = new URLSearchParams();

    if (item.query) params.set("q", item.query);
    if (item.city) params.set("city", item.city);
    if (item.campus) params.set("campus", item.campus);
    if (item.min_price) params.set("minPrice", String(item.min_price));
    if (item.max_price) params.set("maxPrice", String(item.max_price));
    if (item.bedrooms) params.set("bedrooms", String(item.bedrooms));
    if (item.bathrooms) params.set("bathrooms", String(item.bathrooms));
    if (item.guests) params.set("guests", String(item.guests));
    if (item.sort && item.sort !== "newest") params.set("sort", item.sort);

    params.set("page", "1");

    return `/search?${params.toString()}`;
  }

  function getName(item: SavedSearch) {
    return item.title || item.name || "Saved Search";
  }

  function describeSearch(item: SavedSearch) {
    const parts = [
      item.query,
      item.city,
      item.campus,
      item.min_price ? `Min $${item.min_price}` : null,
      item.max_price ? `Max $${item.max_price}` : null,
      item.bedrooms ? `${item.bedrooms}+ bedrooms` : null,
      item.bathrooms ? `${item.bathrooms}+ bathrooms` : null,
      item.guests ? `${item.guests}+ guests` : null,
      item.sort === "price-low"
        ? "Price low to high"
        : item.sort === "price-high"
        ? "Price high to low"
        : null,
    ].filter(Boolean);

    return parts.length > 0 ? parts.join(" • ") : "No filters saved";
  }

  return (
    <main className="min-h-screen bg-[#050505] px-4 py-10 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70">
              <Bookmark size={16} />
              Personal search hub
            </div>

            <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">
              Saved Searches
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/50 sm:text-base">
              Reopen your favorite rental searches and receive alerts when new
              matching listings are posted.
            </p>
          </div>

          <Link
            href="/search"
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black hover:bg-white/90"
          >
            <Search size={16} />
            New Search
          </Link>
        </div>

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="h-44 animate-pulse rounded-3xl border border-white/10 bg-white/[0.05]"
              />
            ))}
          </div>
        ) : savedSearches.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-10 text-center">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10">
              <Bookmark size={24} className="text-white/60" />
            </div>

            <h2 className="text-2xl font-semibold">No saved searches yet</h2>

            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-white/50">
              Go to the search page, choose your filters, then click Save Search.
            </p>

            <Link
              href="/search"
              className="mt-6 inline-flex rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black hover:bg-white/90"
            >
              Start Searching
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {savedSearches.map((item) => (
              <div
                key={item.id}
                className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 transition hover:bg-white/[0.07]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="line-clamp-1 text-lg font-semibold">
                        {getName(item)}
                      </h2>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          item.alerts_enabled
                            ? "bg-emerald-500/10 text-emerald-300"
                            : "bg-zinc-700/50 text-zinc-400"
                        }`}
                      >
                        {item.alerts_enabled ? "Alerts On" : "Alerts Off"}
                      </span>
                    </div>

                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-white/50">
                      {describeSearch(item)}
                    </p>
                  </div>

                  <button
                    onClick={() => deleteSavedSearch(item.id)}
                    disabled={workingId === item.id}
                    className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-red-300 transition hover:bg-red-500/20 disabled:opacity-50"
                  >
                    {workingId === item.id ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Trash2 size={16} />
                    )}
                  </button>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  {item.city && (
                    <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/70">
                      {item.city}
                    </span>
                  )}

                  {item.campus && (
                    <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/70">
                      {item.campus}
                    </span>
                  )}

                  {item.min_price && (
                    <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/70">
                      Min ${item.min_price}
                    </span>
                  )}

                  {item.max_price && (
                    <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/70">
                      Max ${item.max_price}
                    </span>
                  )}
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <Link
                    href={buildSearchUrl(item)}
                    className="flex w-full items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-white/90"
                  >
                    Open Search
                  </Link>

                  <button
                    onClick={() => toggleAlerts(item)}
                    disabled={workingId === item.id}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10 disabled:opacity-50"
                  >
                    {workingId === item.id ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : item.alerts_enabled ? (
                      <BellOff size={16} />
                    ) : (
                      <Bell size={16} />
                    )}

                    {item.alerts_enabled ? "Turn Off Alerts" : "Turn On Alerts"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}