import { createClient } from "@/lib/supabase/server";
import {
  getVerifiedPublicListingIds,
  PUBLIC_LISTING_STATUS,
} from "@/lib/listings/public-visibility";

type RecommendationListingImage = {
  image_url?: string | null;
  is_cover?: boolean | null;
  sort_order?: number | null;
};

type RecommendationListingRow = {
  id: string;
  title?: string | null;
  city?: string | null;
  campus?: string | null;
  price?: number | null;
  status?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  guests?: number | null;
  listing_images?: RecommendationListingImage[] | null;
};

export async function getRecommendations(listingId: string) {
  const supabase = await createClient();

  const { data: currentListing, error: currentError } = await supabase
    .from("listings")
    .select("id, city, campus, price, bedrooms, bathrooms, guests")
    .eq("id", listingId)
    .maybeSingle();

  if (currentError || !currentListing) return [];
  const verifiedListingIds = await getVerifiedPublicListingIds(
    supabase as never
  );

  if (verifiedListingIds.length === 0) return [];

  const minPrice = currentListing.price ? currentListing.price * 0.75 : 0;
  const maxPrice = currentListing.price ? currentListing.price * 1.25 : 999999;

  const { data, error } = await supabase
    .from("listings")
    .select(
      `
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
    `
    )
    .neq("id", listingId)
    .eq("status", PUBLIC_LISTING_STATUS)
    .in("id", verifiedListingIds)
    .or(
      `city.ilike.%${currentListing.city || ""}%,campus.ilike.%${
        currentListing.campus || ""
      }%`
    )
    .gte("price", minPrice)
    .lte("price", maxPrice)
    .limit(6);

  if (error) return [];

  return ((data || []) as RecommendationListingRow[]).map((listing) => {
    const images = Array.isArray(listing.listing_images)
      ? listing.listing_images
      : [];

    const sortedImages = [...images].sort(
      (a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999)
    );

    const cover =
      images.find((img) => img.is_cover)?.image_url ||
      sortedImages[0]?.image_url ||
      null;

    return {
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
    };
  });
}
