import Image from "next/image";
import Link from "next/link";
import Money from "@/components/Money";
import { useTranslations } from "next-intl";

type ListingImage = {
  image_url: string | null;
  is_cover: boolean | null;
  sort_order: number | null;
};

type Listing = {
  id: string;
  title: string | null;
  city: string | null;
  campus: string | null;
  price: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  status: string | null;
  is_featured?: boolean | null;
  listing_images?: ListingImage[];
};

function getCoverImage(images?: ListingImage[]) {
  const sortedImages = [...(images || [])].sort(
    (a, b) =>
      Number(b.is_cover) -
        Number(a.is_cover) ||
      (a.sort_order || 0) - (b.sort_order || 0)
  );

  return sortedImages[0]?.image_url || "";
}

export default function FeaturedListings({ listings }: { listings: Listing[] }) {
  const t = useTranslations("home.featuredListings");

  return (
    <section className="px-6 py-20">
      <div className="mx-auto max-w-7xl">
        <div className="flex items-end justify-between gap-6">
          <div>
            <p className="text-sm font-bold uppercase tracking-widest text-red-400">
              {t("eyebrow")}
            </p>
            <h2 className="mt-3 text-3xl font-black sm:text-5xl">
              {t("title")}
            </h2>
          </div>

          <Link
            href="/search"
            className="hidden rounded-xl border border-white/15 px-5 py-3 font-bold hover:bg-white/10 sm:block"
          >
            {t("viewAll")}
          </Link>
        </div>

        {listings.length === 0 ? (
          <div className="mt-10 rounded-3xl border border-white/10 bg-white/[0.04] p-8">
            <p className="text-white/70">
              {t("emptyText")}
            </p>

            <Link
              href="/search"
              className="mt-6 inline-flex rounded-2xl bg-white px-6 py-3 font-bold text-black hover:bg-white/90"
            >
              {t("browseMarketplace")}
            </Link>
          </div>
        ) : (
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((listing) => {
              const cover = getCoverImage(listing.listing_images);

              return (
                <Link
                  key={listing.id}
                  href={`/listings/${listing.id}`}
                  prefetch={false}
                  className="group overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] transition hover:-translate-y-1 hover:bg-white/[0.07]"
                >
                  <div className="relative h-64 overflow-hidden bg-white/10">
                    {cover ? (
                      <Image
                        src={cover}
                        alt={listing.title || "Travel Markets listing"}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        className="object-cover transition duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-white/40">
                        {t("noImage")}
                      </div>
                    )}

                    <div className="absolute left-4 top-4 z-10 flex gap-2">
                      {listing.is_featured && (
                        <span className="rounded-full bg-red-600 px-3 py-1 text-xs font-bold text-white">
                          {t("featured")}
                        </span>
                      )}

                      <span className="rounded-full bg-black/70 px-3 py-1 text-xs font-bold text-white">
                        {t("available")}
                      </span>
                    </div>
                  </div>

                  <div className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h3 className="line-clamp-1 text-lg font-black">
                          {listing.title || t("fallbackTitle")}
                        </h3>

                        <p className="mt-1 text-sm text-white/60">
                          {listing.city || t("fallbackCountry")}{" "}
                          {listing.campus ? `• ${listing.campus}` : ""}
                        </p>
                      </div>

                      <p className="shrink-0 font-black text-red-400">
                        {listing.price == null ? t("ask") : <Money amountCAD={listing.price} />}
                      </p>
                    </div>

                    <div className="mt-4 flex gap-3 text-sm text-white/60">
                      <span>{t("bed", { count: listing.bedrooms || 0 })}</span>
                      <span>•</span>
                      <span>{t("bath", { count: listing.bathrooms || 0 })}</span>
                    </div>

                    <div className="mt-5 rounded-2xl bg-white px-4 py-3 text-center text-sm font-black text-black">
                      {t("viewListing")}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
