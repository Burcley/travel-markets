"use client";

import Link from "next/link";

export default function ListingCard({
  listing,
  isActive,
  onHover,
  onLeave,
}: {
  listing: any;
  isActive?: boolean;
  onHover?: () => void;
  onLeave?: () => void;
}) {
  const badge =
    listing.status === "rented"
      ? "bg-red-500/20 text-red-300"
      : listing.status === "pending"
      ? "bg-yellow-500/20 text-yellow-300"
      : "bg-green-500/20 text-green-300";

  function saveRecentlyViewed() {
    const item = {
      id: listing.id,
      title: listing.title,
      city: listing.city,
      campus: listing.campus,
      price: listing.price,
      status: listing.status,
      cover_image: listing.cover_image,
    };

    const existing = JSON.parse(
      localStorage.getItem("recentlyViewedListings") || "[]"
    );

    const filtered = existing.filter((x: any) => x.id !== listing.id);

    const updated = [item, ...filtered].slice(0, 6);

    localStorage.setItem("recentlyViewedListings", JSON.stringify(updated));
  }

  return (
    <Link
      href={`/listings/${listing.id}`}
      onClick={saveRecentlyViewed}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      className={`overflow-hidden rounded-3xl border bg-zinc-950 transition hover:-translate-y-1 ${
        isActive
          ? "border-white shadow-2xl shadow-white/10"
          : "border-zinc-800 hover:border-zinc-600"
      }`}
    >
      <div className="relative h-60 bg-zinc-900">
        {listing.cover_image ? (
          <img
            src={listing.cover_image}
            className="h-full w-full object-cover"
            alt={listing.title}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-zinc-500">
            No Image
          </div>
        )}

        <span
          className={`absolute left-4 top-4 rounded-full px-3 py-1 text-xs font-bold capitalize ${badge}`}
        >
          {listing.status || "available"}
        </span>

        <span className="absolute right-4 top-4 rounded-full bg-black/70 px-3 py-1 text-xs font-bold text-white backdrop-blur">
          Approx area
        </span>
      </div>

      <div className="p-5">
        <h2 className="line-clamp-1 text-lg font-bold">{listing.title}</h2>

        <p className="mt-2 line-clamp-1 text-sm text-zinc-400">
          {listing.city || "City hidden"}
          {listing.campus ? ` • ${listing.campus}` : ""}
        </p>

        <p className="mt-4 text-xl font-bold">
          ${listing.price || 0}
          <span className="text-sm font-normal text-zinc-400"> / month</span>
        </p>

        <p className="mt-3 text-xs text-zinc-500">
          Exact address hidden until owner approval.
        </p>
      </div>
    </Link>
  );
}