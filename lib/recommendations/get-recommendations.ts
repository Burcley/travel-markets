import { createClient } from "@/lib/supabase/server";

export async function getRecommendations(listingId: string) {
  const supabase = await createClient();

  const { data: currentListing, error: currentError } = await supabase
    .from("listings")
    .select("id, city, campus, price, bedrooms, bathrooms, guests")
    .eq("id", listingId)
    .maybeSingle();

  if (currentError || !currentListing) return [];

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
    .neq("status", "rented")
    .or(
      `city.ilike.%${currentListing.city || ""}%,campus.ilike.%${
        currentListing.campus || ""
      }%`
    )
    .gte("price", minPrice)
    .lte("price", maxPrice)
    .limit(6);

  if (error) return [];

  return (data || []).map((listing: any) => {
    const images = Array.isArray(listing.listing_images)
      ? listing.listing_images
      : [];

    const sortedImages = [...images].sort(
      (a: any, b: any) => (a.sort_order ?? 999) - (b.sort_order ?? 999)
    );

    const cover =
      images.find((img: any) => img.is_cover)?.image_url ||
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