import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const supabase = await createClient();
  const supabaseAdmin = createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  if (body.confirmation !== "DELETE") {
    return NextResponse.json(
      { error: "Type DELETE to confirm." },
      { status: 400 }
    );
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role, is_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role === "admin" || profile?.is_admin) {
    return NextResponse.json(
      { error: "Admin accounts cannot self-delete." },
      { status: 403 }
    );
  }

  const userId = user.id;

  await supabaseAdmin.from("notifications").delete().eq("user_id", userId);
  await supabaseAdmin.from("saved_listings").delete().eq("user_id", userId);
  await supabaseAdmin.from("saved_searches").delete().eq("user_id", userId);
  await supabaseAdmin.from("recently_viewed").delete().eq("user_id", userId);
  await supabaseAdmin.from("listing_views").delete().eq("user_id", userId);

  await supabaseAdmin
    .from("messages")
    .delete()
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`);

  await supabaseAdmin
    .from("inquiries")
    .delete()
    .or(`requester_id.eq.${userId},owner_id.eq.${userId}`);

  await supabaseAdmin
    .from("viewings")
    .delete()
    .or(`requester_id.eq.${userId},owner_id.eq.${userId}`);

  await supabaseAdmin
    .from("reports")
    .delete()
    .or(`reporter_id.eq.${userId},target_user_id.eq.${userId}`);

  await supabaseAdmin
    .from("reviews")
    .delete()
    .or(`reviewer_id.eq.${userId},owner_id.eq.${userId}`);

  const { data: listings } = await supabaseAdmin
    .from("listings")
    .select("id")
    .or(`owner_id.eq.${userId},user_id.eq.${userId}`);

  const listingIds = listings?.map((listing) => listing.id) || [];

  if (listingIds.length > 0) {
    await supabaseAdmin
      .from("listing_images")
      .delete()
      .in("listing_id", listingIds);

    await supabaseAdmin.from("listings").delete().in("id", listingIds);
  }

  await supabaseAdmin.from("profiles").delete().eq("id", userId);

  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId, true);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}