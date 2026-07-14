"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useTranslations } from "next-intl";
import mapboxgl from "mapbox-gl";
import { HomeListing } from "@/types/home-listing";
import { usePreferences } from "@/components/preferences/PreferencesProvider";
import { formatMoney } from "@/lib/currency";
import type { CurrencyCode } from "@/lib/currency";

type Props = {
  listings: HomeListing[];
  activeListingId: string | null;
  setActiveListingId: (id: string | null) => void;
  onViewportListingsChange?: (listings: HomeListing[]) => void;
  query?: string;
  city?: string;
  campus?: string;
};

type ListingFeature = GeoJSON.Feature<
  GeoJSON.Point,
  {
    id: string;
    title: string;
    city: string;
    campus: string;
    price: number | null;
    image_url: string | null;
    owner_plan: string;
    owner_badge: string | null;
    is_featured: boolean;
    priceLabel: string;
    markerPriceLabel: string;
  }
>;

const SOURCE_ID = "travel-markets-listings";
const CLUSTER_LAYER_ID = "travel-markets-clusters";
const CLUSTER_COUNT_LAYER_ID = "travel-markets-cluster-count";
const POINT_BG_LAYER_ID = "travel-markets-point-bg";
const POINT_TEXT_LAYER_ID = "travel-markets-point-text";

