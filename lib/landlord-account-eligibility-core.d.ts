export type LandlordAccountEligibilityResult = {
  canPublishListings: boolean;
  reason:
    | "PROFILE_REQUIRED"
    | "ACCOUNT_BLOCKED"
    | "ADMIN"
    | "LANDLORD_ROLE_REQUIRED"
    | "LANDLORD_VERIFICATION_REQUIRED"
    | "VERIFIED_LANDLORD";
  identityApproved: boolean;
  landlordApproved: boolean;
  landlordPending: boolean;
};

export function normalizeStatus(value: unknown): string;
export function normalizeRole(value: unknown): string;
export function isLandlordAccountRole(role: unknown): boolean;
export function isAdminAccount(profile: Record<string, unknown> | null): boolean;
export function isBlockedAccount(profile: Record<string, unknown> | null): boolean;
export function isApprovedStatus(status: unknown): boolean;
export function isPendingStatus(status: unknown): boolean;
export function isLandlordVerificationSubmission(
  submission: Record<string, unknown> | null
): boolean;
export function hasApprovedIdentityVerification(
  profile: Record<string, unknown> | null,
  submissions?: Array<Record<string, unknown>>
): boolean;
export function hasApprovedLandlordVerification(
  submissions?: Array<Record<string, unknown>>
): boolean;
export function hasPendingLandlordVerification(
  submissions?: Array<Record<string, unknown>>
): boolean;
export function getLandlordAccountEligibility(input?: {
  profile?: Record<string, unknown> | null;
  submissions?: Array<Record<string, unknown>>;
}): LandlordAccountEligibilityResult;
