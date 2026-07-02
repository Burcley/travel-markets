"use client";

import { useTranslations } from "next-intl";

type Filters = {
  bedrooms: string;
  bathrooms: string;
  minPrice: number;
  maxPrice: number;
  status: string;
};

type Props = {
  filters: Filters;
  setFilters: React.Dispatch<React.SetStateAction<Filters>>;
};

export default function AdvancedListingFilters({ filters, setFilters }: Props) {
  const t = useTranslations("finalBatchD.advancedFilters");

  return (
    <div className="rounded-3xl border border-white/10 bg-[#111111] p-5 shadow-2xl">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">{t("title")}</h2>
          <p className="text-sm text-gray-400">
            {t("subtitle")}
          </p>
        </div>

        <button
          onClick={() =>
            setFilters({
              bedrooms: "any",
              bathrooms: "any",
              minPrice: 0,
              maxPrice: 5000,
              status: "any",
            })
          }
          className="rounded-full border border-white/10 px-4 py-2 text-sm text-gray-300 hover:bg-white/10"
        >
          {t("reset")}
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        <div>
          <label className="mb-2 block text-sm text-gray-300">{t("bedrooms")}</label>
          <select
            value={filters.bedrooms}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, bedrooms: e.target.value }))
            }
            className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none"
          >
            <option value="any">{t("any")}</option>
            <option value="1">1+</option>
            <option value="2">2+</option>
            <option value="3">3+</option>
            <option value="4">4+</option>
            <option value="5">5+</option>
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm text-gray-300">{t("bathrooms")}</label>
          <select
            value={filters.bathrooms}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, bathrooms: e.target.value }))
            }
            className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none"
          >
            <option value="any">{t("any")}</option>
            <option value="1">1+</option>
            <option value="2">2+</option>
            <option value="3">3+</option>
            <option value="4">4+</option>
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm text-gray-300">
            {t("minPrice", { price: filters.minPrice })}
          </label>
          <input
            type="range"
            min="0"
            max="5000"
            step="50"
            value={filters.minPrice}
            onChange={(e) =>
              setFilters((prev) => ({
                ...prev,
                minPrice: Number(e.target.value),
              }))
            }
            className="w-full"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm text-gray-300">
            {t("maxPrice", { price: filters.maxPrice })}
          </label>
          <input
            type="range"
            min="0"
            max="5000"
            step="50"
            value={filters.maxPrice}
            onChange={(e) =>
              setFilters((prev) => ({
                ...prev,
                maxPrice: Number(e.target.value),
              }))
            }
            className="w-full"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm text-gray-300">
            {t("availability")}
          </label>
          <select
            value={filters.status}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, status: e.target.value }))
            }
            className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none"
          >
            <option value="any">{t("any")}</option>
            <option value="available">{t("available")}</option>
            <option value="pending">{t("pending")}</option>
            <option value="rented">{t("rented")}</option>
          </select>
        </div>
      </div>
    </div>
  );
}
