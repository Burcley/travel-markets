import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { resend } from "@/lib/email/resend";
import { newInquiryTemplate } from "@/lib/email/templates/new-inquiry";

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { inquiryId } = await request.json();

    const { data: inquiry } = await supabaseAdmin
      .from("inquiries")
      .select("*")
      .eq("id", inquiryId)
      .single();

    if (!inquiry) {
      return NextResponse.json(
        { error: "Inquiry not found" },
        { status: 404 }
      );
    }

    const { data: listing } = await supabaseAdmin
      .from("listings")
      .select("title")
      .eq("id", inquiry.listing_id)
      .single();

    const { data: ownerUser } =
      await supabaseAdmin.auth.admin.getUserById(inquiry.owner_id);

    const ownerEmail = ownerUser?.user?.email;

    if (!ownerEmail) {
      return NextResponse.json(
        { error: "Owner email not found" },
        { status: 404 }
      );
    }

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const result = await resend.emails.send({
      from:
        process.env.EMAIL_FROM ||
        "Travel Markets <noreply@travelmarkets.ca>",
      to: ownerEmail,
      subject: "New Housing Inquiry",
      html: newInquiryTemplate({
        listingTitle: listing?.title || "Your Listing",
        studentMessage: inquiry.message || "",
        inquiriesUrl: `${appUrl}/inquiries/received`,
      }),
    });

    console.log("NEW INQUIRY EMAIL SENT:", result);

    return NextResponse.json({
      success: true,
      sentTo: ownerEmail,
    });
  } catch (error: any) {
    console.error("NEW INQUIRY EMAIL ERROR:", error);

    return NextResponse.json(
      {
        error: error?.message || "Failed to send email",
      },
      { status: 500 }
    );
  }
}