import { createClient } from "@/lib/supabase/server";
import { HomeListing } from "@/types/home-listing";

export async function getHomepageListings(): Promise<HomeListing[]> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: listings, error } = await supabase
    .from("listings")
    .select(
      `
      id,
      title,
      price,
      city,
      campus,
      bedrooms,
      bathrooms,
      guests,
      status,
      latitude,
      longitude,
      created_at,
      listing_images (
        image_url,
        sort_order,
        is_cover
      )
    `
    )
    .neq("status", "rented")
    .order("created_at", { ascending: false })
    .limit(80);

  if (error) {
    console.error("Homepage listings error:", error.message);
    return [];
  }

  let savedIds = new Set<string>();

  if (user) {
    const { data: saved } = await supabase
      .from("saved_listings")
      .select("listing_id")
      .eq("user_id", user.id);

    savedIds = new Set(saved?.map((item) => item.listing_id));
  }

  return (
    listings?.map((listing: any) => {
      const images = listing.listing_images || [];

      const cover =
        images.find((img: any) => img.is_cover)?.image_url ||
        images.sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))[0]
          ?.image_url ||
        null;

      return {
        id: listing.id,
        title: listing.title,
        price: listing.price,
        city: listing.city,
        campus: listing.campus,
        bedrooms: listing.bedrooms,
        bathrooms: listing.bathrooms,
        guests: listing.guests,
        status: listing.status,
        latitude: listing.latitude,
        longitude: listing.longitude,
        created_at: listing.created_at,
        image_url: cover,
        is_saved: savedIds.has(listing.id),
      };
    }) ?? []
  );
}