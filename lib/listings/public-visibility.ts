import { createAdminClient } from "@/lib/supabase/admin";
import { getLandlordAccountEligibility } from "@/lib/landlord-account-eligibility";
import {
  PUBLIC_LISTING_STATUS,
  PUBLIC_LISTING_VERIFICATION_STATUS,
  isPubliclyDiscoverableListing,
} from "./public-visibility-core.mjs";

type SupabaseLike = {
  from: (table: string) => unknown;
};

type ListingVisibilityRow = {
  id: string;
  user_id?: string | null;
  status?: string | null;
};

type OwnerProfileRow = {
  id?: string | null;
  role?: string | null;
  is_admin?: boolean | null;
  account_status?: string | null;
  status?: string | null;
  identity_verified?: boolean | null;
  is_verified?: boolean | null;
  identity_verification_status?: string | null;
};

type VerificationSubmissionRow = {
  user_id?: string | null;
  verification_type?: string | null;
  status?: string | null;
};

const PAGE_SIZE = 1000;
const ZERO_UUID = "00000000-0000-0000-0000-000000000000";

export { PUBLIC_LISTING_STATUS, PUBLIC_LISTING_VERIFICATION_STATUS };

function groupByUserId(rows: VerificationSubmissionRow[] | null | undefined) {
  const grouped = new Map<string, VerificationSubmissionRow[]>();

  for (const row of rows || []) {
    if (!row.user_id) continue;
    grouped.set(row.user_id, [...(grouped.get(row.user_id) || []), row]);
  }

  return grouped;
}

export async function getVerifiedPublicListingIds(_supabase?: SupabaseLike) {
  void _supabase;

  const admin = createAdminClient();
  const ids: string[] = [];
  let from = 0;

  while (true) {
    const { data: listings, error: listingError } = await admin
      .from("listings")
      .select("id, user_id, status")
      .eq("status", PUBLIC_LISTING_STATUS)
      .range(from, from + PAGE_SIZE - 1);

    if (listingError) {
      throw new Error(listingError.message || "Unable to load public listings.");
    }

    const page = (listings || []) as ListingVisibilityRow[];
    if (page.length === 0) break;

    const ownerIds = Array.from(
      new Set(page.map((listing) => listing.user_id).filter(Boolean))
    ) as string[];

    const [{ data: profiles, error: profileError }, { data: submissions, error }] =
      await Promise.all([
        admin
          .from("profiles")
          .select(
            "id, role, is_admin, account_status, status, identity_verified, is_verified, identity_verification_status"
          )
          .in("id", ownerIds.length ? ownerIds : [ZERO_UUID]),
        admin
          .from("verification_submissions")
          .select("user_id, verification_type, status")
          .in("user_id", ownerIds.length ? ownerIds : [ZERO_UUID]),
      ]);

    if (profileError) {
      throw new Error(profileError.message || "Unable to load owner profiles.");
    }

    if (error) {
      throw new Error(error.message || "Unable to load owner verification.");
    }

    const profileById = new Map(
      ((profiles || []) as OwnerProfileRow[])
        .filter((profile) => profile.id)
        .map((profile) => [profile.id as string, profile])
    );
    const submissionsByUserId = groupByUserId(
      (submissions || []) as VerificationSubmissionRow[]
    );

    ids.push(
      ...page
        .filter((listing) => {
          const ownerId = listing.user_id || "";
          const eligibility = getLandlordAccountEligibility({
            profile: profileById.get(ownerId) || null,
            submissions: submissionsByUserId.get(ownerId) || [],
          });

          return isPubliclyDiscoverableListing({
            listingStatus: listing.status,
            ownerEligible: eligibility.canPublishListings,
          });
        })
        .map((listing) => listing.id)
    );

    if (page.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return ids;
}

export function listingIsVerifiedForPublicDiscovery(
  verificationStatus?: string | null
) {
  return verificationStatus === PUBLIC_LISTING_VERIFICATION_STATUS;
}

export async function getPublicListingEligibility(listingId: string) {
  const admin = createAdminClient();
  const { data: listing, error: listingError } = await admin
    .from("listings")
    .select("id, user_id, status")
    .eq("id", listingId)
    .maybeSingle();

  if (listingError) {
    throw new Error(listingError.message || "Unable to load listing.");
  }

  if (!listing) {
    return {
      listingExists: false,
      publiclyEligible: false,
      listingSpecificVerified: false,
      legacyPropertyVerified: false,
      verificationStatus: null as string | null,
      ownerAccountEligible: false,
    };
  }

  const [
    { data: ownerProfile, error: profileError },
    { data: submissions, error: submissionError },
  ] = await Promise.all([
    admin
      .from("profiles")
      .select(
        "id, role, is_admin, account_status, status, identity_verified, is_verified, identity_verification_status"
      )
      .eq("id", listing.user_id)
      .maybeSingle(),
    admin
      .from("verification_submissions")
      .select("user_id, verification_type, status")
      .eq("user_id", listing.user_id),
  ]);

  if (profileError) {
    throw new Error(profileError.message || "Unable to load owner profile.");
  }

  if (submissionError) {
    throw new Error(
      submissionError.message || "Unable to load owner verification."
    );
  }

  const eligibility = getLandlordAccountEligibility({
    profile: ownerProfile,
    submissions: (submissions || []) as VerificationSubmissionRow[],
  });
  const publiclyEligible = isPubliclyDiscoverableListing({
    listingStatus: listing.status,
    ownerEligible: eligibility.canPublishListings,
  });

  return {
    listingExists: true,
    publiclyEligible,
    listingSpecificVerified: false,
    legacyPropertyVerified: false,
    verificationStatus: null as string | null,
    ownerAccountEligible: eligibility.canPublishListings,
  };
}
