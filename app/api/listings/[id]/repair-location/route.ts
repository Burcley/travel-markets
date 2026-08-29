import { NextRequest, NextResponse } from "next/server";
import {
  buildListingFullAddress,
  geocodeListingAddressWithMapbox,
} from "@/lib/listing-address-geocode";
import { campusOptions } from "@/lib/listing-transparency";
import { generatePublicCoordinate, distanceMeters } from "@/lib/location-privacy";
import { canManageListings } from "@/lib/role-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type ListingRow = {
  id: string;
  user_id: string;
  title: string | null;
  address: string | null;
  address_line: string | null;
  unit?: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  country: string | null;
  campus: string | null;
  campus_id?: string | null;
  nearest_campus_name: string | null;
  nearest_campus_address: string | null;
  campus_destination_label?: string | null;
  campus_coordinate_source?: string | null;
  latitude: number | null;
  longitude: number | null;
  public_latitude: number | null;
  public_longitude: number | null;
  campus_latitude: number | null;
  campus_longitude: number | null;
};

type CampusOption = (typeof campusOptions)[number];

function isValidCoordinate(latitude: unknown, longitude: unknown) {
  return (
    typeof latitude === "number" &&
    typeof longitude === "number" &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

function safeDistanceMeters(
  fromLatitude: number | null,
  fromLongitude: number | null,
  toLatitude: number | null,
  toLongitude: number | null
) {
  const hasCoordinates =
    typeof fromLatitude === "number" &&
    typeof fromLongitude === "number" &&
    typeof toLatitude === "number" &&
    typeof toLongitude === "number";

  if (
    !hasCoordinates ||
    !isValidCoordinate(fromLatitude, fromLongitude) ||
    !isValidCoordinate(toLatitude, toLongitude)
  ) {
    return null;
  }

  return Math.round(
    distanceMeters([fromLongitude, fromLatitude], [toLongitude, toLatitude])
  );
}

function campusForListing(listing: ListingRow) {
  const normalizedNearest = listing.nearest_campus_name?.trim().toLowerCase();
  const normalizedCampus = listing.campus?.trim().toLowerCase();
  const normalizedCampusId = listing.campus_id?.trim().toLowerCase();

  return (
    campusOptions.find((campus) => campus.id.toLowerCase() === normalizedCampusId) ||
    campusOptions.find((campus) => campus.name.toLowerCase() === normalizedCampus) ||
    campusOptions.find(
      (campus) => campus.officialName.toLowerCase() === normalizedCampus
    ) ||
    campusOptions.find(
      (campus) =>
        normalizedCampus?.includes("durham") &&
        campus.name.toLowerCase().includes("durham")
    ) ||
    campusOptions.find((campus) => campus.name.toLowerCase() === normalizedNearest) ||
    campusOptions.find(
      (campus) => campus.officialName.toLowerCase() === normalizedNearest
    ) ||
    null
  );
}

async function getActor() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { user: null, isAdmin: false };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_admin")
    .eq("id", user.id)
    .maybeSingle();

  return {
    user,
    isAdmin: Boolean(profile?.is_admin || profile?.role === "admin"),
    canManageListings: canManageListings(profile),
  };
}

async function loadAuthorizedListing(listingId: string) {
  const { user, isAdmin, canManageListings } = await getActor();

  if (!user) {
    return {
      response: NextResponse.json({ error: "Authentication required." }, { status: 401 }),
      listing: null,
      isAdmin,
    };
  }

  const admin = createAdminClient();
  const { data: listing, error } = await admin
    .from("listings")
    .select(
      "id, user_id, title, address, address_line, unit, city, province, postal_code, country, campus, campus_id, nearest_campus_name, nearest_campus_address, campus_destination_label, campus_coordinate_source, latitude, longitude, public_latitude, public_longitude, campus_latitude, campus_longitude"
    )
    .eq("id", listingId)
    .maybeSingle();

  if (error) {
    console.error("LOCATION REPAIR LISTING LOAD ERROR:", error);
    return {
      response: NextResponse.json(
        { error: "We could not load this listing location." },
        { status: 500 }
      ),
      listing: null,
      isAdmin,
    };
  }

  if (!listing) {
    return {
      response: NextResponse.json({ error: "Listing not found." }, { status: 404 }),
      listing: null,
      isAdmin,
    };
  }

  if (!canManageListings || (!isAdmin && listing.user_id !== user.id)) {
    return {
      response: NextResponse.json({ error: "Not authorized." }, { status: 403 }),
      listing: null,
      isAdmin,
    };
  }

  return { response: null, listing: listing as ListingRow, isAdmin };
}

async function geocodeListingAddress(listing: ListingRow) {
  const token = process.env.MAPBOX_ACCESS_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const result = await geocodeListingAddressWithMapbox({
    token,
    address: {
      address: listing.address,
      addressLine: listing.address_line,
      unit: listing.unit,
      city: listing.city,
      province: listing.province,
      postalCode: listing.postal_code,
      country: listing.country || "Canada",
    },
    previousLatitude: listing.latitude,
    previousLongitude: listing.longitude,
  });

  if (!result.ok) {
    return {
      error: result.code,
      status: result.status,
      featureCount: result.featureCount,
      fullAddress: result.fullAddress,
      label: result.label,
    };
  }

  return result;
}

function providerByMode(
  routeRows: Array<{ travel_mode: string | null; provider: string | null }>
) {
  return routeRows.reduce<Record<string, string>>((providers, row) => {
    if (row.travel_mode) {
      providers[row.travel_mode] = row.provider || "unknown";
    }

    return providers;
  }, {});
}

function campusDiagnostic(campus: CampusOption | null, listing: ListingRow) {
  return {
    campusId: campus?.id || listing.campus_id || null,
    officialCampusName:
      (campus ? campus.officialName : listing.nearest_campus_name) || null,
    campusCoordinateSource: campus ? "curated_campus_record" : "listing_saved",
    destinationEntranceLabel:
      campus?.entranceLabel || listing.campus_destination_label || null,
  };
}

function diagnosticPayload({
  listing,
  geocode,
  routeRows,
}: {
  listing: ListingRow;
  geocode?: Awaited<ReturnType<typeof geocodeListingAddress>>;
  routeRows: Array<{ travel_mode: string | null; provider: string | null }>;
}) {
  const campus = campusForListing(listing);
  const campusDetails = campusDiagnostic(campus, listing);

  return {
    listingId: listing.id,
    title: listing.title,
    fullPrivateAddressExists: Boolean(
      buildListingFullAddress({
        address: listing.address,
        addressLine: listing.address_line,
        unit: listing.unit,
        city: listing.city,
        province: listing.province,
        postalCode: listing.postal_code,
        country: listing.country || "Canada",
      })
    ),
    canonicalCoordinateFields: "listings.latitude/listings.longitude",
    privateCoordinatesPresent: isValidCoordinate(listing.latitude, listing.longitude),
    publicCoordinatesPresent: isValidCoordinate(
      listing.public_latitude,
      listing.public_longitude
    ),
    privateCoordinateSource: "listings.latitude/longitude",
    publicCoordinateSource: "listings.public_latitude/public_longitude",
    routeOriginType: isValidCoordinate(listing.latitude, listing.longitude)
      ? "private_exact"
      : "fallback",
    campusId: campusDetails.campusId,
    officialCampusName: campusDetails.officialCampusName,
    campusCoordinateSource: campusDetails.campusCoordinateSource,
    campusDestinationLabel: campusDetails.destinationEntranceLabel,
    cacheRecordsFound: routeRows.length,
    currentProviderByMode: providerByMode(routeRows),
    geocodedAddressDifferenceMeters:
      geocode && "latitude" in geocode
        ? safeDistanceMeters(
            listing.latitude,
            listing.longitude,
            geocode.latitude,
            geocode.longitude
          )
        : null,
  };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { response, listing } = await loadAuthorizedListing(id);

  if (response) return response;
  if (!listing) {
    return NextResponse.json({ error: "Listing not found." }, { status: 404 });
  }

  const admin = createAdminClient();
  const { data: routeRows } = await admin
    .from("listing_campus_routes")
    .select("travel_mode, provider")
    .eq("listing_id", id);
  const geocode = await geocodeListingAddress(listing);

  return NextResponse.json(
    diagnosticPayload({
      listing,
      geocode,
      routeRows: routeRows || [],
    })
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { response, listing } = await loadAuthorizedListing(id);

  if (response) return response;
  if (!listing) {
    return NextResponse.json({ error: "Listing not found." }, { status: 404 });
  }

  const geocode = await geocodeListingAddress(listing);

  if (!("latitude" in geocode)) {
    return NextResponse.json(
      {
        error:
          "We could not recalculate this listing location. Check the private address and try again.",
        code: geocode.error,
      },
      { status: 422 }
    );
  }

  const admin = createAdminClient();
  const campus = campusForListing(listing);
  const publicCoordinate = generatePublicCoordinate({
    latitude: geocode.latitude,
    longitude: geocode.longitude,
    seed: id,
  });
  const oldDistanceMeters = safeDistanceMeters(
    listing.latitude,
    listing.longitude,
    geocode.latitude,
    geocode.longitude
  );
  const publicDistanceMeters = safeDistanceMeters(
    geocode.latitude,
    geocode.longitude,
    publicCoordinate.latitude,
    publicCoordinate.longitude
  );

  const updatePayload: Record<string, unknown> = {
    latitude: geocode.latitude,
    longitude: geocode.longitude,
    public_latitude: publicCoordinate.latitude,
    public_longitude: publicCoordinate.longitude,
    location_privacy_radius_meters: publicCoordinate.radiusMeters,
    public_location_generated_at: new Date().toISOString(),
  };

  if (campus) {
    updatePayload.campus_id = campus.id;
    updatePayload.nearest_campus_name = campus.officialName;
    updatePayload.nearest_campus_address = campus.address;
    updatePayload.campus_destination_label = campus.entranceLabel;
    updatePayload.campus_coordinate_source = "curated_campus_record";
    updatePayload.campus_latitude = campus.latitude;
    updatePayload.campus_longitude = campus.longitude;
  }

  updatePayload.distance_to_campus_km = null;
  updatePayload.walking_time_minutes = null;
  updatePayload.cycling_time_minutes = null;
  updatePayload.driving_time_minutes = null;
  updatePayload.transit_time_minutes = null;
  updatePayload.distance_last_calculated_at = null;

  const { error: updateError } = await admin
    .from("listings")
    .update(updatePayload)
    .eq("id", id);

  if (updateError) {
    console.error("LOCATION REPAIR UPDATE ERROR:", updateError);
    return NextResponse.json(
      { error: "We could not save the repaired location." },
      { status: 500 }
    );
  }

  await admin.from("listing_campus_routes").delete().eq("listing_id", id);

  const modes = ["walking", "cycling", "driving", "transit"];
  const recalculatedModes = await Promise.allSettled(
    modes.map((mode) =>
      fetch(`${request.nextUrl.origin}/api/routes/campus?listingId=${id}&mode=${mode}`, {
        headers: {
          cookie: request.headers.get("cookie") || "",
        },
        cache: "no-store",
      })
    )
  );

  return NextResponse.json({
    ok: true,
    listingId: id,
    diagnostic: diagnosticPayload({
      listing: {
        ...listing,
        latitude: geocode.latitude,
        longitude: geocode.longitude,
        public_latitude: publicCoordinate.latitude,
        public_longitude: publicCoordinate.longitude,
        campus_id: campus?.id || listing.campus_id,
        nearest_campus_name: campus?.officialName || listing.nearest_campus_name,
        nearest_campus_address: campus?.address || listing.nearest_campus_address,
        campus_destination_label:
          campus?.entranceLabel || listing.campus_destination_label,
        campus_coordinate_source: campus
          ? "curated_campus_record"
          : listing.campus_coordinate_source,
        campus_latitude: campus?.latitude || listing.campus_latitude,
        campus_longitude: campus?.longitude || listing.campus_longitude,
      },
      geocode,
      routeRows: [],
    }),
    oldVsGeocodedDifferenceMeters: oldDistanceMeters,
    publicMarkerDistanceMeters: publicDistanceMeters,
    campusDestination: campus?.officialName || listing.nearest_campus_name,
    campusDestinationLabel: campus?.entranceLabel || null,
    routeCacheInvalidated: true,
    staleManualEstimatesCleared: true,
    recalculatedModes: await Promise.all(
      recalculatedModes.map(async (result, index) => {
        if (result.status !== "fulfilled") {
          return {
            mode: modes[index],
            ok: false,
            error: "REQUEST_FAILED",
          };
        }

        let body: Record<string, unknown> = {};

        try {
          body = await result.value.json();
        } catch {
          body = {};
        }

        return {
          mode: modes[index],
          ok: result.value.ok && body.routeUnavailable !== true,
          provider: body.provider || null,
          originType: body.originType || null,
          destinationSource: body.destinationSource || null,
          distanceMeters: body.distanceMeters || null,
          durationSeconds: body.durationSeconds || null,
          calculatedAt: body.calculatedAt || null,
          cacheStatus: body.cacheStatus || null,
          code: body.code || null,
        };
      })
    ),
  });
}
