import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { BROCK_ANALYTICS_EVENTS, normalizeAcquisitionSource } from "@/lib/brock/analytics";

type BrockEventRow = {
  event_name: string;
  listing_id: string | null;
  source: string | null;
  created_at: string;
};

type ListingRow = {
  id: string;
  title: string | null;
  city: string | null;
};

const FUNNEL_EVENTS = [
  "brock_page_view",
  "campus_selected",
  "brock_listing_click",
  "brock_signup_completed",
  "brock_inquiry_sent",
  "brock_viewing_requested",
] as const;

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile?.is_admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await admin
    .from("brock_acquisition_events")
    .select("event_name, listing_id, source, created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(5000);

  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205") {
      return NextResponse.json({
        available: false,
        counts: Object.fromEntries(BROCK_ANALYTICS_EVENTS.map((event) => [event, 0])),
        funnel: FUNNEL_EVENTS.map((event) => ({ event, count: 0, conversion: null })),
        sources: [],
        topClickedListings: [],
        topConvertingListings: [],
      });
    }

    console.error("BROCK ADMIN ANALYTICS ERROR:", {
      code: error.code,
      message: error.message,
    });
    return NextResponse.json({ error: "Brock analytics could not be loaded." }, { status: 500 });
  }

  const events = (data || []) as BrockEventRow[];
  const counts = Object.fromEntries(BROCK_ANALYTICS_EVENTS.map((event) => [event, 0]));
  const sourceCounts = new Map<string, number>();
  const clickedListings = new Map<string, number>();
  const convertingListings = new Map<string, number>();

  for (const event of events) {
    if (event.event_name in counts) counts[event.event_name] += 1;

    const source = normalizeAcquisitionSource(event.source);
    sourceCounts.set(source, (sourceCounts.get(source) || 0) + 1);

    if (event.event_name === "brock_listing_click" && event.listing_id) {
      clickedListings.set(event.listing_id, (clickedListings.get(event.listing_id) || 0) + 1);
    }

    if (
      (event.event_name === "brock_inquiry_sent" ||
        event.event_name === "brock_viewing_requested") &&
      event.listing_id
    ) {
      convertingListings.set(
        event.listing_id,
        (convertingListings.get(event.listing_id) || 0) + 1
      );
    }
  }

  const listingIds = Array.from(
    new Set([...clickedListings.keys(), ...convertingListings.keys()])
  );
  let listingTitles = new Map<string, ListingRow>();

  if (listingIds.length > 0) {
    const { data: listings } = await admin
      .from("listings")
      .select("id, title, city")
      .in("id", listingIds);

    listingTitles = new Map(
      ((listings || []) as ListingRow[]).map((listing) => [listing.id, listing])
    );
  }

  function rankedListings(sourceMap: Map<string, number>) {
    return Array.from(sourceMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([listingId, count]) => ({
        listingId,
        count,
        title: listingTitles.get(listingId)?.title || "Unknown listing",
        city: listingTitles.get(listingId)?.city || null,
      }));
  }

  const pageViews = counts.brock_page_view || 0;
  const funnel = FUNNEL_EVENTS.map((event) => {
    const count = counts[event] || 0;
    return {
      event,
      count,
      conversion: pageViews > 0 ? Math.round((count / pageViews) * 1000) / 10 : null,
    };
  });

  return NextResponse.json({
    available: true,
    counts,
    funnel,
    sources: Array.from(sourceCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([source, count]) => ({ source, count })),
    topClickedListings: rankedListings(clickedListings),
    topConvertingListings: rankedListings(convertingListings),
  });
}
