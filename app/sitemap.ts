import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "https://travelmarkets.ca";

  const supabase = await createClient();

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

  const { data: listings } = await supabase
    .from("listings")
    .select("id, updated_at, created_at")
    .eq("status", "available")
    .limit(5000);

  const listingRoutes: MetadataRoute.Sitemap =
    listings?.map((listing) => ({
      url: `${siteUrl}/listings/${listing.id}`,
      lastModified: new Date(listing.updated_at || listing.created_at),
      changeFrequency: "daily",
      priority: 0.9,
    })) || [];

  return [...staticRoutes, ...listingRoutes];
}