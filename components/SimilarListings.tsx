"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type SimilarListingsProps = {
  currentListingId: string;
  city?: string | null;
  campus?: string | null;
  price?: number | null;
};

export default function SimilarListings({
  currentListingId,
  city,
  campus,
  price,
}: SimilarListingsProps) {
  const supabase = createClient();
  const [listings, setListings] = useState<any[]>([]);

  useEffect(() => {
    async function loadSimilarListings() {
      let query = supabase
        .from("listings")
        .select(`
          id,
          title,
          city,
          location,
          campus,
          price,
          status,
          listing_images (
            image_url,
            is_cover,
            sort_order
          )
        `)
        .neq("id", currentListingId)
        .limit(4);

      if (city) {
        query = query.or(`city.ilike.%${city}%,location.ilike.%${city}%`);
      }

      if (campus) {
        query = query.ilike("campus", `%${campus}%`);
      }

      if (price) {
        query = query
          .gte("price", Math.max(0, price - 300))
          .lte("price", price + 300);
      }

      const { data, error } = await query;

      if (error) {
        console.error("SIMILAR LISTINGS ERROR:", error);
        return;
      }

      const formatted =
        data?.map((listing: any) => {
          const images = listing.listing_images || [];

          const cover =
            images.find((img: any) => img.is_cover)?.image_url ||
            images.sort(
              (a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
            )[0]?.image_url ||
            null;

          return {
            ...listing,
            cover_image: cover,
          };
        }) || [];

      setListings(formatted);
    }

    loadSimilarListings();
  }, [currentListingId, city, campus, price]);

  if (listings.length === 0) return null;

  return (
    <section className="mt-14 border-t border-zinc-800 pt-10">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white">Similar listings</h2>
        <p className="mt-1 text-sm text-zinc-400">
          More places near this area and price range.
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
                  No Image
                </div>
              )}
            </div>

            <div className="p-4">
              <h3 className="line-clamp-1 font-bold text-white">
                {listing.title}
              </h3>

              <p className="mt-1 line-clamp-1 text-sm text-zinc-400">
                {listing.city || listing.location || "Area hidden"}
                {listing.campus ? ` • ${listing.campus}` : ""}
              </p>

              <p className="mt-3 font-bold text-white">
                ${listing.price || 0}
                <span className="text-sm font-normal text-zinc-500">
                  {" "}
                  / month
                </span>
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}