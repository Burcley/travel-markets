import { createClient } from "@/lib/supabase/server";

type ListingImage = {
  image_url: string | null;
  is_cover: boolean | null;
  sort_order: number | null;
};

type TrendingListing = {
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

type ListingViewRow = {
  listing_id: string | null;
  listings: TrendingListing | null;
};

type TrendingListingResult = {
  id: string;
  title: string;
  city: string | null;
  campus: string | null;
  price: number | null;
  status: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  guests: number | null;
  image_url: string | null;
  view_count: number;
};

export async function getTrendingListings() {
  const supabase = await createClient();

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { data, error } = await supabase
    .from("listing_views")
    .select(
      `
      listing_id,
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
    .gte("viewed_at", sevenDaysAgo.toISOString());

  if (error) {
    console.error("TRENDING LISTINGS ERROR:", error);
    return [];
  }

  const rows = (data ?? []) as unknown as ListingViewRow[];

  const grouped = new Map<string, TrendingListingResult>();

  for (const row of rows) {
    const listing = row.listings;

    if (!listing?.id) continue;

    const existing = grouped.get(listing.id);

    if (existing) {
      existing.view_count += 1;
      continue;
    }

    const images = Array.isArray(listing.listing_images)
      ? listing.listing_images
      : [];

    const sortedImages = [...images].sort(
      (a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999)
    );

    const cover =
      images.find((image) => image.is_cover)?.image_url ||
      sortedImages[0]?.image_url ||
      null;

    grouped.set(listing.id, {
      id: listing.id,
      title: listing.title || "Untitled listing",
      city: listing.city,
      campus: listing.campus,
      price: listing.price,
      status: listing.status,
      bedrooms: listing.bedrooms,
      bathrooms: listing.bathrooms,
      guests: listing.guests,
      image_url: cover,
      view_count: 1,
    });
  }

  return Array.from(grouped.values())
    .sort((a, b) => b.view_count - a.view_count)
    .slice(0, 8);
}