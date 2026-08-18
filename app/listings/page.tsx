"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import AdvancedListingFilters from "@/components/AdvancedListingFilters";

const PUBLIC_LISTING_STATUS = "available";
const VERIFIED_LISTING_STATUS = "verified";

type ListingImage = {
  image_url: string;
  is_cover: boolean | null;
  sort_order: number | null;
};

type Listing = {
  id: string;
  title: string;
  price: number | null;
  city: string | null;
  address: string | null;
  campus: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  status: "available" | "pending" | "rented" | null;
  created_at: string;
  listing_images?: ListingImage[];
};

export default function ListingsPage() {
  const t = useTranslations("finalBatchD.listingsPage");
  const supabase = useMemo(() => createClient(), []);

  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  const [filters, setFilters] = useState({
    bedrooms: "any",
    bathrooms: "any",
    minPrice: 0,
    maxPrice: 5000,
    status: "any",
  });

  useEffect(() => {
    async function fetchListings() {
      setLoading(true);
      const { data: verifiedRows, error: verifiedError } = await supabase
        .from("public_listing_verification_status")
        .select("listing_id")
        .eq("status", VERIFIED_LISTING_STATUS);

      if (verifiedError) {
        console.error("Error fetching verified listings:", verifiedError.message);
        setListings([]);
        setLoading(false);
        return;
      }

      const verifiedListingIds =
        verifiedRows?.map((row) => row.listing_id).filter(Boolean) || [];

      if (verifiedListingIds.length === 0) {
        setListings([]);
        setLoading(false);
        return;
      }

      let query = supabase
        .from("listings")
        .select(
          `
          id,
          title,
          price,
          city,
          address,
          campus,
          bedrooms,
          bathrooms,
          status,
          created_at,
          listing_images (
            image_url,
            is_cover,
            sort_order
          )
        `
        )
        .eq("status", PUBLIC_LISTING_STATUS)
        .in("id", verifiedListingIds)
        .order("created_at", { ascending: false });

      query = query.gte("price", filters.minPrice);
      query = query.lte("price", filters.maxPrice);

      if (filters.bedrooms !== "any") {
        query = query.gte("bedrooms", Number(filters.bedrooms));
      }

      if (filters.bathrooms !== "any") {
        query = query.gte("bathrooms", Number(filters.bathrooms));
      }

      if (filters.status !== "any" && filters.status !== PUBLIC_LISTING_STATUS) {
        setListings([]);
        setLoading(false);
        return;
      }

      if (filters.status === PUBLIC_LISTING_STATUS) {
        query = query.eq("status", filters.status);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching listings:", error.message);
        setListings([]);
      } else {
        setListings((data || []) as Listing[]);
      }

      setLoading(false);
    }

    const timer = setTimeout(fetchListings, 250);
    return () => clearTimeout(timer);
  }, [filters, supabase]);

  const totalResults = listings.length;

  function getCoverImage(listing: Listing) {
    const images = listing.listing_images || [];

    const cover = images.find((img) => img.is_cover);
    if (cover?.image_url) return cover.image_url;

    const sorted = [...images].sort(
      (a, b) => (a.sort_order || 0) - (b.sort_order || 0)
    );

    return sorted[0]?.image_url || "/placeholder-listing.jpg";
  }

  function getLocationText(listing: Listing) {
    const parts = [listing.city, listing.campus, listing.address].filter(Boolean);
    return parts.length > 0 ? parts.join(" • ") : t("locationMissing");
  }

  function getStatusStyle(status: Listing["status"]) {
    if (status === "available") {
      return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
    }

    if (status === "pending") {
      return "bg-yellow-500/15 text-yellow-400 border-yellow-500/30";
    }

    if (status === "rented") {
      return "bg-red-500/15 text-red-400 border-red-500/30";
    }

    return "bg-gray-500/15 text-gray-400 border-gray-500/30";
  }

  return (
    <main className="min-h-screen bg-black px-4 py-8 text-white md:px-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <h1 className="text-3xl font-bold md:text-5xl">
              {t("title")}
            </h1>
            <p className="mt-3 max-w-2xl text-gray-400">
              {t("subtitle")}
            </p>
          </div>

          <Link
            href="/listings/create"
            className="rounded-full bg-white px-6 py-3 font-medium text-black hover:bg-gray-200"
          >
            {t("createListing")}
          </Link>
        </div>

        <AdvancedListingFilters filters={filters} setFilters={setFilters} />

        <div className="mt-6 flex items-center justify-between">
          <p className="text-sm text-gray-400">
            {loading
              ? t("searching")
              : t("resultsFound", { count: totalResults })}
          </p>
        </div>

        {loading ? (
          <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((item) => (
              <div
                key={item}
                className="h-[360px] animate-pulse rounded-3xl bg-white/10"
              />
            ))}
          </div>
        ) : listings.length === 0 ? (
          <div className="mt-10 rounded-3xl border border-white/10 bg-[#111111] p-10 text-center">
            <h2 className="text-2xl font-semibold">{t("emptyTitle")}</h2>
            <p className="mt-2 text-gray-400">
              {t("emptyText")}
            </p>
          </div>
        ) : (
          <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {listings.map((listing) => (
              <Link
                key={listing.id}
                href={`/listings/${listing.id}`}
                className="group overflow-hidden rounded-3xl border border-white/10 bg-[#111111] shadow-xl transition hover:-translate-y-1 hover:border-white/20"
              >
                <div className="relative h-64 w-full overflow-hidden bg-white/5">
                  <Image
                    src={getCoverImage(listing)}
                    alt={listing.title}
                    fill
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="object-cover transition duration-500 group-hover:scale-105"
                  />

                  <div
                    className={`absolute left-4 top-4 rounded-full border px-3 py-1 text-xs font-medium capitalize ${getStatusStyle(
                      listing.status
                    )}`}
                  >
                    {listing.status || t("unknown")}
                  </div>
                </div>

                <div className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h2 className="line-clamp-1 text-xl font-semibold text-white">
                        {listing.title}
                      </h2>

                      <p className="mt-1 line-clamp-2 text-sm text-gray-400">
                        📍 {getLocationText(listing)}
                      </p>
                    </div>

                    <p className="whitespace-nowrap text-lg font-bold">
                      ${listing.price || 0}
                    </p>
                  </div>

                  <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-gray-300">
                    <span className="rounded-full bg-white/10 px-3 py-1">
                      {t("bed", { count: listing.bedrooms ?? 0 })}
                    </span>

                    <span className="rounded-full bg-white/10 px-3 py-1">
                      {t("bath", { count: listing.bathrooms ?? 0 })}
                    </span>

                    {listing.campus && (
                      <span className="rounded-full bg-white/10 px-3 py-1">
                        🎓 {listing.campus}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
