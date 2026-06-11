import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ plan: "free", status: "inactive" });
    }

    const { data, error } = await supabaseAdmin
      .from("owner_subscriptions")
      .select("plan, status")
      .eq("user_id", userId)
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json({ plan: "free", status: "inactive" });
    }

    const active = data.status === "active" || data.status === "trialing";

    return NextResponse.json({
      plan: active ? data.plan || "free" : "free",
      status: data.status || "inactive",
    });
  } catch (error) {
    console.error("OWNER SUBSCRIPTION API ERROR:", error);
    return NextResponse.json({ plan: "free", status: "inactive" });
  }
}