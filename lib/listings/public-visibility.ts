import { createAdminClient } from "@/lib/supabase/admin";
import {
  isPubliclyDiscoverableListing,
  listingQualifiesForLegacyPropertyVerification,
  PUBLIC_LISTING_STATUS,
  PUBLIC_LISTING_VERIFICATION_STATUS,
} from "./public-visibility-core.mjs";

type SupabaseLike = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (
        column: string,
        value: string
      ) => {
        range: (from: number, to: number) => unknown;
      };
    };
  };
};

type ListingVisibilityRow = {
  id: string;
  user_id?: string | null;
  status?: string | null;
  created_at?: string | null;
};

type OwnerProfileRow = {
  id?: string | null;
  role?: string | null;
  is_admin?: boolean | null;
  account_status?: string | null;
};

type ListingVerificationRow = {
  id?: string | null;
  listing_id?: string | null;
  owner_id?: string | null;
  status?: string | null;
};

type LegacyVerificationRow = {
  id?: string | null;
  user_id?: string | null;
  verification_type?: string | null;
  status?: string | null;
};

const PAGE_SIZE = 1000;
const LEGACY_PROPERTY_VERIFICATION_CUTOFF = "2026-08-18T15:47:03.000Z";
const ZERO_UUID = "00000000-0000-0000-0000-000000000000";

export { PUBLIC_LISTING_STATUS, PUBLIC_LISTING_VERIFICATION_STATUS };

