"use client";

import { useState } from "react";
import { Bell, Loader2 } from "lucide-react";

type Props = {
  filters: {
    title?: string;
    city?: string | null;
    campus?: string | null;
    min_price?: number | null;
    max_price?: number | null;
    bedrooms?: number | null;
    bathrooms?: number | null;
    guests?: number | null;
  };
};

export default function SaveSearchButton({ filters }: Props) {
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  async function saveSearch() {
    try {
      setLoading(true);

      const res = await fetch("/api/saved-searches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...filters,
          title: filters.title || "My Saved Search",
          alerts_enabled: true,
        }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Could not save search.");

      setSaved(true);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={saveSearch}
      disabled={loading || saved}
      className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20 disabled:opacity-60"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
      {saved ? "Search Saved" : "Save Search Alert"}
    </button>
  );
}