import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { resend } from "@/lib/email/resend";
import { viewingApprovedTemplate } from "@/lib/email/templates/viewing-approved";

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function getViewingTypeLabel(type?: string | null) {
  if (type === "video_call") return "Live video call";
  if (type === "video_tour") return "Video tour request";

  return "In-person viewing";
}

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
        "id, owner_id, requester_id, listing_id, slot_id, requested_date, requested_time, status, viewing_type"
      )
      .eq("id", viewingId)
      .maybeSingle();

    if (viewingError || !viewing) {
      return NextResponse.json(
        { error: viewingError?.message || "Viewing not found" },
        { status: 404 }
      );
    }

    if (viewing.owner_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (viewing.status !== "accepted") {
      return NextResponse.json(
        { error: "Viewing is not accepted yet" },
        { status: 400 }
      );
    }

    const { data: listing } = await supabaseAdmin
      .from("listings")
      .select("id, title")
      .eq("id", viewing.listing_id)
      .maybeSingle();

    let slot: {
      slot_date: string | null;
      start_time: string | null;
      end_time: string | null;
    } | null = null;

    if (viewing.slot_id) {
      const { data: slotData } = await supabaseAdmin
        .from("viewing_slots")
        .select("slot_date, start_time, end_time")
        .eq("id", viewing.slot_id)
        .maybeSingle();

      slot = slotData;
    }

    const { data: requesterUser, error: requesterError } =
      await supabaseAdmin.auth.admin.getUserById(viewing.requester_id);

    if (requesterError || !requesterUser?.user?.email) {
      return NextResponse.json(
        { error: requesterError?.message || "Requester email not found" },
        { status: 404 }
      );
    }

    const listingTitle = listing?.title || "your viewing";
    const isVideoTour = viewing.viewing_type === "video_tour";
    const isVideoCall = viewing.viewing_type === "video_call";

    const viewingDate =
      isVideoTour
        ? "Not required"
        : slot?.slot_date || viewing.requested_date || "Date unavailable";

    const viewingTime = isVideoTour
      ? "Continue in messages"
      : slot?.start_time
        ? slot.end_time
          ? `${slot.start_time.slice(0, 5)} - ${slot.end_time.slice(0, 5)}`
          : slot.start_time.slice(0, 5)
        : viewing.requested_time || "Time unavailable";

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const emailResult = await resend.emails.send({
      from: process.env.EMAIL_FROM || "Travel Markets <onboarding@resend.dev>",
      to: requesterUser.user.email,
      subject: "Your viewing was approved",
      html: viewingApprovedTemplate({
        listingTitle: `${listingTitle} (${getViewingTypeLabel(
          viewing.viewing_type
        )})`,
        viewingDate,
        viewingTime,
        addressUrl:
          isVideoTour || isVideoCall
            ? `${appUrl}/messages`
            : `${appUrl}/address-unlocked/${viewing.listing_id}`,
      }),
    });

    console.log("VIEWING APPROVED EMAIL SENT:", emailResult);

    return NextResponse.json({
      success: true,
      sentTo: requesterUser.user.email,
      result: emailResult,
    });
  } catch (error: unknown) {
    console.error("VIEWING APPROVED EMAIL ERROR:", error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to send email",
      },
      { status: 500 }
    );
  }
}
