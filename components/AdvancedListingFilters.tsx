"use client";

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
  return (
    <div className="rounded-3xl border border-white/10 bg-[#111111] p-5 shadow-2xl">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Advanced Filters</h2>
          <p className="text-sm text-gray-400">
            Find the right place faster.
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
          Reset
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        <div>
          <label className="mb-2 block text-sm text-gray-300">Bedrooms</label>
          <select
            value={filters.bedrooms}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, bedrooms: e.target.value }))
            }
            className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none"
          >
            <option value="any">Any</option>
            <option value="1">1+</option>
            <option value="2">2+</option>
            <option value="3">3+</option>
            <option value="4">4+</option>
            <option value="5">5+</option>
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm text-gray-300">Bathrooms</label>
          <select
            value={filters.bathrooms}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, bathrooms: e.target.value }))
            }
            className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none"
          >
            <option value="any">Any</option>
            <option value="1">1+</option>
            <option value="2">2+</option>
            <option value="3">3+</option>
            <option value="4">4+</option>
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm text-gray-300">
            Min Price: ${filters.minPrice}
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
            Max Price: ${filters.maxPrice}
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
            Availability
          </label>
          <select
            value={filters.status}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, status: e.target.value }))
            }
            className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none"
          >
            <option value="any">Any</option>
            <option value="available">Available</option>
            <option value="pending">Pending</option>
            <option value="rented">Rented</option>
          </select>
        </div>
      </div>
    </div>
  );
}