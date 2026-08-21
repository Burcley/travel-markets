const LANDLORD_ROLES = new Set(["owner", "landlord", "host", "property_manager"]);
const ADMIN_ROLES = new Set(["admin"]);
const BLOCKED_ACCOUNT_STATUSES = new Set(["banned", "suspended", "disabled"]);
const APPROVED_STATUSES = new Set(["approved", "verified", "accepted"]);
const PENDING_STATUSES = new Set(["pending", "submitted", "in_review", "pending_review"]);
const LANDLORD_VERIFICATION_TYPES = new Set([
  "property_relationship",
  "landlord",
  "host",
  "property_manager",
]);

export function normalizeStatus(value) {
  return String(value || "").trim().toLowerCase();
}

export function normalizeRole(value) {
  return String(value || "").trim().toLowerCase();
}

export function isLandlordAccountRole(role) {
  return LANDLORD_ROLES.has(normalizeRole(role));
}

export function isAdminAccount(profile) {
  return Boolean(profile?.is_admin) || ADMIN_ROLES.has(normalizeRole(profile?.role));
}

export function isBlockedAccount(profile) {
  return BLOCKED_ACCOUNT_STATUSES.has(
    normalizeStatus(profile?.account_status || profile?.status || "active")
  );
}

export function isApprovedStatus(status) {
  return APPROVED_STATUSES.has(normalizeStatus(status));
}

export function isPendingStatus(status) {
  return PENDING_STATUSES.has(normalizeStatus(status));
}

export function isLandlordVerificationSubmission(submission) {
  return LANDLORD_VERIFICATION_TYPES.has(
    normalizeStatus(submission?.verification_type || submission?.type)
  );
}

export function hasApprovedIdentityVerification(profile, submissions = []) {
  if (
    Boolean(profile?.identity_verified || profile?.is_verified) ||
    isApprovedStatus(profile?.identity_verification_status)
  ) {
    return true;
  }

  return submissions.some(
    (submission) =>
      normalizeStatus(submission?.verification_type || submission?.type) ===
        "identity" && isApprovedStatus(submission?.status)
  );
}

export function hasApprovedLandlordVerification(submissions = []) {
  return submissions.some(
    (submission) =>
      isLandlordVerificationSubmission(submission) &&
      isApprovedStatus(submission?.status)
  );
}

export function hasPendingLandlordVerification(submissions = []) {
  return submissions.some(
    (submission) =>
      isLandlordVerificationSubmission(submission) &&
      isPendingStatus(submission?.status)
  );
}

export function getLandlordAccountEligibility({
  profile,
  submissions = [],
} = {}) {
  if (!profile) {
    return {
      canPublishListings: false,
      reason: "PROFILE_REQUIRED",
      identityApproved: false,
      landlordApproved: false,
      landlordPending: false,
    };
  }

  const admin = isAdminAccount(profile);
  const landlordRole = isLandlordAccountRole(profile.role);
  const blocked = isBlockedAccount(profile);
  const identityApproved = hasApprovedIdentityVerification(profile, submissions);
  const landlordApproved = hasApprovedLandlordVerification(submissions);
  const landlordPending = hasPendingLandlordVerification(submissions);

  if (blocked) {
    return {
      canPublishListings: false,
      reason: "ACCOUNT_BLOCKED",
      identityApproved,
      landlordApproved,
      landlordPending,
    };
  }

  if (admin) {
    return {
      canPublishListings: true,
      reason: "ADMIN",
      identityApproved: true,
      landlordApproved: true,
      landlordPending,
    };
  }

  if (!landlordRole) {
    return {
      canPublishListings: false,
      reason: "LANDLORD_ROLE_REQUIRED",
      identityApproved,
      landlordApproved,
      landlordPending,
    };
  }

  if (!identityApproved || !landlordApproved) {
    return {
      canPublishListings: false,
      reason: "LANDLORD_VERIFICATION_REQUIRED",
      identityApproved,
      landlordApproved,
      landlordPending,
    };
  }

  return {
    canPublishListings: true,
    reason: "VERIFIED_LANDLORD",
    identityApproved,
    landlordApproved,
    landlordPending,
  };
}
