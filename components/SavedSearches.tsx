"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

type SavedSearch = {
  id: string;
  search: string;
  sort: string;
  status: string;
};

export default function SavedSearches({
  currentSearch,
  currentSort,
  currentStatus,
  onApply,
}: {
  currentSearch: string;
  currentSort: string;
  currentStatus: string;
  onApply: (data: SavedSearch) => void;
}) {
  const t = useTranslations("finalBatchD.savedSearchesStrip");
  const [saved, setSaved] = useState<SavedSearch[]>([]);

  useEffect(() => {
    const data = JSON.parse(
      localStorage.getItem("travelMarketsSavedSearches") || "[]"
    );

    setSaved(data);
  }, []);

  function saveCurrentSearch() {
    const item: SavedSearch = {
      id: crypto.randomUUID(),
      search: currentSearch,
      sort: currentSort,
      status: currentStatus,
    };

    const updated = [item, ...saved].slice(0, 8);

    localStorage.setItem(
      "travelMarketsSavedSearches",
      JSON.stringify(updated)
    );

    setSaved(updated);
  }

  function removeSearch(id: string) {
    const updated = saved.filter((item) => item.id !== id);

    localStorage.setItem(
      "travelMarketsSavedSearches",
      JSON.stringify(updated)
    );

    setSaved(updated);
  }

  return (
    <section className="border-b border-zinc-800 bg-black px-5 py-5">
      <div className="mx-auto max-w-[1600px]">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">
              {t("title")}
            </h2>

            <p className="mt-1 text-sm text-zinc-500">
              {t("subtitle")}
            </p>
          </div>

          <button
            onClick={saveCurrentSearch}
            className="rounded-full bg-white px-5 py-2 text-sm font-bold text-black hover:bg-zinc-200"
          >
            {t("saveCurrent")}
          </button>
        </div>

        {saved.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-800 p-6 text-sm text-zinc-500">
            {t("empty")}
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2">
            {saved.map((item) => (
              <div
                key={item.id}
                className="min-w-[260px] rounded-2xl border border-zinc-800 bg-zinc-950 p-4"
              >
                <p className="line-clamp-1 font-bold text-white">
                  {item.search || t("allListings")}
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full bg-white/5 px-3 py-1 text-xs text-zinc-400">
                    {item.sort}
                  </span>

                  <span className="rounded-full bg-white/5 px-3 py-1 text-xs text-zinc-400">
                    {item.status}
                  </span>
                </div>

                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => onApply(item)}
                    className="flex-1 rounded-xl bg-white px-4 py-2 text-sm font-bold text-black hover:bg-zinc-200"
                  >
                    {t("apply")}
                  </button>

                  <button
                    onClick={() => removeSearch(item.id)}
                    className="rounded-xl border border-zinc-700 px-4 py-2 text-sm text-zinc-400 hover:border-red-500 hover:text-red-400"
                  >
                    {t("delete")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
