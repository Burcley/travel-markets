export const PUBLIC_LISTING_STATUS = "available";
export const PUBLIC_LISTING_VERIFICATION_STATUS = "verified";

export function isPublicListingStatus(status) {
  return String(status || "").toLowerCase() === PUBLIC_LISTING_STATUS;
}

export function isVerifiedListingVerificationStatus(status) {
  return String(status || "").toLowerCase() === PUBLIC_LISTING_VERIFICATION_STATUS;
}

export function isPubliclyDiscoverableListing({
  listingStatus,
  verificationStatus,
}) {
  return (
    isPublicListingStatus(listingStatus) &&
    isVerifiedListingVerificationStatus(verificationStatus)
  );
}

export function filterPubliclyDiscoverableListings(listings, verifications) {
  const statusByListingId = new Map(
    verifications
      .filter((verification) => verification?.listing_id)
      .map((verification) => [
        verification.listing_id,
        verification.status,
      ])
  );

  return listings.filter((listing) =>
    isPubliclyDiscoverableListing({
      listingStatus: listing?.status,
      verificationStatus: statusByListingId.get(listing?.id),
    })
  );
}
