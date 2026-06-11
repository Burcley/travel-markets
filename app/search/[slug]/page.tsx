import TravelMarketsHome from "@/components/home/TravelMarketsHome";
import { searchListings } from "@/lib/listings/search-listings";
import type { ListingSearchParams } from "@/lib/listings/search-types";
import { getTrendingListings } from "@/lib/trending/get-trending-listings";
import { getTrendingCities } from "@/lib/trending/get-trending-cities";

export const dynamic = "force-dynamic";

function formatSlug(slug: string) {
  return decodeURIComponent(slug)
    .replaceAll("-", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const location = formatSlug(slug);

  return {
    title: `${location} Rentals | Travel Markets`,
    description: `Find rentals near ${location}. Browse verified listings, prices, rooms, map locations, and viewing options on Travel Markets.`,
  };
}

export default async function SearchSlugPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<ListingSearchParams>;
}) {
  const { slug } = await params;
  const extraParams = await searchParams;

  const location = formatSlug(slug);

  const [result, trendingListings, trendingCities] = await Promise.all([
    searchListings({
      ...extraParams,
      q: extraParams.q || location,
      page: extraParams.page || "1",
    }),
    getTrendingListings(),
    getTrendingCities(),
  ]);

  return (
    <TravelMarketsHome
      initialListings={result.listings as any}
      initialPage={result.page}
      hasMore={result.hasMore}
      totalCount={result.count}
      trendingListings={trendingListings as any}
      trendingCities={trendingCities as any}
    />
  );
}