import Image from "next/image";
import Link from "next/link";
import { MapPin, Sparkles } from "lucide-react";

type RecommendedListing = {
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
};

type Props = {
  listings: RecommendedListing[];
};

export default function RecommendedListings({ listings }: Props) {
  if (!listings || listings.length === 0) return null;

  return (
    <section className="rounded-3xl border border-gray-800 bg-[#070707] p-6">
      <div className="mb-5 flex items-center gap-2">
        <Sparkles size={20} className="text-yellow-300" />
        <h2 className="text-2xl font-bold">Recommended for You</h2>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {listings.map((listing) => (
          <Link
            key={listing.id}
            href={`/listings/${listing.id}`}
            className="group overflow-hidden rounded-2xl border border-gray-800 bg-black transition hover:-translate-y-1 hover:border-white/20"
          >
            <div className="relative aspect-[4/3] bg-white/5">
              {listing.image_url ? (
                <Image
                  src={listing.image_url}
                  alt={listing.title}
                  fill
                  sizes="(max-width: 768px) 100vw, 33vw"
                  className="object-cover transition duration-500 group-hover:scale-105"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-white/30">
                  No image
                </div>
              )}

              <div className="absolute bottom-3 left-3 rounded-full bg-white px-3 py-1 text-sm font-bold text-black">
                ${listing.price ?? "Ask"}/mo
              </div>
            </div>

            <div className="p-4">
              <h3 className="line-clamp-1 font-semibold text-white">
                {listing.title}
              </h3>

              <div className="mt-2 flex items-center gap-2 text-sm text-gray-400">
                <MapPin size={14} />
                <span className="line-clamp-1">
                  {listing.city || "City hidden"}
                  {listing.campus ? ` • ${listing.campus}` : ""}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 text-xs text-gray-400">
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