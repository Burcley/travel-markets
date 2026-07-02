"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Clock, MapPin, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type ListingImage = {
  image_url: string | null;
  is_cover: boolean | null;
  sort_order: number | null;
};

type RecentlyViewedListing = {
  id: string;
  title: string | null;
  city: string | null;
  campus: string | null;
  price: number | null;
  status: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  guests: number | null;
  listing_images: ListingImage[] | null;
};

type RecentlyViewedRow = {
  id: string;
  listing_id: string;
  viewed_at: string;
  listings: RecentlyViewedListing | null;
};

export default function RecentlyViewedPage() {
  const t = useTranslations("accountPages.recentlyViewed");
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState<RecentlyViewedRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRecentlyViewed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadRecentlyViewed() {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("recently_viewed")
        .select(
          `
          id,
          listing_id,
          viewed_at,
          listings (
            id,
            title,
            city,
            campus,
            price,
            status,
            bedrooms,
            bathrooms,
            guests,
            listing_images (
              image_url,
              is_cover,
              sort_order
            )
          )
        `
        )
        .order("viewed_at", { ascending: false })
        .limit(24);

      if (error) throw error;

      setItems((data ?? []) as unknown as RecentlyViewedRow[]);
    } catch (error) {
      console.error("LOAD RECENTLY VIEWED ERROR:", error);
    } finally {
      setLoading(false);
    }
  }

  async function removeItem(id: string) {
    const { error } = await supabase
      .from("recently_viewed")
      .delete()
      .eq("id", id);

    if (error) {
      alert(t("removeFailed"));
      return;
    }

    setItems((prev) => prev.filter((item) => item.id !== id));
  }

  function getCover(item: RecentlyViewedRow) {
    const images = item.listings?.listing_images ?? [];

    const sorted = [...images].sort(
      (a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999)
    );

    return (
      images.find((image) => image.is_cover)?.image_url ||
      sorted[0]?.image_url ||
      null
    );
  }

  return (
    <main className="min-h-screen bg-[#050505] px-4 py-10 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70">
            <Clock size={16} />
            {t("eyebrow")}
          </div>

          <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">
            {t("title")}
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/50">
            {t("subtitle")}
          </p>
        </div>

        {loading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="h-[360px] animate-pulse rounded-3xl border border-white/10 bg-white/[0.05]"
              />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-10 text-center">
            <h2 className="text-2xl font-semibold">
              {t("emptyTitle")}
            </h2>

            <p className="mt-3 text-sm text-white/50">
              {t("emptyText")}
            </p>

            <Link
              href="/search"
              className="mt-6 inline-flex rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black hover:bg-white/90"
            >
              {t("browseListings")}
            </Link>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => {
              const listing = item.listings;
              const cover = getCover(item);

              if (!listing) return null;

              return (
                <div
                  key={item.id}
                  className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] transition hover:-translate-y-1 hover:bg-white/[0.07]"
                >
                  <div className="relative aspect-[4/3] bg-white/5">
                    {cover ? (
                      <Image
                        src={cover}
                        alt={listing.title || t("listingAlt")}
                        fill
                        sizes="(max-width: 768px) 100vw, 33vw"
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-white/30">
                        {t("noImage")}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="absolute right-3 top-3 rounded-full bg-black/60 p-2 text-white backdrop-blur hover:bg-red-500/80"
                    >
                      <Trash2 size={17} />
                    </button>

                    <div className="absolute bottom-3 left-3 rounded-full bg-white px-3 py-1 text-sm font-bold text-black">
                      ${listing.price ?? t("ask")}{t("perMonthCompact")}
                    </div>
                  </div>

                  <Link href={`/listings/${listing.id}`} className="block p-4">
                    <h2 className="line-clamp-1 text-lg font-semibold">
                      {listing.title || t("untitledListing")}
                    </h2>

                    <div className="mt-2 flex items-center gap-2 text-sm text-white/50">
                      <MapPin size={15} />

                      <span className="line-clamp-1">
                        {listing.city || t("cityHidden")}
                        {listing.campus ? ` • ${listing.campus}` : ""}
                      </span>
                    </div>

                    <div className="mt-4 text-xs text-white/40">
                      {t("viewed", {
                        date: new Date(item.viewed_at).toLocaleDateString(
                          "en-CA"
                        ),
                      })}
                    </div>
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
