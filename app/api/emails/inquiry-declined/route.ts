import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { resend } from "@/lib/email/resend";
import { inquiryDeclinedTemplate } from "@/lib/email/templates/inquiry-declined";

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

    const { inquiryId } = await request.json();

    const { data: inquiry, error } = await supabaseAdmin
      .from("inquiries")
      .select("id, listing_id, requester_id, owner_id, status")
      .eq("id", inquiryId)
      .maybeSingle();

    if (error || !inquiry) {
      return NextResponse.json(
        { error: error?.message || "Inquiry not found" },
        { status: 404 }
      );
    }

    const { data: adminProfile } = await supabase
      .from("profiles")
      .select("role, is_admin")
      .eq("id", user.id)
      .maybeSingle();

    const isOwner = inquiry.owner_id === user.id;
    const isAdmin = adminProfile?.role === "admin" || adminProfile?.is_admin;

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: listing } = await supabaseAdmin
      .from("listings")
      .select("title")
      .eq("id", inquiry.listing_id)
      .maybeSingle();

    const { data: requesterUser } =
      await supabaseAdmin.auth.admin.getUserById(inquiry.requester_id);

    if (!requesterUser?.user?.email) {
      return NextResponse.json(
        { error: "Requester email not found" },
        { status: 404 }
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    await resend.emails.send({
      from:
        process.env.EMAIL_FROM ||
        "Travel Markets <noreply@travelmarkets.ca>",
      to: requesterUser.user.email,
      subject: "Your housing inquiry was declined",
      html: inquiryDeclinedTemplate({
        listingTitle: listing?.title || "your housing inquiry",
        searchUrl: `${appUrl}/search`,
      }),
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("INQUIRY DECLINED EMAIL ERROR:", error);

    return NextResponse.json(
      { error: error?.message || "Failed to send inquiry declined email" },
      { status: 500 }
    );
  }
}