import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { resend } from "@/lib/email/resend";

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

    const { fullLegalName } = await request.json();

    const { data: admins, error: adminError } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .or("role.eq.admin,is_admin.eq.true");

    if (adminError) {
      return NextResponse.json({ error: adminError.message }, { status: 500 });
    }

    if (!admins || admins.length === 0) {
      return NextResponse.json({ success: true, message: "No admins found" });
    }

    const notificationRows = admins.map((admin) => ({
      user_id: admin.id,
      actor_id: user.id,
      title: "New identity verification",
      body: `${fullLegalName || "A user"} submitted identity verification.`,
      message: `${fullLegalName || "A user"} submitted identity verification.`,
      type: "identity_verification_submitted",
      link: "/admin/verifications",
      is_read: false,
    }));

    const { error: notificationError } = await supabaseAdmin
      .from("notifications")
      .insert(notificationRows);

    if (notificationError) {
      console.error("ADMIN NOTIFICATION INSERT ERROR:", notificationError);
      return NextResponse.json(
        { error: notificationError.message },
        { status: 500 }
      );
    }

    const adminUsers = await Promise.all(
      admins.map((admin) => supabaseAdmin.auth.admin.getUserById(admin.id))
    );

    const adminEmails = adminUsers
      .map((result) => result.data.user?.email)
      .filter(Boolean) as string[];

    if (adminEmails.length > 0) {
      await resend.emails.send({
        from:
          process.env.EMAIL_FROM ||
          "Travel Markets <noreply@travelmarkets.ca>",
        to: adminEmails,
        subject: "New identity verification submitted",
        html: `
          <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111">
            <h2>New identity verification submitted</h2>
            <p>${fullLegalName || "A user"} submitted identity verification for review.</p>
            <p>
              <a href="${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/admin/verifications" style="display:inline-block;background:#000;color:#fff;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:bold;">
                Review Verification
              </a>
            </p>
          </div>
        `,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("ADMIN IDENTITY SUBMITTED ERROR:", error);

    return NextResponse.json(
      { error: error?.message || "Failed to notify admins" },
      { status: 500 }
    );
  }
}