"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

type RecentListing = {
  id: string;
  title: string;
  city: string | null;
  campus: string | null;
  price: number | null;
  status: string | null;
  cover_image: string | null;
};

export default function RecentlyViewedListings() {
  const t = useTranslations("finalBatchD.recentlyViewedStrip");
  const [items, setItems] = useState<RecentListing[]>([]);

  useEffect(() => {
    const saved = JSON.parse(
      localStorage.getItem("recentlyViewedListings") || "[]"
    );

    setItems(saved);
  }, []);

  if (items.length === 0) return null;

  return (
    <section className="border-b border-zinc-800 bg-black px-5 py-6">
      <div className="mx-auto max-w-[1600px]">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">{t("title")}</h2>
            <p className="text-sm text-zinc-500">
              {t("subtitle")}
            </p>
          </div>

          <button
            onClick={() => {
              localStorage.removeItem("recentlyViewedListings");
              setItems([]);
            }}
            className="rounded-full border border-zinc-800 px-4 py-2 text-sm text-zinc-400 hover:border-white hover:text-white"
          >
            {t("clear")}
          </button>
        </div>

        <div className="flex gap-4 overflow-x-auto pb-2">
          {items.map((listing) => (
            <Link
              key={listing.id}
              href={`/listings/${listing.id}`}
              className="min-w-[260px] overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 transition hover:border-zinc-500"
            >
              <div className="h-36 bg-zinc-900">
                {listing.cover_image ? (
                  <img
                    src={listing.cover_image}
                    alt={listing.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-zinc-500">
                    {t("noImage")}
                  </div>
                )}
              </div>

              <div className="p-4">
                <h3 className="line-clamp-1 font-bold text-white">
                  {listing.title}
                </h3>

                <p className="mt-1 line-clamp-1 text-sm text-zinc-400">
                  {listing.city || t("cityHidden")}
                  {listing.campus ? ` • ${listing.campus}` : ""}
                </p>

                <p className="mt-3 font-bold text-white">
                  ${listing.price || 0}
                  <span className="text-sm font-normal text-zinc-500">
                    {" "}
                    {t("perMonth")}
                  </span>
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
