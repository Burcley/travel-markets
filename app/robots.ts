import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "https://travelmarkets.ca";

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/api",
        "/dashboard",
        "/messages",
        "/profile",
        "/my-listings",
        "/inquiries",
        "/viewings",
        "/notifications",
      ],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}