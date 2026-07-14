import { NextRequest, NextResponse } from "next/server";
import {
  distanceMeters,
  generatePublicCoordinate,
  sanitizeRouteGeometryForPublicOrigin,
  type Coordinate,
} from "@/lib/location-privacy";
import { createClient } from "@/lib/supabase/server";

type TravelMode = "transit" | "cycling" | "walking" | "driving";

type RouteGeometry = {
  type: "LineString";
  coordinates: [number, number][];
};

type RouteErrorCode =
  | "LISTING_NOT_FOUND"
  | "PROPERTY_COORDINATES_MISSING"
  | "CAMPUS_COORDINATES_MISSING"
  | "INVALID_COORDINATES"
  | "MAPBOX_TOKEN_MISSING"
  | "MAPBOX_DIRECTIONS_FAILED"
  | "GOOGLE_ROUTES_KEY_MISSING"
  | "GOOGLE_ROUTES_API_DISABLED"
  | "GOOGLE_ROUTES_BILLING_REQUIRED"
  | "GOOGLE_ROUTES_PERMISSION_DENIED"
  | "GOOGLE_ROUTES_INVALID_ARGUMENT"
  | "GOOGLE_TRANSIT_NO_ROUTE"
  | "GOOGLE_ROUTES_NO_ROUTE"
  | "GOOGLE_ROUTES_QUOTA_EXCEEDED"
  | "GOOGLE_ROUTES_INVALID_FIELD_MASK"
  | "GOOGLE_ROUTES_UNSUPPORTED_DEPARTURE_TIME"
  | "ROUTE_GEOMETRY_INVALID"
  | "UNSUPPORTED_TRAVEL_MODE"
  | "LISTING_QUERY_FAILED";

type RouteProvider =
  | "mapbox_directions"
  | "google_routes"
  | "stored_estimate"
  | "unavailable";

type RouteDetails = {
  provider?: RouteProvider;
  profile?: string;
  departureTime?: string | null;
  arrivalTime?: string | null;
  steps?: Array<{
    type: "walk" | "transit" | "other";
    instruction?: string | null;
    durationSeconds?: number | null;
    distanceMeters?: number | null;
    transitLine?: string | null;
    transitHeadsign?: string | null;
    stopCount?: number | null;
  }>;
  transfers?: number | null;
};

const travelModes = new Set<TravelMode>([
  "transit",
  "cycling",
  "walking",
  "driving",
]);

const routeListingSelect =
  "id, user_id, title, city, campus, latitude, longitude, public_latitude, public_longitude, location_privacy_radius_meters, nearest_campus_name, campus_id, campus_destination_label, campus_coordinate_source, campus_latitude, campus_longitude, distance_to_campus_km, walking_time_minutes, cycling_time_minutes, driving_time_minutes, transit_time_minutes";

const legacyRouteListingSelect =
  "id, user_id, title, city, campus, latitude, longitude, nearest_campus_name, campus_latitude, campus_longitude, distance_to_campus_km, walking_time_minutes, cycling_time_minutes, driving_time_minutes, transit_time_minutes";

const googleModeMap = {
  driving: "DRIVE",
  walking: "WALK",
  cycling: "BICYCLE",
  transit: "TRANSIT",
} as const satisfies Record<TravelMode, string>;

function isTravelMode(value: string | null): value is TravelMode {
  return Boolean(value && travelModes.has(value as TravelMode));
}

function safeNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function isValidLatitude(value: number | null) {
  return value != null && Number.isFinite(value) && value >= -90 && value <= 90;
}

function isValidLongitude(value: number | null) {
  return value != null && Number.isFinite(value) && value >= -180 && value <= 180;
}

function publicRouteError({
  code,
  message,
  status,
}: {
  code: RouteErrorCode;
  message: string;
  status: number;
}) {
  return NextResponse.json(
    {
      code,
      message,
      error: message,
    },
    { status }
  );
}

