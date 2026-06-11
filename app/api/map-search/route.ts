import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const PLAN_RANK: Record<string, number> = {
  free: 0,
  pro: 10,
  premium: 30,
};

function getApproxCoordinates(city?: string | null, campus?: string | null) {
  const text = `${city || ""} ${campus || ""}`.toLowerCase();

  if (text.includes("whitby")) {
    return { latitude: 43.8971, longitude: -78.9429 };
  }

  if (text.includes("oshawa")) {
    return { latitude: 43.8975, longitude: -78.8658 };
  }

  if (text.includes("durham")) {
    return { latitude: 43.9452, longitude: -78.896 };
  }

  if (text.includes("toronto")) {
    return { latitude: 43.6532, longitude: -79.3832 };
  }

  return { latitude: 43.8975, longitude: -78.8658 };
}

function clean(value?: string | null) {
  if (!value || value === "all") return undefined;
  return value.trim();
}

function escapeSearchValue(value: string) {
  return value.replaceAll("%", "").replaceAll(",", " ").trim();
}

function isFeaturedActive(featuredUntil?: string | null) {
  if (!featuredUntil) return true;
  return new Date(featuredUntil).getTime() > Date.now();
}

function getOwnerPlan(subscription?: { plan?: string | null; status?: string | null }) {
  const active =
    subscription?.status === "active" || subscription?.status === "trialing";

  if (!active) return "free";
  if (subscription?.plan === "premium") return "premium";
  if (subscription?.plan === "pro") return "pro";

  return "free";
}

function getListingRankScore(listing: any) {
  const activeFeatured =
    Boolean(listing.is_featured) && isFeaturedActive(listing.featured_until);

  const ownerPlan = listing.owner_plan || "free";
  const planScore = PLAN_RANK[ownerPlan] || 0;

  const featuredScore = activeFeatured
    ? 1000 + Number(listing.featured_rank || 0)
    : 0;

  const dateScore = listing.created_at
    ? new Date(listing.created_at).getTime() / 100000000000
    : 0;

  return featuredScore + planScore + dateScore;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const searchParams = request.nextUrl.searchParams;

    const north = Number(searchParams.get("north"));
    const south = Number(searchParams.get("south"));
    const east = Number(searchParams.get("east"));
    const west = Number(searchParams.get("west"));

    const q = clean(searchParams.get("q"));
    const city = clean(searchParams.get("city"));
    const campus = clean(searchParams.get("campus"));

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
        latitude,
        longitude,
        created_at,
        is_featured,
        featured_until,
        featured_rank,
        listing_images (
          image_url,
          is_cover,
          sort_order
        )
      `
      )
      .neq("status", "rented")
      .limit(80);

    if (!Number.isNaN(north)) {
      query = query.lte("latitude", north);
    }

    if (!Number.isNaN(south)) {
      query = query.gte("latitude", south);
    }

    if (!Number.isNaN(east)) {
      query = query.lte("longitude", east);
    }

    if (!Number.isNaN(west)) {
      query = query.gte("longitude", west);
    }

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

    query = query.order("created_at", {
      ascending: false,
    });

    const { data, error } = await query;

    if (error) {
      console.error("MAP SEARCH ERROR:", error);

      return NextResponse.json(
        {
          listings: [],
        },
        {
          status: 500,
        }
      );
    }

    const rawListings = data || [];

    const ownerIds = Array.from(
      new Set(rawListings.map((listing: any) => listing.user_id).filter(Boolean))
    );

    let subscriptionMap = new Map<
      string,
      { plan?: string | null; status?: string | null }
    >();

    if (ownerIds.length > 0) {
      const { data: subscriptions, error: subError } = await supabase
        .from("owner_subscriptions")
        .select("user_id, plan, status")
        .in("user_id", ownerIds);

      if (subError) {
        console.error("MAP OWNER SUBSCRIPTIONS ERROR:", subError);
      }

      subscriptionMap = new Map(
        (subscriptions || []).map((sub: any) => [sub.user_id, sub])
      );
    }

    const enrichedListings = rawListings.map((listing: any) => {
      const ownerSubscription = subscriptionMap.get(listing.user_id);
      const ownerPlan = getOwnerPlan(ownerSubscription);

      return {
        ...listing,
        owner_plan: ownerPlan,
      };
    });

    const rankedListings = [...enrichedListings].sort(
      (a: any, b: any) => getListingRankScore(b) - getListingRankScore(a)
    );

    const listings = rankedListings.map((listing: any) => {
      const images = Array.isArray(listing.listing_images)
        ? listing.listing_images
        : [];

      const sortedImages = [...images].sort(
        (a: any, b: any) => (a.sort_order ?? 999) - (b.sort_order ?? 999)
      );

      const cover =
        images.find((img: any) => img.is_cover)?.image_url ||
        sortedImages[0]?.image_url ||
        null;

      const fallback = getApproxCoordinates(listing.city, listing.campus);

      const activeFeatured =
        Boolean(listing.is_featured) && isFeaturedActive(listing.featured_until);

      const ownerPlan = listing.owner_plan || "free";

      return {
        id: listing.id,
        title: listing.title,
        city: listing.city || listing.location,
        campus: listing.campus,
        price: listing.price,
        status: listing.status,
        bedrooms: listing.bedrooms,
        bathrooms: listing.bathrooms,
        guests: listing.guests,
        created_at: listing.created_at,

        is_featured: activeFeatured,
        featured_until: listing.featured_until ?? null,
        featured_rank: listing.featured_rank ?? 0,

        owner_plan: ownerPlan,
        owner_badge:
          ownerPlan === "premium"
            ? "Premium Owner"
            : ownerPlan === "pro"
            ? "Pro Owner"
            : null,

        image_url: cover,

        latitude: listing.latitude ?? fallback.latitude,
        longitude: listing.longitude ?? fallback.longitude,

        is_saved: false,
      };
    });

    return NextResponse.json({
      listings,
    });
  } catch (error) {
    console.error("MAP SEARCH ROUTE ERROR:", error);

    return NextResponse.json(
      {
        listings: [],
      },
      {
        status: 500,
      }
    );
  }
}