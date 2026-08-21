export const PUBLIC_LISTING_STATUS: "available";
export const PUBLIC_LISTING_VERIFICATION_STATUS: "verified";

export function isPublicListingStatus(status: unknown): boolean;
export function isVerifiedListingVerificationStatus(status: unknown): boolean;
export function isPubliclyDiscoverableListing(input: {
  listingStatus?: unknown;
  ownerEligible?: boolean;
}): boolean;
export function filterPubliclyDiscoverableListings<
  T extends { id?: string | null; user_id?: string | null; status?: unknown },
>(
  listings: T[],
  ownerProfiles?: Array<Record<string, unknown>>,
  verificationSubmissions?: Array<Record<string, unknown>>
): T[];
