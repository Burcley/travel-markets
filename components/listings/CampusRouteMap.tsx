"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Bike,
  Bus,
  Car,
  GraduationCap,
  Home,
  MapPin,
  Navigation,
  RotateCw,
  Footprints,
} from "lucide-react";
import mapboxgl from "mapbox-gl";

type TravelMode = "transit" | "cycling" | "walking" | "driving";

type RouteGeometry = {
  type: "LineString";
  coordinates: [number, number][];
};

type RouteResponse = {
  mode: TravelMode;
  distanceMeters: number | null;
  durationSeconds: number | null;
  geometry: RouteGeometry;
  originLabel: string;
  destinationLabel: string;
  isApproximateOrigin: boolean;
  calculatedAt: string;
  directionsUrl: string;
  isEstimatedRoute: boolean;
  originIsApproximateOnMap?: boolean;
  routeCalculatedFromExactLocation?: boolean;
  routeUnavailable?: boolean;
  note?: string;
  provider?: string;
  profile?: string;
  routeDetails?: {
    departureTime?: string | null;
    arrivalTime?: string | null;
    transfers?: number | null;
    steps?: Array<{
      type?: string;
      instruction?: string | null;
      durationSeconds?: number | null;
      distanceMeters?: number | null;
      transitLine?: string | null;
      transitHeadsign?: string | null;
      stopCount?: number | null;
    }>;
  } | null;
};

type Props = {
  listingId: string;
  propertyArea: string;
  campusName: string | null | undefined;
  hasCampusCoordinates: boolean;
};

type RouteError = {
  message: string;
  code?: string;
};

const modes: {
  value: TravelMode;
  icon: typeof Bus;
}[] = [
  { value: "transit", icon: Bus },
  { value: "cycling", icon: Bike },
  { value: "walking", icon: Footprints },
  { value: "driving", icon: Car },
];

const ROUTE_SOURCE_ID = "campus-route";
const ROUTE_LAYER_ID = "campus-route-line";

