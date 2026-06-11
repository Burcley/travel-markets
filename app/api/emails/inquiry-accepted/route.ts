import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { resend } from "@/lib/email/resend";
import { inquiryAcceptedTemplate } from "@/lib/email/templates/inquiry-accepted";

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

    if (!inquiryId) {
      return NextResponse.json({ error: "Missing inquiryId" }, { status: 400 });
    }

    const { data: inquiry, error: inquiryError } = await supabaseAdmin
      .from("inquiries")
      .select("id, listing_id, requester_id, owner_id, status")
      .eq("id", inquiryId)
      .maybeSingle();

    if (inquiryError || !inquiry) {
      return NextResponse.json(
        { error: inquiryError?.message || "Inquiry not found" },
        { status: 404 }
      );
    }

    if (inquiry.owner_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (inquiry.status !== "accepted") {
      return NextResponse.json(
        { error: "Inquiry is not accepted yet" },
        { status: 400 }
      );
    }

    const { data: listing } = await supabaseAdmin
      .from("listings")
      .select("id, title")
      .eq("id", inquiry.listing_id)
      .maybeSingle();

    const { data: requesterUser, error: requesterError } =
      await supabaseAdmin.auth.admin.getUserById(inquiry.requester_id);

    if (requesterError || !requesterUser?.user?.email) {
      return NextResponse.json(
        { error: requesterError?.message || "Requester email not found" },
        { status: 404 }
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const listingTitle = listing?.title || "your housing inquiry";

    const emailResult = await resend.emails.send({
      from: process.env.EMAIL_FROM || "Travel Markets <noreply@travelmarkets.ca>",
      to: requesterUser.user.email,
      subject: "Your housing inquiry was accepted",
      html: inquiryAcceptedTemplate({
        listingTitle,
        inquiryUrl: `${appUrl}/inquiries/sent`,
      }),
    });

    console.log("INQUIRY ACCEPTED EMAIL SENT:", emailResult);

    return NextResponse.json({
      success: true,
      sentTo: requesterUser.user.email,
      result: emailResult,
    });
  } catch (error: any) {
    console.error("INQUIRY ACCEPTED EMAIL ERROR:", error);

    return NextResponse.json(
      { error: error?.message || "Failed to send inquiry accepted email" },
      { status: 500 }
    );
  }
}