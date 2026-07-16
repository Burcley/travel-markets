import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type ViewingRequestResult = {
  ok?: boolean;
  code?: string;
  viewingId?: string;
  inquiryId?: string;
  ownerId?: string;
};

const ERROR_MESSAGES: Record<string, { message: string; status: number }> = {
  UNAUTHORIZED: { message: "Please log in to request a viewing.", status: 401 },
  ACCEPTED_INQUIRY_REQUIRED: {
    message: "The landlord must accept your inquiry before you can book a viewing.",
    status: 403,
  },
  LISTING_NOT_FOUND: { message: "Listing not found.", status: 404 },
  LISTING_OWNER_MISMATCH: {
    message: "This viewing request does not match the listing owner.",
    status: 403,
  },
  OWNER_CANNOT_BOOK: {
    message: "You cannot book a viewing for your own listing.",
    status: 403,
  },
  LISTING_UNAVAILABLE: {
    message: "This listing is no longer available for viewing requests.",
    status: 409,
  },
  ACTIVE_VIEWING_EXISTS: {
    message: "You already have an active viewing request for this listing.",
    status: 409,
  },
  SLOT_NOT_FOUND: { message: "This time slot is no longer available.", status: 404 },
  SLOT_NOT_FOR_LISTING: {
    message: "This time slot does not belong to this listing.",
    status: 403,
  },
  SLOT_UNAVAILABLE: {
    message: "This time slot has already been booked.",
    status: 409,
  },
  SLOT_PAST: { message: "This time slot has already passed.", status: 422 },
  SLOT_TYPE_UNSUPPORTED: {
    message: "Please request video tours as a custom request.",
    status: 422,
  },
  SLOT_TYPE_UNAVAILABLE: {
    message: "This time slot is not available for the selected viewing type.",
    status: 422,
  },
  DATE_TIME_REQUIRED: {
    message: "Please choose a future date and time.",
    status: 422,
  },
  CUSTOM_TIME_PAST: {
    message: "Please choose a future date and time.",
    status: 422,
  },
  INVALID_VIEWING_TYPE: {
    message: "Please choose a valid viewing type.",
    status: 422,
  },
};

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const admin = createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: ERROR_MESSAGES.UNAUTHORIZED.message, code: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  if (!user.email_confirmed_at) {
    return NextResponse.json(
      {
        error: "Please verify your email before booking a viewing.",
        code: "EMAIL_VERIFICATION_REQUIRED",
      },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);

  if (!body || typeof body !== "object") {
    return NextResponse.json(
      { error: "Invalid viewing request.", code: "INVALID_REQUEST" },
      { status: 400 }
    );
  }

  const listingId =
    typeof body.listingId === "string" ? body.listingId.trim() : "";
  const inquiryId =
    typeof body.inquiryId === "string" ? body.inquiryId.trim() : "";
  const slotId =
    typeof body.slotId === "string" && body.slotId.trim()
      ? body.slotId.trim()
      : null;
  const viewingType =
    typeof body.viewingType === "string" ? body.viewingType.trim() : "in_person";
  const requestedDate =
    typeof body.requestedDate === "string" && body.requestedDate.trim()
      ? body.requestedDate.trim()
      : null;
  const requestedTime =
    typeof body.requestedTime === "string" && body.requestedTime.trim()
      ? body.requestedTime.trim()
      : null;
  const note =
    typeof body.note === "string" && body.note.trim()
      ? body.note.trim().slice(0, 1000)
      : null;

  if (!listingId || !inquiryId) {
    return NextResponse.json(
      { error: "Missing listing or inquiry.", code: "MISSING_REQUIRED_FIELDS" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase.rpc("request_listing_viewing", {
    p_listing_id: listingId,
    p_inquiry_id: inquiryId,
    p_slot_id: slotId,
    p_viewing_type: viewingType,
    p_requested_date: requestedDate,
    p_requested_time: requestedTime,
    p_note: note,
  });

  if (error) {
    console.error("VIEWING REQUEST RPC ERROR:", {
      code: error.code,
      message: error.message,
      details: error.details,
    });

    return NextResponse.json(
      {
        error: "We could not submit this viewing request. Please try again.",
        code: "VIEWING_REQUEST_FAILED",
      },
      { status: 500 }
    );
  }

  const result = (data || {}) as ViewingRequestResult;

  if (!result.ok) {
    const mapped = ERROR_MESSAGES[result.code || ""] || {
      message: "We could not submit this viewing request.",
      status: 400,
    };

    return NextResponse.json(
      { error: mapped.message, code: result.code || "VIEWING_REQUEST_FAILED" },
      { status: mapped.status }
    );
  }

  await admin.from("notifications").insert({
    user_id: result.ownerId,
    inquiry_id: result.inquiryId || inquiryId,
    title: "New viewing request",
    message: "A student requested a viewing for your listing.",
    body: "A student requested a viewing for your listing.",
    type: "viewing_requested",
    link: "/viewings",
    is_read: false,
  });

  return NextResponse.json({
    success: true,
    viewingId: result.viewingId,
    inquiryId: result.inquiryId || inquiryId,
  });
}
