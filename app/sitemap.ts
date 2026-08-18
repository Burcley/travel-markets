import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";
import {
  getVerifiedPublicListingIds,
  PUBLIC_LISTING_STATUS,
} from "@/lib/listings/public-visibility";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "https://travelmarkets.ca";

  const supabase = await createClient();
  let verifiedListingIds: string[] = [];

  try {
    verifiedListingIds = await getVerifiedPublicListingIds(supabase as never);
  } catch {
    verifiedListingIds = [];
  }

  const staticRoutes: MetadataRoute.Sitemap = [
    "",
    "/search",
    "/about",
    "/landlords",
    "/faq",
    "/contact",
    "/safety",
    "/privacy",
    "/terms",
    "/billing",
  ].map((route) => ({
    url: `${siteUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: route === "" || route === "/search" ? "daily" : "weekly",
    priority: route === "" ? 1 : route === "/search" ? 0.9 : 0.7,
  }));

  const { data: listings } = verifiedListingIds.length
    ? await supabase
        .from("listings")
        .select("id, updated_at, created_at")
        .eq("status", PUBLIC_LISTING_STATUS)
        .in("id", verifiedListingIds)
        .limit(5000)
    : { data: [] };

  const listingRoutes: MetadataRoute.Sitemap =
    listings?.map((listing) => ({
      url: `${siteUrl}/listings/${listing.id}`,
      lastModified: new Date(listing.updated_at || listing.created_at),
      changeFrequency: "daily",
      priority: 0.9,
    })) || [];

  return [...staticRoutes, ...listingRoutes];
}
