import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const secret = request.nextUrl.searchParams.get("secret");

    if (secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: searches, error: searchesError } = await supabaseAdmin
      .from("saved_searches")
      .select("*")
      .eq("alerts_enabled", true);

    if (searchesError) throw searchesError;

    let alertsCreated = 0;

    for (const search of searches || []) {
      let query = supabaseAdmin
        .from("listings")
        .select("id, title, price, city, campus, bedrooms, bathrooms, guests, created_at")
        .eq("status", "available")
        .order("created_at", { ascending: false })
        .limit(10);

      if (search.city) query = query.ilike("city", `%${search.city}%`);
      if (search.campus) query = query.ilike("campus", `%${search.campus}%`);
      if (search.min_price) query = query.gte("price", search.min_price);
      if (search.max_price) query = query.lte("price", search.max_price);
      if (search.bedrooms) query = query.gte("bedrooms", search.bedrooms);
      if (search.bathrooms) query = query.gte("bathrooms", search.bathrooms);
      if (search.guests) query = query.gte("guests", search.guests);

      const { data: matches, error: matchesError } = await query;

      if (matchesError) continue;

      for (const listing of matches || []) {
        const { data: existing } = await supabaseAdmin
          .from("saved_search_alerts")
          .select("id")
          .eq("saved_search_id", search.id)
          .eq("listing_id", listing.id)
          .maybeSingle();

        if (existing) continue;

        await supabaseAdmin.from("saved_search_alerts").insert({
          saved_search_id: search.id,
          user_id: search.user_id,
          listing_id: listing.id,
        });

        await supabaseAdmin.from("notifications").insert({
          user_id: search.user_id,
          title: "New listing matches your saved search",
          body: `${listing.title} matches your saved search for ${search.city || "rentals"}.`,
          type: "saved_search_alert",
          related_listing_id: listing.id,
          is_read: false,
        });

        alertsCreated++;
      }

      await supabaseAdmin
        .from("saved_searches")
        .update({ last_alert_sent_at: new Date().toISOString() })
        .eq("id", search.id);
    }

    return NextResponse.json({
      success: true,
      searchesChecked: searches?.length || 0,
      alertsCreated,
    });
  } catch (error) {
    console.error("SAVED SEARCH ALERT RUN ERROR:", error);

    return NextResponse.json(
      { error: "Failed to run saved search alerts." },
      { status: 500 }
    );
  }
}