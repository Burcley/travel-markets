import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const editListingUpdatePayloadKeys = [
  "title",
  "city",
  "location",
  "campus",
  "address",
  "address_line",
  "unit",
  "province",
  "postal_code",
  "country",
  "safety_instructions",
  "price",
  "bedrooms",
  "bathrooms",
  "guests",
  "roommates",
  "status",
  "description",
  "amenities",
  "verification_disclaimer_acknowledged",
  "fair_housing_acknowledged",
  "owner_occupies_property",
  "owner_family_occupies_property",
  "shared_kitchen_with_owner",
  "shared_bathroom_with_owner",
  "private_bedroom",
  "self_contained_unit",
  "other_occupants_present",
  "estimated_other_occupant_count",
  "occupancy_notes",
];

function getProjectRef() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!url) return null;

  try {
    return new URL(url).hostname.split(".")[0] || null;
  } catch {
    return null;
  }
}

function isAuthorized(request: NextRequest) {
  const expectedToken = process.env.CRON_SECRET;
  const providedToken =
    request.headers.get("x-debug-token") ||
    request.nextUrl.searchParams.get("token");

  return Boolean(expectedToken && providedToken === expectedToken);
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const admin = createAdminClient();

  const [listingsResult, profilesResult] = await Promise.all([
    admin.from("listings").select("*").limit(1),
    admin.from("profiles").select("*").limit(1),
  ]);

  if (listingsResult.error || profilesResult.error) {
    console.error("LISTINGS SCHEMA DIAGNOSTIC ERROR:", {
      listings: listingsResult.error,
      profiles: profilesResult.error,
    });

    return NextResponse.json(
      {
        error: "Could not inspect schema columns.",
        projectRef: getProjectRef(),
      },
      { status: 500 }
    );
  }

  const listingColumns = Object.keys(listingsResult.data?.[0] || {}).sort();
  const profileColumns = Object.keys(profilesResult.data?.[0] || {}).sort();

  return NextResponse.json({
    projectRef: getProjectRef(),
    listingsColumns: listingColumns,
    profilesColumns: profileColumns,
    editListingUpdatePayloadKeys,
    checks: {
      listingsStatus: listingColumns.includes("status"),
      profilesStatus: profileColumns.includes("status"),
      profilesAccountStatus: profileColumns.includes("account_status"),
    },
  });
}
