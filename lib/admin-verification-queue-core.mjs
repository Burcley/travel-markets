const MANUAL_VERIFICATION_TYPES = [
  "identity",
  "student_status",
  "property_relationship",
];

export function isActionableAdminReviewRecord(record) {
  if (!record || record.status !== "pending") return false;

  if (record.source === "verification_submissions") {
    return MANUAL_VERIFICATION_TYPES.includes(record.verificationType);
  }

  return (
    record.source === "listing_verifications" &&
    record.verificationType === "property_relationship"
  );
}

export function countActionableAdminReviewRecords(records) {
  return (records || []).filter(isActionableAdminReviewRecord).length;
}

export function profileHasActionableAdminReviewRecords(profile) {
  return countActionableAdminReviewRecords(profile?.allRecords || []) > 0;
}

export function mergeVerificationTypeKeys(baseTypes, records) {
  const types = [...(baseTypes || [])];

  for (const record of records || []) {
    if (record?.verificationType && !types.includes(record.verificationType)) {
      types.push(record.verificationType);
    }
  }

  return types;
}

export function adminVerificationProfileState({
  recordsByType,
  allRecords,
  applicableTypes,
}) {
  const pendingCount = countActionableAdminReviewRecords(allRecords);

  if (pendingCount > 0) {
    return {
      pendingCount,
      overallStatus: "needs_review",
    };
  }

  const applicableRecords = (applicableTypes || [])
    .map((type) => recordsByType?.[type])
    .filter(Boolean);

  if (
    applicableRecords.some(
      (record) => record.status === "resubmission_required"
    )
  ) {
    return {
      pendingCount,
      overallStatus: "more_information_required",
    };
  }

  if (applicableRecords.some((record) => record.status === "rejected")) {
    return {
      pendingCount,
      overallStatus: "rejected",
    };
  }

  const hasStarted = applicableRecords.some(
    (record) => record.status !== "not_started"
  );
  const allVerified = (applicableTypes || []).every((type) => {
    const status = recordsByType?.[type]?.status;
    return status === "approved" || status === "verified";
  });

  if (allVerified) {
    return {
      pendingCount,
      overallStatus: "fully_verified",
    };
  }

  return {
    pendingCount,
    overallStatus: hasStarted ? "partially_verified" : "not_started",
  };
}
