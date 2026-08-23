"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Copy, Loader2 } from "lucide-react";

export default function DuplicateListingButton({
  listingId,
}: {
  listingId: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function duplicateListing() {
    setLoading(true);

    try {
      const response = await fetch(`/api/listings/${listingId}/duplicate`, {
        method: "POST",
      });
      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.id) {
        alert(data?.error || "We could not duplicate this listing.");
        return;
      }

      router.push(`/listings/${data.id}/edit`);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={duplicateListing}
      disabled={loading}
      className="inline-flex items-center gap-2 rounded-xl border border-gray-600 px-4 py-2 text-white hover:bg-gray-900 disabled:opacity-50"
    >
      {loading ? <Loader2 className="animate-spin" size={16} /> : <Copy size={16} />}
      Duplicate
    </button>
  );
}
