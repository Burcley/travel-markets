import { createClient } from "@/lib/supabase/server";

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

  const grouped = new Map<string, any>();

  for (const row of data || []) {
    const listing = row.listings;

    if (!listing?.id) continue;

    const existing = grouped.get(listing.id);

    if (existing) {
      existing.view_count += 1;
    } else {
      const images = Array.isArray(listing.listing_images)
        ? listing.listing_images
        : [];

      const sortedImages = [...images].sort(
        (a: any, b: any) => (a.sort_order ?? 999) - (b.sort_order ?? 999)
      );

      const cover =
        images.find((image: any) => image.is_cover)?.image_url ||
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
  }

  return Array.from(grouped.values())
    .sort((a, b) => b.view_count - a.view_count)
    .slice(0, 8);
}