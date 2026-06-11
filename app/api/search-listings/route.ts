import { NextRequest, NextResponse } from "next/server";
import { searchListings } from "@/lib/listings/search-listings";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    const result = await searchListings({
      q: searchParams.get("q") || undefined,
      city: searchParams.get("city") || undefined,
      campus: searchParams.get("campus") || undefined,
      minPrice: searchParams.get("minPrice") || undefined,
      maxPrice: searchParams.get("maxPrice") || undefined,
      bedrooms: searchParams.get("bedrooms") || undefined,
      bathrooms: searchParams.get("bathrooms") || undefined,
      guests: searchParams.get("guests") || undefined,
      status: searchParams.get("status") || undefined,
      sort: searchParams.get("sort") || undefined,
      page: searchParams.get("page") || "1",
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("SEARCH API ERROR:", error);

    return NextResponse.json(
      {
        error: "Failed to load listings",
      },
      {
        status: 500,
      }
    );
  }
}