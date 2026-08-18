declare module "@/lib/admin-verification-review-core.mjs" {
  export function listingVerificationStatusForAdminAction(
    action: string
  ): "verified" | "declined" | "more_information_required" | null;

  export function documentReviewStatusForAdminAction(
    action: string
  ): "accepted" | "rejected" | null;

  export function legacyRelationshipTypeForListingVerification(
    value?: string | null
  ):
    | "registered_owner"
    | "property_manager"
    | "authorized_representative"
    | null;

  export function canReviewAdminVerificationRecord(record?: {
    status?: string | null;
    verificationType?: string | null;
    source?: string | null;
  } | null): boolean;
}
