import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { getSafePublicCoordinate } from "@/lib/location-privacy";
import {
  getVerifiedPublicListingIds,
  PUBLIC_LISTING_STATUS,
} from "@/lib/listings/public-visibility";
import {
  getOwnerBadgeLabel,
  getPlanEntitlements,
  normalizeOwnerPlan,
  subscriptionStatusHasPaidAccess,
} from "@/lib/subscriptions/plans";
import type { ListingSearchParams } from "./search-types";

const PAGE_SIZE = 12;

const TRUST_TIER: Record<string, number> = {
  new: 1,
  basic: 2,
  trusted: 3,
  elite: 4,
};

type ListingImageRow = {
  image_url?: string | null;
  is_cover?: boolean | null;
  sort_order?: number | null;
};

type SearchListingRow = {
  id: string;
  user_id?: string | null;
  title?: string | null;
  city?: string | null;
  location?: string | null;
  campus?: string | null;
  price?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  guests?: number | null;
  status?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  public_latitude?: number | null;
  public_longitude?: number | null;
  created_at?: string | null;
  is_featured?: boolean | null;
  featured_until?: string | null;
  featured_rank?: number | null;
  boost_until?: string | null;
  boost_rank?: number | null;
  listing_images?: ListingImageRow[] | null;
};

type OwnerSubscriptionSummary = {
  user_id?: string | null;
  plan?: string | null;
  status?: string | null;
};

type OwnerProfileSummary = {
  id?: string | null;
  is_verified?: boolean | null;
  identity_verified?: boolean | null;
  trust_score?: number | null;
  trust_level?: string | null;
  is_founding_landlord?: boolean | null;
  founding_landlord_number?: number | null;
  founding_status?: string | null;
};

type EnrichedSearchListing = SearchListingRow & {
  owner_plan?: string | null;
  owner_is_verified?: boolean | null;
  owner_trust_score?: number | null;
  owner_trust_level?: string | null;
  owner_founding_landlord_number?: number | null;
  is_verified?: boolean | null;
  identity_verified?: boolean | null;
  trust_score?: number | null;
  trust_level?: string | null;
};

type ExtendedListingSearchParams = ListingSearchParams & {
  verified?: string | null;
  trust?: string | null;
};

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

function clean(value?: string | null) {
  if (!value || value === "all") return undefined;
  return value.trim();
}

