import TravelMarketsHome from "@/components/home/TravelMarketsHome";
import { searchListings } from "@/lib/listings/search-listings";
import type { ListingSearchParams } from "@/lib/listings/search-types";
import { getTrendingListings } from "@/lib/trending/get-trending-listings";
import { getTrendingCities } from "@/lib/trending/get-trending-cities";

export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<ListingSearchParams>;
}) {
  const params = await searchParams;

  const [result, trendingListings, trendingCities] = await Promise.all([
    searchListings(params),
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