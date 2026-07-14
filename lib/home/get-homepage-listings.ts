import { createClient } from "@/lib/supabase/server";
import { getSafePublicCoordinate } from "@/lib/location-privacy";
import { HomeListing } from "@/types/home-listing";

function isMissingPublicCoordinateColumn(error: unknown) {
  const typedError = error as { code?: string | null; message?: string | null };
  const message = typedError?.message || "";

  return (
    (typedError?.code === "42703" || typedError?.code === "PGRST204") &&
    (message.includes("public_latitude") ||
      message.includes("public_longitude"))
  );
}

export async function getHomepageListings(): Promise<HomeListing[]> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  function createListingQuery(includePublicCoordinates: boolean) {
    return supabase
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
        ${includePublicCoordinates ? "public_latitude, public_longitude," : "latitude, longitude,"}
        created_at,
        listing_images (
          image_url,
          sort_order,
          is_cover
        )
      `
      )
      .neq("status", "rented")
      .neq("status", "draft")
      .order("created_at", { ascending: false })
      .limit(80);
  }

  let { data: listings, error } = await createListingQuery(true);

  if (error && isMissingPublicCoordinateColumn(error)) {
    console.error(
      "HOMEPAGE LISTINGS PUBLIC COORDINATE FALLBACK:",
      JSON.stringify({
        code: error.code,
        message: error.message,
      })
    );

    const legacyResult = await createListingQuery(false);
    listings = legacyResult.data;
    error = legacyResult.error;
  }

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
      const safeCoordinate = getSafePublicCoordinate({
        id: listing.id,
        latitude: listing.latitude,
        longitude: listing.longitude,
        publicLatitude: listing.public_latitude,
        publicLongitude: listing.public_longitude,
      });

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
        latitude: safeCoordinate.latitude ?? null,
        longitude: safeCoordinate.longitude ?? null,
        created_at: listing.created_at,
        image_url: cover,
        is_saved: savedIds.has(listing.id),
      };
    }) ?? []
  );
}
