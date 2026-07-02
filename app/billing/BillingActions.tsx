"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { OwnerPlan } from "@/lib/subscriptions/plans";

type Props = {
  action: "checkout" | "portal";
  plan?: OwnerPlan;
  label: string;
  fullWidth?: boolean;
};

export default function BillingActions({ action, plan, label, fullWidth }: Props) {
  const t = useTranslations("accountPages.billingActions");
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    try {
      setLoading(true);

      const endpoint =
        action === "checkout"
          ? "/api/subscriptions/checkout"
          : "/api/subscriptions/portal";

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: action === "checkout" ? JSON.stringify({ plan }) : undefined,
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || t("billingFailed"));
        return;
      }

      if (!data.url) {
        alert(t("missingUrl"));
        return;
      }

      window.location.href = data.url;
    } catch (error: any) {
      alert(error?.message || t("openFailed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={`rounded-2xl bg-white px-5 py-3 font-bold text-black transition hover:scale-[1.02] disabled:opacity-50 ${
        fullWidth ? "w-full" : ""
      }`}
    >
      {loading ? t("opening") : label}
    </button>
  );
}
