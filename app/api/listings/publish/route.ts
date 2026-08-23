import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canCreateOrActivateListing } from "@/lib/subscriptions/server";
import { getLandlordAccountEligibility } from "@/lib/landlord-account-eligibility";

const landlordVerificationError =
  "Complete landlord verification to publish listings.";

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

  const { data: profile } = await admin
    .from("profiles")
    .select(
      "id, role, is_admin, account_status, identity_verified, is_verified, identity_verification_status"
    )
    .eq("id", user.id)
    .maybeSingle();
  const { data: verificationSubmissions, error: verificationSubmissionError } =
    await admin
      .from("verification_submissions")
      .select("verification_type, status")
      .eq("user_id", user.id);

  if (verificationSubmissionError) {
    console.error(
      "LISTING PUBLISH ACCOUNT VERIFICATION LOOKUP ERROR:",
      verificationSubmissionError
    );
    return NextResponse.json(
      { error: "We could not verify your landlord account. Please try again." },
      { status: 500 }
    );
  }

  const accountStatus = String(profile?.account_status || "active").toLowerCase();
  const role = String(profile?.role || "").toLowerCase();
  const isLandlord =
    profile?.is_admin ||
    ["owner", "landlord", "host", "property_manager", "admin"].includes(role);

  if (!profile || !isLandlord) {
    return NextResponse.json(
      { error: "Only landlord accounts can publish listings." },
      { status: 403 }
    );
  }

  if (["banned", "suspended", "disabled"].includes(accountStatus)) {
    return NextResponse.json(
      { error: "This account cannot publish listings." },
      { status: 403 }
    );
  }

  const { data: listing } = await admin
    .from("listings")
    .select("id, user_id, status")
    .eq("id", listingId)
    .maybeSingle();

  if (!listing || listing.user_id !== user.id) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }

  if (listing.status === "draft" || listing.status === "rented") {
    const planCheck = await canCreateOrActivateListing({
      userId: user.id,
      excludeListingId: listingId,
    });

    if (!planCheck.allowed) {
      return NextResponse.json(
        {
          error: planCheck.reason,
          code: planCheck.code,
          billingUrl: "/billing",
          currentCount: planCheck.currentCount,
          limit: planCheck.limit,
          plan: planCheck.plan,
        },
        { status: 403 }
      );
    }
  }

  const eligibility = getLandlordAccountEligibility({
    profile,
    submissions: verificationSubmissions || [],
  });

  if (!eligibility.canPublishListings) {
    return NextResponse.json(
      {
        error: landlordVerificationError,
        code: eligibility.reason,
        verificationUrl: "/dashboard/verification",
      },
      { status: 403 }
    );
  }

  const { error: updateError } = await supabase
    .from("listings")
    .update({ status: "available" })
    .eq("id", listingId)
    .eq("user_id", user.id);

  if (updateError) {
    console.error("LISTING PUBLISH ERROR:", updateError);
    return NextResponse.json(
      { error: "We could not save your verification details. Please try again." },
      { status: 400 }
    );
  }

  await admin.from("listing_verification_audit_events").insert({
    listing_id: listingId,
    verification_id: null,
    actor_id: user.id,
    event_type: "listing_published_by_verified_landlord",
    metadata: {
      previous_status: listing.status,
      account_verification: eligibility.reason,
    },
  });

  return NextResponse.json({ ok: true });
}
