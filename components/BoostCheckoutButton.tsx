"use client";

import { useState } from "react";

export default function BoostCheckoutButton({
  listingId,
  days,
  label,
}: {
  listingId: string;
  days: number;
  label: string;
}) {
  const [loading, setLoading] = useState(false);

  async function handleBoost() {
    try {
      setLoading(true);

      const response = await fetch("/api/listings/boost/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          listingId,
          days,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || "Failed to start boost checkout.");
        return;
      }

      if (!data.url) {
        alert("Stripe checkout URL missing.");
        return;
      }

      window.location.href = data.url;
    } catch (error: any) {
      alert(error?.message || "Boost checkout failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleBoost}
      disabled={loading}
      className="w-full rounded-xl border border-yellow-400/30 bg-yellow-500/10 px-3 py-2 text-xs font-bold text-yellow-200 hover:bg-yellow-500/20 disabled:opacity-50"
    >
      {loading ? "Opening..." : label}
    </button>
  );
}