import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { publishListingForOwner } from "@/lib/listings/publish-listing";

const landlordVerificationError =
  "Complete landlord verification to publish listings.";

function publishUpdateErrorResponse(error: { message?: string; code?: string }) {
  const message = error.message || "";

  if (message.includes("Complete landlord verification")) {
    return NextResponse.json(
      {
        error: landlordVerificationError,
        code: "landlord_verification_required",
        verificationUrl: "/dashboard/verification",
      },
      { status: 403 }
    );
  }

  if (message.includes("Only landlord accounts")) {
    return NextResponse.json(
      { error: "Only landlord accounts can publish listings." },
      { status: 403 }
    );
  }

  if (message.includes("This account cannot publish listings")) {
    return NextResponse.json(
      { error: "This account cannot publish listings." },
      { status: 403 }
    );
  }

  if (message.includes("fair-housing")) {
    return NextResponse.json(
      {
        error: "Acknowledge the fair-housing document notice before publishing.",
      },
      { status: 400 }
    );
  }

  console.error("LISTING PUBLISH ERROR:", {
    code: error.code,
    message: error.message,
  });

  return NextResponse.json(
    { error: "We couldn't publish your listing. Please try again." },
    { status: 400 }
  );
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const admin = createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const listingId = String(body.listingId || "");

  if (!listingId) {
    return NextResponse.json({ error: "Missing listing id" }, { status: 400 });
  }

  const result = await publishListingForOwner({
    admin,
    updateClient: supabase,
    listingId,
    ownerId: user.id,
  });

  if (!result.ok && result.code === "LISTING_NOT_FOUND") {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }

  if (!result.ok && result.reason.includes("Only landlord accounts")) {
    return NextResponse.json(
      { error: "Only landlord accounts can publish listings." },
      { status: 403 }
    );
  }

  if (!result.ok && result.reason.includes("This account cannot publish listings")) {
    return NextResponse.json(
      { error: "This account cannot publish listings." },
      { status: 403 }
    );
  }

  if (!result.ok && result.reason.includes("Complete landlord verification")) {
    return NextResponse.json(
      {
        error: landlordVerificationError,
        code: result.code,
        verificationUrl: "/dashboard/verification",
      },
      { status: 403 }
    );
  }

  if (!result.ok && result.code === "ACTIVE_LISTING_LIMIT_REACHED") {
    return NextResponse.json(
      {
        error: result.reason,
        code: result.code,
        billingUrl: "/billing",
      },
      { status: 403 }
    );
  }

  if (!result.ok) {
    return publishUpdateErrorResponse({
      code: result.code || undefined,
      message: result.reason,
    });
  }

  return NextResponse.json({ ok: true });
}
