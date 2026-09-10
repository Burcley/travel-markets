import type { Metadata } from "next";
import BrockLandingClient from "@/components/brock/BrockLandingClient";
import { searchListings } from "@/lib/listings/search-listings";
import { buildBrockSearchUrl, BROCK_SEARCH_FILTERS } from "@/lib/brock/search-links";

export const dynamic = "force-dynamic";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://travelmarkets.ca";

export const metadata: Metadata = {
  title: "Student Housing Near Brock University | Travel Markets",
  description:
    "Browse student rentals near Brock University. Compare prices, commute times and available housing, then connect directly with landlords on Travel Markets.",
  alternates: {
    canonical: `${siteUrl}/brock`,
  },
  openGraph: {
    title: "Student Housing Near Brock University | Travel Markets",
    description:
      "Browse student rentals near Brock University and connect directly with landlords on Travel Markets.",
    url: `${siteUrl}/brock`,
    siteName: "Travel Markets",
    type: "website",
  },
};

export default async function BrockPage() {
  const result = await searchListings({
    city: BROCK_SEARCH_FILTERS.city,
    campus: BROCK_SEARCH_FILTERS.campus,
    sort: BROCK_SEARCH_FILTERS.sort,
  });
  const listings = result.listings.map((listing) => ({
    ...listing,
    city: listing.city ?? null,
    campus: listing.campus ?? null,
    price: listing.price ?? null,
    bedrooms: listing.bedrooms ?? null,
    bathrooms: listing.bathrooms ?? null,
    guests: listing.guests ?? null,
    status: listing.status ?? null,
    latitude: listing.latitude ?? null,
    longitude: listing.longitude ?? null,
    created_at: listing.created_at ?? "",
    image_url: listing.image_url ?? null,
    cover_image_url: listing.cover_image_url ?? null,
  }));
  const minPrice =
    listings.length > 0
      ? listings.reduce<number | null>((lowest, listing) => {
          if (listing.price == null) return lowest;
          if (lowest == null) return listing.price;
          return Math.min(lowest, listing.price);
        }, null)
      : null;

  return (
    <>
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebPage",
            name: "Student Housing Near Brock University",
            url: `${siteUrl}/brock`,
            description: metadata.description,
            potentialAction: {
              "@type": "SearchAction",
              target: `${siteUrl}${buildBrockSearchUrl()}`,
              queryInput: "required name=search_term_string",
            },
          }),
        }}
      />
      <BrockLandingClient
        listings={listings}
        totalCount={result.count}
        minPrice={minPrice}
      />
    </>
  );
}
