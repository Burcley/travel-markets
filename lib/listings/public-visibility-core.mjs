export const PUBLIC_LISTING_STATUS = "available";
export const PUBLIC_LISTING_VERIFICATION_STATUS = "verified";
export const LEGACY_PROPERTY_VERIFICATION_CUTOFF =
  "2026-08-18T15:47:03.000Z";

const LEGACY_PROPERTY_VERIFICATION_TYPES = new Set([
  "property_relationship",
  "property",
  "host",
  "landlord",
]);

const LEGACY_APPROVED_STATUSES = new Set(["approved", "verified"]);

const OWNER_ROLES = new Set(["owner", "landlord", "property_manager", "host"]);

const BLOCKED_ACCOUNT_STATUSES = new Set(["banned", "suspended", "disabled"]);

export function isPublicListingStatus(status) {
  return String(status || "").toLowerCase() === PUBLIC_LISTING_STATUS;
}

export function isVerifiedListingVerificationStatus(status) {
  return String(status || "").toLowerCase() === PUBLIC_LISTING_VERIFICATION_STATUS;
}

export function isLegacyPropertyVerificationType(type) {
  return LEGACY_PROPERTY_VERIFICATION_TYPES.has(String(type || "").toLowerCase());
}

export function isApprovedLegacyPropertyVerification(submission) {
  return (
    Boolean(submission) &&
    isLegacyPropertyVerificationType(submission.verification_type) &&
    LEGACY_APPROVED_STATUSES.has(String(submission.status || "").toLowerCase())
  );
}

export function isEligibleOwnerRole(profile) {
  if (!profile || profile.is_admin === true) return false;

  const role = String(profile.role || "").toLowerCase();
  const accountStatus = String(profile.account_status || "active").toLowerCase();

  return OWNER_ROLES.has(role) && !BLOCKED_ACCOUNT_STATUSES.has(accountStatus);
}

export function predatesLegacyPropertyVerificationCutoff(createdAt) {
  if (!createdAt) return false;

  const createdTime = new Date(createdAt).getTime();
  const cutoffTime = new Date(LEGACY_PROPERTY_VERIFICATION_CUTOFF).getTime();

  return Number.isFinite(createdTime) && createdTime < cutoffTime;
}

export function listingQualifiesForLegacyPropertyVerification({
  listing,
  ownerProfile,
  legacyVerification,
  listingVerification,
}) {
  return (
    Boolean(listing?.id) &&
    !listingVerification &&
    predatesLegacyPropertyVerificationCutoff(listing?.created_at) &&
    isEligibleOwnerRole(ownerProfile) &&
    isApprovedLegacyPropertyVerification(legacyVerification)
  );
}

export function isPubliclyDiscoverableListing({
  listingStatus,
  verificationStatus,
  legacyPropertyVerified = false,
}) {
  return (
    isPublicListingStatus(listingStatus) &&
    (isVerifiedListingVerificationStatus(verificationStatus) ||
      legacyPropertyVerified === true)
  );
}

export function filterPubliclyDiscoverableListings(
  listings,
  verifications,
  legacyEligibleListingIds = []
) {
  const statusByListingId = new Map(
    verifications
      .filter((verification) => verification?.listing_id)
      .map((verification) => [
        verification.listing_id,
        verification.status,
      ])
  );
  const legacyEligibleSet = new Set(legacyEligibleListingIds);

  return listings.filter((listing) =>
    isPubliclyDiscoverableListing({
      listingStatus: listing?.status,
      verificationStatus: statusByListingId.get(listing?.id),
      legacyPropertyVerified: legacyEligibleSet.has(listing?.id),
    })
  );
}