function logRouteFailure({
  listingId,
  selectedMode,
  error,
  status,
}: {
  listingId: string | null;
  selectedMode: string | null;
  error: unknown;
  status?: number;
}) {
  const typedError = error as {
    message?: string;
    details?: string | null;
    hint?: string | null;
    code?: string | null;
  };

  console.error(
    "Campus route calculation failed",
    JSON.stringify({
      listingId,
      selectedMode,
      message:
        typedError?.message ||
        (error instanceof Error ? error.message : "Unknown route error"),
      details: typedError?.details,
      hint: typedError?.hint,
      code: typedError?.code,
      status,
    })
  );
}

function shouldRetryWithoutPublicLocationColumns(error: unknown) {
  const typedError = error as {
    code?: string | null;
    message?: string | null;
  };
  const message = typedError?.message || "";

  return (
    (typedError?.code === "PGRST204" || typedError?.code === "42703") &&
    (message.includes("public_latitude") ||
      message.includes("public_longitude") ||
      message.includes("location_privacy_radius_meters") ||
      message.includes("campus_id") ||
      message.includes("campus_destination_label") ||
      message.includes("campus_coordinate_source"))
  );
}

function makeStraightGeometry(
  origin: Coordinate,
  destination: Coordinate
): RouteGeometry {
  return {
    type: "LineString",
    coordinates: [origin, destination],
  };
}

function googleMode(mode: TravelMode) {
  if (mode === "cycling") return "bicycling";
  if (mode === "walking") return "walking";
  if (mode === "transit") return "transit";
  return "driving";
}

