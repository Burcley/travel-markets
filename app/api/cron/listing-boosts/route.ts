import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

type ExpiredBoostRow = {
  id: string;
  owner_id: string;
  listing_id: string;
  expires_at: string;
};

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;

  if (authHeader !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("listing_boosts")
    .select("id, owner_id, listing_id, expires_at")
    .eq("status", "active")
    .lte("expires_at", now)
    .limit(100);

  if (error) {
    console.error("Boost expiry scan failed:", error);

    return NextResponse.json(
      { error: "Failed to process expired boosts" },
      { status: 500 }
    );
  }

  const expiredBoosts = ((data || []) as ExpiredBoostRow[]).filter(
    (boost) => boost.id && boost.owner_id && boost.listing_id
  );

  if (expiredBoosts.length === 0) {
    return NextResponse.json({ success: true, expiredCount: 0 });
  }

  const boostIds = expiredBoosts.map((boost) => boost.id);
  const listingIds = [...new Set(expiredBoosts.map((boost) => boost.listing_id))];

  const { error: updateBoostError } = await supabaseAdmin
    .from("listing_boosts")
    .update({
      status: "expired",
      updated_at: now,
    })
    .in("id", boostIds);

  if (updateBoostError) {
    console.error("Boost expiry update failed:", updateBoostError);

    return NextResponse.json(
      { error: "Failed to update expired boosts" },
      { status: 500 }
    );
  }

  const { error: updateListingError } = await supabaseAdmin
    .from("listings")
    .update({
      is_featured: false,
      boost_rank: 0,
    })
    .in("id", listingIds)
    .lte("boost_until", now);

  if (updateListingError) {
    console.error("Expired listing boost cleanup failed:", updateListingError);
  }

  const notifications = expiredBoosts.map((boost) => ({
    user_id: boost.owner_id,
    title: "Listing boost expired",
    message:
      "One of your listing boosts has expired. You can promote another active listing from the Boost Center.",
    type: "listing_boost_expired",
    href: "/dashboard/boosts",
    is_read: false,
  }));

  const { error: notificationError } = await supabaseAdmin
    .from("notifications")
    .insert(notifications);

  if (notificationError) {
    console.error("Boost expiry notification insert failed:", notificationError);
  }

  return NextResponse.json({
    success: true,
    expiredCount: expiredBoosts.length,
  });
}
