declare module "@/lib/public-profile-verification-core.mjs" {
  import type { VerificationStatus } from "@/lib/verification-center";

  type PublicStatusInput = string | null | undefined;

  export function isPublicHostRole(role?: string | null): boolean;
  export function isPublicStudentRole(role?: string | null): boolean;
  export function normalizePublicVerificationStatus(
    status?: PublicStatusInput,
    verified?: boolean
  ): VerificationStatus;
  export function resolvePropertyRelationshipStatus(
    records?: Array<{ status?: PublicStatusInput }>
  ): VerificationStatus;
  export function getPublicProfileTrustCards(args: {
    role?: string | null;
    identityStatus: VerificationStatus;
    emailStatus: VerificationStatus;
    phoneStatus: VerificationStatus;
    studentStatus: VerificationStatus;
    propertyRelationshipStatus: VerificationStatus;
    profileCompletion: number;
    memberSince?: string | null;
  }): Array<{
    key: string;
    label: string;
    status?: VerificationStatus;
    value?: string;
    active: boolean;
  }>;
  export function isPublicProfileFullyVerified(args: {
    role?: string | null;
    identityStatus: VerificationStatus;
    emailStatus: VerificationStatus;
    phoneStatus: VerificationStatus;
    studentStatus: VerificationStatus;
    propertyRelationshipStatus: VerificationStatus;
  }): boolean;
}
