import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { resend } from "@/lib/email/resend";
import { identityRejectedTemplate } from "@/lib/email/templates/identity-rejected";

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { userId, reason } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    const { data: adminProfile } = await supabase
      .from("profiles")
      .select("role, is_admin")
      .eq("id", user.id)
      .maybeSingle();

    if (adminProfile?.role !== "admin" && !adminProfile?.is_admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: targetUser } =
      await supabaseAdmin.auth.admin.getUserById(userId);

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("id", userId)
      .maybeSingle();

    if (!targetUser?.user?.email) {
      return NextResponse.json({ error: "User email not found" }, { status: 404 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    await resend.emails.send({
      from:
        process.env.EMAIL_FROM ||
        "Travel Markets <noreply@travelmarkets.ca>",
      to: targetUser.user.email,
      subject: "Identity verification rejected",
      html: identityRejectedTemplate({
        name: profile?.full_name,
        reason,
        verifyUrl: `${appUrl}/verify-identity`,
      }),
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to send identity rejected email" },
      { status: 500 }
    );
  }
}