function toNumber(value?: string | null) {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function getApproxCoordinates(city?: string | null, campus?: string | null) {
  const text = `${city || ""} ${campus || ""}`.toLowerCase();

  if (text.includes("whitby")) return { latitude: 43.8971, longitude: -78.9429 };
  if (text.includes("oshawa")) return { latitude: 43.8975, longitude: -78.8658 };
  if (text.includes("durham")) return { latitude: 43.9452, longitude: -78.896 };
  if (text.includes("toronto")) return { latitude: 43.6532, longitude: -79.3832 };

  return { latitude: 43.8975, longitude: -78.8658 };
}

function normalizeSort(sort?: string) {
  if (sort === "price-low") return "price-low";
  if (sort === "price-high") return "price-high";
  if (sort === "trust-high") return "trust-high";
  return "newest";
}

function escapeSearchValue(value: string) {
  return value.replaceAll("%", "").replaceAll(",", " ").trim();
}

function isFeaturedActive(featuredUntil?: string | null) {
  if (!featuredUntil) return true;
  return new Date(featuredUntil).getTime() > Date.now();
}

function isBoostActive(boostUntil?: string | null) {
  if (!boostUntil) return false;
  return new Date(boostUntil).getTime() > Date.now();
}

function isMissingPublicCoordinateColumn(error: unknown) {
  const typedError = error as { code?: string | null; message?: string | null };
  const message = typedError?.message || "";

  return (
    (typedError?.code === "42703" || typedError?.code === "PGRST204") &&
    (message.includes("public_latitude") ||
      message.includes("public_longitude"))
  );
}

function getOwnerPlan(subscription?: {
  plan?: string | null;
  status?: string | null;
}) {
  if (!subscriptionStatusHasPaidAccess(subscription?.status)) return "free";

  return normalizeOwnerPlan(subscription?.plan);
}

function compareByMarketplacePriority(
  a: EnrichedSearchListing,
  b: EnrichedSearchListing
) {
  const aFeatured = Boolean(a.is_featured) && isFeaturedActive(a.featured_until);
  const bFeatured = Boolean(b.is_featured) && isFeaturedActive(b.featured_until);

  if (aFeatured !== bFeatured) return bFeatured ? 1 : -1;

  const aBoosted = isBoostActive(a.boost_until);
  const bBoosted = isBoostActive(b.boost_until);

  if (aBoosted !== bBoosted) return bBoosted ? 1 : -1;

  const aBoostRank = Number(a.boost_rank || 0);
  const bBoostRank = Number(b.boost_rank || 0);

  if (aBoostRank !== bBoostRank) return bBoostRank - aBoostRank;

  const aTrustTier = TRUST_TIER[a.trust_level || "new"] || 1;
  const bTrustTier = TRUST_TIER[b.trust_level || "new"] || 1;

  if (aTrustTier !== bTrustTier) return bTrustTier - aTrustTier;

  const aTrustScore = Number(a.trust_score || 0);
  const bTrustScore = Number(b.trust_score || 0);

  if (aTrustScore !== bTrustScore) return bTrustScore - aTrustScore;

  const aTier = getPlanEntitlements(a.owner_plan || "free").searchWeight;
  const bTier = getPlanEntitlements(b.owner_plan || "free").searchWeight;

  if (aTier !== bTier) return bTier - aTier;

  const aFeaturedRank = Number(a.featured_rank || 0);
  const bFeaturedRank = Number(b.featured_rank || 0);

  if (aFeaturedRank !== bFeaturedRank) return bFeaturedRank - aFeaturedRank;

  const aDate = a.created_at ? new Date(a.created_at).getTime() : 0;
  const bDate = b.created_at ? new Date(b.created_at).getTime() : 0;

  return bDate - aDate;
}

function compareByTrust(a: EnrichedSearchListing, b: EnrichedSearchListing) {
  const aTrustTier = TRUST_TIER[a.trust_level || "new"] || 1;
  const bTrustTier = TRUST_TIER[b.trust_level || "new"] || 1;

  if (aTrustTier !== bTrustTier) return bTrustTier - aTrustTier;

  const aTrustScore = Number(a.trust_score || 0);
  const bTrustScore = Number(b.trust_score || 0);

  if (aTrustScore !== bTrustScore) return bTrustScore - aTrustScore;

  const aDate = a.created_at ? new Date(a.created_at).getTime() : 0;
  const bDate = b.created_at ? new Date(b.created_at).getTime() : 0;

  return bDate - aDate;
}

export async function searchListings(params: ListingSearchParams) {
  const supabase = await createClient();
  let verifiedListingIds: string[] = [];

  try {
    verifiedListingIds = await getVerifiedPublicListingIds(supabase as never);
  } catch (error) {
    console.error("SEARCH VERIFIED LISTING GATE ERROR:", error);
    return {
      listings: [],
      count: 0,
      page: Math.max(toNumber(params.page) || 1, 1),
      pageSize: PAGE_SIZE,
      hasMore: false,
    };
  }

  const page = Math.max(toNumber(params.page) || 1, 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const q = clean(params.q);
  const city = clean(params.city);
  const campus = clean(params.campus);
  const status = clean(params.status);

  const minPrice = toNumber(params.minPrice);
  const maxPrice = toNumber(params.maxPrice);
  const bedrooms = toNumber(params.bedrooms);
  const bathrooms = toNumber(params.bathrooms);
  const guests = toNumber(params.guests);

  const extendedParams = params as ExtendedListingSearchParams;
  const verifiedOnly = clean(extendedParams.verified) === "true";
  const trustFilter = clean(extendedParams.trust);

  const sort = normalizeSort(clean(params.sort));

  if (verifiedListingIds.length === 0) {
    return {
      listings: [],
      count: 0,
      page,
      pageSize: PAGE_SIZE,
      hasMore: false,
    };
  }

  function createListingQuery(includePublicCoordinates: boolean) {
    let query = supabase
      .from("listings")
      .select(
        `
        id,
        user_id,
        title,
        city,
        location,
        campus,
        price,
        bedrooms,
        bathrooms,
        guests,
        status,
        ${includePublicCoordinates ? "public_latitude, public_longitude," : "latitude, longitude,"}
        created_at,
        is_featured,
        featured_until,
        featured_rank,
        boost_until,
        boost_rank,
        listing_images (
          image_url,
          is_cover,
          sort_order
        )
      `,
        { count: "exact" }
      )
      .eq("status", PUBLIC_LISTING_STATUS)
      .in("id", verifiedListingIds);

    if (q) {
      const safeQ = escapeSearchValue(q);
      query = query.or(
        `title.ilike.%${safeQ}%,city.ilike.%${safeQ}%,location.ilike.%${safeQ}%,campus.ilike.%${safeQ}%`
      );
    }

    if (city) {
      const safeCity = escapeSearchValue(city);
      query = query.or(`city.ilike.%${safeCity}%,location.ilike.%${safeCity}%`);
    }

    if (campus) {
      const safeCampus = escapeSearchValue(campus);
      query = query.ilike("campus", `%${safeCampus}%`);
    }

    if (status && status !== PUBLIC_LISTING_STATUS) {
      query = query.eq("status", "__not_public__");
    }
    if (minPrice !== undefined) query = query.gte("price", minPrice);
    if (maxPrice !== undefined) query = query.lte("price", maxPrice);
    if (bedrooms !== undefined) query = query.gte("bedrooms", bedrooms);
    if (bathrooms !== undefined) query = query.gte("bathrooms", bathrooms);
    if (guests !== undefined) query = query.gte("guests", guests);

    if (sort === "price-low") {
      query = query.order("price", { ascending: true, nullsFirst: false });
    } else if (sort === "price-high") {
      query = query.order("price", { ascending: false, nullsFirst: false });
    } else {
      query = query.order("created_at", { ascending: false });
    }

    return query;
  }

  let { data, error } = await createListingQuery(true);

  if (error && isMissingPublicCoordinateColumn(error)) {
    console.error(
      "SEARCH LISTINGS PUBLIC COORDINATE FALLBACK:",
      JSON.stringify({
        code: error.code,
        message: error.message,
      })
    );

    const legacyResult = await createListingQuery(false);
    data = legacyResult.data;
    error = legacyResult.error;
  }

  if (error) {
    console.error("SEARCH LISTINGS ERROR:", error);

    return {
      listings: [],
      count: 0,
      page,
      pageSize: PAGE_SIZE,
      hasMore: false,
    };
  }

  const rawListings = (data || []) as SearchListingRow[];

  const ownerIds = Array.from(
    new Set(rawListings.map((listing) => listing.user_id).filter(Boolean))
  ) as string[];

  let subscriptionMap = new Map<string, OwnerSubscriptionSummary>();

  let profileMap = new Map<string, OwnerProfileSummary>();

  if (ownerIds.length > 0) {
    const { data: subscriptions, error: subError } = await supabaseAdmin
      .from("owner_subscriptions")
      .select("user_id, plan, status")
      .in("user_id", ownerIds);

    if (subError) {
      console.error("ADMIN OWNER SUBSCRIPTIONS SEARCH ERROR:", subError);
    }

    subscriptionMap = new Map(
      ((subscriptions || []) as OwnerSubscriptionSummary[])
        .filter((sub) => Boolean(sub.user_id))
        .map((sub) => [sub.user_id as string, sub])
    );

    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from("profiles")
      .select(
        "id, is_verified, identity_verified, trust_score, trust_level, is_founding_landlord, founding_landlord_number, founding_status"
      )
      .in("id", ownerIds);

    if (profilesError) {
      console.error("ADMIN OWNER PROFILES SEARCH ERROR:", profilesError);
    }

    profileMap = new Map(
      ((profiles || []) as OwnerProfileSummary[])
        .filter((profile) => Boolean(profile.id))
        .map((profile) => [profile.id as string, profile])
    );
  }

  const enrichedListings: EnrichedSearchListing[] = rawListings.map((listing) => {
    const ownerSubscription = listing.user_id
      ? subscriptionMap.get(listing.user_id)
      : undefined;
    const ownerProfile = listing.user_id
      ? profileMap.get(listing.user_id)
      : undefined;
    const ownerPlan = getOwnerPlan(ownerSubscription);

    const ownerVerified = Boolean(
      ownerProfile?.is_verified || ownerProfile?.identity_verified
    );

    const ownerTrustScore = Number(ownerProfile?.trust_score || 0);
    const ownerTrustLevel = ownerProfile?.trust_level || "new";
    const ownerFoundingNumber =
      ownerProfile?.is_founding_landlord &&
      ownerProfile?.founding_status === "confirmed"
        ? ownerProfile.founding_landlord_number || null
        : null;

    return {
      ...listing,
      owner_plan: ownerPlan,
      is_verified: ownerVerified,
      identity_verified: ownerVerified,
      trust_score: ownerTrustScore,
      trust_level: ownerTrustLevel,
      owner_is_verified: ownerVerified,
      owner_trust_score: ownerTrustScore,
      owner_trust_level: ownerTrustLevel,
      owner_founding_landlord_number: ownerFoundingNumber,
    };
  });

  const filteredByTrust = enrichedListings.filter((listing) => {
    if (verifiedOnly && !listing.owner_is_verified) return false;
    if (trustFilter && listing.owner_trust_level !== trustFilter) return false;
    return true;
  });

  const rankedData =
    sort === "trust-high"
      ? [...filteredByTrust].sort(compareByTrust)
      : sort === "newest"
      ? [...filteredByTrust].sort(compareByMarketplacePriority)
      : filteredByTrust;

  const totalFilteredCount = rankedData.length;
  const paginatedData = rankedData.slice(from, to + 1);

  const listings = paginatedData.map((listing) => {
    const images = Array.isArray(listing.listing_images)
      ? listing.listing_images
      : [];

    const sortedImages = [...images].sort(
      (a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999)
    );

    const cover =
      images.find((img) => img.is_cover)?.image_url ||
      sortedImages[0]?.image_url ||
      null;

    const displayCity = listing.city || listing.location || "";
    const fallback = getApproxCoordinates(displayCity, listing.campus);
    const safeCoordinate = getSafePublicCoordinate({
      id: listing.id,
      latitude: listing.latitude,
      longitude: listing.longitude,
      publicLatitude: listing.public_latitude,
      publicLongitude: listing.public_longitude,
    });

    const activeFeatured =
      Boolean(listing.is_featured) && isFeaturedActive(listing.featured_until);

    const activeBoost = isBoostActive(listing.boost_until);

    const ownerPlan = listing.owner_plan || "free";
    const ownerVerified = Boolean(listing.owner_is_verified);
    const ownerTrustScore = Number(listing.owner_trust_score || 0);
    const ownerTrustLevel = listing.owner_trust_level || "new";
    const ownerFoundingNumber = listing.owner_founding_landlord_number || null;

    return {
      id: listing.id,
      title: listing.title || "Untitled listing",
      city: displayCity,
      campus: listing.campus,
      price: listing.price,
      status: listing.status || "available",
      created_at: listing.created_at,

      is_featured: activeFeatured,
      featured_until: listing.featured_until ?? null,
      featured_rank: listing.featured_rank ?? 0,

      is_boosted: activeBoost,
      boost_until: listing.boost_until ?? null,
      boost_rank: listing.boost_rank ?? 0,

      owner_plan: ownerPlan,
      owner_badge: getOwnerBadgeLabel(ownerPlan),

      is_verified: ownerVerified,
      identity_verified: ownerVerified,
      owner_is_verified: ownerVerified,
      trust_score: ownerTrustScore,
      trust_level: ownerTrustLevel,
      owner_trust_score: ownerTrustScore,
      owner_trust_level: ownerTrustLevel,
      owner_founding_landlord_number: ownerFoundingNumber,

      image_url: cover,
      cover_image_url: cover,

      latitude: safeCoordinate.latitude ?? fallback.latitude,
      longitude: safeCoordinate.longitude ?? fallback.longitude,

      bedrooms: listing.bedrooms ?? null,
      bathrooms: listing.bathrooms ?? null,
      guests: listing.guests ?? null,

      is_saved: false,
    };
  });

  return {
    listings,
    count: totalFilteredCount,
    page,
    pageSize: PAGE_SIZE,
    hasMore: to + 1 < totalFilteredCount,
  };
}
