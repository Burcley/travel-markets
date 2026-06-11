"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

export default function SearchFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const initial = useMemo(() => {
    return {
      q: searchParams.get("q") || "",
      city: searchParams.get("city") || "",
      campus: searchParams.get("campus") || "",
      minPrice: searchParams.get("minPrice") || "",
      maxPrice: searchParams.get("maxPrice") || "",
      bedrooms: searchParams.get("bedrooms") || "",
      bathrooms: searchParams.get("bathrooms") || "",
      guests: searchParams.get("guests") || "",
      status: searchParams.get("status") || "all",
      sort: searchParams.get("sort") || "newest",
    };
  }, [searchParams]);

  const [form, setForm] = useState(initial);

  function updateField(name: string, value: string) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function applyFilters() {
    const params = new URLSearchParams();

    Object.entries(form).forEach(([key, value]) => {
      if (value && value !== "all") params.set(key, value);
    });

    params.set("page", "1");

    startTransition(() => {
      router.push(`/search?${params.toString()}`);
    });
  }

  function resetFilters() {
    setForm({
      q: "",
      city: "",
      campus: "",
      minPrice: "",
      maxPrice: "",
      bedrooms: "",
      bathrooms: "",
      guests: "",
      status: "all",
      sort: "newest",
    });

    startTransition(() => {
      router.push("/search");
    });
  }

  const inputClass =
    "w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-white/30";

  return (
    <aside className="h-fit rounded-[2rem] border border-white/10 bg-white/[0.04] p-4 shadow-2xl shadow-black/30 md:sticky md:top-6">
      <div className="mb-5">
        <h2 className="text-lg font-semibold">Filters</h2>
        <p className="text-sm text-white/50">Search updates through the URL.</p>
      </div>

      <div className="space-y-3">
        <input
          className={inputClass}
          placeholder="Search city, campus, title..."
          value={form.q}
          onChange={(e) => updateField("q", e.target.value)}
        />

        <input
          className={inputClass}
          placeholder="City"
          value={form.city}
          onChange={(e) => updateField("city", e.target.value)}
        />

        <input
          className={inputClass}
          placeholder="Campus"
          value={form.campus}
          onChange={(e) => updateField("campus", e.target.value)}
        />

        <div className="grid grid-cols-2 gap-3">
          <input
            className={inputClass}
            placeholder="Min price"
            type="number"
            value={form.minPrice}
            onChange={(e) => updateField("minPrice", e.target.value)}
          />

          <input
            className={inputClass}
            placeholder="Max price"
            type="number"
            value={form.maxPrice}
            onChange={(e) => updateField("maxPrice", e.target.value)}
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <input
            className={inputClass}
            placeholder="Beds"
            type="number"
            value={form.bedrooms}
            onChange={(e) => updateField("bedrooms", e.target.value)}
          />

          <input
            className={inputClass}
            placeholder="Baths"
            type="number"
            value={form.bathrooms}
            onChange={(e) => updateField("bathrooms", e.target.value)}
          />

          <input
            className={inputClass}
            placeholder="Guests"
            type="number"
            value={form.guests}
            onChange={(e) => updateField("guests", e.target.value)}
          />
        </div>

        <select
          className={inputClass}
          value={form.status}
          onChange={(e) => updateField("status", e.target.value)}
        >
          <option value="all">Any status</option>
          <option value="available">Available</option>
          <option value="pending">Pending</option>
          <option value="rented">Rented</option>
        </select>

        <select
          className={inputClass}
          value={form.sort}
          onChange={(e) => updateField("sort", e.target.value)}
        >
          <option value="newest">Newest first</option>
          <option value="price-low">Price low to high</option>
          <option value="price-high">Price high to low</option>
        </select>

        <button
          onClick={applyFilters}
          disabled={isPending}
          className="w-full rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-white/85 disabled:opacity-50"
        >
          {isPending ? "Searching..." : "Apply filters"}
        </button>

        <button
          onClick={resetFilters}
          className="w-full rounded-2xl border border-white/10 px-4 py-3 text-sm font-medium text-white/70 transition hover:bg-white/10"
        >
          Reset
        </button>
      </div>
    </aside>
  );
}