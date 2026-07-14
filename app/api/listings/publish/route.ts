import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const publishVerificationError =
  "Property verification is required before this listing can be published. Upload at least one document showing your ownership, management authority or authorization to advertise this property.";

function livingArrangementComplete(listing: Record<string, unknown>) {
  return [
    "owner_occupies_property",
    "owner_family_occupies_property",
    "shared_kitchen_with_owner",
    "shared_bathroom_with_owner",
    "private_bedroom",
    "self_contained_unit",
    "other_occupants_present",
  ].every((key) => listing[key] !== null && listing[key] !== undefined);
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

  const { data: profile } = await admin
    .from("profiles")
    .select("id, role, is_admin, account_status")
    .eq("id", user.id)
    .maybeSingle();

  const accountStatus = String(profile?.account_status || "active").toLowerCase();
  const role = String(profile?.role || "").toLowerCase();
  const isLandlord =
    profile?.is_admin || ["owner", "landlord", "admin"].includes(role);

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
    .select(
      "id, user_id, status, owner_occupies_property, owner_family_occupies_property, shared_kitchen_with_owner, shared_bathroom_with_owner, private_bedroom, self_contained_unit, other_occupants_present, verification_disclaimer_acknowledged, fair_housing_acknowledged"
    )
    .eq("id", listingId)
    .maybeSingle();

  if (!listing || listing.user_id !== user.id) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }

  if (!listing.verification_disclaimer_acknowledged) {
    return NextResponse.json(
      { error: "Acknowledge the property verification disclaimer before publishing." },
      { status: 400 }
    );
  }

  if (!listing.fair_housing_acknowledged) {
    return NextResponse.json(
      { error: "Acknowledge the fair-housing document notice before publishing." },
      { status: 400 }
    );
  }

  if (!livingArrangementComplete(listing)) {
    return NextResponse.json(
      { error: "Complete the living-arrangement questions before publishing." },
      { status: 400 }
    );
  }

  const { data: verification, error: verificationError } = await admin
    .from("listing_verifications")
    .select("id, relationship_type, other_relationship_explanation, status")
    .eq("listing_id", listingId)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (verificationError) {
    console.error("LISTING PUBLISH VERIFICATION LOOKUP ERROR:", verificationError);
    return NextResponse.json(
      { error: "We could not save your verification details. Please try again." },
      { status: 500 }
    );
  }

  if (!verification?.relationship_type) {
    return NextResponse.json({ error: publishVerificationError }, { status: 400 });
  }

  if (
    verification.relationship_type === "other" &&
    !String(verification.other_relationship_explanation || "").trim()
  ) {
    return NextResponse.json(
      { error: "Explain the other authorized relationship before publishing." },
      { status: 400 }
    );
  }

  const { count: documentCount } = await admin
    .from("listing_verification_documents")
    .select("id", { count: "exact", head: true })
    .eq("verification_id", verification.id)
    .eq("uploader_id", user.id)
    .in("review_status", ["pending", "accepted"]);

  if (!documentCount) {
    return NextResponse.json({ error: publishVerificationError }, { status: 400 });
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
    verification_id: verification.id,
    actor_id: user.id,
    event_type: "listing_published_with_pending_verification",
    metadata: {
      previous_status: listing.status,
      verification_status: verification.status,
    },
  });

  return NextResponse.json({ ok: true });
}
