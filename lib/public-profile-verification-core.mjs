const HOST_ROLES = new Set(["host", "owner", "landlord", "property_manager"]);

export function isPublicHostRole(role) {
  return HOST_ROLES.has(String(role || "").toLowerCase());
}

export function isPublicStudentRole(role) {
  return String(role || "").toLowerCase() === "student";
}

export function normalizePublicVerificationStatus(status, verified = false) {
  const normalized = String(status || "").toLowerCase();

  if (verified || ["verified", "approved", "accepted"].includes(normalized)) {
    return "verified";
  }

  if (["pending", "pending_review", "submitted", "in_review"].includes(normalized)) {
    return "pending";
  }

  if (
    ["rejected", "declined", "denied", "more_information_required"].includes(
      normalized
    )
  ) {
    return "rejected";
  }

  if (normalized === "resubmission_required") return "resubmission_required";
  if (normalized === "code_sent") return "code_sent";
  if (normalized === "expired") return "expired";
  if (normalized === "failed") return "failed";
  if (normalized === "locked") return "locked";

  return "not_started";
}

export function resolvePropertyRelationshipStatus(records = []) {
  const statuses = records.map((record) =>
    normalizePublicVerificationStatus(record?.status)
  );

  if (statuses.includes("verified")) return "verified";
  if (statuses.includes("pending")) return "pending";
  if (statuses.includes("resubmission_required")) return "resubmission_required";
  if (statuses.includes("rejected")) return "rejected";
  if (statuses.includes("expired")) return "expired";

  return "not_started";
}

export function getPublicProfileTrustCards({
  role,
  identityStatus,
  emailStatus,
  phoneStatus,
  studentStatus,
  propertyRelationshipStatus,
  profileCompletion,
  memberSince,
}) {
  const cards = [
    {
      key: "identity",
      label: "Identity verified",
      status: identityStatus,
      active: identityStatus === "verified",
    },
    {
      key: "email",
      label: "Email verified",
      status: emailStatus,
      active: emailStatus === "verified",
    },
    {
      key: "phone",
      label: "Phone verified",
      status: phoneStatus,
      active: phoneStatus === "verified",
    },
  ];

  if (isPublicHostRole(role)) {
    cards.push({
      key: "property_relationship",
      label: "Property relationship verified",
      status: propertyRelationshipStatus,
      active: propertyRelationshipStatus === "verified",
    });
  } else if (isPublicStudentRole(role)) {
    cards.push({
      key: "student_status",
      label: "Student status verified",
      status: studentStatus,
      active: studentStatus === "verified",
    });
  }

  cards.push(
    {
      key: "profile_completion",
      label: "Profile completeness",
      value: `${profileCompletion}%`,
      active: profileCompletion >= 70,
    },
    {
      key: "member_since",
      label: "Member since",
      value: memberSince || "Not available",
      active: Boolean(memberSince),
    }
  );

  return cards;
}

export function isPublicProfileFullyVerified({
  role,
  identityStatus,
  emailStatus,
  phoneStatus,
  studentStatus,
  propertyRelationshipStatus,
}) {
  const commonVerified =
    identityStatus === "verified" &&
    emailStatus === "verified" &&
    phoneStatus === "verified";

  if (!commonVerified) return false;

  if (isPublicHostRole(role)) {
    return propertyRelationshipStatus === "verified";
  }

  if (isPublicStudentRole(role)) {
    return studentStatus === "verified";
  }

  return true;
}
