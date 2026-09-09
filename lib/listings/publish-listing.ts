import type { SupabaseClient } from "@supabase/supabase-js";
import { getFoundingListingEntitlement } from "@/lib/founding-landlords/server";
import { getLandlordAccountEligibility } from "@/lib/landlord-account-eligibility";
import { getEffectivePlanFromSubscription, getPlanEntitlements } from "@/lib/subscriptions/server";

type SupabaseAdminClient = SupabaseClient;

type ListingPublishRow = {
  id: string;
  user_id: string | null;
  title: string | null;
  description: string | null;
  price: number | null;
  status: string | null;
  address_line: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  campus: string | null;
  nearest_campus_name: string | null;
  campus_id: string | null;
  latitude: number | null;
  longitude: number | null;
  campus_latitude: number | null;
  campus_longitude: number | null;
  fair_housing_acknowledged: boolean | null;
};

export type ListingPublishReview = {
  id: string;
  title: string;
  ownerId: string;
  landlord: string;
  address: string;
  city: string;
  province: string;
  rent: number | null;
  rooms: number | null;
  imagesCount: number;
  nearestCampus: string;
  campusId: string | null;
  status: string;
  valid: boolean;
  missing: string[];
};

type PublishListingResult =
  | {
      ok: true;
      listingId: string;
      status: "published" | "skipped";
      reason?: string;
    }
  | {
      ok: false;
      listingId: string;
      status: "failed";
      reason: string;
      code?: string | null;
    };

const ACTIVE_LISTING_STATUSES = ["available", "pending"];

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function landlordName(
  profile: { full_name?: string | null; email?: string | null } | null,
  ownerId: string
) {
  return clean(profile?.full_name) || clean(profile?.email) || ownerId || "Unknown landlord";
}

function listingAddress(listing: ListingPublishRow) {
  return [
    clean(listing.address_line) || clean(listing.address),
    clean(listing.city),
    clean(listing.province),
    clean(listing.postal_code),
  ]
    .filter(Boolean)
    .join(", ");
}

export function getListingPublishMissingFields(listing: ListingPublishRow) {
  const missing: string[] = [];

  if (!clean(listing.title)) missing.push("Listing title");
  if (!(Number(listing.price) > 0)) missing.push("Monthly rent");
  if (!clean(listing.address_line) && !clean(listing.address)) {
    missing.push("Street address");
  }
  if (!clean(listing.city)) missing.push("City");
  if (!clean(listing.province)) missing.push("Province");
  if (!clean(listing.nearest_campus_name) && !clean(listing.campus)) {
    missing.push("Nearest campus");
  }
  if (!listing.campus_id) missing.push("Campus ID");
  if (listing.latitude == null || listing.longitude == null) {
    missing.push("Property coordinates");
  }
  if (listing.campus_latitude == null || listing.campus_longitude == null) {
    missing.push("Campus coordinates");
  }
  if (!clean(listing.description)) missing.push("Description");
  if (listing.fair_housing_acknowledged !== true) {
    missing.push("Fair-housing acknowledgement");
  }

  return missing;
}

async function countActiveOwnerListingsWithAdmin({
  admin,
  userId,
  excludeListingId,
}: {
  admin: SupabaseAdminClient;
  userId: string;
  excludeListingId?: string | null;
}) {
  let query = admin
    .from("listings")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .in("status", ACTIVE_LISTING_STATUSES);

  if (excludeListingId) {
    query = query.neq("id", excludeListingId);
  }

  const { count, error } = await query;
  if (error) {
    throw new Error(error.message || "Unable to count active listings.");
  }

  return count || 0;
}

async function canOwnerActivateListingWithAdmin({
  admin,
  userId,
  excludeListingId,
}: {
  admin: SupabaseAdminClient;
  userId: string;
  excludeListingId?: string | null;
}) {
  const { data: subscription, error } = await admin
    .from("owner_subscriptions")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Unable to load owner subscription.");
  }

  const plan = getEffectivePlanFromSubscription(subscription || null);
  const entitlements = getPlanEntitlements(plan);
  const currentCount = await countActiveOwnerListingsWithAdmin({
    admin,
    userId,
    excludeListingId,
  });
  const foundingEntitlement = await getFoundingListingEntitlement(userId);

  if (foundingEntitlement.hasUnlimitedListings) {
    return {
      allowed: true,
      reason: null as string | null,
      currentCount,
      limit: null as number | null,
    };
  }

  const limit = entitlements.activeListingLimit;
  const allowed = limit === null || currentCount < limit;

  return {
    allowed,
    reason: allowed
      ? null
      : `The owner's ${entitlements.displayName} plan allows ${
          limit ?? "unlimited"
        } active listing${limit === 1 ? "" : "s"}.`,
    currentCount,
    limit,
  };
}

