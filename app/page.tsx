"use client";

import { useEffect, useState } from "react";
import ListingsExplorer from "@/components/ListingsExplorer";
import { createClient } from "@/lib/supabase/client";

export default function HomePage() {
  const supabase = createClient();

  const [listings, setListings] = useState<any[]>([]);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");

  useEffect(() => {
    async function loadListings() {
      try {
        setLoading(true);
        setPageError("");

        const {
          data: { user },
        } = await supabase.auth.getUser();

        setUserEmail(user?.email || null);

        const { data, error } = await supabase
          .from("listings")
          .select(`
            id,
            title,
            city,
            location,
            campus,
            price,
            status,
            created_at,
            latitude,
            longitude,
            listing_images (
              image_url,
              is_cover,
              sort_order
            )
          `)
          .order("created_at", { ascending: false });

        if (error) {
          console.error("LISTINGS FETCH ERROR:", error);
          setPageError(error.message);
          return;
        }

        const formatted =
          data?.map((listing: any) => {
            const images = listing.listing_images || [];

            const cover =
              images.find((img: any) => img.is_cover)?.image_url ||
              images.sort(
                (a: any, b: any) =>
                  (a.sort_order ?? 0) - (b.sort_order ?? 0)
              )[0]?.image_url ||
              null;

            return {
              id: listing.id,
              title: listing.title,
              city: listing.city || listing.location,
              campus: listing.campus,
              price: listing.price,
              status: listing.status || "available",
              created_at: listing.created_at,
              cover_image: cover,
              latitude: listing.latitude,
              longitude: listing.longitude,
            };
          }) || [];

        setListings(formatted);
      } catch (error: any) {
        console.error("HOME PAGE FETCH CRASH:", error);
        setPageError(error?.message || "Unable to load listings.");
      } finally {
        setLoading(false);
      }
    }

    loadListings();
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen bg-black px-5 py-10 text-white">
        <div className="mx-auto max-w-[1600px]">
          <div className="mb-8 h-9 w-80 animate-pulse rounded-full bg-zinc-800" />
          <div className="mb-8 h-20 animate-pulse rounded-3xl border border-zinc-800 bg-zinc-950" />

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950"
              >
                <div className="h-60 animate-pulse bg-zinc-900" />
                <div className="space-y-4 p-5">
                  <div className="h-5 w-3/4 animate-pulse rounded-full bg-zinc-800" />
                  <div className="h-4 w-1/2 animate-pulse rounded-full bg-zinc-800" />
                  <div className="h-6 w-1/3 animate-pulse rounded-full bg-zinc-800" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    );
  }

  if (pageError) {
    return (
      <main className="min-h-screen bg-black px-6 py-10 text-white">
        <div className="mx-auto max-w-2xl rounded-3xl border border-red-500/30 bg-red-500/10 p-6">
          <h1 className="text-2xl font-bold text-red-300">
            Error loading listings
          </h1>

          <p className="mt-3 text-sm text-red-100/80">{pageError}</p>

          <button
            onClick={() => window.location.reload()}
            className="mt-5 rounded-xl bg-white px-5 py-3 font-bold text-black"
          >
            Reload Page
          </button>
        </div>
      </main>
    );
  }

  return <ListingsExplorer initialListings={listings} userEmail={userEmail} />;
}