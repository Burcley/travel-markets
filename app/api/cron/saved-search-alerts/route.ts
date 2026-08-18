import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { resend } from "@/lib/email/resend";
import { savedSearchAlertTemplate } from "@/lib/email/templates/saved-search-alert";
import {
  getVerifiedPublicListingIds,
  PUBLIC_LISTING_STATUS,
} from "@/lib/listings/public-visibility";

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const expected = `Bearer ${process.env.CRON_SECRET}`;

    if (authHeader !== expected) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const { data: savedSearches, error: searchError } = await supabaseAdmin
      .from("saved_searches")
      .select("*")
      .eq("alerts_enabled", true);

    if (searchError) throw searchError;
    const verifiedListingIds = await getVerifiedPublicListingIds(
      supabaseAdmin as never
    );

    let sentCount = 0;
    if (verifiedListingIds.length === 0) {
      return NextResponse.json({
        success: true,
        sentCount,
      });
    }

    for (const search of savedSearches || []) {
      let query = supabaseAdmin
        .from("listings")
        .select("id, title, price, city, campus, bedrooms, bathrooms, guests, created_at")
        .eq("status", PUBLIC_LISTING_STATUS)
        .in("id", verifiedListingIds)
        .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order("created_at", { ascending: false })
        .limit(3);

      if (search.city) query = query.ilike("city", `%${search.city}%`);
      if (search.campus) query = query.ilike("campus", `%${search.campus}%`);
      if (search.min_price) query = query.gte("price", search.min_price);
      if (search.max_price) query = query.lte("price", search.max_price);
      if (search.bedrooms) query = query.gte("bedrooms", search.bedrooms);
      if (search.bathrooms) query = query.gte("bathrooms", search.bathrooms);
      if (search.guests) query = query.gte("guests", search.guests);

      const { data: matches, error: matchError } = await query;

      if (matchError || !matches?.length) continue;

      const { data: userData } = await supabaseAdmin.auth.admin.getUserById(
        search.user_id
      );

      const email = userData?.user?.email;
      if (!email) continue;

      for (const listing of matches) {
        await resend.emails.send({
          from:
            process.env.EMAIL_FROM ||
            "Travel Markets <noreply@travelmarkets.ca>",
          to: email,
          subject: "New listing matches your saved search",
          html: savedSearchAlertTemplate({
            searchTitle: search.title || search.name || "Saved Search",
            listingTitle: listing.title || "New listing",
            price: listing.price,
            city: listing.city,
            campus: listing.campus,
            listingUrl: `${appUrl}/listings/${listing.id}`,
          }),
        });

        sentCount++;
      }
    }

    return NextResponse.json({
      success: true,
      sentCount,
    });
  } catch (error: unknown) {
    console.error("SAVED SEARCH ALERT ERROR:", error);
    const message = error instanceof Error ? error.message : "Failed to send saved search alerts";

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
