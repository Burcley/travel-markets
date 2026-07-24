import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const admin = createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const message = String(body?.message || "").trim();
  const listingId = body?.listingId ? String(body.listingId) : null;

  const { data: profile } = await admin
    .from("profiles")
    .select("founding_status, is_founding_landlord")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.founding_status !== "confirmed" || !profile?.is_founding_landlord) {
    return NextResponse.json(
      { error: "Founding Landlord status is required." },
      { status: 403 }
    );
  }

  const { error } = await admin.from("founding_landlord_assistance_requests").insert({
    owner_id: user.id,
    listing_id: listingId,
    message: message || null,
    status: "requested",
  });

  if (error) {
    console.error("FOUNDING ASSISTANCE ERROR:", error);
    return NextResponse.json(
      { error: "We could not send your request. Please try again." },
      { status: 500 }
    );
  }

  await admin.from("notifications").insert({
    user_id: user.id,
    title: "Setup assistance requested",
    message: "Travel Markets support received your Founding Landlord setup request.",
    type: "founding_landlord",
    href: "/dashboard",
    is_read: false,
  });

  return NextResponse.json({ ok: true });
}
