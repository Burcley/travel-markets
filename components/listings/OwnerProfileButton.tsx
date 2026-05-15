"use client";

import Link from "next/link";

type OwnerProfileButtonProps = {
  ownerId: string;
  ownerName?: string | null;
};

export default function OwnerProfileButton({
  ownerId,
  ownerName,
}: OwnerProfileButtonProps) {
  if (!ownerId) return null;

  return (
    <Link
      href={`/users/${ownerId}`}
      className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
    >
      View {ownerName ? `${ownerName}'s` : "Owner"} Profile
    </Link>
  );
}