"use client";

import { useState } from "react";
import { CreditCard, Loader2 } from "lucide-react";

export default function BillingPortalButton() {
  const [loading, setLoading] = useState(false);

  async function openBillingPortal() {
    try {
      setLoading(true);

      const res = await fetch("/api/stripe/billing-portal", {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok || !data.url) {
        throw new Error(data.error || "Unable to open billing portal.");
      }

      window.location.href = data.url;
    } catch (error) {
      alert(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={openBillingPortal}
      disabled={loading}
      className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
      Manage Billing
    </button>
  );
}