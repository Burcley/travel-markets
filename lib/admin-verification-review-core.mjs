import { isActionableAdminReviewRecord } from "./admin-verification-queue-core.mjs";

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
  return isActionableAdminReviewRecord(record);
}
