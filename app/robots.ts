import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "https://travelmarkets.ca";

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api", "/messages", "/dashboard"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}