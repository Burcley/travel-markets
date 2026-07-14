export const MIN_PRIVACY_OFFSET_METERS = 75;
export const MAX_PRIVACY_OFFSET_METERS = 150;
export const ROUTE_GEOMETRY_PRIVACY_BUFFER_METERS = 150;
export const MAX_PUBLIC_ROUTE_CONNECTOR_METERS = 300;

export type Coordinate = [number, number];

export function isValidCoordinate(latitude: unknown, longitude: unknown) {
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

export function distanceMeters(
  from: Coordinate,
  to: Coordinate
) {
  const [fromLng, fromLat] = from;
  const [toLng, toLat] = to;
  const radiusMeters = 6371000;
  const latDelta = toRadians(toLat - fromLat);
  const lngDelta = toRadians(toLng - fromLng);
  const a =
    Math.sin(latDelta / 2) * Math.sin(latDelta / 2) +
    Math.cos(toRadians(fromLat)) *
      Math.cos(toRadians(toLat)) *
      Math.sin(lngDelta / 2) *
      Math.sin(lngDelta / 2);

  return radiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function sanitizeRouteGeometryForPublicOrigin({
  exactGeometry,
  exactOrigin,
  publicOrigin,
  destination,
  privacyBufferMeters = ROUTE_GEOMETRY_PRIVACY_BUFFER_METERS,
}: {
  exactGeometry: Coordinate[];
  exactOrigin: Coordinate;
  publicOrigin: Coordinate;
  destination: Coordinate;
  privacyBufferMeters?: number;
}) {
  const coordinates = exactGeometry.filter((coordinate) =>
    isValidCoordinate(coordinate[1], coordinate[0])
  );

  if (coordinates.length < 2) {
    return [publicOrigin, destination];
  }

  const startDistance = distanceMeters(coordinates[0], exactOrigin);
  const endDistance = distanceMeters(coordinates[coordinates.length - 1], exactOrigin);
  const propertyAtEnd = endDistance < startDistance;
  const routeFromProperty = propertyAtEnd ? [...coordinates].reverse() : coordinates;
  const firstSafeIndex = routeFromProperty.findIndex(
    (coordinate) => distanceMeters(coordinate, exactOrigin) >= privacyBufferMeters
  );
  const safeIndex =
    firstSafeIndex >= 0
      ? firstSafeIndex
      : routeFromProperty.length - 1;
  const closestConnectorIndex = routeFromProperty.reduce(
    (best, coordinate, index) => {
      if (distanceMeters(coordinate, exactOrigin) < privacyBufferMeters) {
        return best;
      }

      const connectorDistance = distanceMeters(publicOrigin, coordinate);

      if (
        connectorDistance > MAX_PUBLIC_ROUTE_CONNECTOR_METERS ||
        connectorDistance >= best.distance
      ) {
        return best;
      }

      return {
        index,
        distance: connectorDistance,
      };
    },
    { index: -1, distance: Number.POSITIVE_INFINITY }
  );
  const publicConnectorIndex =
    closestConnectorIndex.index >= 0 ? closestConnectorIndex.index : safeIndex;

  const safeRemainder = routeFromProperty.slice(publicConnectorIndex);

  const dedupedRemainder =
    safeRemainder.length > 0 && distanceMeters(publicOrigin, safeRemainder[0]) < 5
      ? safeRemainder.slice(1)
      : safeRemainder;
  const sanitized = [publicOrigin, ...dedupedRemainder];

  return propertyAtEnd ? sanitized.reverse() : sanitized;
}

export function generatePublicCoordinate({
  latitude,
  longitude,
  seed,
  minOffsetMeters = MIN_PRIVACY_OFFSET_METERS,
  maxOffsetMeters = MAX_PRIVACY_OFFSET_METERS,
}: {
  latitude: number;
  longitude: number;
  seed: string;
  minOffsetMeters?: number;
  maxOffsetMeters?: number;
}) {
  const bearingSeed = seededFraction(`${seed}:bearing`);
  const radiusSeed = seededFraction(`${seed}:radius`);
  const bearing = bearingSeed * Math.PI * 2;
  const radiusMeters =
    minOffsetMeters + radiusSeed * Math.max(0, maxOffsetMeters - minOffsetMeters);
  const latDelta = (radiusMeters * Math.cos(bearing)) / 111320;
  const lngDelta =
    (radiusMeters * Math.sin(bearing)) /
    Math.max(1, 111320 * Math.cos(toRadians(latitude)));

  return {
    latitude: latitude + latDelta,
    longitude: longitude + lngDelta,
    radiusMeters: Math.round(radiusMeters),
  };
}

export function getSafePublicCoordinate({
  id,
  latitude,
  longitude,
  publicLatitude,
  publicLongitude,
}: {
  id: string;
  latitude?: number | null;
  longitude?: number | null;
  publicLatitude?: number | null;
  publicLongitude?: number | null;
}) {
  if (isValidCoordinate(publicLatitude, publicLongitude)) {
    return {
      latitude: publicLatitude,
      longitude: publicLongitude,
    };
  }

  const privateLatitude = typeof latitude === "number" ? latitude : null;
  const privateLongitude = typeof longitude === "number" ? longitude : null;

  if (
    privateLatitude === null ||
    privateLongitude === null ||
    !isValidCoordinate(privateLatitude, privateLongitude)
  ) {
    return {
      latitude: null,
      longitude: null,
    };
  }

  const generated = generatePublicCoordinate({
    latitude: privateLatitude,
    longitude: privateLongitude,
    seed: id,
  });

  return {
    latitude: generated.latitude,
    longitude: generated.longitude,
  };
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function seededFraction(input: string) {
  let hash = 2166136261;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0) / 4294967295;
}
