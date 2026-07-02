"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";

type SavedRow = {
  id: string;
  user_id: string;
  listing_id: string;
  created_at: string;
};

type Listing = {
  id: string;
  user_id: string;
  title: string;
  price: number | null;
  description: string | null;
  created_at: string;
};

type ListingImage = {
  listing_id: string;
  image_url: string;
  sort_order: number | null;
  is_cover: boolean | null;
};

export default function SavedListingsPage() {
  const t = useTranslations("accountPages.savedListings");
  const router = useRouter();
  const supabase = createClient();

  const [savedRows, setSavedRows] = useState<SavedRow[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [images, setImages] = useState<ListingImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);

  useEffect(() => {
    loadSavedListings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadSavedListings() {
    try {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/auth");
        return;
      }

      const { data: savedData, error: savedError } = await supabase
        .from("saved_listings")
        .select("id, user_id, listing_id, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (savedError) {
        alert(savedError.message);
        return;
      }

      const rows = (savedData || []) as SavedRow[];
      setSavedRows(rows);

      const listingIds = rows.map((row) => row.listing_id);

      if (listingIds.length === 0) {
        setListings([]);
        setImages([]);
        return;
      }

      const { data: listingData, error: listingError } = await supabase
        .from("listings")
        .select("id, user_id, title, price, description, created_at")
        .in("id", listingIds);

      if (listingError) {
        alert(listingError.message);
        return;
      }

      setListings((listingData || []) as Listing[]);

      const { data: imageData } = await supabase
        .from("listing_images")
        .select("listing_id, image_url, sort_order, is_cover")
        .in("listing_id", listingIds);

      setImages((imageData || []) as ListingImage[]);
    } finally {
      setLoading(false);
    }
  }

  async function removeSavedListing(listingId: string) {
    try {
      setWorkingId(listingId);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/auth");
        return;
      }

      const { error } = await supabase
        .from("saved_listings")
        .delete()
        .eq("user_id", user.id)
        .eq("listing_id", listingId);

      if (error) {
        alert(error.message);
        return;
      }

      await loadSavedListings();
    } finally {
      setWorkingId(null);
    }
  }

  function getListing(listingId: string) {
    return listings.find((listing) => listing.id === listingId);
  }

  function getListingImage(listingId: string) {
    const listingImages = images.filter(
      (image) => image.listing_id === listingId
    );

    const cover = listingImages.find(
      (image) => image.is_cover && image.image_url
    );

    if (cover?.image_url) return cover.image_url;

    const sorted = [...listingImages].sort(
      (a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999)
    );

    return sorted[0]?.image_url || null;
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black px-6 py-10 text-white">
        {t("loading")}
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-4 py-8 text-white">
      <div className="mx-auto max-w-7xl space-y-8">
        <section className="rounded-3xl border border-gray-800 bg-[#070707] p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-4xl font-bold">{t("title")}</h1>
              <p className="mt-2 text-gray-400">{t("subtitle")}</p>
            </div>

            <Link
              href="/"
              className="rounded-xl bg-white px-5 py-3 font-semibold text-black"
            >
              {t("browseListings")}
            </Link>
          </div>
        </section>

        {savedRows.length === 0 ? (
          <section className="rounded-3xl border border-dashed border-gray-700 bg-[#070707] p-10 text-center">
            <h2 className="text-2xl font-bold">{t("emptyTitle")}</h2>
            <p className="mt-3 text-gray-400">
              {t("emptyText")}
            </p>

            <Link
              href="/"
              className="mt-6 inline-flex rounded-xl bg-white px-6 py-3 font-semibold text-black"
            >
              {t("findListings")}
            </Link>
          </section>
        ) : (
          <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {savedRows.map((row) => {
              const listing = getListing(row.listing_id);

              if (!listing) return null;

              const image = getListingImage(listing.id);

              return (
                <div
                  key={row.id}
                  className="overflow-hidden rounded-3xl border border-gray-800 bg-[#070707]"
                >
                  <Link href={`/listings/${listing.id}`}>
                    <div className="h-60 bg-gray-900">
                      {image ? (
                        <img
                          src={image}
                          alt={listing.title}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-gray-500">
                          {t("noImage")}
                        </div>
                      )}
                    </div>
                  </Link>

                  <div className="p-5">
                    <Link href={`/listings/${listing.id}`}>
                      <h2 className="line-clamp-1 text-xl font-bold hover:underline">
                        {listing.title}
                      </h2>
                    </Link>

                    <p className="mt-4 text-2xl font-bold">
                      ${listing.price || 0}
                      <span className="text-sm font-normal text-gray-400">
                        {" "}
                        {t("perMonth")}
                      </span>
                    </p>

                    <p className="mt-3 line-clamp-2 text-sm leading-6 text-gray-400">
                      {listing.description || t("noDescription")}
                    </p>

                    <div className="mt-5 flex gap-3">
                      <Link
                        href={`/listings/${listing.id}`}
                        className="flex-1 rounded-xl bg-white px-5 py-3 text-center font-semibold text-black"
                      >
                        {t("view")}
                      </Link>

                      <button
                        onClick={() => removeSavedListing(listing.id)}
                        disabled={workingId === listing.id}
                        className="flex-1 rounded-xl border border-red-500/30 bg-red-500/10 px-5 py-3 font-semibold text-red-300 disabled:bg-gray-700"
                      >
                        {workingId === listing.id ? t("removing") : t("unsave")}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
}