function formatDistance(meters: number | null) {
  if (meters == null || !Number.isFinite(meters)) return "—";
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

function formatDuration(seconds: number | null) {
  if (seconds == null || !Number.isFinite(seconds)) return "—";
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return remaining ? `${hours}h ${remaining}m` : `${hours}h`;
}

function boundsFromCoordinates(coordinates: [number, number][]) {
  const bounds = new mapboxgl.LngLatBounds();
  coordinates.forEach((coordinate) => bounds.extend(coordinate));
  return bounds;
}

function createMarkerElement(kind: "property" | "campus") {
  const element = document.createElement("div");
  element.className =
    kind === "property"
      ? "flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-pink-500 text-white shadow-2xl"
      : "flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-blue-500 text-white shadow-2xl";
  element.innerHTML =
    kind === "property"
      ? '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m3 10 9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/></svg>'
      : '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5Z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>';
  return element;
}

export default function CampusRouteMap({
  listingId,
  propertyArea,
  campusName,
  hasCampusCoordinates,
}: Props) {
  const t = useTranslations("listingDetail.campusRoute");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const propertyMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const campusMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const [selectedMode, setSelectedMode] = useState<TravelMode>(
    hasCampusCoordinates ? "transit" : "driving"
  );
  const [routesByMode, setRoutesByMode] = useState<
    Partial<Record<TravelMode, RouteResponse>>
  >({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<RouteError | null>(null);
  const [mapError, setMapError] = useState("");
  const [mapReady, setMapReady] = useState(false);
  const activeRoute = routesByMode[selectedMode];
  const activeGeometry = activeRoute?.geometry;

  const selectedModeLabel = t(`modes.${selectedMode}`);
  const originLabel = activeRoute?.isApproximateOrigin
    ? t("propertyArea")
    : activeRoute?.originLabel || "";
  const routeIntro = useMemo(() => {
    if (!activeRoute || activeRoute.routeUnavailable) return "";
    return t("summarySentence", {
      duration: formatDuration(activeRoute.durationSeconds),
      mode: selectedModeLabel.toLowerCase(),
      campus: activeRoute.destinationLabel,
    });
  }, [activeRoute, selectedModeLabel, t]);

  const transitSteps =
    activeRoute?.mode === "transit" ? activeRoute.routeDetails?.steps || [] : [];
  const transitFallbackActive =
    selectedMode === "transit" && activeRoute?.routeUnavailable;

  useEffect(() => {
    // Clear every route belonging to the previous listing.
    setRoutesByMode({});
    setError(null);
    setLoading(false);

    // Reset the default selected mode for the newly opened listing.
    setSelectedMode(hasCampusCoordinates ? "transit" : "driving");

    const map = mapRef.current;

    // Remove the previous listing's route layer and source.
    if (map?.getLayer(ROUTE_LAYER_ID)) {
      map.removeLayer(ROUTE_LAYER_ID);
    }

    if (map?.getSource(ROUTE_SOURCE_ID)) {
      map.removeSource(ROUTE_SOURCE_ID);
    }

    // Remove previous listing markers.
    propertyMarkerRef.current?.remove();
    campusMarkerRef.current?.remove();

    propertyMarkerRef.current = null;
    campusMarkerRef.current = null;
  }, [listingId, hasCampusCoordinates]);

  useEffect(() => {
    if (!hasCampusCoordinates || routesByMode[selectedMode]) return;

    const controller = new AbortController();

    async function loadRoute() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(
          `/api/routes/campus?listingId=${listingId}&mode=${selectedMode}`,
          {
            signal: controller.signal,
            cache: "no-store",
          }
        );
        const result = await response.json();

        if (!response.ok) {
          setError({
            message: result?.message || result?.error || t("routeError"),
            code: result?.code,
          });
          return;
        }

        setRoutesByMode((previous) => ({
          ...previous,
          [(result as RouteResponse).mode]: result as RouteResponse,
        }));
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === "AbortError") {
          return;
        }

        console.error("CAMPUS ROUTE LOAD ERROR:", loadError);
        setError({
          message:
            loadError instanceof Error ? loadError.message : t("routeError"),
        });
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadRoute();

    return () => controller.abort();
  }, [hasCampusCoordinates, listingId, routesByMode, selectedMode, t]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

    if (!token) {
      setMapError(t("missingMapboxToken"));
      return;
    }

    mapboxgl.accessToken = token;

    try {
      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/dark-v11",
        center: [-79.3832, 43.6532],
        zoom: 10,
      });

      map.addControl(new mapboxgl.NavigationControl(), "top-right");
      map.on("load", () => {
        map.resize();
        setMapReady(true);
      });
      map.on("error", (event) => {
        console.error("CAMPUS ROUTE MAPBOX ERROR:", event.error);
        setMapError(t("mapError"));
      });

      mapRef.current = map;

      const resizeTimer = window.setTimeout(() => map.resize(), 100);

      return () => {
        window.clearTimeout(resizeTimer);
        propertyMarkerRef.current?.remove();
        campusMarkerRef.current?.remove();
        map.remove();
        mapRef.current = null;
        setMapReady(false);
      };
    } catch (createError) {
      console.error("CAMPUS ROUTE MAP INIT ERROR:", createError);
      setMapError(t("mapError"));
    }
  }, [t]);

  useEffect(() => {
    const map = mapRef.current;
    if (
      !map ||
      !mapReady ||
      !map.isStyleLoaded() ||
      !activeRoute ||
      !activeGeometry ||
      activeGeometry.type !== "LineString"
    ) {
      return;
    }

    const shouldDrawRouteLine =
      !activeRoute.isEstimatedRoute && !activeRoute.routeUnavailable;

    if (map.getLayer(ROUTE_LAYER_ID)) {
      map.removeLayer(ROUTE_LAYER_ID);
    }

    if (map.getSource(ROUTE_SOURCE_ID)) {
      map.removeSource(ROUTE_SOURCE_ID);
    }

    const feature = {
      type: "Feature",
      properties: {
        mode: selectedMode,
        coordinateCount: activeGeometry.coordinates.length,
      },
      geometry: activeGeometry,
    } satisfies GeoJSON.Feature<GeoJSON.LineString>;

    console.log("Rebuilt campus route layer", {
      selectedMode,
      coordinateCount: activeGeometry.coordinates.length,
    });

    if (shouldDrawRouteLine) {
      map.addSource(ROUTE_SOURCE_ID, {
        type: "geojson",
        data: feature,
      });

      map.addLayer({
        id: ROUTE_LAYER_ID,
        type: "line",
        source: ROUTE_SOURCE_ID,
        layout: {
          "line-cap": "round",
          "line-join": "round",
        },
        paint: {
          "line-color": "#ff2d62",
          "line-width": 5,
          "line-opacity": 0.95,
          "line-dasharray": [1, 0],
        },
      });
    }

    const coordinates = activeGeometry.coordinates;

    if (coordinates.length > 1) {
      const origin = coordinates[0];
      const destination = coordinates[coordinates.length - 1];

      propertyMarkerRef.current?.remove();
      campusMarkerRef.current?.remove();

      propertyMarkerRef.current = new mapboxgl.Marker({
        element: createMarkerElement("property"),
      })
        .setLngLat(origin)
        .setPopup(new mapboxgl.Popup({ offset: 22 }).setText(t("propertyArea")))
        .addTo(map);

      campusMarkerRef.current = new mapboxgl.Marker({
        element: createMarkerElement("campus"),
      })
        .setLngLat(destination)
        .setPopup(
          new mapboxgl.Popup({ offset: 22 }).setText(activeRoute.destinationLabel)
        )
        .addTo(map);

      map.fitBounds(boundsFromCoordinates(coordinates), {
        padding: 70,
        maxZoom: 14,
        duration: 350,
      });
    }

    map.resize();
  }, [selectedMode, activeGeometry, mapReady, activeRoute, t]);

  return (
    <div className="rounded-3xl border border-gray-800 bg-[#070707] p-6">
      <div className="space-y-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-pink-500/15 text-pink-200">
              <MapPin size={21} aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-pink-300">
                {t("eyebrow")}
              </p>
              <h2 className="mt-1 text-2xl font-bold">{t("title")}</h2>
            </div>
          </div>
          <p className="mt-3 text-sm leading-6 text-gray-400">
            {t("description")}
          </p>
          <div className="mt-4 flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:gap-6">
            <div className="flex min-w-0 items-center gap-2">
              <Home size={16} aria-hidden="true" className="shrink-0 text-gray-500" />
              <span className="shrink-0 text-gray-500">{t("location")}:</span>
              <span className="truncate font-semibold text-white">
                {propertyArea}
              </span>
            </div>
            <div className="flex min-w-0 items-center gap-2">
              <GraduationCap
                size={16}
                aria-hidden="true"
                className="shrink-0 text-gray-500"
              />
              <span className="shrink-0 text-gray-500">
                {t("nearestCampus")}:
              </span>
              <span className="truncate font-semibold text-white">
                {campusName || t("campusMissing")}
              </span>
            </div>
          </div>
          {routeIntro && (
            <p className="mt-3 text-sm font-semibold text-pink-100">
              {routeIntro}
            </p>
          )}
        </div>

        <div>
          <p className="mb-3 text-sm font-semibold text-gray-300">
            {t("chooseMode")}
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {modes.map(({ value, icon: Icon }) => {
              const selected = selectedMode === value;

              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setSelectedMode(value)}
                  aria-pressed={selected}
                  className={`flex min-h-12 items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-bold transition focus:outline-none focus:ring-2 focus:ring-pink-300 ${
                    selected
                      ? "border-pink-400 bg-pink-500 text-white"
                      : "border-gray-800 bg-black text-gray-300 hover:border-gray-600 hover:text-white"
                  }`}
                >
                  <Icon size={17} aria-hidden="true" />
                  {t(`modes.${value}`)}
                </button>
              );
            })}
          </div>
        </div>

        {!hasCampusCoordinates ? (
          <div className="flex h-[320px] w-full items-center justify-center rounded-2xl border border-amber-500/20 bg-amber-500/10 p-5 text-center text-sm text-amber-100/80 sm:h-[380px] lg:h-[460px]">
            {t("missingCampus")}
          </div>
        ) : (
          <>
            <div className="relative w-full overflow-hidden rounded-2xl border border-slate-800 bg-black">
              <div
                ref={containerRef}
                className="h-[320px] w-full sm:h-[380px] lg:h-[460px]"
                aria-label={t("mapLabel")}
              />
              {mapError && (
                <div className="absolute inset-0 flex items-center justify-center bg-black p-6 text-center text-sm font-semibold text-red-200">
                  {mapError}
                </div>
              )}
              {loading && !mapError && (
                <div
                  className="absolute inset-0 flex items-center justify-center bg-black/45 text-sm font-semibold text-white"
                  aria-live="polite"
                >
                  {t("calculating")}
                </div>
              )}
            </div>
            {error && (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-red-200">
                      {t("routeUnavailable")}
                    </p>
                    {process.env.NODE_ENV !== "production" && error.code && (
                      <p className="mt-1 text-xs font-semibold text-red-100/70">
                        {error.code}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setRoutesByMode((previous) => {
                        const next = { ...previous };
                        delete next[selectedMode];
                        return next;
                      })
                    }
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-300/20 bg-black/30 px-4 py-2 text-sm font-bold text-red-100 hover:bg-black/50"
                  >
                    <RotateCw size={15} aria-hidden="true" />
                    {t("retry")}
                  </button>
                </div>
              </div>
            )}

            {activeRoute && (
              <div className="rounded-2xl border border-slate-800 bg-black/40 p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-lg font-bold text-white">
                      {t("routeSummary")}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-gray-400">
                      {t("fromTo", {
                        from: originLabel,
                        to: activeRoute.destinationLabel,
                      })}
                    </p>
                  </div>
                  <a
                    href={activeRoute.directionsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-black hover:bg-gray-200 sm:w-auto"
                  >
                    <Navigation size={17} aria-hidden="true" />
                    {t("openDirections")}
                  </a>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-4 border-t border-slate-800 pt-5 sm:grid-cols-3">
                  <SummaryItem
                    label={t("travelMode")}
                    value={selectedModeLabel}
                  />
                  <SummaryItem
                    label={t("distance")}
                    value={
                      transitFallbackActive
                        ? t("viewLiveRoute")
                        : activeRoute.isEstimatedRoute
                        ? t("openLiveTransitDirections")
                        : formatDistance(activeRoute.distanceMeters)
                    }
                  />
                  <SummaryItem
                    label={t("estimatedTime")}
                    value={
                      transitFallbackActive
                        ? t("checkCurrentSchedule")
                        : formatDuration(activeRoute.durationSeconds)
                    }
                  />
                </div>

                <p className="mt-4 text-xs leading-5 text-gray-500">
                  {transitFallbackActive
                    ? t("transitUnavailable")
                    : activeRoute.isEstimatedRoute && activeRoute.routeUnavailable
                    ? t("transitUnavailable")
                    : activeRoute.routeUnavailable
                    ? t("routeUnavailable")
                    : activeRoute.isEstimatedRoute
                      ? t("transitEstimate")
                      : activeRoute.originIsApproximateOnMap
                        ? t("privacyDisclaimer")
                        : t("exactAddressDisclaimer")}
                </p>
                {transitFallbackActive && (
                  <p className="mt-2 text-xs leading-5 text-gray-500">
                    {t("transitGoogleMapsHint")}
                  </p>
                )}
                {(selectedMode === "walking" || selectedMode === "cycling") &&
                  !activeRoute.routeUnavailable && (
                    <p className="mt-2 text-xs leading-5 text-gray-500">
                      {t("walkingCyclingNotice")}
                    </p>
                  )}
                {activeRoute.originIsApproximateOnMap && (
                  <p className="mt-2 text-xs leading-5 text-gray-500">
                    {t("externalDirectionsDisclaimer")}
                  </p>
                )}
                {activeRoute.mode === "transit" && transitSteps.length > 0 && (
                  <div className="mt-4 space-y-2 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    {transitSteps.slice(0, 6).map((step, index) => {
                      const line = step.transitLine
                        ? `${step.transitLine}${step.transitHeadsign ? ` ${t("toward")} ${step.transitHeadsign}` : ""}`
                        : step.instruction || t("transitStep");
                      const duration = formatDuration(step.durationSeconds ?? null);
                      const stops =
                        typeof step.stopCount === "number" && step.stopCount > 0
                          ? ` • ${t("stops", { count: step.stopCount })}`
                          : "";

                      return (
                        <div
                          key={`${step.type}-${index}`}
                          className="flex items-start justify-between gap-3 text-xs"
                        >
                          <p className="min-w-0 text-gray-300">
                            <span className="font-semibold text-white">
                              {step.type === "transit" ? t("transit") : t("walk")}
                            </span>{" "}
                            {line}
                            {stops}
                          </p>
                          <span className="shrink-0 text-gray-500">{duration}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
        {label}
      </p>
      <p className="mt-1 truncate font-semibold text-white">{value}</p>
    </div>
  );
}
