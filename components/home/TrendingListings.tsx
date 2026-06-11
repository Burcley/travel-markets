import Image from "next/image";
import Link from "next/link";
import { Flame, MapPin } from "lucide-react";

type TrendingListing = {
  id: string;
  title: string;
  city: string | null;
  campus: string | null;
  price: number | null;
  status: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  guests: number | null;
  image_url: string | null;
  view_count: number;
};

type Props = {
  listings: TrendingListing[];
};

export default function TrendingListings({ listings }: Props) {
  if (!listings || listings.length === 0) return null;

  return (
    <section className="mb-8">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-orange-500/10 px-3 py-1 text-xs font-semibold text-orange-300">
            <Flame size={14} />
            Most viewed this week
          </div>

          <h2 className="text-2xl font-semibold text-white">
            Trending listings
          </h2>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        {listings.map((listing) => (
          <Link
            key={listing.id}
            href={`/listings/${listing.id}`}
            className="group overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] transition hover:-translate-y-1 hover:bg-white/[0.07]"
          >
            <div className="relative aspect-[4/3] overflow-hidden bg-white/5">
              {listing.image_url ? (
                <Image
                  src={listing.image_url}
                  alt={listing.title || "Trending listing"}
                  fill
                  sizes="(max-width: 640px) 100vw, 50vw"
                  className="object-cover transition duration-500 group-hover:scale-105"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-white/30">
                  No image
                </div>
              )}

              <div className="absolute left-3 top-3 rounded-full bg-orange-500 px-3 py-1 text-xs font-bold text-black">
                🔥 {listing.view_count} views
              </div>

              <div className="absolute bottom-3 left-3 rounded-full bg-white px-3 py-1 text-sm font-bold text-black shadow-lg">
                ${listing.price ?? "Ask"}/mo
              </div>
            </div>

            <div className="p-4">
              <h3 className="line-clamp-1 text-base font-semibold text-white">
                {listing.title}
              </h3>

              <div className="mt-2 flex items-center gap-2 text-sm text-white/50">
                <MapPin size={15} />

                <span className="line-clamp-1">
                  {listing.city || "City hidden"}
                  {listing.campus ? ` • ${listing.campus}` : ""}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 text-xs text-white/60">
                <span className="rounded-xl bg-white/5 px-2 py-2">
                  {listing.bedrooms ?? "-"} bed
                </span>

                <span className="rounded-xl bg-white/5 px-2 py-2">
                  {listing.bathrooms ?? "-"} bath
                </span>

                <span className="rounded-xl bg-white/5 px-2 py-2">
                  {listing.guests ?? "-"} guest
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}