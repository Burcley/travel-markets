"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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
  } | null;
};

export default function OwnerTrustCard({ owner }: OwnerTrustCardProps) {
  const supabase = createClient();
  const [listingCount, setListingCount] = useState(0);

  useEffect(() => {
    async function loadOwnerStats() {
      if (!owner?.id) return;

      const { count, error } = await supabase
        .from("listings")
        .select("id", { count: "exact", head: true })
        .eq("user_id", owner.id);

      if (!error) {
        setListingCount(count || 0);
      }
    }

    loadOwnerStats();
  }, [owner?.id]);

  if (!owner) return null;

  const ownerName = owner.full_name || "Property Owner";
  const ownerInitial = ownerName.charAt(0).toUpperCase();

  return (
    <div className="rounded-3xl border border-gray-800 bg-[#070707] p-6">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm font-semibold uppercase tracking-wide text-gray-400">
          Hosted by
        </p>

        {owner.is_verified && (
          <span className="rounded-full bg-blue-500/10 px-3 py-1 text-xs font-bold text-blue-300">
            ✓ Verified
          </span>
        )}
      </div>

      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-gray-800">
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

      <div className="mt-6 grid grid-cols-3 gap-3">
        <TrustStat label="Listings" value={listingCount} />
        <TrustStat label="Response" value="Fast" />
        <TrustStat label="Trust" value={owner.is_verified ? "High" : "New"} />
      </div>

      {owner.bio && (
        <p className="mt-5 line-clamp-4 text-sm leading-6 text-gray-400">
          {owner.bio}
        </p>
      )}

      <div className="mt-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
        <p className="text-sm font-semibold text-emerald-300">
          Safer marketplace profile
        </p>
        <p className="mt-1 text-xs leading-5 text-emerald-100/70">
          Travel Markets protects exact addresses until approved viewing or
          unlock access.
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