const EMPTY_GEOJSON: GeoJSON.FeatureCollection<GeoJSON.Point> = {
  type: "FeatureCollection",
  features: [],
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export default function ListingMap({
  listings,
  activeListingId,
  setActiveListingId,
  onViewportListingsChange,
  query,
  city,
  campus,
}: Props) {
  const t = useTranslations("home.map");
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const popupRef = useRef<mapboxgl.Popup | null>(null);
  const hoveredFeatureIdRef = useRef<string | null>(null);
  const selectedFeatureIdRef = useRef<string | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const geoJsonRef = useRef<GeoJSON.FeatureCollection<GeoJSON.Point>>(EMPTY_GEOJSON);
  const mapListingsRef = useRef<HomeListing[]>([]);
  const listingFitKeyRef = useRef("");
  const lastFitKeyRef = useRef("");
  const { currency, convertFromCAD } = usePreferences();

  const getPopupPriceLabel = useCallback((amountCAD: number | null | undefined) => {
    if (amountCAD == null) return t("askForPrice");

    const converted = convertFromCAD(Number(amountCAD));

    if (!Number.isFinite(converted)) return t("askForPrice");

    return `${formatMoney(converted, currency as CurrencyCode)}/mo`;
  }, [convertFromCAD, currency, t]);

  const getMarkerPriceLabel = useCallback((amountCAD: number | null | undefined) => {
    if (amountCAD == null) return t("ask");

    const converted = convertFromCAD(Number(amountCAD));

    if (!Number.isFinite(converted)) return t("ask");

    return new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency: currency as CurrencyCode,
      currencyDisplay: "narrowSymbol",
      notation: "compact",
      maximumFractionDigits: 1,
    })
      .format(converted)
      .replace(/\s/g, "");
  }, [convertFromCAD, currency, t]);

  const mapListings = useMemo(() => {
    return listings.filter((item) => {
      const latitude = Number(item.latitude);
      const longitude = Number(item.longitude);
      const isValid =
        Number.isFinite(latitude) &&
        Number.isFinite(longitude) &&
        latitude >= -90 &&
        latitude <= 90 &&
        longitude >= -180 &&
        longitude <= 180;

      if (!isValid && process.env.NODE_ENV !== "production") {
        console.warn("Skipping invalid public map marker", {
          listingId: item.id,
          hasLatitude: Number.isFinite(latitude),
          hasLongitude: Number.isFinite(longitude),
        });
      }

      return isValid;
    });
  }, [listings]);

  const listingFitKey = useMemo(
    () =>
      mapListings
        .map((listing) => `${listing.id}:${listing.latitude}:${listing.longitude}`)
        .sort()
        .join("|"),
    [mapListings]
  );

  const geoJson = useMemo<GeoJSON.FeatureCollection<GeoJSON.Point>>(() => {
    const features: ListingFeature[] = mapListings.map((listing) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [listing.longitude!, listing.latitude!],
      },
      properties: {
        id: listing.id,
        title: listing.title || t("untitledListing"),
        city: listing.city || t("locationPreview"),
        campus: listing.campus || "",
        price: listing.price ?? null,
        image_url: listing.image_url || null,
        owner_plan: listing.owner_plan || "free",
        owner_badge: listing.owner_badge || null,
        is_featured: Boolean(listing.is_featured),
        priceLabel: getPopupPriceLabel(listing.price),
        markerPriceLabel: getMarkerPriceLabel(listing.price),
      },
    }));

    return {
      type: "FeatureCollection",
      features,
    };
  }, [mapListings, getMarkerPriceLabel, getPopupPriceLabel, t]);

  useEffect(() => {
    geoJsonRef.current = geoJson;
  }, [geoJson]);

  useEffect(() => {
    mapListingsRef.current = mapListings;

    if (
      selectedFeatureIdRef.current &&
      !mapListings.some((listing) => listing.id === selectedFeatureIdRef.current)
    ) {
      selectedFeatureIdRef.current = null;
      popupRef.current?.remove();
      setActiveListingId(null);
    }
  }, [mapListings, setActiveListingId]);

  useEffect(() => {
    listingFitKeyRef.current = listingFitKey;
  }, [listingFitKey]);

  const fitMapToListings = useCallback(
    (map: mapboxgl.Map, listingsToFit: HomeListing[], fitKey: string) => {
      if (listingsToFit.length === 0) return;
      if (lastFitKeyRef.current === fitKey) return;

      const bounds = new mapboxgl.LngLatBounds();

      listingsToFit.forEach((listing) => {
        bounds.extend([listing.longitude!, listing.latitude!]);
      });

      if (bounds.isEmpty()) return;

      lastFitKeyRef.current = fitKey;
      map.resize();
      map.fitBounds(bounds, {
        padding: 70,
        maxZoom: 13,
        duration: 500,
      });
    },
    []
  );

  const createPopupHtml = useCallback((properties: ListingFeature["properties"]) => {
    const title = escapeHtml(properties.title || t("untitledListing"));
    const cityText = escapeHtml(properties.city || t("locationPreview"));
    const campusText = escapeHtml(properties.campus || "");
    const imageUrl = properties.image_url;
    const price = escapeHtml(properties.priceLabel || t("askForPrice"));

    const featuredBadge = properties.is_featured
      ? `<div style="margin-top:8px;display:inline-block;border-radius:999px;background:#facc15;color:#000;padding:5px 9px;font-size:11px;font-weight:900">⭐ ${escapeHtml(t("featuredListing"))}</div>`
      : "";

    const planBadge =
      properties.owner_plan === "elite" || properties.owner_plan === "legacy_premium"
        ? `<div style="margin-top:8px;display:inline-block;border-radius:999px;background:#a855f7;color:#fff;padding:5px 9px;font-size:11px;font-weight:900">👑 Elite Property Manager</div>`
        : properties.owner_plan === "premium"
        ? `<div style="margin-top:8px;display:inline-block;border-radius:999px;background:#facc15;color:#000;padding:5px 9px;font-size:11px;font-weight:900">⚡ Premium Landlord</div>`
        : "";

    return `
      <div style="background:#080808;color:white;border-radius:18px;overflow:hidden;width:240px;border:1px solid rgba(255,255,255,.12);box-shadow:0 24px 80px rgba(0,0,0,.45)">
        ${
          imageUrl
            ? `<img src="${imageUrl}" style="width:100%;height:125px;object-fit:cover" />`
            : `<div style="height:125px;background:#171717;display:flex;align-items:center;justify-content:center;color:#777">${escapeHtml(t("noImage"))}</div>`
        }

        <div style="padding:13px">
          <div style="display:flex;flex-wrap:wrap;gap:6px">
            ${featuredBadge}
            ${planBadge}
          </div>

          <div style="margin-top:10px;font-weight:800;font-size:14px;line-height:1.35">${title}</div>

          <div style="margin-top:7px;color:#aaa;font-size:12px">
            ${cityText}${campusText ? ` • ${campusText}` : ""}
          </div>

          <div style="margin-top:9px;font-weight:900;font-size:14px">${price}</div>

          <div style="margin-top:9px;color:#777;font-size:11px;line-height:1.4">${escapeHtml(t("exactAddressHidden"))}</div>
        </div>
      </div>
    `;
  }, [t]);

  const fetchViewportListings = useCallback(async () => {
    if (!mapRef.current || !onViewportListingsChange) return;

    const bounds = mapRef.current.getBounds();

    if (!bounds) return;

    try {
      const params = new URLSearchParams();

      params.set("north", String(bounds.getNorth()));
      params.set("south", String(bounds.getSouth()));
      params.set("east", String(bounds.getEast()));
      params.set("west", String(bounds.getWest()));

      if (query) params.set("q", query);
      if (city) params.set("city", city);
      if (campus) params.set("campus", campus);

      const response = await fetch(`/api/map-search?${params.toString()}`);

      if (!response.ok) return;

      const data = await response.json();

      if (Array.isArray(data.listings)) {
        onViewportListingsChange(data.listings);
      }
    } catch (error) {
      console.error("VIEWPORT FETCH ERROR:", error);
    }
  }, [campus, city, onViewportListingsChange, query]);

  const addMapLayers = useCallback((map: mapboxgl.Map) => {
    if (map.getSource(SOURCE_ID)) return;

    map.addSource(SOURCE_ID, {
      type: "geojson",
      data: geoJsonRef.current,
      cluster: false,
    });

    map.addLayer({
      id: CLUSTER_LAYER_ID,
      type: "circle",
      source: SOURCE_ID,
      filter: ["has", "point_count"],
      paint: {
        "circle-color": [
          "step",
          ["get", "point_count"],
          "#ffffff",
          10,
          "#f8fafc",
          30,
          "#e2e8f0",
        ],
        "circle-radius": [
          "step",
          ["get", "point_count"],
          22,
          10,
          28,
          30,
          36,
        ],
        "circle-stroke-width": 2,
        "circle-stroke-color": "rgba(0,0,0,0.35)",
      },
    });

    map.addLayer({
      id: CLUSTER_COUNT_LAYER_ID,
      type: "symbol",
      source: SOURCE_ID,
      filter: ["has", "point_count"],
      layout: {
        "text-field": ["get", "point_count_abbreviated"],
        "text-size": 13,
        "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
      },
      paint: {
        "text-color": "#000000",
      },
    });

    map.addLayer({
      id: POINT_BG_LAYER_ID,
      type: "circle",
      source: SOURCE_ID,
      filter: ["!", ["has", "point_count"]],
      paint: {
        "circle-radius": [
          "case",
          ["==", ["get", "id"], ""],
          22,
          ["==", ["get", "is_featured"], true],
          21,
          ["==", ["get", "owner_plan"], "elite"],
          20,
          ["==", ["get", "owner_plan"], "legacy_premium"],
          20,
          ["==", ["get", "owner_plan"], "premium"],
          19,
          17,
        ],
        "circle-color": [
          "case",
          ["==", ["get", "is_featured"], true],
          "#facc15",
          ["==", ["get", "owner_plan"], "elite"],
          "#a855f7",
          ["==", ["get", "owner_plan"], "legacy_premium"],
          "#a855f7",
          ["==", ["get", "owner_plan"], "premium"],
          "#eab308",
          "#ffffff",
        ],
        "circle-stroke-width": [
          "case",
          ["==", ["get", "id"], ""],
          4,
          2,
        ],
        "circle-stroke-color": [
          "case",
          ["==", ["get", "id"], ""],
          "#38bdf8",
          "rgba(0,0,0,0.45)",
        ],
      },
    });

    map.addLayer({
      id: POINT_TEXT_LAYER_ID,
      type: "symbol",
      source: SOURCE_ID,
      filter: ["!", ["has", "point_count"]],
      layout: {
        "text-field": [
          "case",
          ["has", "markerPriceLabel"],
          ["get", "markerPriceLabel"],
          t("view"),
        ],
        "text-size": 12,
        "text-font": ["DIN Offc Pro Bold", "Arial Unicode MS Bold"],
        "text-allow-overlap": true,
        "text-ignore-placement": true,
      },
      paint: {
        "text-color": [
          "case",
          ["==", ["get", "owner_plan"], "elite"],
          "#ffffff",
          ["==", ["get", "owner_plan"], "legacy_premium"],
          "#ffffff",
          "#000000",
        ],
      },
    });

    map.on("moveend", () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      debounceRef.current = setTimeout(() => {
        fetchViewportListings();
      }, 350);
    });

    function openListingPopup(
      properties: ListingFeature["properties"],
      coordinates: [number, number],
      closeOnClick = false
    ) {
      popupRef.current?.remove();

      popupRef.current = new mapboxgl.Popup({
        offset: 22,
        closeButton: false,
        closeOnClick,
        className: "travel-markets-popup",
      })
        .setLngLat(coordinates)
        .setHTML(createPopupHtml(properties))
        .addTo(map);
    }

    function getPointData(event: mapboxgl.MapLayerMouseEvent) {
      const feature = event.features?.[0];
      const properties = feature?.properties as ListingFeature["properties"];

      if (
        !properties?.id ||
        !feature?.geometry ||
        feature.geometry.type !== "Point"
      ) {
        return null;
      }

      return {
        properties,
        coordinates: feature.geometry.coordinates as [number, number],
      };
    }

    map.on("mouseenter", POINT_BG_LAYER_ID, (event) => {
      map.getCanvas().style.cursor = "pointer";

      const point = getPointData(event);

      if (!point) return;

      hoveredFeatureIdRef.current = point.properties.id;
      setActiveListingId(point.properties.id);

      openListingPopup(point.properties, point.coordinates);
    });

    map.on("mouseleave", POINT_BG_LAYER_ID, () => {
      map.getCanvas().style.cursor = "";
      hoveredFeatureIdRef.current = null;
      setActiveListingId(selectedFeatureIdRef.current);

      if (!selectedFeatureIdRef.current) {
        popupRef.current?.remove();
      }
    });

    map.on("mouseenter", POINT_TEXT_LAYER_ID, (event) => {
      map.getCanvas().style.cursor = "pointer";

      const point = getPointData(event);

      if (!point) return;

      hoveredFeatureIdRef.current = point.properties.id;
      setActiveListingId(point.properties.id);

      openListingPopup(point.properties, point.coordinates);
    });

    map.on("mouseleave", POINT_TEXT_LAYER_ID, () => {
      map.getCanvas().style.cursor = "";
      hoveredFeatureIdRef.current = null;
      setActiveListingId(selectedFeatureIdRef.current);

      if (!selectedFeatureIdRef.current) {
        popupRef.current?.remove();
      }
    });

    map.on("click", CLUSTER_LAYER_ID, (event) => {
      const features = map.queryRenderedFeatures(event.point, {
        layers: [CLUSTER_LAYER_ID],
      });

      const clusterId = features[0]?.properties?.cluster_id;

      const source = map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource;

      source.getClusterExpansionZoom(clusterId, (error, zoom) => {
        if (error || zoom == null) return;

        const coordinates = (features[0].geometry as GeoJSON.Point)
          .coordinates as [number, number];

        map.easeTo({
          center: coordinates,
          zoom,
          duration: 650,
        });
      });
    });

    map.on("click", POINT_BG_LAYER_ID, (event) => {
      const point = getPointData(event);
      if (!point) return;

      selectedFeatureIdRef.current = point.properties.id;
      setActiveListingId(point.properties.id);
      openListingPopup(point.properties, point.coordinates, true);
      map.easeTo({
        center: point.coordinates,
        zoom: Math.max(map.getZoom(), 12),
        duration: 500,
      });
    });

    map.on("click", POINT_TEXT_LAYER_ID, (event) => {
      const point = getPointData(event);
      if (!point) return;

      selectedFeatureIdRef.current = point.properties.id;
      setActiveListingId(point.properties.id);
      openListingPopup(point.properties, point.coordinates, true);
      map.easeTo({
        center: point.coordinates,
        zoom: Math.max(map.getZoom(), 12),
        duration: 500,
      });
    });
  }, [createPopupHtml, fetchViewportListings, setActiveListingId, t]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [-79.3832, 43.6532],
      zoom: 9,
      pitch: 25,
    });

    mapRef.current = map;
    map.addControl(new mapboxgl.NavigationControl(), "top-right");

    map.on("load", () => {
      addMapLayers(map);
      const source = map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource | null;
      source?.setData(geoJsonRef.current);
      fitMapToListings(map, mapListingsRef.current, listingFitKeyRef.current);
      map.resize();
    });

    return () => {
      popupRef.current?.remove();

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      map.remove();
      mapRef.current = null;
    };
  }, [addMapLayers, fitMapToListings]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map) return;

    if (map.loaded() && !map.getSource(SOURCE_ID)) {
      addMapLayers(map);
    }

    const source = map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource | null;

    if (!source) return;

    source.setData(geoJson);
  }, [addMapLayers, geoJson]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map || !map.loaded() || mapListings.length === 0) return;
    if (lastFitKeyRef.current === listingFitKey) return;

    fitMapToListings(map, mapListings, listingFitKey);
  }, [fitMapToListings, listingFitKey, mapListings]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map || !map.getLayer(POINT_BG_LAYER_ID)) return;

    map.setPaintProperty(POINT_BG_LAYER_ID, "circle-radius", [
      "case",
      ["==", ["get", "id"], activeListingId || ""],
      22,
      ["==", ["get", "is_featured"], true],
      21,
      ["==", ["get", "owner_plan"], "elite"],
      20,
      ["==", ["get", "owner_plan"], "legacy_premium"],
      20,
      ["==", ["get", "owner_plan"], "premium"],
      19,
      17,
    ]);

    map.setPaintProperty(POINT_BG_LAYER_ID, "circle-stroke-width", [
      "case",
      ["==", ["get", "id"], activeListingId || ""],
      4,
      2,
    ]);

    map.setPaintProperty(POINT_BG_LAYER_ID, "circle-stroke-color", [
      "case",
      ["==", ["get", "id"], activeListingId || ""],
      "#38bdf8",
      "rgba(0,0,0,0.45)",
    ]);

    if (!activeListingId || hoveredFeatureIdRef.current === activeListingId) {
      return;
    }

    const listing = mapListings.find((item) => item.id === activeListingId);

    if (!listing?.latitude || !listing?.longitude) return;

    map.easeTo({
      center: [listing.longitude, listing.latitude],
      zoom: Math.max(map.getZoom(), 12),
      duration: 550,
    });
  }, [activeListingId, mapListings]);

  return (
    <div className="relative h-[520px] overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] shadow-2xl lg:h-full">
      <div ref={containerRef} className="h-full w-full" />

      {mapListings.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="rounded-2xl bg-black/70 px-4 py-3 text-sm text-white/70 backdrop-blur">
            {t("noMapLocations")}
          </div>
        </div>
      )}

      <div className="pointer-events-none absolute bottom-4 left-4 rounded-2xl border border-white/10 bg-black/70 p-3 text-xs text-white/80 backdrop-blur">
        <div className="mb-2 font-bold text-white">{t("mapPriority")}</div>
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-yellow-400" />
          {t("featuredPremium")}
        </div>
        <div className="mt-1 flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-purple-500" />
          Elite Property Manager
        </div>
        <div className="mt-1 flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-yellow-600" />
          Premium Landlord
        </div>
        <div className="mt-1 flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-white" />
          {t("freeOwner")}
        </div>
      </div>
    </div>
  );
}
