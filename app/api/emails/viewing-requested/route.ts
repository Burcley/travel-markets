import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { resend } from "@/lib/email/resend";
import { viewingRequestedTemplate } from "@/lib/email/templates/viewing-requested";

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

    const { viewingId } = await request.json();

    if (!viewingId) {
      return NextResponse.json({ error: "Missing viewingId" }, { status: 400 });
    }

    const { data: viewing, error: viewingError } = await supabaseAdmin
      .from("viewings")
      .select(
        "id, owner_id, requester_id, listing_id, requested_date, requested_time, status"
      )
      .eq("id", viewingId)
      .maybeSingle();

    if (viewingError || !viewing) {
      return NextResponse.json(
        { error: viewingError?.message || "Viewing not found" },
        { status: 404 }
      );
    }

    if (viewing.requester_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: listing } = await supabaseAdmin
      .from("listings")
      .select("id, title")
      .eq("id", viewing.listing_id)
      .maybeSingle();

    const { data: ownerUser, error: ownerError } =
      await supabaseAdmin.auth.admin.getUserById(viewing.owner_id);

    if (ownerError || !ownerUser?.user?.email) {
      return NextResponse.json(
        { error: ownerError?.message || "Owner email not found" },
        { status: 404 }
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const emailResult = await resend.emails.send({
      from: process.env.EMAIL_FROM || "Travel Markets <noreply@travelmarkets.ca>",
      to: ownerUser.user.email,
      subject: "New viewing request",
      html: viewingRequestedTemplate({
        listingTitle: listing?.title || "your listing",
        viewingDate: viewing.requested_date || "Date unavailable",
        viewingTime: viewing.requested_time || "Time unavailable",
        viewingsUrl: `${appUrl}/viewings`,
      }),
    });

    console.log("VIEWING REQUESTED EMAIL SENT:", emailResult);

    return NextResponse.json({
      success: true,
      sentTo: ownerUser.user.email,
      result: emailResult,
    });
  } catch (error: any) {
    console.error("VIEWING REQUESTED EMAIL ERROR:", error);

    return NextResponse.json(
      { error: error?.message || "Failed to send viewing request email" },
      { status: 500 }
    );
  }
}