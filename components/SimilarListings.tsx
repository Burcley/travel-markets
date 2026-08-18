"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

type SimilarListingsProps = {
  currentListingId: string;
  city?: string | null;
  campus?: string | null;
  price?: number | null;
};

type SimilarListing = {
  id: string;
  title: string;
  city?: string | null;
  location?: string | null;
  campus?: string | null;
  price?: number | null;
  image_url?: string | null;
  cover_image_url?: string | null;
  cover_image?: string | null;
};

type SimilarListingsResponse = {
  listings?: SimilarListing[];
};

export default function SimilarListings({
  currentListingId,
  city,
  campus,
  price,
}: SimilarListingsProps) {
  const t = useTranslations("similarListings");
  const [listings, setListings] = useState<SimilarListing[]>([]);

  useEffect(() => {
    async function loadSimilarListings() {
      const params = new URLSearchParams({
        page: "1",
      });

      if (city) {
        params.set("city", city);
      }

      if (campus) {
        params.set("campus", campus);
      }

      if (price) {
        params.set("minPrice", String(Math.max(0, price - 300)));
        params.set("maxPrice", String(price + 300));
      }

      const response = await fetch(`/api/search-listings?${params.toString()}`);

      if (!response.ok) {
        console.error("SIMILAR LISTINGS ERROR:", response.status);
        return;
      }

      const result = (await response.json()) as SimilarListingsResponse;
      const formatted =
        result.listings
          ?.filter((listing) => listing.id !== currentListingId)
          .slice(0, 4)
          .map((listing) => ({
            ...listing,
            cover_image: listing.image_url || listing.cover_image_url || null,
          })) || [];

      setListings(formatted);
    }

    loadSimilarListings();
  }, [currentListingId, city, campus, price]);

  if (listings.length === 0) return null;

  return (
    <section className="mt-14 border-t border-zinc-800 pt-10">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white">{t("title")}</h2>
        <p className="mt-1 text-sm text-zinc-400">
          {t("subtitle")}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {listings.map((listing) => (
          <Link
            key={listing.id}
            href={`/listings/${listing.id}`}
            className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950 transition hover:-translate-y-1 hover:border-zinc-600"
          >
            <div className="h-44 bg-zinc-900">
              {listing.cover_image ? (
                <img
                  src={listing.cover_image}
                  alt={listing.title}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-zinc-500">
                  {t("noImage")}
                </div>
              )}
            </div>

            <div className="p-4">
              <h3 className="line-clamp-1 font-bold text-white">
                {listing.title}
              </h3>

              <p className="mt-1 line-clamp-1 text-sm text-zinc-400">
                {listing.city || listing.location || t("areaHidden")}
                {listing.campus ? ` • ${listing.campus}` : ""}
              </p>

              <p className="mt-3 font-bold text-white">
                ${listing.price || 0}
                <span className="text-sm font-normal text-zinc-500">
                  {" "}
                  {t("perMonthSlash")}
                </span>
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
