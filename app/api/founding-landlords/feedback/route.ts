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
  const category = String(body?.category || "general").trim() || "general";

  if (!message) {
    return NextResponse.json({ error: "Feedback is required." }, { status: 400 });
  }

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

  const { error } = await admin.from("founding_landlord_feedback").insert({
    owner_id: user.id,
    category,
    message,
    status: "new",
  });

  if (error) {
    console.error("FOUNDING FEEDBACK ERROR:", error);
    return NextResponse.json(
      { error: "We could not send your feedback. Please try again." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
