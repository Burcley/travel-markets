"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

type ListingMapProps = {
  listings: any[];
  hoveredListingId?: string | null;
};

export default function ListingMap({
  listings,
  hoveredListingId,
}: ListingMapProps) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const leafletMapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current) return;

    if (leafletMapRef.current) {
      leafletMapRef.current.remove();
      leafletMapRef.current = null;
    }

    const mapListings = listings.filter(
      (listing) =>
        listing.latitude !== null &&
        listing.latitude !== undefined &&
        listing.longitude !== null &&
        listing.longitude !== undefined
    );

    const center: [number, number] =
      mapListings.length > 0
        ? [Number(mapListings[0].latitude), Number(mapListings[0].longitude)]
        : [43.8971, -78.8658];

    const map = L.map(mapRef.current, {
      center,
      zoom: 12,
      zoomControl: false,
      scrollWheelZoom: true,
    });

    leafletMapRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap",
    }).addTo(map);

    mapListings.forEach((listing) => {
      const isActive = hoveredListingId === listing.id;

      const priceIcon = L.divIcon({
        className: "",
        html: `
          <div style="
            background:${isActive ? "#ff2d5f" : "#111111"};
            color:white;
            padding:10px 16px;
            border-radius:999px;
            font-weight:800;
            font-size:13px;
            border:1px solid rgba(255,255,255,0.25);
            box-shadow:0 12px 35px rgba(0,0,0,0.45);
            white-space:nowrap;
          ">
            $${listing.price || 0}
          </div>
        `,
        iconSize: [90, 40],
        iconAnchor: [45, 20],
      });

      L.marker([Number(listing.latitude), Number(listing.longitude)], {
        icon: priceIcon,
      })
        .addTo(map)
        .bindPopup(`
          <div style="width:230px">
            ${
              listing.cover_image
                ? `<img src="${listing.cover_image}" style="width:100%;height:120px;object-fit:cover;border-radius:14px;margin-bottom:10px" />`
                : ""
            }
            <strong style="font-size:16px">${listing.title}</strong>
            <p style="margin:6px 0;color:#666">${listing.city || "Area hidden"} ${
              listing.campus ? `• ${listing.campus}` : ""
            }</p>
            <p style="font-weight:800;font-size:17px">$${listing.price || 0}/month</p>
            <p style="font-size:12px;color:#777">Exact address hidden until owner approval.</p>
            <a href="/listings/${listing.id}" style="display:block;margin-top:10px;background:#000;color:#fff;text-align:center;padding:10px;border-radius:12px;text-decoration:none;font-weight:700">
              View listing
            </a>
          </div>
        `);
    });

    setTimeout(() => {
      map.invalidateSize();
    }, 200);

    return () => {
      map.remove();
      leafletMapRef.current = null;
    };
  }, [listings, hoveredListingId]);

  return (
    <section className="relative h-full w-full overflow-hidden rounded-[2rem] bg-zinc-950">
      <div className="pointer-events-none absolute left-4 top-4 z-[1000] max-w-xs rounded-2xl border border-white/10 bg-black/85 px-4 py-3 text-white shadow-2xl backdrop-blur-xl">
        <p className="text-sm font-bold">Approximate location map</p>
        <p className="mt-1 text-xs text-zinc-300">
          Price markers stay locked to approximate coordinates.
        </p>
      </div>

      <div ref={mapRef} className="h-full w-full" />
    </section>
  );
}