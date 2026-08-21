import { getLandlordAccountEligibility } from "../landlord-account-eligibility-core.mjs";

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
  ownerEligible = false,
}) {
  return isPublicListingStatus(listingStatus) && ownerEligible === true;
}

export function filterPubliclyDiscoverableListings(
  listings,
  ownerProfiles = [],
  verificationSubmissions = []
) {
  const profilesById = new Map(
    ownerProfiles
      .filter((profile) => profile?.id)
      .map((profile) => [profile.id, profile])
  );
  const submissionsByUserId = new Map();

  for (const submission of verificationSubmissions || []) {
    if (!submission?.user_id) continue;
    submissionsByUserId.set(submission.user_id, [
      ...(submissionsByUserId.get(submission.user_id) || []),
      submission,
    ]);
  }

  return listings.filter((listing) => {
    const ownerId = listing?.user_id;
    const eligibility = getLandlordAccountEligibility({
      profile: ownerId ? profilesById.get(ownerId) : null,
      submissions: ownerId ? submissionsByUserId.get(ownerId) || [] : [],
    });

    return isPubliclyDiscoverableListing({
      listingStatus: listing?.status,
      ownerEligible: eligibility.canPublishListings,
    });
  });
}
