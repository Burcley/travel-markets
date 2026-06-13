import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim();
    const category = String(body.category || "support").trim();
    const subject = String(body.subject || "").trim();
    const message = String(body.message || "").trim();

    if (!name || !email || !subject || !message) {
      return NextResponse.json(
        { error: "Missing required ticket fields." },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin.from("support_tickets").insert({
      user_id: user?.id || null,
      name,
      email,
      category,
      subject,
      message,
      status: "open",
    });

    if (error) {
      console.error("SUPPORT TICKET INSERT ERROR:", error);

      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("SUPPORT API ERROR:", error);

    return NextResponse.json(
      { error: error?.message || "Failed to create support ticket." },
      { status: 500 }
    );
  }
}