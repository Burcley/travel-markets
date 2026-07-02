"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

export default function BoostCheckoutButton({
  listingId,
  days,
  label,
}: {
  listingId: string;
  days: number;
  label: string;
}) {
  const t = useTranslations("finalBatchD.boostCheckoutButton");
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
        alert(data.error || t("startFailed"));
        return;
      }

      if (!data.url) {
        alert(t("missingUrl"));
        return;
      }

      window.location.href = data.url;
    } catch (error: any) {
      alert(error?.message || t("checkoutFailed"));
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
      {loading ? t("opening") : label}
    </button>
  );
}
