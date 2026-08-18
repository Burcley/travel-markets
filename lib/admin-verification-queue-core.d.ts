import type {
  OverallVerificationStatus,
  UnifiedVerificationRecord,
  VerificationType,
} from "./admin-verification-profiles";

export function isActionableAdminReviewRecord(
  record?: Pick<
    UnifiedVerificationRecord,
    "source" | "verificationType" | "status"
  > | null
): boolean;

export function countActionableAdminReviewRecords(
  records: Array<
    Pick<UnifiedVerificationRecord, "source" | "verificationType" | "status">
  >
): number;

export function profileHasActionableAdminReviewRecords(profile?: {
  allRecords?: Array<
    Pick<UnifiedVerificationRecord, "source" | "verificationType" | "status">
  >;
} | null): boolean;

export function mergeVerificationTypeKeys(
  baseTypes: VerificationType[],
  records: Array<Pick<UnifiedVerificationRecord, "verificationType">>
): VerificationType[];

export function adminVerificationProfileState(input: {
  recordsByType: Partial<Record<VerificationType, UnifiedVerificationRecord>>;
  allRecords: UnifiedVerificationRecord[];
  applicableTypes: VerificationType[];
}): {
  pendingCount: number;
  overallStatus: OverallVerificationStatus;
};