function directionsUrl({
  origin,
  destination,
  mode,
}: {
  origin: Coordinate;
  destination: Coordinate;
  mode: TravelMode;
}) {
  const params = new URLSearchParams({
    api: "1",
    origin: `${origin[1]},${origin[0]}`,
    destination: `${destination[1]},${destination[0]}`,
    travelmode: googleMode(mode),
  });

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

function secondsFromGoogleDuration(value: unknown) {
  const seconds = Number.parseInt(String(value).replace("s", ""), 10);
  return Number.isFinite(seconds) ? seconds : null;
}

function getGoogleRoutesErrorCode(
  status: number,
  message: string,
  mode: TravelMode
): RouteErrorCode {
  const normalized = message.toLowerCase();

  if (
    normalized.includes("field mask") ||
    normalized.includes("fieldmask") ||
    normalized.includes("invalid field")
  ) {
    return "GOOGLE_ROUTES_INVALID_FIELD_MASK";
  }

  if (
    normalized.includes("departure_time") ||
    normalized.includes("departure time") ||
    normalized.includes("departuretime") ||
    normalized.includes("unsupported")
  ) {
    return "GOOGLE_ROUTES_UNSUPPORTED_DEPARTURE_TIME";
  }

  if (status === 403 && normalized.includes("billing")) {
    return "GOOGLE_ROUTES_BILLING_REQUIRED";
  }

  if (status === 400 || normalized.includes("invalid argument")) {
    return "GOOGLE_ROUTES_INVALID_ARGUMENT";
  }

  if (
    normalized.includes("api has not been used") ||
    normalized.includes("disabled") ||
    normalized.includes("not enabled")
  ) {
    return "GOOGLE_ROUTES_API_DISABLED";
  }

  if (
    status === 401 ||
    status === 403 ||
    normalized.includes("permission denied") ||
    normalized.includes("api key not valid") ||
    normalized.includes("referer") ||
    normalized.includes("referrer")
  ) {
    return "GOOGLE_ROUTES_PERMISSION_DENIED";
  }

  if (status === 429 || normalized.includes("quota")) {
    return "GOOGLE_ROUTES_QUOTA_EXCEEDED";
  }

  return mode === "transit" ? "GOOGLE_TRANSIT_NO_ROUTE" : "GOOGLE_ROUTES_NO_ROUTE";
}

function fallbackRouteResponse({
  mode,
  listing,
  displayOrigin,
  destination,
  campusName,
  isApproximateOrigin,
  routeCalculatedFromExactLocation,
}: {
  mode: TravelMode;
  listing: Record<string, unknown>;
  displayOrigin: Coordinate;
  destination: Coordinate;
  campusName: string;
  isApproximateOrigin: boolean;
  routeCalculatedFromExactLocation: boolean;
}) {
  return {
    mode,
    distanceMeters: null,
    durationSeconds: null,
    geometry: makeStraightGeometry(displayOrigin, destination),
    originLabel: isApproximateOrigin ? "Approximate property area" : "Property",
    destinationLabel: campusName,
    publicOrigin: {
      latitude: displayOrigin[1],
      longitude: displayOrigin[0],
      label: isApproximateOrigin ? "Approximate property area" : "Property",
    },
    destination: {
      latitude: destination[1],
      longitude: destination[0],
      label: campusName,
    },
    isApproximateOrigin,
    originIsApproximateOnMap: isApproximateOrigin,
    routeCalculatedFromExactLocation,
    calculatedAt: new Date().toISOString(),
    directionsUrl: directionsUrl({ origin: displayOrigin, destination, mode }),
    isEstimatedRoute: false,
    routeUnavailable: true,
    provider: "unavailable" as RouteProvider,
    cacheStatus: "unavailable",
    originType: routeCalculatedFromExactLocation ? "private_exact" : "fallback",
    destinationSource:
      typeof listing.campus_coordinate_source === "string"
        ? listing.campus_coordinate_source
        : "listing_saved",
    routeDetails: {
      provider: "unavailable" as RouteProvider,
      profile: mode,
    },
    note:
      mode === "transit"
        ? "Live transit routing is temporarily unavailable."
        : "The route could not be calculated right now.",
  };
}

async function userCanSeeExactLocation({
  userId,
  listing,
  supabase,
}: {
  userId: string | null;
  listing: Record<string, unknown>;
  supabase: Awaited<ReturnType<typeof createClient>>;
}) {
  if (!userId) {
    return {
      canSeeExact: false,
      userRole: null as string | null,
    };
  }

  if (listing.user_id === userId) {
    return {
      canSeeExact: true,
      userRole: null as string | null,
    };
  }

  const listingId = String(listing.id);

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin, role")
    .eq("id", userId)
    .maybeSingle();

  if (profile?.is_admin === true || profile?.role === "admin") {
    return {
      canSeeExact: true,
      userRole: typeof profile.role === "string" ? profile.role : null,
    };
  }

  const { data: acceptedInquiry } = await supabase
    .from("inquiries")
    .select("id")
    .eq("listing_id", listingId)
    .eq("requester_id", userId)
    .eq("status", "accepted")
    .maybeSingle();

  if (acceptedInquiry) {
    return {
      canSeeExact: true,
      userRole: typeof profile?.role === "string" ? profile.role : null,
    };
  }

  const { data: acceptedViewing } = await supabase
    .from("viewings")
    .select("id")
    .eq("listing_id", listingId)
    .eq("requester_id", userId)
    .eq("status", "accepted")
    .maybeSingle();

  return {
    canSeeExact: Boolean(acceptedViewing),
    userRole: typeof profile?.role === "string" ? profile.role : null,
  };
}

function googleRoutesTravelMode(mode: TravelMode) {
  return googleModeMap[mode];
}

function routeGeometryFingerprint(coordinates: Coordinate[]) {
  let hash = 2166136261;
  const serialized = JSON.stringify(coordinates);

  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(16).padStart(8, "0");
}

function readGoogleGeoJsonLineString(value: unknown): Coordinate[] {
  if (
    !value ||
    typeof value !== "object" ||
    !("type" in value) ||
    !("coordinates" in value)
  ) {
    return [];
  }

  const geometry = value as {
    type?: unknown;
    coordinates?: unknown;
  };

  if (
    geometry.type !== "LineString" ||
    !Array.isArray(geometry.coordinates)
  ) {
    return [];
  }

  return geometry.coordinates.filter(
    (coordinate): coordinate is Coordinate =>
      Array.isArray(coordinate) &&
      coordinate.length >= 2 &&
      typeof coordinate[0] === "number" &&
      typeof coordinate[1] === "number" &&
      Number.isFinite(coordinate[0]) &&
      Number.isFinite(coordinate[1]) &&
      isValidLongitude(coordinate[0]) &&
      isValidLatitude(coordinate[1])
  );
}

async function fetchGoogleRoute({
  apiKey,
  origin,
  destination,
  travelMode,
  locale,
}: {
  apiKey: string;
  origin: Coordinate;
  destination: Coordinate;
  travelMode: string;
  locale: string;
}) {
  const response = await fetch(
    "https://routes.googleapis.com/directions/v2:computeRoutes",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "routes.duration,routes.distanceMeters,routes.polyline.geoJsonLinestring,routes.legs",
      },
      body: JSON.stringify({
        origin: {
          location: {
            latLng: {
              latitude: origin[1],
              longitude: origin[0],
            },
          },
        },
        destination: {
          location: {
            latLng: {
              latitude: destination[1],
              longitude: destination[0],
            },
          },
        },
        travelMode,
        polylineQuality: "HIGH_QUALITY",
        polylineEncoding: "GEO_JSON_LINESTRING",
        computeAlternativeRoutes: false,
        languageCode: locale === "fr-CA" ? "fr-CA" : "en-CA",
        units: "METRIC",
      }),
      cache: "no-store",
    }
  );
  const text = await response.text();
  let data: {
    routes?: Array<{
      duration?: string;
      distanceMeters?: number;
      polyline?: {
        geoJsonLinestring?: {
          type?: string;
          coordinates?: unknown;
        };
      };
      legs?: Array<{
        steps?: Array<{
          distanceMeters?: number;
          staticDuration?: string;
          localizedValues?: {
            staticDuration?: {
              text?: string;
            };
          };
          navigationInstruction?: {
            instructions?: string;
          };
          travelMode?: string;
          transitDetails?: {
            stopCount?: number;
            headsign?: string;
            transitLine?: {
              name?: string;
              nameShort?: string;
              vehicle?: {
                name?: {
                  text?: string;
                };
                type?: string;
              };
            };
            stopDetails?: {
              departureTime?: string;
              arrivalTime?: string;
            };
          };
        }>;
      }>;
      travelAdvisory?: unknown;
    }>;
    error?: {
      message?: string;
      status?: string;
    };
  } = {};

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {
      error: {
        message: text,
      },
    };
  }

  return {
    response,
    text,
    data,
  };
}

