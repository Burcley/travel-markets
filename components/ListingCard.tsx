"use client";

import Link from "next/link";
import { Crown, ShieldCheck, Sparkles, Star } from "lucide-react";

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
  const statusBadge =
    listing.status === "rented"
      ? "bg-red-500/20 text-red-300"
      : listing.status === "pending"
      ? "bg-yellow-500/20 text-yellow-300"
      : "bg-green-500/20 text-green-300";

  const ownerPlan = listing.owner_plan || "free";
  const ownerBadge = listing.owner_badge;

  const trustScore = listing.owner_trust_score ?? listing.trust_score ?? null;
  const trustLevel = listing.owner_trust_level ?? listing.trust_level ?? "new";
  const ownerVerified =
    listing.owner_is_verified ??
    listing.is_verified ??
    listing.identity_verified ??
    false;

  const trustLabel =
    trustLevel === "elite"
      ? "Elite Owner"
      : trustLevel === "trusted"
      ? "Trusted Owner"
      : trustLevel === "basic"
      ? "Basic Trust"
      : "New Owner";

  const trustClass =
    trustLevel === "elite"
      ? "bg-emerald-400 text-black"
      : trustLevel === "trusted"
      ? "bg-emerald-500/20 text-emerald-300"
      : trustLevel === "basic"
      ? "bg-blue-500/20 text-blue-300"
      : "bg-zinc-700/80 text-zinc-300";

  function saveRecentlyViewed() {
    const item = {
      id: listing.id,
      title: listing.title,
      city: listing.city,
      campus: listing.campus,
      price: listing.price,
      status: listing.status,
      cover_image:
        listing.cover_image || listing.cover_image_url || listing.image_url,
      owner_plan: ownerPlan,
      owner_badge: ownerBadge,
      is_featured: listing.is_featured,
      owner_trust_score: trustScore,
      owner_trust_level: trustLevel,
      owner_is_verified: ownerVerified,
    };

    const existing = JSON.parse(
      localStorage.getItem("recentlyViewedListings") || "[]"
    );

    const filtered = existing.filter((x: any) => x.id !== listing.id);
    const updated = [item, ...filtered].slice(0, 6);

    localStorage.setItem("recentlyViewedListings", JSON.stringify(updated));
  }

  const image =
    listing.cover_image || listing.cover_image_url || listing.image_url || null;

  return (
    <Link
      href={`/listings/${listing.id}`}
      onClick={saveRecentlyViewed}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      className={`group overflow-hidden rounded-3xl border bg-zinc-950 transition hover:-translate-y-1 ${
        isActive
          ? "border-white shadow-2xl shadow-white/10"
          : "border-zinc-800 hover:border-zinc-600"
      }`}
    >
      <div className="relative h-60 bg-zinc-900">
        {image ? (
          <img
            src={image}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
            alt={listing.title || "Travel Markets listing"}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-zinc-500">
            No Image
          </div>
        )}

        <div className="absolute left-4 top-4 flex flex-wrap gap-2">
          <span
            className={`rounded-full px-3 py-1 text-xs font-bold capitalize backdrop-blur ${statusBadge}`}
          >
            {listing.status || "available"}
          </span>

          {listing.is_featured && (
            <span className="rounded-full bg-yellow-400 px-3 py-1 text-xs font-black text-black">
              Featured
            </span>
          )}
        </div>

        <span className="absolute right-4 top-4 rounded-full bg-black/70 px-3 py-1 text-xs font-bold text-white backdrop-blur">
          Approx area
        </span>

        <div className="absolute bottom-4 left-4 flex flex-wrap gap-2">
          {ownerBadge && (
            <div
              className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-black shadow-xl backdrop-blur ${
                ownerPlan === "premium"
                  ? "bg-yellow-400 text-black"
                  : "bg-purple-500 text-white"
              }`}
            >
              {ownerPlan === "premium" ? (
                <Crown size={14} />
              ) : (
                <Sparkles size={14} />
              )}
              {ownerBadge}
            </div>
          )}

          <div
            className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-black shadow-xl backdrop-blur ${trustClass}`}
          >
            {ownerVerified ? <ShieldCheck size={14} /> : <Star size={14} />}
            {trustLabel}
            {trustScore !== null && (
              <span className="opacity-80">{trustScore}/100</span>
            )}
          </div>
        </div>
      </div>

      <div className="p-5">
        <h2 className="line-clamp-1 text-lg font-bold">{listing.title}</h2>

        <p className="mt-2 line-clamp-1 text-sm text-zinc-400">
          {listing.city || "City hidden"}
          {listing.campus ? ` • ${listing.campus}` : ""}
        </p>

        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-xl font-bold">
            ${listing.price || 0}
            <span className="text-sm font-normal text-zinc-400"> / month</span>
          </p>

          {ownerVerified && (
            <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-300">
              ✓ Verified
            </span>
          )}
        </div>

        <p className="mt-3 text-xs text-zinc-500">
          Exact address hidden until owner approval.
        </p>
      </div>
    </Link>
  );
}