async function getListingSpecificVerifiedListingIds(supabase: SupabaseLike) {
  const ids: string[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await (supabase
      .from("public_listing_verification_status")
      .select("listing_id")
      .eq("status", PUBLIC_LISTING_VERIFICATION_STATUS)
      .range(from, from + PAGE_SIZE - 1) as PromiseLike<{
      data: Array<{ listing_id: string | null }> | null;
      error: { message?: string | null } | null;
    }>);

    if (error) {
      throw new Error(error.message || "Unable to load verified listings.");
    }

    const page = data || [];
    ids.push(
      ...page
        .map((item) => item.listing_id)
        .filter((id): id is string => Boolean(id))
    );

    if (page.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return ids;
}

function mapById<T extends { id?: string | null }>(rows: T[] | null | undefined) {
  return new Map(
    (rows || [])
      .filter((row): row is T & { id: string } => Boolean(row.id))
      .map((row) => [row.id, row])
  );
}

function firstApprovedLegacyByUser(
  rows: LegacyVerificationRow[] | null | undefined
) {
  const approved = new Map<string, LegacyVerificationRow>();

  for (const row of rows || []) {
    if (!row.user_id || approved.has(row.user_id)) continue;

    if (
      ["property_relationship", "property", "host", "landlord"].includes(
        String(row.verification_type || "").toLowerCase()
      ) &&
      ["approved", "verified"].includes(String(row.status || "").toLowerCase())
    ) {
      approved.set(row.user_id, row);
    }
  }

  return approved;
}

async function getLegacyEligibleListingIds() {
  const admin = createAdminClient();
  const ids: string[] = [];
  let from = 0;

  while (true) {
    const { data: listings, error: listingError } = await admin
      .from("listings")
      .select("id, user_id, status, created_at")
      .eq("status", PUBLIC_LISTING_STATUS)
      .lt("created_at", LEGACY_PROPERTY_VERIFICATION_CUTOFF)
      .range(from, from + PAGE_SIZE - 1);

    if (listingError) {
      throw new Error(
        listingError.message || "Unable to load legacy public listings."
      );
    }

    const candidateListings = (listings || []) as ListingVisibilityRow[];
    if (candidateListings.length === 0) break;

    const listingIds = candidateListings.map((listing) => listing.id);
    const ownerIds = Array.from(
      new Set(candidateListings.map((listing) => listing.user_id).filter(Boolean))
    ) as string[];

    const [verificationResult, profileResult, legacyResult] = await Promise.all([
      admin
        .from("listing_verifications")
        .select("id, listing_id, owner_id, status")
        .in("listing_id", listingIds.length ? listingIds : [ZERO_UUID]),
      admin
        .from("profiles")
        .select("id, role, is_admin, account_status")
        .in("id", ownerIds.length ? ownerIds : [ZERO_UUID]),
      admin
        .from("verification_submissions")
        .select("id, user_id, verification_type, status")
        .in("user_id", ownerIds.length ? ownerIds : [ZERO_UUID]),
    ]);

    if (verificationResult.error) {
      throw new Error(
        verificationResult.error.message ||
          "Unable to load listing verification records."
      );
    }

    if (profileResult.error) {
      throw new Error(
        profileResult.error.message || "Unable to load owner profiles."
      );
    }

    if (legacyResult.error) {
      throw new Error(
        legacyResult.error.message ||
          "Unable to load legacy property verification records."
      );
    }

    const listingVerificationByListingId = new Map(
      ((verificationResult.data || []) as ListingVerificationRow[])
        .filter((verification) => Boolean(verification.listing_id))
        .map((verification) => [verification.listing_id as string, verification])
    );
    const profileById = mapById((profileResult.data || []) as OwnerProfileRow[]);
    const legacyByUserId = firstApprovedLegacyByUser(
      (legacyResult.data || []) as LegacyVerificationRow[]
    );

    ids.push(
      ...candidateListings
        .filter((listing) =>
          listingQualifiesForLegacyPropertyVerification({
            listing,
            ownerProfile: listing.user_id ? profileById.get(listing.user_id) : null,
            legacyVerification: listing.user_id
              ? legacyByUserId.get(listing.user_id)
              : null,
            listingVerification: listingVerificationByListingId.get(listing.id),
          })
        )
        .map((listing) => listing.id)
    );

    if (candidateListings.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return ids;
}

export async function getVerifiedPublicListingIds(supabase: SupabaseLike) {
  const listingSpecificIds = await getListingSpecificVerifiedListingIds(supabase);
  const legacyIds = await getLegacyEligibleListingIds();

  return Array.from(new Set([...listingSpecificIds, ...legacyIds]));
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
    .select("id, user_id, status, created_at")
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
    };
  }

  const [
    { data: listingVerification, error: verificationError },
    { data: ownerProfile, error: profileError },
    { data: legacyRows, error: legacyError },
  ] = await Promise.all([
    admin
      .from("listing_verifications")
      .select("id, listing_id, owner_id, status")
      .eq("listing_id", listingId)
      .maybeSingle(),
    admin
      .from("profiles")
      .select("id, role, is_admin, account_status")
      .eq("id", listing.user_id)
      .maybeSingle(),
    admin
      .from("verification_submissions")
      .select("id, user_id, verification_type, status")
      .eq("user_id", listing.user_id),
  ]);

  if (verificationError) {
    throw new Error(
      verificationError.message || "Unable to load listing verification."
    );
  }

  if (profileError) {
    throw new Error(profileError.message || "Unable to load owner profile.");
  }

  if (legacyError) {
    throw new Error(
      legacyError.message || "Unable to load legacy verification records."
    );
  }

  const legacyByUserId = firstApprovedLegacyByUser(
    (legacyRows || []) as LegacyVerificationRow[]
  );
  const legacyPropertyVerified = listingQualifiesForLegacyPropertyVerification({
    listing,
    ownerProfile,
    legacyVerification: legacyByUserId.get(listing.user_id),
    listingVerification,
  });
  const verificationStatus = listingVerification?.status || null;
  const publiclyEligible = isPubliclyDiscoverableListing({
    listingStatus: listing.status,
    verificationStatus,
    legacyPropertyVerified,
  });

  return {
    listingExists: true,
    publiclyEligible,
    listingSpecificVerified:
      verificationStatus === PUBLIC_LISTING_VERIFICATION_STATUS,
    legacyPropertyVerified,
    verificationStatus,
  };
}
