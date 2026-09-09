import {
  buildListingFullAddress,
  geocodeListingAddressWithMapbox,
} from "@/lib/listing-address-geocode";
import {
  calculateDistanceKm,
  campusOptions,
  estimateTravelTimes,
} from "@/lib/listing-transparency";
import { generatePublicCoordinate } from "@/lib/location-privacy";

type ImportLocationRow = {
  property?: string | null;
  streetAddress?: string | null;
  unit?: string | null;
  city?: string | null;
  province?: string | null;
  postalCode?: string | null;
};

export function nearestRouteReadyCampus(latitude: number, longitude: number) {
  return (
    campusOptions
      .map((campus) => ({
        campus,
        distanceKm: calculateDistanceKm(
          latitude,
          longitude,
          campus.latitude,
          campus.longitude
        ),
      }))
      .filter((item) => item.distanceKm != null)
      .sort((first, second) => (first.distanceKm || 0) - (second.distanceKm || 0))[0] ||
    null
  );
}

export async function resolveImportedListingLocationFields(row: ImportLocationRow) {
  const token = process.env.MAPBOX_ACCESS_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const address = {
    addressLine: row.streetAddress || row.property || "",
    unit: row.unit,
    city: row.city,
    province: row.province,
    postalCode: row.postalCode,
    country: "Canada",
  };
  const geocode = await geocodeListingAddressWithMapbox({
    token,
    address,
  });

  if (!geocode.ok) {
    return {
      ok: false as const,
      message: geocode.message,
      code: geocode.code,
      fullAddress: geocode.fullAddress || buildListingFullAddress(address),
    };
  }

  const nearest = nearestRouteReadyCampus(geocode.latitude, geocode.longitude);

  if (!nearest) {
    return {
      ok: false as const,
      message: "Could not determine a route-ready nearest campus for this address.",
      code: "NEAREST_CAMPUS_NOT_FOUND",
      fullAddress: geocode.fullAddress,
    };
  }

  const publicCoordinate = generatePublicCoordinate({
    latitude: geocode.latitude,
    longitude: geocode.longitude,
    seed: geocode.fullAddress,
  });
  const travelTimes = estimateTravelTimes(nearest.distanceKm);

  return {
    ok: true as const,
    fullAddress: geocode.fullAddress,
    geocodeLabel: geocode.label,
    campus: nearest.campus,
    fields: {
      campus: nearest.campus.officialName,
      latitude: geocode.latitude,
      longitude: geocode.longitude,
      public_latitude: publicCoordinate.latitude,
      public_longitude: publicCoordinate.longitude,
      location_privacy_radius_meters: publicCoordinate.radiusMeters,
      public_location_generated_at: new Date().toISOString(),
      nearest_campus_name: nearest.campus.officialName,
      nearest_campus_address: nearest.campus.address,
      campus_id: nearest.campus.id,
      campus_destination_label: nearest.campus.officialName,
      campus_coordinate_source: "curated_campus_record",
      campus_latitude: nearest.campus.latitude,
      campus_longitude: nearest.campus.longitude,
      distance_to_campus_km: nearest.distanceKm,
      walking_time_minutes: travelTimes.walking,
      cycling_time_minutes: travelTimes.cycling,
      driving_time_minutes: travelTimes.driving,
      transit_time_minutes: travelTimes.transit,
      distance_last_calculated_at: new Date().toISOString(),
    },
  };
}
