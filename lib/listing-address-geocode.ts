import { campusOptions } from "@/lib/listing-transparency";
import { distanceMeters } from "@/lib/location-privacy";

type ListingAddressInput = {
  address?: string | null;
  addressLine?: string | null;
  unit?: string | null;
  city?: string | null;
  province?: string | null;
  postalCode?: string | null;
  country?: string | null;
};

type GeocodeSuccess = {
  ok: true;
  latitude: number;
  longitude: number;
  label: string;
  relevance: number | null;
  fullAddress: string;
};

type GeocodeFailure = {
  ok: false;
  code:
    | "MAPBOX_TOKEN_MISSING"
    | "PRIVATE_ADDRESS_MISSING"
    | "GEOCODE_REQUEST_FAILED"
    | "GEOCODE_ADDRESS_NOT_FOUND"
    | "GEOCODE_CITY_MISMATCH"
    | "GEOCODE_CAMPUS_MATCH"
    | "GEOCODE_REUSED_PREVIOUS_COORDINATE";
  message: string;
  fullAddress: string;
  status?: number;
  featureCount?: number;
  label?: string | null;
};

export type ListingAddressGeocodeResult = GeocodeSuccess | GeocodeFailure;

function clean(value: string | null | undefined) {
  return value?.trim() || "";
}

function normalize(value: string | null | undefined) {
  return clean(value).toLowerCase();
}

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

export function buildListingFullAddress(input: ListingAddressInput) {
  const street = clean(input.addressLine || input.address);
  const unit = clean(input.unit);
  const streetNumber = street.match(/^\d+[A-Za-z]?/)?.[0]?.toLowerCase() || "";
  const unitPart =
    unit &&
    unit.toLowerCase() !== streetNumber &&
    !street.toLowerCase().includes(unit.toLowerCase())
      ? unit
      : "";

  return [
    [street, unitPart].filter(Boolean).join(" "),
    input.city,
    input.province,
    input.postalCode,
    input.country || "Canada",
  ]
    .map((part) => clean(part))
    .filter(Boolean)
    .join(", ");
}

function contextContainsCity(feature: Record<string, unknown>, city: string) {
  const normalizedCity = normalize(city);
  const placeName = normalize(
    typeof feature.place_name === "string" ? feature.place_name : ""
  );

  if (!normalizedCity) return true;
  if (placeName.includes(normalizedCity)) return true;

  const context = Array.isArray(feature.context) ? feature.context : [];
  return context.some((item) => {
    if (!item || typeof item !== "object") return false;
    const text = "text" in item && typeof item.text === "string" ? item.text : "";
    return normalize(text) === normalizedCity;
  });
}

function isCampusCoordinate(latitude: number, longitude: number) {
  return campusOptions.some((campus) => {
    const distance = distanceMeters(
      [longitude, latitude],
      [campus.longitude, campus.latitude]
    );

    return distance <= 100;
  });
}

export async function geocodeListingAddressWithMapbox({
  token,
  address,
  previousLatitude,
  previousLongitude,
  rejectPreviousCoordinate = false,
}: {
  token: string | null | undefined;
  address: ListingAddressInput;
  previousLatitude?: number | null;
  previousLongitude?: number | null;
  rejectPreviousCoordinate?: boolean;
}): Promise<ListingAddressGeocodeResult> {
  const fullAddress = buildListingFullAddress(address);

  if (!token?.trim()) {
    return {
      ok: false,
      code: "MAPBOX_TOKEN_MISSING",
      message: "Address validation is temporarily unavailable.",
      fullAddress,
    };
  }

  if (!clean(address.addressLine || address.address) || !clean(address.city)) {
    return {
      ok: false,
      code: "PRIVATE_ADDRESS_MISSING",
      message: "Enter the full street address and city before saving.",
      fullAddress,
    };
  }

  const url = new URL(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
      fullAddress
    )}.json`
  );
  url.searchParams.set("access_token", token.trim());
  url.searchParams.set("country", "ca");
  url.searchParams.set("limit", "5");
  url.searchParams.set("types", "address");

  const response = await fetch(url, { cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  const features = Array.isArray(data.features) ? data.features : [];
  const feature = features[0] as Record<string, unknown> | undefined;
  const center = Array.isArray(feature?.center) ? feature.center : [];
  const longitude = center[0];
  const latitude = center[1];
  const placeTypes = Array.isArray(feature?.place_type) ? feature.place_type : [];
  const label =
    typeof feature?.place_name === "string" ? feature.place_name : null;

  if (
    !response.ok ||
    !feature ||
    !isValidCoordinate(latitude, longitude) ||
    !placeTypes.includes("address")
  ) {
    return {
      ok: false,
      code: "GEOCODE_ADDRESS_NOT_FOUND",
      message:
        "We could not validate that exact address. Check the street address and postal code.",
      fullAddress,
      status: response.status,
      featureCount: features.length,
      label,
    };
  }

  if (!contextContainsCity(feature, clean(address.city))) {
    return {
      ok: false,
      code: "GEOCODE_CITY_MISMATCH",
      message:
        "The address result does not match the listing city. Please check the address.",
      fullAddress,
      status: response.status,
      featureCount: features.length,
      label,
    };
  }

  if (isCampusCoordinate(latitude, longitude)) {
    return {
      ok: false,
      code: "GEOCODE_CAMPUS_MATCH",
      message:
        "The address appears to point to a campus, not the rental property.",
      fullAddress,
      status: response.status,
      featureCount: features.length,
      label,
    };
  }

  if (
    rejectPreviousCoordinate &&
    isValidCoordinate(previousLatitude, previousLongitude)
  ) {
    const previousDistance = distanceMeters(
      [previousLongitude as number, previousLatitude as number],
      [longitude, latitude]
    );

    if (previousDistance < 2) {
      return {
        ok: false,
        code: "GEOCODE_REUSED_PREVIOUS_COORDINATE",
        message:
          "We could not confirm a new precise location for this changed address.",
        fullAddress,
        status: response.status,
        featureCount: features.length,
        label,
      };
    }
  }

  return {
    ok: true,
    latitude,
    longitude,
    label: label || fullAddress,
    relevance:
      typeof feature.relevance === "number" && Number.isFinite(feature.relevance)
        ? feature.relevance
        : null,
    fullAddress,
  };
}
