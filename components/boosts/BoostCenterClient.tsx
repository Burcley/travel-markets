"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { CalendarDays, ExternalLink, Rocket, ShoppingBag, X, Zap } from "lucide-react";
import { sourceLabel, type BoostOptionSlug } from "@/lib/boosts/config";

export type BoostCenterSummary = {
  includedAvailable: number;
  includedUsed: number;
  includedTotal: number;
  purchasedAvailable: number;
  nextResetDate: string | null;
  plan: string;
};

export type BoostCenterListing = {
  id: string;
  title: string;
  location: string;
  status: string;
  imageUrl: string | null;
  views: number;
  inquiries: number;
  isEligible: boolean;
  ineligibleReason: string | null;
  activeBoost: {
    id: string | null;
    source: string | null;
    durationDays: number | null;
    startedAt: string | null;
    expiresAt: string | null;
  } | null;
};

type PurchaseOption = {
  slug: BoostOptionSlug;
  durationDays: number;
  name: string;
  priceLabel: string;
};

function formatDate(date: string | null) {
  if (!date) return "Not available";

  return new Intl.DateTimeFormat("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
}

function timeRemaining(date: string | null) {
  if (!date) return "";

  const diff = new Date(date).getTime() - Date.now();
  if (diff <= 0) return "Expired";

  const days = Math.ceil(diff / 86400000);
  return `${days} day${days === 1 ? "" : "s"} remaining`;
}

export default function BoostCenterClient({
  summary,
  listings,
  purchaseOptions,
}: {
  summary: BoostCenterSummary;
  listings: BoostCenterListing[];
  purchaseOptions: PurchaseOption[];
}) {
  const [localSummary, setLocalSummary] = useState(summary);
  const [localListings, setLocalListings] = useState(listings);
  const [selectedListing, setSelectedListing] =
    useState<BoostCenterListing | null>(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");

  const activeBoosts = useMemo(
    () => localListings.filter((listing) => listing.activeBoost),
    [localListings]
  );
  const hasListings = localListings.length > 0;
  const hasActiveListings = localListings.some((listing) =>
    ["available", "pending"].includes(listing.status)
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSelectedListing(null);
      }
    }

    if (selectedListing) {
      document.addEventListener("keydown", onKeyDown);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [selectedListing]);

  async function activateIncludedBoost() {
    if (!selectedListing) return;

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/listings/boost/included", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          listingId: selectedListing.id,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "We could not boost this listing.");
      }

      const expiresAt = String(data.expiresAt || "");
      setLocalSummary((current) => ({
        ...current,
        includedAvailable: Math.max(0, Number(data.remaining ?? 0)),
        includedUsed: Math.min(
          current.includedTotal,
          current.includedUsed + 1
        ),
      }));
      setLocalListings((current) =>
        current.map((listing) =>
          listing.id === selectedListing.id
            ? {
                ...listing,
                isEligible: false,
                ineligibleReason: "Boost active",
                activeBoost: {
                  id: data.boostId || null,
                  source: "included",
                  durationDays: 7,
                  startedAt: new Date().toISOString(),
                  expiresAt,
                },
              }
            : listing
        )
      );
      setSelectedListing(null);
      setToast(
        "Listing boosted successfully. It will receive increased visibility for 7 days."
      );
    } catch (activationError) {
      setError(
        activationError instanceof Error
          ? activationError.message
          : "We could not boost this listing."
      );
    } finally {
      setLoading(false);
    }
  }

  async function purchaseBoost(option: PurchaseOption, listing = selectedListing) {
    if (!listing) return;

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/listings/boost/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          listingId: listing.id,
          option: option.slug,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "We could not start boost checkout.");
      }

      if (!data.url) {
        throw new Error("Stripe did not return a checkout URL.");
      }

      window.location.href = data.url;
    } catch (purchaseError) {
      setError(
        purchaseError instanceof Error
          ? purchaseError.message
          : "We could not start boost checkout."
      );
      setLoading(false);
    }
  }

  return (
    <div>
      {toast && (
        <div className="mb-5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">
          {toast}
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-4">
        <SummaryCard
          icon={<Zap />}
          title="Included monthly boosts"
          value={
            localSummary.includedTotal > 0
              ? `${localSummary.includedAvailable} available`
              : "No monthly boosts included"
          }
        />
        <SummaryCard
          icon={<Rocket />}
          title="Used this billing cycle"
          value={`${localSummary.includedUsed} of ${localSummary.includedTotal}`}
        />
        <SummaryCard
          icon={<ShoppingBag />}
          title="Purchased boosts"
          value={`${localSummary.purchasedAvailable} available`}
        />
        <SummaryCard
          icon={<CalendarDays />}
          title="Next reset"
          value={formatDate(localSummary.nextResetDate)}
        />
      </section>

      <section className="mt-8 rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-black">Active boosts</h2>
            <p className="mt-1 text-sm text-slate-400">
              Listings currently receiving increased visibility.
            </p>
          </div>
          <a
            href="#eligible-listings"
            className="rounded-2xl bg-white px-5 py-3 text-sm font-bold text-black"
          >
            Choose a listing
          </a>
        </div>

        {activeBoosts.length === 0 ? (
          <EmptyState
            title="No active boosts yet."
            text="Promote one of your active listings to increase its visibility."
            href="#eligible-listings"
            action="Choose a listing"
          />
        ) : (
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {activeBoosts.map((listing) => (
              <BoostCard key={listing.id} listing={listing} />
            ))}
          </div>
        )}
      </section>

      <section
        id="eligible-listings"
        className="mt-8 rounded-[2rem] border border-white/10 bg-white/[0.04] p-5"
      >
        <h2 className="text-2xl font-black">Eligible listings</h2>
        <p className="mt-1 text-sm text-slate-400">
          Pick an active listing to promote.
        </p>

        {!hasListings ? (
          <EmptyState
            title="You need an active listing before you can use a boost."
            text="Create and publish a listing to promote it."
            href="/post"
            action="Create Listing"
          />
        ) : !hasActiveListings ? (
          <EmptyState
            title="Publish a listing before promoting it."
            text="Draft and inactive listings cannot be boosted."
            href="/my-listings"
            action="Manage Listings"
          />
        ) : (
          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            {localListings.map((listing) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                onBoost={() => setSelectedListing(listing)}
              />
            ))}
          </div>
        )}
      </section>

      <section className="mt-8 rounded-[2rem] border border-yellow-400/20 bg-yellow-400/10 p-5">
        <h2 className="text-2xl font-black">Purchase more boosts</h2>
        <p className="mt-2 text-sm text-yellow-100/75">
          If you have used all included boosts this cycle, purchase a separate
          boost for any eligible listing.
        </p>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {purchaseOptions.map((option) => (
            <div
              key={option.slug}
              className="rounded-2xl border border-yellow-300/20 bg-black/30 p-4"
            >
              <p className="font-bold">{option.name}</p>
              <p className="mt-1 text-sm text-yellow-100/70">
                {option.priceLabel}
              </p>
              <p className="mt-3 text-xs text-yellow-100/50">
                Choose a listing above to purchase this boost.
              </p>
            </div>
          ))}
        </div>
      </section>

      {localSummary.includedTotal === 0 && (
        <section className="mt-8 rounded-[2rem] border border-pink-400/20 bg-pink-500/10 p-5">
          <h2 className="text-xl font-black">
            Monthly boosts are included with Premium and Elite.
          </h2>
          <Link
            href="/billing"
            className="mt-4 inline-flex rounded-2xl bg-white px-5 py-3 text-sm font-bold text-black"
          >
            View Plans
          </Link>
        </section>
      )}

      {selectedListing && (
        <div
          className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/80 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="boost-modal-title"
        >
          <div className="w-full max-w-lg rounded-[2rem] border border-white/10 bg-[#080808] p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="boost-modal-title" className="text-2xl font-black">
                  Boost this listing?
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Your listing will receive increased visibility in search and
                  recommendations for 7 days.
                </p>
              </div>
              <button
                onClick={() => setSelectedListing(null)}
                className="rounded-full bg-white p-2 text-black"
                aria-label="Close boost modal"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-5 flex gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
              <div className="h-20 w-24 shrink-0 overflow-hidden rounded-xl bg-slate-900">
                {selectedListing.imageUrl ? (
                  <img
                    src={selectedListing.imageUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : null}
              </div>
              <div>
                <p className="font-bold">{selectedListing.title}</p>
                <p className="mt-1 text-sm text-slate-400">
                  {selectedListing.location}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  Expires around {formatDate(new Date(Date.now() + 7 * 86400000).toISOString())}
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <InfoPill
                label="Included boosts remaining"
                value={`${localSummary.includedAvailable}/${localSummary.includedTotal}`}
              />
              <InfoPill label="Next reset" value={formatDate(localSummary.nextResetDate)} />
            </div>

            {error && (
              <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
                {error}
              </div>
            )}

            <div className="mt-6 space-y-3">
              {localSummary.includedAvailable > 0 ? (
                <button
                  onClick={activateIncludedBoost}
                  disabled={loading}
                  className="w-full rounded-2xl bg-yellow-400 px-5 py-4 font-black text-black hover:bg-yellow-300 disabled:opacity-60"
                >
                  {loading ? "Activating..." : "Use 1 Included Boost"}
                </button>
              ) : (
                <div className="rounded-2xl border border-yellow-400/20 bg-yellow-500/10 p-4 text-sm text-yellow-100/80">
                  You have used all included boosts for this billing cycle.
                </div>
              )}

              {localSummary.includedAvailable <= 0 && (
                <div className="grid gap-2 sm:grid-cols-3">
                  {purchaseOptions.map((option) => (
                    <button
                      key={option.slug}
                      onClick={() => purchaseBoost(option)}
                      disabled={loading}
                      className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm font-bold text-white hover:bg-white/10 disabled:opacity-60"
                    >
                      {option.durationDays} days
                    </button>
                  ))}
                </div>
              )}

              <button
                onClick={() => setSelectedListing(null)}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-bold text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  icon,
  title,
  value,
}: {
  icon: ReactNode;
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
      <div className="flex items-center gap-3 text-pink-200">{icon}</div>
      <p className="mt-4 text-sm text-slate-400">{title}</p>
      <p className="mt-2 text-2xl font-black">{value}</p>
    </div>
  );
}

function EmptyState({
  title,
  text,
  href,
  action,
}: {
  title: string;
  text: string;
  href: string;
  action: string;
}) {
  return (
    <div className="mt-5 rounded-3xl border border-white/10 bg-black/30 p-8 text-center">
      <p className="text-xl font-bold">{title}</p>
      <p className="mx-auto mt-2 max-w-lg text-sm text-slate-400">{text}</p>
      <Link
        href={href}
        className="mt-5 inline-flex rounded-2xl bg-white px-5 py-3 text-sm font-bold text-black"
      >
        {action}
      </Link>
    </div>
  );
}

function BoostCard({ listing }: { listing: BoostCenterListing }) {
  const boost = listing.activeBoost;

  return (
    <article className="flex gap-4 rounded-3xl border border-yellow-400/30 bg-yellow-500/10 p-4">
      <div className="h-24 w-28 shrink-0 overflow-hidden rounded-2xl bg-slate-900">
        {listing.imageUrl ? (
          <img src={listing.imageUrl} alt="" className="h-full w-full object-cover" />
        ) : null}
      </div>
      <div className="min-w-0">
        <p className="truncate text-lg font-bold">{listing.title}</p>
        <p className="mt-1 text-sm text-yellow-100/70">{listing.location}</p>
        <p className="mt-2 text-sm font-semibold text-yellow-200">
          {sourceLabel(boost?.source)}
        </p>
        <p className="mt-1 text-xs text-yellow-100/60">
          Started {formatDate(boost?.startedAt || null)} · Expires{" "}
          {formatDate(boost?.expiresAt || null)}
        </p>
        <p className="mt-1 text-xs text-yellow-100/60">
          {timeRemaining(boost?.expiresAt || null)}
        </p>
        <Link
          href={`/listings/${listing.id}`}
          className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-white"
        >
          View listing <ExternalLink size={14} />
        </Link>
      </div>
    </article>
  );
}

function ListingCard({
  listing,
  onBoost,
}: {
  listing: BoostCenterListing;
  onBoost: () => void;
}) {
  return (
    <article className="overflow-hidden rounded-3xl border border-white/10 bg-black/30">
      <div className="relative h-44 bg-slate-900">
        {listing.imageUrl ? (
          <img src={listing.imageUrl} alt="" className="h-full w-full object-cover" />
        ) : null}
        {listing.activeBoost && (
          <span className="absolute left-3 top-3 rounded-full bg-yellow-400 px-3 py-1 text-xs font-black text-black">
            Boost Active
          </span>
        )}
      </div>
      <div className="p-4">
        <p className="line-clamp-1 text-lg font-bold">{listing.title}</p>
        <p className="mt-1 text-sm text-slate-400">{listing.location}</p>
        <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-slate-400">
          <span>Status: {listing.status}</span>
          <span>Views: {listing.views}</span>
          <span>Inquiries: {listing.inquiries}</span>
          {listing.activeBoost?.expiresAt && (
            <span>Expires: {formatDate(listing.activeBoost.expiresAt)}</span>
          )}
        </div>
        <button
          onClick={onBoost}
          disabled={!listing.isEligible}
          className="mt-4 w-full rounded-2xl bg-white px-4 py-3 text-sm font-black text-black disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/45"
        >
          {listing.isEligible ? "Boost Listing" : listing.ineligibleReason || "Not eligible"}
        </button>
      </div>
    </article>
  );
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 font-bold">{value}</p>
    </div>
  );
}
