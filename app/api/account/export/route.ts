import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const supabase = await createClient();
  const supabaseAdmin = createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = user.id;

  const [
    profile,
    listings,
    inquiriesSent,
    inquiriesReceived,
    messagesSent,
    messagesReceived,
    viewingsRequested,
    viewingsOwned,
    savedListings,
    savedSearches,
    reviewsGiven,
    reviewsReceived,
    reports,
    notifications,
  ] = await Promise.all([
    supabaseAdmin.from("profiles").select("*").eq("id", userId),
    supabaseAdmin.from("listings").select("*").or(`owner_id.eq.${userId},user_id.eq.${userId}`),
    supabaseAdmin.from("inquiries").select("*").eq("requester_id", userId),
    supabaseAdmin.from("inquiries").select("*").eq("owner_id", userId),
    supabaseAdmin.from("messages").select("*").eq("sender_id", userId),
    supabaseAdmin.from("messages").select("*").eq("receiver_id", userId),
    supabaseAdmin.from("viewings").select("*").eq("requester_id", userId),
    supabaseAdmin.from("viewings").select("*").eq("owner_id", userId),
    supabaseAdmin.from("saved_listings").select("*").eq("user_id", userId),
    supabaseAdmin.from("saved_searches").select("*").eq("user_id", userId),
    supabaseAdmin.from("reviews").select("*").eq("reviewer_id", userId),
    supabaseAdmin.from("reviews").select("*").eq("owner_id", userId),
    supabaseAdmin.from("reports").select("*").eq("reporter_id", userId),
    supabaseAdmin.from("notifications").select("*").eq("user_id", userId),
  ]);

  const exportData = {
    exported_at: new Date().toISOString(),
    user: {
      id: user.id,
      email: user.email,
      created_at: user.created_at,
    },
    profile: profile.data || [],
    listings: listings.data || [],
    inquiries: {
      sent: inquiriesSent.data || [],
      received: inquiriesReceived.data || [],
    },
    messages: {
      sent: messagesSent.data || [],
      received: messagesReceived.data || [],
    },
    viewings: {
      requested: viewingsRequested.data || [],
      owned: viewingsOwned.data || [],
    },
    saved_listings: savedListings.data || [],
    saved_searches: savedSearches.data || [],
    reviews: {
      given: reviewsGiven.data || [],
      received: reviewsReceived.data || [],
    },
    reports: reports.data || [],
    notifications: notifications.data || [],
  };

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="travel-markets-data-${userId}.json"`,
    },
  });
}