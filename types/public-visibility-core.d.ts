export const PUBLIC_LISTING_STATUS: "available";
export const PUBLIC_LISTING_VERIFICATION_STATUS: "verified";

export function isPublicListingStatus(status: unknown): boolean;
export function isVerifiedListingVerificationStatus(status: unknown): boolean;
export function isPubliclyDiscoverableListing(input: {
  listingStatus: unknown;
  verificationStatus: unknown;
}): boolean;
export function filterPubliclyDiscoverableListings<
  TListing extends { id?: string | null; status?: unknown },
  TVerification extends { listing_id?: string | null; status?: unknown },
>(listings: TListing[], verifications: TVerification[]): TListing[];
