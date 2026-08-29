import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { canManageListings } from "@/lib/role-access";
import { canCreateOrActivateListing } from "@/lib/subscriptions/server";
import { getLandlordAccountEligibility } from "@/lib/landlord-account-eligibility";

const ACTIVE_STATUSES = new Set(["available", "pending"]);
const ALLOWED_STATUSES = new Set(["draft", "available", "pending", "rented"]);
const publicApprovalError = "Complete landlord verification to publish listings.";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const admin = createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: roleProfile } = await supabase
    .from("profiles")
    .select("role, is_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (!canManageListings(roleProfile)) {
    return NextResponse.json(
      { error: "Property listing tools are available to landlord accounts." },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);
  const listingId = String(body?.listingId || "");
  const status = String(body?.status || "");
  const dryRun = Boolean(body?.dryRun);

  if (!listingId || !ALLOWED_STATUSES.has(status)) {
    return NextResponse.json({ error: "Invalid listing status." }, { status: 400 });
  }

  const { data: listing, error: readError } = await admin
    .from("listings")
    .select("id, user_id, status")
    .eq("id", listingId)
    .maybeSingle();

  if (readError) {
    console.error("LISTING STATUS READ ERROR:", readError);
    return NextResponse.json(
      { error: "We could not update this listing status." },
      { status: 500 }
    );
  }

  if (!listing || listing.user_id !== user.id) {
    return NextResponse.json({ error: "Listing not found." }, { status: 404 });
  }

  const currentStatus = String(listing.status || "draft");

  if (
    currentStatus === "draft" &&
    ["available", "pending", "rented"].includes(status)
  ) {
    return NextResponse.json(
      {
        error: "DRAFT_REQUIRES_PUBLISH",
        message: "Complete and publish this listing first.",
        continueUrl: `/listings/${listingId}/edit`,
      },
      { status: 409 }
    );
  }

  const currentlyActive = ACTIVE_STATUSES.has(currentStatus);
  const nextActive = ACTIVE_STATUSES.has(status);

  if (nextActive && !currentlyActive) {
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

  if (status === "available") {
    const [{ data: profile, error: profileError }, { data: submissions, error }] =
      await Promise.all([
        admin
          .from("profiles")
          .select(
            "id, role, is_admin, account_status, identity_verified, is_verified, identity_verification_status"
          )
          .eq("id", user.id)
          .maybeSingle(),
        admin
          .from("verification_submissions")
          .select("verification_type, status")
          .eq("user_id", user.id),
      ]);

    if (profileError || error) {
      console.error("LISTING STATUS ACCOUNT VERIFICATION READ ERROR:", {
        profileError,
        submissionError: error,
      });
      return NextResponse.json(
        { error: "We could not verify this listing status." },
        { status: 500 }
      );
    }

    const eligibility = getLandlordAccountEligibility({
      profile,
      submissions: submissions || [],
    });

    if (!eligibility.canPublishListings) {
      return NextResponse.json(
        {
          error: publicApprovalError,
          code: eligibility.reason,
          verificationUrl: "/dashboard/verification",
        },
        { status: 403 }
      );
    }
  }

  if (dryRun) {
    return NextResponse.json({ ok: true });
  }

  const { error: updateError } = await admin
    .from("listings")
    .update({ status })
    .eq("id", listingId)
    .eq("user_id", user.id);

  if (updateError) {
    console.error("LISTING STATUS UPDATE ERROR:", updateError);
    return NextResponse.json(
      { error: "We could not update this listing status." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
