import Link from "next/link";
import { useTranslations } from "next-intl";
import { Flame, MapPin } from "lucide-react";

type TrendingCity = {
  name: string;
  count: number;
};

type Props = {
  cities: TrendingCity[];
};

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/\s+/g, "-");
}

export default function TrendingLocations({ cities }: Props) {
  const t = useTranslations("home.trendingLocations");

  if (!cities || cities.length === 0) return null;

  return (
    <section className="mb-8 rounded-3xl border border-white/10 bg-white/[0.04] p-5">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-orange-500/10 px-3 py-1 text-xs font-semibold text-orange-300">
            <Flame size={14} />
            {t("eyebrow")}
          </div>

          <h2 className="text-2xl font-semibold text-white">
            {t("title")}
          </h2>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        {cities.map((city) => (
          <Link
            key={city.name}
            href={`/search/${slugify(city.name)}`}
            className="group inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white/80 transition hover:border-white/20 hover:bg-white/10"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white">
              <MapPin size={16} />
            </span>

            <span>
              <span className="block font-semibold text-white">
                {city.name}
              </span>

              <span className="text-xs text-white/45">
                {t("viewsThisWeek", { count: city.count })}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
