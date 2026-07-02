import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import LoadMoreListings from "./LoadMoreListings";
import type { ListingCardData } from "@/lib/listings/search-types";

export default async function SearchResults({
  listings,
  count,
  page,
  hasMore,
}: {
  listings: ListingCardData[];
  count: number;
  page: number;
  hasMore: boolean;
}) {
  const t = await getTranslations("finalBatchD.searchResults");

  return (
    <section>
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">{t("title")}</h2>
          <p className="text-sm text-white/50">
            {t("count", { count })}
          </p>
        </div>
      </div>

      {listings.length === 0 ? (
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-10 text-center">
          <h3 className="text-lg font-semibold">{t("emptyTitle")}</h3>
          <p className="mt-2 text-sm text-white/50">
            {t("emptyText")}
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {listings.map((listing) => (
              <Link
                key={listing.id}
                href={`/listings/${listing.id}`}
                className="group overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.04] shadow-xl shadow-black/20 transition hover:-translate-y-1 hover:bg-white/[0.07]"
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-white/5">
                  {listing.cover_image_url ? (
                    <Image
                      src={listing.cover_image_url}
                      alt={listing.title}
                      fill
                      sizes="(max-width: 768px) 100vw, 33vw"
                      className="object-cover transition duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-white/35">
                      {t("noImage")}
                    </div>
                  )}

                  <div className="absolute left-3 top-3 rounded-full bg-black/70 px-3 py-1 text-xs font-medium backdrop-blur">
                    {listing.status || "available"}
                  </div>
                </div>

                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="line-clamp-1 font-semibold">
                        {listing.title}
                      </h3>
                      <p className="mt-1 line-clamp-1 text-sm text-white/50">
                        {[listing.city, listing.campus].filter(Boolean).join(" • ")}
                      </p>
                    </div>

                    <p className="shrink-0 text-sm font-semibold">
                      ${listing.price ?? "—"}
                    </p>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2 text-xs text-white/55">
                    <span className="rounded-full bg-white/[0.06] px-3 py-1">
                      {t("beds", { count: listing.bedrooms ?? 0 })}
                    </span>
                    <span className="rounded-full bg-white/[0.06] px-3 py-1">
                      {t("baths", { count: listing.bathrooms ?? 0 })}
                    </span>
                    <span className="rounded-full bg-white/[0.06] px-3 py-1">
                      {t("guests", { count: listing.guests ?? 0 })}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          <LoadMoreListings currentPage={page} hasMore={hasMore} />
        </>
      )}
    </section>
  );
}
