export type VerificationStatus =
  | "verified"
  | "pending"
  | "code_sent"
  | "not_started"
  | "rejected"
  | "resubmission_required"
  | "expired"
  | "failed"
  | "locked";

export type VerificationProfile = {
  full_name?: string | null;
  phone?: string | null;
  bio?: string | null;
  role?: string | null;
  avatar_url?: string | null;
  is_verified?: boolean | null;
  identity_verified?: boolean | null;
  identity_verification_status?: string | null;
  identity_verified_at?: string | null;
  phone_verified?: boolean | null;
  phone_verified_at?: string | null;
  phone_verification_status?: string | null;
  student_email_verified?: boolean | null;
  student_verification_status?: string | null;
  profile_completion_percentage?: number | null;
  trust_score?: number | null;
  trust_level?: string | null;
};

export type PropertyVerificationRecord = {
  status?: string | null;
  reviewed_at?: string | null;
  submitted_at?: string | null;
  owner_visible_reason?: string | null;
};

export function isHostRole(role?: string | null) {
  return ["owner", "landlord", "host", "property_manager"].includes(
    String(role || "").toLowerCase()
  );
}

export function normalizeVerificationStatus(
  status?: string | null,
  verified = false
): VerificationStatus {
  const normalized = String(status || "").toLowerCase();

  if (verified || ["verified", "approved", "accepted"].includes(normalized)) {
    return "verified";
  }

  if (["pending", "pending_review", "submitted", "in_review"].includes(normalized)) {
    return "pending";
  }

  if (normalized === "code_sent") return "code_sent";
  if (normalized === "expired") return "expired";
  if (normalized === "failed") return "failed";
  if (normalized === "locked") return "locked";

  if (
    ["rejected", "declined", "denied", "more_information_required"].includes(
      normalized
    )
  ) {
    return "rejected";
  }

  if (normalized === "resubmission_required") return "resubmission_required";

  return "not_started";
}

export function verificationLabel(status: VerificationStatus) {
  if (status === "verified") return "Verified";
  if (status === "pending") return "Pending Review";
  if (status === "code_sent") return "Code Sent";
  if (status === "rejected") return "Rejected";
  if (status === "resubmission_required") return "Resubmission Required";
  if (status === "expired") return "Expired";
  if (status === "failed") return "Failed";
  if (status === "locked") return "Locked";
  return "Not Started";
}

export function trustScoreLabel(score: number) {
  if (score >= 80) return "Excellent";
  if (score >= 60) return "Strong";
  if (score >= 35) return "Building";
  return "New";
}

export function trustStars(score: number) {
  if (score >= 80) return "★★★★★";
  if (score >= 60) return "★★★★☆";
  if (score >= 35) return "★★★☆☆";
  return "★★☆☆☆";
}

export function calculateProfileCompletion({
  profile,
  emailVerified,
  propertyVerification,
}: {
  profile: VerificationProfile;
  emailVerified: boolean;
  propertyVerification?: PropertyVerificationRecord | null;
}) {
  const host = isHostRole(profile.role);
  const identityVerified = normalizeVerificationStatus(
    profile.identity_verification_status,
    Boolean(profile.identity_verified || profile.is_verified)
  ) === "verified";
  const roleSpecificVerified = host
    ? normalizeVerificationStatus(propertyVerification?.status) === "verified"
    : normalizeVerificationStatus(
        profile.student_verification_status,
        Boolean(profile.student_email_verified)
      ) === "verified";

  const items = [
    Boolean(profile.avatar_url),
    Boolean(profile.full_name?.trim()),
    Boolean(profile.phone?.trim()),
    Boolean(profile.bio?.trim()),
    Boolean(profile.role),
    emailVerified,
    identityVerified,
    roleSpecificVerified,
  ];

  return Math.round((items.filter(Boolean).length / items.length) * 100);
}

export function calculateTrustScore({
  profile,
  emailVerified,
  propertyVerification,
  reviewCount = 0,
  responseRate = 0,
  listingQuality = 0,
}: {
  profile: VerificationProfile;
  emailVerified: boolean;
  propertyVerification?: PropertyVerificationRecord | null;
  reviewCount?: number;
  responseRate?: number;
  listingQuality?: number;
}) {
  const completion = calculateProfileCompletion({
    profile,
    emailVerified,
    propertyVerification,
  });
  const identityVerified =
    normalizeVerificationStatus(
      profile.identity_verification_status,
      Boolean(profile.identity_verified || profile.is_verified)
    ) === "verified";
  const roleVerified = isHostRole(profile.role)
    ? normalizeVerificationStatus(propertyVerification?.status) === "verified"
    : normalizeVerificationStatus(
        profile.student_verification_status,
        Boolean(profile.student_email_verified)
      ) === "verified";
  const verificationPoints =
    (emailVerified ? 10 : 0) +
    (profile.phone_verified || profile.phone_verified_at ? 10 : 0) +
    (identityVerified ? 20 : 0) +
    (roleVerified ? 15 : 0);
  const profilePoints = Math.round(completion * 0.25);
  const reviewPoints = Math.min(reviewCount * 4, 20);
  const responsePoints = Math.round(Math.min(Math.max(responseRate, 0), 100) * 0.1);
  const listingPoints = Math.round(Math.min(Math.max(listingQuality, 0), 100) * 0.1);

  return Math.min(
    100,
    verificationPoints + profilePoints + reviewPoints + responsePoints + listingPoints
  );
}
