"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  BadgeCheck,
  Crown,
  Home,
  LockKeyhole,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Star,
  Zap,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type OwnerTrustCardProps = {
  owner: {
    id: string;
    full_name: string | null;
    role: string | null;
    bio: string | null;
    phone: string | null;
    avatar_url: string | null;
    is_verified: boolean | null;
    identity_verified?: boolean | null;
    identity_verification_status?: string | null;
    trust_score?: number | null;
    trust_level?: string | null;
    phone_verified?: boolean | null;
    student_email_verified?: boolean | null;
  } | null;
};

export default function OwnerTrustCard({ owner }: OwnerTrustCardProps) {
  const supabase = createClient();

  const [listingCount, setListingCount] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);
  const [averageRating, setAverageRating] = useState("0.0");
  const [ownerPlan, setOwnerPlan] = useState("free");

  useEffect(() => {
    async function loadOwnerStats() {
      if (!owner?.id) return;

      const [listingResponse, reviewResponse, subscriptionResponse] =
        await Promise.all([
          supabase
            .from("listings")
            .select("id", { count: "exact", head: true })
            .eq("user_id", owner.id),

          supabase
            .from("reviews")
            .select("rating")
            .eq("owner_id", owner.id),

          fetch(`/api/owner-subscription?userId=${owner.id}`),
        ]);

      setListingCount(listingResponse.count || 0);

      const reviews = reviewResponse.data || [];
      setReviewCount(reviews.length);

      if (reviews.length > 0) {
        const total = reviews.reduce(
          (sum: number, review: any) => sum + Number(review.rating || 0),
          0
        );

        setAverageRating((total / reviews.length).toFixed(1));
      }

      if (subscriptionResponse.ok) {
        const data = await subscriptionResponse.json();
        setOwnerPlan(data.plan || "free");
      }
    }

    loadOwnerStats();
  }, [owner?.id, supabase]);

  if (!owner) return null;

  const ownerName = owner.full_name || "Property Owner";
  const ownerInitial = ownerName.charAt(0).toUpperCase();

  const isPremium = ownerPlan === "premium";
  const isPro = ownerPlan === "pro";

  const isVerified = Boolean(owner.is_verified || owner.identity_verified);
  const trustScore = owner.trust_score ?? 20;
  const trustLevel = owner.trust_level || "new";

  const trustLabel =
    trustLevel === "elite"
      ? "Elite Owner"
      : trustLevel === "trusted"
      ? "Trusted Owner"
      : trustLevel === "basic"
      ? "Basic Trust"
      : "New Owner";

  const trustColor =
    trustLevel === "elite"
      ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-300"
      : trustLevel === "trusted"
      ? "border-green-400/40 bg-green-500/15 text-green-300"
      : trustLevel === "basic"
      ? "border-blue-400/40 bg-blue-500/15 text-blue-300"
      : "border-zinc-700 bg-zinc-900 text-zinc-300";

  return (
    <div
      className={`rounded-3xl border p-6 shadow-2xl ${
        isPremium
          ? "border-yellow-400/40 bg-gradient-to-br from-yellow-500/15 via-[#070707] to-black"
          : isPro
          ? "border-purple-400/40 bg-gradient-to-br from-purple-500/15 via-[#070707] to-black"
          : trustLevel === "elite"
          ? "border-emerald-400/30 bg-gradient-to-br from-emerald-500/15 via-[#070707] to-black"
          : "border-gray-800 bg-[#070707]"
      }`}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <p className="text-sm font-semibold uppercase tracking-wide text-gray-400">
          Owner Trust
        </p>

        <div className="flex flex-wrap justify-end gap-2">
          {isPremium && (
            <span className="inline-flex items-center gap-1 rounded-full bg-yellow-400 px-3 py-1 text-xs font-black text-black">
              <Crown size={13} />
              Premium
            </span>
          )}

          {isPro && (
            <span className="inline-flex items-center gap-1 rounded-full bg-purple-500 px-3 py-1 text-xs font-black text-white">
              <Sparkles size={13} />
              Pro
            </span>
          )}

          {isVerified && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-300">
              <BadgeCheck size={13} />
              Verified
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div
          className={`flex h-16 w-16 items-center justify-center overflow-hidden rounded-full ${
            isPremium
              ? "bg-yellow-400/20 ring-2 ring-yellow-400/40"
              : isPro
              ? "bg-purple-500/20 ring-2 ring-purple-400/40"
              : isVerified
              ? "bg-emerald-500/20 ring-2 ring-emerald-400/40"
              : "bg-gray-800"
          }`}
        >
          {owner.avatar_url ? (
            <img
              src={owner.avatar_url}
              alt={ownerName}
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="text-2xl font-bold">{ownerInitial}</span>
          )}
        </div>

        <div>
          <p className="text-lg font-bold">{ownerName}</p>
          <p className="text-sm capitalize text-gray-400">
            {owner.role || "owner"}
          </p>
        </div>
      </div>

      <div className={`mt-6 rounded-2xl border p-5 ${trustColor}`}>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold">{trustLabel}</p>
            <p className="mt-1 text-xs opacity-80">
              Travel Markets trust score
            </p>
          </div>

          <div className="text-right">
            <p className="text-3xl font-black">{trustScore}/100</p>
          </div>
        </div>

        <div className="mt-4 h-2 overflow-hidden rounded-full bg-black/50">
          <div
            className="h-full rounded-full bg-current"
            style={{ width: `${Math.min(trustScore, 100)}%` }}
          />
        </div>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-3">
        <TrustStat label="Listings" value={listingCount} />
        <TrustStat label="Reviews" value={reviewCount} />
        <TrustStat label="Rating" value={averageRating} />
      </div>

      <div className="mt-6 rounded-2xl border border-white/10 bg-black/50 p-5">
        <div className="mb-4 flex items-center gap-2">
          <ShieldCheck size={18} className="text-emerald-300" />
          <h3 className="font-bold text-white">Trust Signals</h3>
        </div>

        <div className="space-y-3">
          <HighlightItem
            icon={<BadgeCheck size={15} />}
            label={
              isVerified
                ? "Identity Verified"
                : "Identity Not Fully Verified"
            }
            description={
              isVerified
                ? "This owner submitted identity verification and was approved."
                : "This owner has not completed identity approval yet."
            }
            active={isVerified}
          />

          <HighlightItem
            icon={<ShieldCheck size={15} />}
            label={`Verification Status: ${
              owner.identity_verification_status || "unverified"
            }`}
            description="Verification status is reviewed through Travel Markets trust flow."
            active={isVerified}
          />

          <HighlightItem
            icon={<Home size={15} />}
            label={`${listingCount} Active Listing${
              listingCount === 1 ? "" : "s"
            }`}
            description="Owner has active marketplace inventory."
            active={listingCount > 0}
          />

          <HighlightItem
            icon={<Star size={15} />}
            label={`${reviewCount} Review${reviewCount === 1 ? "" : "s"}`}
            description="Reviews help renters judge owner reliability."
            active={reviewCount > 0}
          />

          <HighlightItem
            icon={<MessageCircle size={15} />}
            label="Contact Through Travel Markets"
            description="Keep messages inside the platform for safer communication."
            active
          />

          <HighlightItem
            icon={<LockKeyhole size={15} />}
            label="Address Protection"
            description="Exact address stays hidden until approved viewing."
            active
          />

          {isPremium && (
            <HighlightItem
              icon={<Crown size={15} />}
              label="Premium Owner"
              description="Premium owner has paid marketplace visibility."
              active
            />
          )}

          {isPro && (
            <HighlightItem
              icon={<Sparkles size={15} />}
              label="Pro Owner"
              description="Pro owner has upgraded marketplace tools."
              active
            />
          )}

          <HighlightItem
            icon={<Zap size={15} />}
            label="Travel Markets Safer Flow"
            description="Built for student housing, viewings, reviews, and address protection."
            active
          />
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
        <p className="text-sm font-semibold text-emerald-300">
          What this means
        </p>
        <p className="mt-1 text-xs leading-5 text-emerald-100/70">
          Verification means the owner submitted identity details that were
          reviewed by Travel Markets. It does not guarantee safety, so always
          use viewings, messaging, and platform protections.
        </p>
      </div>

      <Link
        href={`/users/${owner.id}`}
        className="mt-5 flex w-full items-center justify-center rounded-xl border border-gray-700 bg-white/5 px-5 py-4 font-semibold text-white transition hover:bg-white/10"
      >
        View Owner Profile
      </Link>
    </div>
  );
}

function TrustStat({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-2xl border border-gray-800 bg-black p-3 text-center">
      <p className="text-sm font-bold text-white">{value}</p>
      <p className="mt-1 text-xs text-gray-500">{label}</p>
    </div>
  );
}

function HighlightItem({
  icon,
  label,
  description,
  active,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  active: boolean;
}) {
  return (
    <div className="flex gap-3">
      <div className={`mt-0.5 ${active ? "text-emerald-300" : "text-zinc-600"}`}>
        {icon}
      </div>

      <div>
        <p className="text-sm font-semibold text-white">{label}</p>
        <p className="mt-0.5 text-xs leading-5 text-gray-400">{description}</p>
      </div>
    </div>
  );
}