export async function getListingPublishReview({
  admin,
  listingId,
  ownerId,
}: {
  admin: SupabaseAdminClient;
  listingId: string;
  ownerId?: string | null;
}): Promise<ListingPublishReview | null> {
  const { data: listing, error } = await admin
    .from("listings")
    .select(
      [
        "id",
        "user_id",
        "title",
        "description",
        "price",
        "status",
        "address",
        "address_line",
        "city",
        "province",
        "postal_code",
        "campus",
        "nearest_campus_name",
        "campus_id",
        "latitude",
        "longitude",
        "campus_latitude",
        "campus_longitude",
        "fair_housing_acknowledged",
        "bedrooms",
        "roommates",
        "guests",
      ].join(", ")
    )
    .eq("id", listingId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Unable to load listing.");
  }

  const typedListing = listing as unknown as ListingPublishRow & {
    bedrooms?: number | null;
    roommates?: number | null;
    guests?: number | null;
  };

  if (!typedListing || (ownerId && typedListing.user_id !== ownerId)) {
    return null;
  }

  const [{ data: ownerProfile }, { count, error: imageCountError }] =
    await Promise.all([
      admin
        .from("profiles")
        .select("full_name, email")
        .eq("id", typedListing.user_id)
        .maybeSingle(),
      admin
        .from("listing_images")
        .select("id", { count: "exact", head: true })
        .eq("listing_id", listingId),
    ]);

  if (imageCountError) {
    throw new Error(imageCountError.message || "Unable to count listing images.");
  }

  const missing = getListingPublishMissingFields(typedListing);

  return {
    id: typedListing.id,
    title: clean(typedListing.title) || "Untitled listing",
    ownerId: typedListing.user_id || "",
    landlord: landlordName(ownerProfile || null, typedListing.user_id || ""),
    address: listingAddress(typedListing),
    city: clean(typedListing.city),
    province: clean(typedListing.province),
    rent: typedListing.price ?? null,
    rooms:
      typedListing.bedrooms ??
      typedListing.roommates ??
      typedListing.guests ??
      null,
    imagesCount: count || 0,
    nearestCampus:
      clean(typedListing.nearest_campus_name) ||
      clean(typedListing.campus) ||
      "Campus not selected",
    campusId: typedListing.campus_id || null,
    status: typedListing.status || "draft",
    valid: missing.length === 0,
    missing,
  };
}

export async function publishListingForOwner({
  admin,
  updateClient,
  listingId,
  ownerId,
  adminActorId,
}: {
  admin: SupabaseAdminClient;
  updateClient?: Pick<SupabaseAdminClient, "from">;
  listingId: string;
  ownerId?: string | null;
  adminActorId?: string | null;
}): Promise<PublishListingResult> {
  const review = await getListingPublishReview({ admin, listingId, ownerId });

  if (!review) {
    return {
      ok: false,
      listingId,
      status: "failed",
      reason: "Listing not found for the selected landlord.",
      code: "LISTING_NOT_FOUND",
    };
  }

  if (review.status === "available") {
    return {
      ok: true,
      listingId,
      status: "skipped",
      reason: "Listing is already published.",
    };
  }

  const publishableStatuses = adminActorId ? ["draft"] : ["draft", "rented"];

  if (!publishableStatuses.includes(review.status)) {
    return {
      ok: false,
      listingId,
      status: "failed",
      reason: adminActorId
        ? `Listing status is ${review.status}; only draft listings can be bulk published.`
        : `Listing status is ${review.status}; this listing cannot be published.`,
      code: "UNSUPPORTED_LISTING_STATUS",
    };
  }

  if (!review.valid) {
    return {
      ok: false,
      listingId,
      status: "failed",
      reason: `Missing required fields: ${review.missing.join(", ")}.`,
      code: "LISTING_INCOMPLETE",
    };
  }

  const [{ data: profile, error: profileError }, { data: submissions, error }] =
    await Promise.all([
      admin
        .from("profiles")
        .select(
          "id, role, is_admin, account_status, identity_verified, is_verified, identity_verification_status"
        )
        .eq("id", review.ownerId)
        .maybeSingle(),
      admin
        .from("verification_submissions")
        .select("verification_type, status")
        .eq("user_id", review.ownerId),
    ]);

  if (profileError || error) {
    return {
      ok: false,
      listingId,
      status: "failed",
      reason:
        profileError?.message ||
        error?.message ||
        "Unable to verify the landlord account.",
      code: "ACCOUNT_VERIFICATION_LOOKUP_FAILED",
    };
  }

  const eligibility = getLandlordAccountEligibility({
    profile: profile || null,
    submissions: submissions || [],
  });

  if (!eligibility.canPublishListings) {
    return {
      ok: false,
      listingId,
      status: "failed",
      reason: "Complete landlord verification to publish listings.",
      code: eligibility.reason,
    };
  }

  try {
    const planCheck = await canOwnerActivateListingWithAdmin({
      admin,
      userId: review.ownerId,
      excludeListingId: listingId,
    });

    if (!planCheck.allowed) {
      return {
        ok: false,
        listingId,
        status: "failed",
        reason: planCheck.reason || "The owner has reached their active listing limit.",
        code: "ACTIVE_LISTING_LIMIT_REACHED",
      };
    }
  } catch (error) {
    return {
      ok: false,
      listingId,
      status: "failed",
      reason:
        error instanceof Error
          ? error.message
          : "Unable to verify active listing limits.",
      code: "LISTING_LIMIT_LOOKUP_FAILED",
    };
  }

  if (adminActorId) {
    const { error: rpcError } = await admin.rpc("admin_publish_listing_as_owner", {
      p_admin_id: adminActorId,
      p_listing_id: listingId,
    });

    if (rpcError) {
      return {
        ok: false,
        listingId,
        status: "failed",
        reason: rpcError.message || "Listing could not be published.",
        code: rpcError.code || "PUBLISH_FAILED",
      };
    }

    return {
      ok: true,
      listingId,
      status: "published",
    };
  }

  const { error: updateError } = await (updateClient || admin)
    .from("listings")
    .update({ status: "available" })
    .eq("id", listingId)
    .eq("user_id", review.ownerId);

  if (updateError) {
    return {
      ok: false,
      listingId,
      status: "failed",
      reason: updateError.message || "Listing could not be published.",
      code: updateError.code || "PUBLISH_FAILED",
    };
  }

  return {
    ok: true,
    listingId,
    status: "published",
  };
}