async function calculateGoogleRoute({
  mode,
  exactOrigin,
  destination,
  displayOrigin,
  canSeeExact,
  locale,
}: {
  mode: TravelMode;
  exactOrigin: Coordinate;
  destination: Coordinate;
  displayOrigin: Coordinate;
  canSeeExact: boolean;
  locale: string;
}) {
  const googleApiKey = process.env.GOOGLE_ROUTES_API_KEY?.trim();
  const googleTravelMode = googleRoutesTravelMode(mode);

  if (process.env.NODE_ENV !== "production") {
    console.log("Google Routes key configured:", Boolean(googleApiKey));
  }

  if (!googleApiKey) {
    return {
      errorCode: "GOOGLE_ROUTES_KEY_MISSING" as RouteErrorCode,
      message: "Google Routes API key is missing.",
    };
  }

  const { response, text, data } = await fetchGoogleRoute({
    apiKey: googleApiKey,
    origin: exactOrigin,
    destination,
    travelMode: googleTravelMode,
    locale,
  });

  if (!response.ok) {
    const message = data.error?.message || text || "Google Routes API failed.";

    if (process.env.NODE_ENV !== "production") {
      console.error("Google transit route failed", {
        status: response.status,
        statusText: response.statusText,
        responseBody: data,
      });
    }

    return {
      errorCode: getGoogleRoutesErrorCode(response.status, message, mode),
      message,
      rawResponse: text,
      status: response.status,
    };
  }

  const route = data.routes?.[0];
  const decodedCoordinates = readGoogleGeoJsonLineString(
    route?.polyline?.geoJsonLinestring
  );

  if (!route) {
    return {
      errorCode: (mode === "transit"
        ? "GOOGLE_TRANSIT_NO_ROUTE"
        : "GOOGLE_ROUTES_NO_ROUTE") as RouteErrorCode,
      message: "Google Routes did not return a route.",
      rawResponse: text,
      status: response.status,
    };
  }

  if (decodedCoordinates.length < 2) {
    return {
      errorCode: "ROUTE_GEOMETRY_INVALID" as RouteErrorCode,
      message: "Google Routes returned invalid transit geometry.",
      rawResponse: text,
      status: response.status,
    };
  }

  let displayCoordinates = decodedCoordinates;
  let sanitizerUsed = false;
  let publicPreviewUsed = false;

  if (!canSeeExact) {
    const preview = await fetchGoogleRoute({
      apiKey: googleApiKey,
      origin: displayOrigin,
      destination,
      travelMode: googleTravelMode,
      locale,
    });
    const previewCoordinates = preview.response.ok
      ? readGoogleGeoJsonLineString(
          preview.data.routes?.[0]?.polyline?.geoJsonLinestring
        )
      : [];

    if (previewCoordinates.length >= 2) {
      displayCoordinates = previewCoordinates;
      publicPreviewUsed = true;
    } else {
      displayCoordinates = sanitizeRouteGeometryForPublicOrigin({
        exactGeometry: decodedCoordinates,
        exactOrigin,
        publicOrigin: displayOrigin,
        destination,
      });
      sanitizerUsed = true;
    }
  }

  if (process.env.NODE_ENV !== "production") {
    console.log("Campus route geometry diagnostics", {
      mode,
      googleTravelMode,
      authorizedUser: canSeeExact,
      sanitizerUsed,
      publicPreviewUsed,
      decodedCoordinateCount: decodedCoordinates.length,
      returnedGeoJsonCoordinateCount: decodedCoordinates.length,
      returnedCoordinateCount: displayCoordinates.length,
      geometryFingerprint: routeGeometryFingerprint(displayCoordinates),
    });
  }

  const steps =
    route.legs?.flatMap((leg) =>
      (leg.steps || []).map((step) => {
        const transitLine = step.transitDetails?.transitLine;
        const travelMode = step.travelMode?.toLowerCase();

        return {
          type:
            travelMode === "transit"
              ? ("transit" as const)
              : travelMode === "walk"
                ? ("walk" as const)
                : ("other" as const),
          instruction: step.navigationInstruction?.instructions || null,
          durationSeconds: secondsFromGoogleDuration(step.staticDuration),
          distanceMeters: safeNumber(step.distanceMeters),
          transitLine:
            transitLine?.nameShort ||
            transitLine?.name ||
            transitLine?.vehicle?.name?.text ||
            null,
          transitHeadsign: step.transitDetails?.headsign || null,
          stopCount: safeNumber(step.transitDetails?.stopCount),
        };
      })
    ) || [];

  const transitStepCount = steps.filter((step) => step.type === "transit").length;
  const routeDetails: RouteDetails = {
    provider: "google_routes",
    profile: googleRoutesTravelMode(mode),
    departureTime: null,
    arrivalTime: null,
    steps,
    transfers:
      mode === "transit" && transitStepCount > 0
        ? Math.max(0, transitStepCount - 1)
        : null,
  };

  return {
    distanceMeters: safeNumber(route.distanceMeters),
    durationSeconds: secondsFromGoogleDuration(route.duration),
    geometry: {
      type: "LineString" as const,
      coordinates: displayCoordinates,
    },
    routeDetails,
  };
}

