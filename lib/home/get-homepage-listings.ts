import { createClient } from "@/lib/supabase/server";
import { getSafePublicCoordinate } from "@/lib/location-privacy";
import { HomeListing } from "@/types/home-listing";
import {
  getVerifiedPublicListingIds,
  PUBLIC_LISTING_STATUS,
} from "@/lib/listings/public-visibility";

type HomepageListingImage = {
  image_url?: string | null;
  sort_order?: number | null;
  is_cover?: boolean | null;
};

type HomepageListingRow = {
  id: string;
  title?: string | null;
  price?: number | null;
  city?: string | null;
  campus?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  guests?: number | null;
  status?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  public_latitude?: number | null;
  public_longitude?: number | null;
  created_at?: string | null;
  listing_images?: HomepageListingImage[] | null;
};

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
  let verifiedListingIds: string[] = [];

  try {
    verifiedListingIds = await getVerifiedPublicListingIds(supabase as never);
  } catch (error) {
    console.error("HOMEPAGE VERIFIED LISTING GATE ERROR:", error);
    return [];
  }

  if (verifiedListingIds.length === 0) return [];

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
      .eq("status", PUBLIC_LISTING_STATUS)
      .in("id", verifiedListingIds)
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
    ((listings || []) as HomepageListingRow[]).map((listing) => {
      const images = listing.listing_images || [];

      const cover =
        images.find((img) => img.is_cover)?.image_url ||
        images.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))[0]
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
        title: listing.title || "Untitled listing",
        price: listing.price ?? null,
        city: listing.city ?? null,
        campus: listing.campus ?? null,
        bedrooms: listing.bedrooms ?? null,
        bathrooms: listing.bathrooms ?? null,
        guests: listing.guests ?? null,
        status: listing.status ?? null,
        latitude: safeCoordinate.latitude ?? null,
        longitude: safeCoordinate.longitude ?? null,
        created_at: listing.created_at || new Date(0).toISOString(),
        image_url: cover,
        is_saved: savedIds.has(listing.id),
      };
    }) ?? []
  );
}
