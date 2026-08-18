import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getVerifiedPublicListingIds,
  PUBLIC_LISTING_STATUS,
} from "@/lib/listings/public-visibility";

function clean(value?: string | null) {
  if (!value) return "";
  return value.trim().toLowerCase();
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const verifiedListingIds = await getVerifiedPublicListingIds(
      supabase as never
    );

    const query = clean(request.nextUrl.searchParams.get("q"));

    if (!query || query.length < 2 || verifiedListingIds.length === 0) {
      return NextResponse.json({
        suggestions: [],
      });
    }

    const { data, error } = await supabase
      .from("listings")
      .select("city, campus, title")
      .eq("status", PUBLIC_LISTING_STATUS)
      .in("id", verifiedListingIds)
      .or(
        `city.ilike.%${query}%,campus.ilike.%${query}%,title.ilike.%${query}%`
      )
      .limit(12);

    if (error) {
      console.error("SUGGESTIONS ERROR:", error);

      return NextResponse.json({
        suggestions: [],
      });
    }

    const values = new Set<string>();

    data?.forEach((item) => {
      if (
        item.city &&
        item.city.toLowerCase().includes(query)
      ) {
        values.add(item.city);
      }

      if (
        item.campus &&
        item.campus.toLowerCase().includes(query)
      ) {
        values.add(item.campus);
      }

      if (
        item.title &&
        item.title.toLowerCase().includes(query)
      ) {
        values.add(item.title);
      }
    });

    return NextResponse.json({
      suggestions: Array.from(values).slice(0, 8),
    });
  } catch (error) {
    console.error("SEARCH SUGGESTIONS API ERROR:", error);

    return NextResponse.json(
      {
        suggestions: [],
      },
      {
        status: 500,
      }
    );
  }
}