export async function GET(request: NextRequest) {
  const listingId = request.nextUrl.searchParams.get("listingId");
  const modeParam = request.nextUrl.searchParams.get("mode");

  if (!listingId || !isTravelMode(modeParam)) {
    return publicRouteError({
      code: "UNSUPPORTED_TRAVEL_MODE",
      message: "Invalid route request.",
      status: 400,
    });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const listingResult = await supabase
    .from("listings")
    .select(routeListingSelect)
    .eq("id", listingId)
    .maybeSingle();
  let listingData = listingResult.data as Record<string, unknown> | null;
  let listingError = listingResult.error;

  if (listingError && shouldRetryWithoutPublicLocationColumns(listingError)) {
    logRouteFailure({
      listingId,
      selectedMode: modeParam,
      error: listingError,
      status: 500,
    });

    const legacyResult = await supabase
      .from("listings")
      .select(legacyRouteListingSelect)
      .eq("id", listingId)
      .maybeSingle();

    listingData = (legacyResult.data as Record<string, unknown> | null) || null;
    listingError = legacyResult.error;
  }

  if (listingError) {
    logRouteFailure({
      listingId,
      selectedMode: modeParam,
      error: listingError,
      status: 500,
    });

    return publicRouteError({
      code: "LISTING_QUERY_FAILED",
      message: "We could not load this route right now.",
      status: 500,
    });
  }

  if (!listingData) {
    return publicRouteError({
      code: "LISTING_NOT_FOUND",
      message: "Listing not found.",
      status: 404,
    });
  }

  const listing = listingData as Record<string, unknown>;
  const originLat = safeNumber(listing.latitude);
  const originLng = safeNumber(listing.longitude);
  const publicLat = safeNumber(listing.public_latitude);
  const publicLng = safeNumber(listing.public_longitude);
  const campusLat = safeNumber(listing.campus_latitude);
  const campusLng = safeNumber(listing.campus_longitude);

  if (originLat == null || originLng == null) {
    return publicRouteError({
      code: "PROPERTY_COORDINATES_MISSING",
      message: "Property coordinates are unavailable.",
      status: 422,
    });
  }

  if (campusLat == null || campusLng == null) {
    return publicRouteError({
      code: "CAMPUS_COORDINATES_MISSING",
      message: "Campus coordinates are unavailable.",
      status: 422,
    });
  }

  if (
    !isValidLatitude(originLat) ||
    !isValidLongitude(originLng) ||
    !isValidLatitude(campusLat) ||
    !isValidLongitude(campusLng) ||
    (originLat === campusLat && originLng === campusLng)
  ) {
    return publicRouteError({
      code: "INVALID_COORDINATES",
      message: "Route coordinates are invalid.",
      status: 422,
    });
  }

  const access = await userCanSeeExactLocation({
    userId: user?.id || null,
    listing,
    supabase,
  });
  const canSeeExact = access.canSeeExact;
  const isApproximateOrigin = !canSeeExact;
  const exactOrigin: Coordinate = [originLng, originLat];
  const fallbackPublicOrigin = generatePublicCoordinate({
    latitude: originLat,
    longitude: originLng,
    seed: listingId,
  });
  const generatedPublicOrigin: Coordinate = [
    fallbackPublicOrigin.longitude,
    fallbackPublicOrigin.latitude,
  ];
  const storedPublicOrigin: Coordinate | null =
    publicLat != null &&
    publicLng != null &&
    isValidLatitude(publicLat) &&
    isValidLongitude(publicLng)
      ? [publicLng, publicLat]
      : null;
  const storedPublicDistanceMeters = storedPublicOrigin
    ? distanceMeters(exactOrigin, storedPublicOrigin)
    : null;
  const storedPublicOriginIsValid =
    storedPublicOrigin != null &&
    storedPublicDistanceMeters != null &&
    storedPublicDistanceMeters >= 75 &&
    storedPublicDistanceMeters <= 200;
  const displayOrigin: Coordinate =
    canSeeExact
      ? exactOrigin
      : storedPublicOriginIsValid
        ? storedPublicOrigin
        : generatedPublicOrigin;

  if (storedPublicOrigin && !storedPublicOriginIsValid) {
    const { error: publicCoordinateRepairError } = await supabase
      .from("listings")
      .update({
        public_latitude: fallbackPublicOrigin.latitude,
        public_longitude: fallbackPublicOrigin.longitude,
        location_privacy_radius_meters: fallbackPublicOrigin.radiusMeters,
      })
      .eq("id", listingId);

    if (publicCoordinateRepairError) {
      console.error("Campus route public coordinate repair failed", {
        listingId,
        code: publicCoordinateRepairError.code,
        message: publicCoordinateRepairError.message,
      });
    }
  }

  if (process.env.NODE_ENV !== "production") {
    console.log("Campus route origin validation", {
      listingId,
      mode: modeParam,
      canSeeExact,
      userRole: access.userRole,
      storedPublicOriginExists: Boolean(storedPublicOrigin),
      storedPublicDistanceMeters:
        storedPublicDistanceMeters == null
          ? null
          : Math.round(storedPublicDistanceMeters),
      storedPublicOriginIsValid,
      originUsed: canSeeExact
        ? "private_exact"
        : storedPublicOriginIsValid
          ? "stored_public"
          : "regenerated_public",
    });
  }

  const destination: Coordinate = [campusLng, campusLat];
  const campusName =
    typeof listing.nearest_campus_name === "string" &&
    listing.nearest_campus_name.trim()
      ? listing.nearest_campus_name.trim()
      : "Selected campus";
  const destinationLabel =
    typeof listing.campus_destination_label === "string" &&
    listing.campus_destination_label.trim()
      ? `${campusName} (${listing.campus_destination_label.trim()})`
      : campusName;
  const destinationSource =
    typeof listing.campus_coordinate_source === "string" &&
    listing.campus_coordinate_source.trim()
      ? listing.campus_coordinate_source.trim()
      : "campus_record";
  const locale =
    request.headers.get("accept-language")?.split(",")[0]?.trim() || "en-CA";

  try {
    const googleRoute = await calculateGoogleRoute({
      mode: modeParam,
      exactOrigin,
      destination,
      displayOrigin,
      canSeeExact,
      locale,
    });

    if ("errorCode" in googleRoute) {
      logRouteFailure({
        listingId,
        selectedMode: modeParam,
        error: {
          message: googleRoute.message,
          code: googleRoute.errorCode,
          details: googleRoute.rawResponse,
        },
        status: googleRoute.status || 200,
      });

      const fallback = fallbackRouteResponse({
        mode: modeParam,
        listing,
        displayOrigin,
        destination,
        campusName,
        isApproximateOrigin,
        routeCalculatedFromExactLocation: true,
      });

      return NextResponse.json({
        ...fallback,
        routeUnavailable: true,
        code: googleRoute.errorCode,
        note:
          googleRoute.errorCode === "GOOGLE_ROUTES_KEY_MISSING"
            ? "Google Routes API configuration is required for live routes."
            : googleRoute.errorCode === "GOOGLE_TRANSIT_NO_ROUTE"
              ? "No public-transit route was found for this trip."
              : fallback.note,
      });
    }

    const calculatedAt = new Date().toISOString();
    const routeData = {
      mode: modeParam,
      distanceMeters: googleRoute.distanceMeters,
      durationSeconds: googleRoute.durationSeconds,
      geometry: googleRoute.geometry,
      originLabel: isApproximateOrigin ? "Approximate property area" : "Property",
      destinationLabel,
      publicOrigin: {
        latitude: displayOrigin[1],
        longitude: displayOrigin[0],
        label: isApproximateOrigin ? "Approximate property area" : "Property",
      },
      destination: {
        latitude: destination[1],
        longitude: destination[0],
        label: destinationLabel,
      },
      isApproximateOrigin,
      originIsApproximateOnMap: isApproximateOrigin,
      routeCalculatedFromExactLocation: true,
      calculatedAt,
      provider: "google_routes" as RouteProvider,
      profile: googleRoutesTravelMode(modeParam),
      routeDetails: googleRoute.routeDetails,
      cacheStatus: "no-store",
      originType: "private_exact",
      destinationSource,
      directionsUrl: directionsUrl({
        origin: displayOrigin,
        destination,
        mode: modeParam,
      }),
      isEstimatedRoute: false,
    };

    return NextResponse.json(routeData);
  } catch (error) {
    logRouteFailure({
      listingId,
      selectedMode: modeParam,
      error,
      status: 200,
    });

    return NextResponse.json(
      fallbackRouteResponse({
        mode: modeParam,
        listing,
        displayOrigin,
        destination,
        campusName,
        isApproximateOrigin,
        routeCalculatedFromExactLocation: true,
      })
    );
  }
}
