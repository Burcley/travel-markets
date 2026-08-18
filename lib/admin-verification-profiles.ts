export type VerificationType =
  | "identity"
  | "student_status"
  | "property_relationship"
  | "phone"
  | "email";

export type VerificationStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "resubmission_required"
  | "expired"
  | "not_started"
  | "verified";

export type OverallVerificationStatus =
  | "needs_review"
  | "more_information_required"
  | "rejected"
  | "fully_verified"
  | "partially_verified"
  | "not_started";

export type UnifiedVerificationRecord = {
  id: string;
  source:
    | "verification_submissions"
    | "identity_verifications"
    | "listing_verifications"
    | "profile";
  userId: string;
  fullName: string | null;
  email: string | null;
  avatarUrl: string | null;
  role: string | null;
  verificationType: VerificationType;
  status: VerificationStatus;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewerName: string | null;
  rejectionReason: string | null;
  institution: string | null;
  property: string | null;
  documentPaths: string[];
  metadata: Record<string, unknown>;
  phoneMasked?: string | null;
  verifiedAt?: string | null;
};

export type UserVerificationProfile = {
  userId: string;
  fullName: string | null;
  email: string | null;
  avatarUrl: string | null;
  role: string | null;
  institution: string | null;
  hostInfo: string | null;
  records: Partial<Record<VerificationType, UnifiedVerificationRecord>>;
  allRecords: UnifiedVerificationRecord[];
  applicableTypes: VerificationType[];
  pendingCount: number;
  overallStatus: OverallVerificationStatus;
  lastActivityAt: string | null;
};

export const manualVerificationTypes: VerificationType[] = [
  "identity",
  "student_status",
  "property_relationship",
];

export function verificationTypeLabel(type: VerificationType) {
  if (type === "student_status") return "Student Status";
  if (type === "property_relationship") return "Property Relationship";
  return type.charAt(0).toUpperCase() + type.slice(1);
}

export function statusLabel(status: VerificationStatus | OverallVerificationStatus) {
  return status.replaceAll("_", " ");
}

export function isManualVerification(type: VerificationType) {
  return manualVerificationTypes.includes(type);
}

export function isStudentRole(role?: string | null) {
  return String(role || "").toLowerCase() === "student";
}

export function isHostRole(role?: string | null) {
  const value = String(role || "").toLowerCase();
  return ["host", "owner", "landlord", "property_manager"].includes(value);
}

export function applicableVerificationTypes(role?: string | null): VerificationType[] {
  if (isStudentRole(role)) {
    return ["email", "phone", "identity", "student_status"];
  }

  if (isHostRole(role)) {
    return ["email", "phone", "identity", "property_relationship"];
  }

  return ["email", "phone", "identity"];
}

function timestamp(record: UnifiedVerificationRecord) {
  return record.submittedAt || record.reviewedAt || record.verifiedAt || "";
}

function statusPriority(status: VerificationStatus) {
  if (status === "pending") return 6;
  if (status === "resubmission_required") return 5;
  if (status === "rejected") return 4;
  if (status === "approved" || status === "verified") return 3;
  if (status === "expired") return 2;
  return 1;
}

function chooseRepresentativeRecord(
  current: UnifiedVerificationRecord | undefined,
  candidate: UnifiedVerificationRecord
) {
  if (!current) return candidate;

  const priorityDelta =
    statusPriority(candidate.status) - statusPriority(current.status);
  if (priorityDelta !== 0) return priorityDelta > 0 ? candidate : current;

  return timestamp(candidate).localeCompare(timestamp(current)) > 0
    ? candidate
    : current;
}

function latestActivity(records: UnifiedVerificationRecord[]) {
  return records
    .map(timestamp)
    .filter(Boolean)
    .sort()
    .at(-1) || null;
}

function computeOverallStatus({
  records,
  applicableTypes,
}: {
  records: Partial<Record<VerificationType, UnifiedVerificationRecord>>;
  applicableTypes: VerificationType[];
}): OverallVerificationStatus {
  const applicableRecords = applicableTypes
    .map((type) => records[type])
    .filter(Boolean) as UnifiedVerificationRecord[];
  const manualRecords = applicableRecords.filter((record) =>
    isManualVerification(record.verificationType)
  );

  if (manualRecords.some((record) => record.status === "pending")) {
    return "needs_review";
  }

  if (applicableRecords.some((record) => record.status === "resubmission_required")) {
    return "more_information_required";
  }

  if (applicableRecords.some((record) => record.status === "rejected")) {
    return "rejected";
  }

  const hasStarted = applicableRecords.some(
    (record) => record.status !== "not_started"
  );
  const allVerified = applicableTypes.every((type) => {
    const status = records[type]?.status;
    return status === "approved" || status === "verified";
  });

  if (allVerified) return "fully_verified";
  if (hasStarted) return "partially_verified";
  return "not_started";
}

export function groupVerificationRecords(
  records: UnifiedVerificationRecord[]
): UserVerificationProfile[] {
  const profiles = new Map<string, UserVerificationProfile>();

  for (const record of records) {
    const existing = profiles.get(record.userId);
    const profile =
      existing ||
      ({
        userId: record.userId,
        fullName: record.fullName,
        email: record.email,
        avatarUrl: record.avatarUrl,
        role: record.role,
        institution: record.institution,
        hostInfo: record.property,
        records: {},
        allRecords: [],
        applicableTypes: applicableVerificationTypes(record.role),
        pendingCount: 0,
        overallStatus: "not_started",
        lastActivityAt: null,
      } satisfies UserVerificationProfile);

    profile.fullName ||= record.fullName;
    profile.email ||= record.email;
    profile.avatarUrl ||= record.avatarUrl;
    profile.role ||= record.role;
    profile.institution ||= record.institution;
    profile.hostInfo ||= record.property;
    profile.records[record.verificationType] = chooseRepresentativeRecord(
      profile.records[record.verificationType],
      record
    );
    profile.allRecords.push(record);
    profile.applicableTypes = applicableVerificationTypes(profile.role);
    profiles.set(record.userId, profile);
  }

  return Array.from(profiles.values())
    .map((profile) => {
      const applicableRecords = profile.applicableTypes
        .map((type) => profile.records[type])
        .filter(Boolean) as UnifiedVerificationRecord[];

      return {
        ...profile,
        pendingCount: applicableRecords.filter(
          (record) =>
            isManualVerification(record.verificationType) &&
            record.status === "pending"
        ).length,
        overallStatus: computeOverallStatus({
          records: profile.records,
          applicableTypes: profile.applicableTypes,
        }),
        lastActivityAt: latestActivity(profile.allRecords),
      };
    })
    .sort((a, b) => {
      if (a.pendingCount !== b.pendingCount) return b.pendingCount - a.pendingCount;
      return String(b.lastActivityAt || "").localeCompare(
        String(a.lastActivityAt || "")
      );
    });
}
