const LEGACY_RELATIONSHIP_MAP = {
  owner: "registered_owner",
  authorized_property_manager: "property_manager",
  agent: "authorized_representative",
  representative: "authorized_representative",
};

export function listingVerificationStatusForAdminAction(action) {
  if (action === "approve") return "verified";
  if (action === "reject") return "declined";
  if (action === "resubmission") return "more_information_required";
  return null;
}

export function documentReviewStatusForAdminAction(action) {
  if (action === "approve") return "accepted";
  if (action === "reject" || action === "resubmission") return "rejected";
  return null;
}

export function legacyRelationshipTypeForListingVerification(value) {
  return LEGACY_RELATIONSHIP_MAP[String(value || "").toLowerCase()] || null;
}

export function canReviewAdminVerificationRecord(record) {
  if (!record || record.status !== "pending") return false;

  if (record.source === "verification_submissions") {
    return ["identity", "student_status", "property_relationship"].includes(
      record.verificationType
    );
  }

  return (
    record.source === "listing_verifications" &&
    record.verificationType === "property_relationship"
  );
}
