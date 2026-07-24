import { NextResponse } from "next/server";
import { getFoundingPublicStats } from "@/lib/founding-landlords/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id, role, is_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.is_admin && profile?.role !== "admin") {
    return null;
  }

  return { user, admin };
}

type FoundingAdminProfile = {
  founding_landlord_number?: number | null;
  founding_status?: string | null;
  full_name?: string | null;
  email?: string | null;
  role?: string | null;
  founding_reserved_at?: string | null;
  founding_confirmed_at?: string | null;
  founding_free_fee_period_ends_at?: string | null;
  founding_referral_code?: string | null;
};

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const exportFormat = url.searchParams.get("export");
  const status = url.searchParams.get("status");

  let query = auth.admin
    .from("profiles")
    .select(
      [
        "id",
        "full_name",
        "email",
        "role",
        "account_status",
        "created_at",
        "is_admin",
        "is_founding_landlord",
        "founding_landlord_number",
        "founding_status",
        "founding_reserved_at",
        "founding_reservation_expires_at",
        "founding_confirmed_at",
        "founding_benefits_started_at",
        "founding_free_fee_period_ends_at",
        "founding_discount_percentage",
        "founding_referral_code",
        "founding_benefits_disabled",
        "founding_benefits_disabled_reason",
      ].join(", ")
    )
    .not("founding_status", "is", null)
    .order("founding_landlord_number", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (status && status !== "all") {
    query = query.eq("founding_status", status);
  }

  const [
    { data: profiles, error: profilesError },
    { data: assignments },
    { data: assistanceRequests },
    { data: feedbackItems },
    stats,
  ] = await Promise.all([
    query,
    auth.admin
      .from("founding_landlord_number_assignments")
      .select("*")
      .order("founding_number", { ascending: true }),
    auth.admin
      .from("founding_landlord_assistance_requests")
      .select("*, profiles:owner_id(full_name, email)")
      .order("created_at", { ascending: false }),
    auth.admin
      .from("founding_landlord_feedback")
      .select("*, profiles:owner_id(full_name, email)")
      .order("created_at", { ascending: false }),
    getFoundingPublicStats(),
  ]);

  if (profilesError) {
    console.error("ADMIN FOUNDING LANDLORDS ERROR:", profilesError);
    return NextResponse.json(
      { error: "Could not load Founding Landlord records." },
      { status: 500 }
    );
  }

  if (exportFormat === "csv") {
    const exportProfiles = (profiles || []) as FoundingAdminProfile[];
    const rows = [
      [
        "number",
        "status",
        "name",
        "email",
        "role",
        "reserved_at",
        "confirmed_at",
        "free_fee_ends_at",
        "referral_code",
      ],
      ...exportProfiles.map((profile) => [
        profile.founding_landlord_number || "",
        profile.founding_status || "",
        profile.full_name || "",
        profile.email || "",
        profile.role || "",
        profile.founding_reserved_at || "",
        profile.founding_confirmed_at || "",
        profile.founding_free_fee_period_ends_at || "",
        profile.founding_referral_code || "",
      ]),
    ];
    const csv = rows
      .map((row) =>
        row
          .map((cell) => `"${String(cell).replaceAll('"', '""')}"`)
          .join(",")
      )
      .join("\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=founding-landlords.csv",
      },
    });
  }

  return NextResponse.json({
    stats,
    profiles: profiles || [],
    assignments: assignments || [],
    assistanceRequests: assistanceRequests || [],
    feedbackItems: feedbackItems || [],
  });
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const action = String(body?.action || "");
  const profileId = String(body?.profileId || "");

  if (!profileId) {
    return NextResponse.json({ error: "Missing profile ID." }, { status: 400 });
  }

  if (action === "evaluate") {
    const { data, error } = await auth.admin.rpc("evaluate_founding_landlord", {
      p_user_id: profileId,
    });

    if (error) {
      console.error("ADMIN FOUNDING EVALUATE ERROR:", error);
      return NextResponse.json({ error: "Evaluation failed." }, { status: 500 });
    }

    return NextResponse.json({ ok: true, result: data });
  }

  if (action === "reserve") {
    const { data, error } = await auth.admin.rpc("try_reserve_founding_landlord", {
      p_user_id: profileId,
      p_referral_code: null,
    });

    if (error) {
      console.error("ADMIN FOUNDING RESERVE ERROR:", error);
      return NextResponse.json({ error: "Reservation failed." }, { status: 500 });
    }

    return NextResponse.json({ ok: true, result: data });
  }

  if (action === "disqualify") {
    const reason = String(body?.reason || "").trim() || "Admin disqualified";
    const { data: currentProfile } = await auth.admin
      .from("profiles")
      .select("founding_status")
      .eq("id", profileId)
      .maybeSingle();
    const wasConfirmed = currentProfile?.founding_status === "confirmed";
    const updatePayload: Record<string, string | boolean | null> = {
      founding_status: "disqualified",
      is_founding_landlord: false,
      founding_benefits_disabled: true,
      founding_benefits_disabled_reason: reason,
    };

    if (!wasConfirmed) {
      updatePayload.founding_landlord_number = null;
      updatePayload.founding_reserved_at = null;
      updatePayload.founding_reservation_expires_at = null;
    }

    const { error } = await auth.admin
      .from("profiles")
      .update(updatePayload)
      .eq("id", profileId);

    if (error) {
      console.error("ADMIN FOUNDING DISQUALIFY ERROR:", error);
      return NextResponse.json({ error: "Disqualification failed." }, { status: 500 });
    }

    await auth.admin
      .from("founding_landlord_number_assignments")
      .update({
        status: "disqualified",
        released_at: new Date().toISOString(),
        release_reason: reason,
      })
      .eq("profile_id", profileId)
      .eq("status", "reserved");

    return NextResponse.json({ ok: true });
  }

  if (action === "enable_benefits" || action === "disable_benefits") {
    const disabled = action === "disable_benefits";
    const reason = disabled
      ? String(body?.reason || "").trim() || "Benefits disabled by admin"
      : null;
    const { error } = await auth.admin
      .from("profiles")
      .update({
        founding_benefits_disabled: disabled,
        founding_benefits_disabled_reason: reason,
      })
      .eq("id", profileId);

    if (error) {
      console.error("ADMIN FOUNDING BENEFIT TOGGLE ERROR:", error);
      return NextResponse.json({ error: "Benefit update failed." }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
}
