import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Crown } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { canManageListings } from "@/lib/role-access";
import DeleteListingButton from "@/components/DeleteListingButton";
import ListingStatusControls from "@/components/ListingStatusControls";
import DuplicateListingButton from "@/components/DuplicateListingButton";

type Listing = {
  id: string;
  title: string;
  price: number;
  location: string | null;
  description: string | null;
  status: string | null;
  created_at: string;
  boost_until: string | null;
  boost_rank: number | null;
};

type ListingImageRow = {
  listing_id: string;
  image_url: string | null;
};

function StatusBadge({
  status,
  labels,
}: {
  status: string | null;
  labels: { rented: string; pending: string; available: string; draft: string };
}) {
  const safeStatus = status || "available";

  if (safeStatus === "draft") {
    return (
      <span className="rounded-full bg-zinc-500/20 px-3 py-1 text-xs font-semibold text-zinc-300">
        {labels.draft}
      </span>
    );
  }

  if (safeStatus === "rented") {
    return (
      <span className="rounded-full bg-red-500/20 px-3 py-1 text-xs font-semibold text-red-300">
        {labels.rented}
      </span>
    );
  }

  if (safeStatus === "pending") {
    return (
      <span className="rounded-full bg-yellow-500/20 px-3 py-1 text-xs font-semibold text-yellow-300">
        {labels.pending}
      </span>
    );
  }

  return (
    <span className="rounded-full bg-green-500/20 px-3 py-1 text-xs font-semibold text-green-300">
      {labels.available}
    </span>
  );
}

function isBoostActive(boostUntil: string | null) {
  if (!boostUntil) return false;
  return new Date(boostUntil).getTime() > Date.now();
}

function formatDate(date: string | null, fallback: string) {
  if (!date) return fallback;

  return new Intl.DateTimeFormat("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
}

export default async function MyListingsPage() {
  const t = await getTranslations("listingManagement.myListings");
  const supabase = await createClient();
  const statusLabels = {
    rented: t("status.rented"),
    pending: t("status.pending"),
    available: t("status.available"),
    draft: "Draft",
  };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (!canManageListings(profile)) {
    redirect("/dashboard");
  }

  const { data: listings, error } = await supabase
    .from("listings")
    .select(
      "id, title, price, location, description, status, created_at, boost_until, boost_rank"
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-10 text-white">
        <h1 className="text-3xl font-bold">{t("title")}</h1>
        <p className="mt-4 text-red-500">{t("loadFailed")}</p>
      </main>
    );
  }

  const listingIds = (listings || []).map((listing) => listing.id);
  const previewMap: Record<string, string> = {};

  if (listingIds.length > 0) {
    const { data: images } = await supabase
      .from("listing_images")
      .select("listing_id, image_url")
      .in("listing_id", listingIds);

    if (images) {
      for (const image of images as ListingImageRow[]) {
        if (!previewMap[image.listing_id] && image.image_url) {
          previewMap[image.listing_id] = image.image_url;
        }
      }
    }
  }

  return (
    <main className="min-h-screen bg-black px-4 py-10 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-yellow-300">
              {t("eyebrow")}
            </p>
            <h1 className="mt-2 text-4xl font-black">{t("title")}</h1>
            <p className="mt-2 text-gray-400">
              {t("subtitle")}
            </p>
          </div>

          <Link
            href="/post"
            className="rounded-2xl bg-white px-5 py-3 font-bold text-black hover:bg-gray-200"
          >
            {t("createListing")}
          </Link>
          <Link
            href="/dashboard/boosts"
            className="rounded-2xl border border-yellow-400/30 bg-yellow-500/10 px-5 py-3 font-bold text-yellow-100 hover:bg-yellow-500/20"
          >
            Boost Center
          </Link>
        </div>

        {!listings || listings.length === 0 ? (
          <div className="rounded-3xl border border-gray-800 bg-[#070707] p-10 text-center text-gray-300">
            {t("empty")}
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {listings.map((listing: Listing) => {
              const previewImage = previewMap[listing.id] || "/placeholder.jpg";
              const activeBoost = isBoostActive(listing.boost_until);
              const isDraft = listing.status === "draft";

              return (
                <div
                  key={listing.id}
                  className={`overflow-hidden rounded-3xl border bg-[#070707] shadow-2xl ${
                    activeBoost ? "border-yellow-400/50" : "border-gray-800"
                  }`}
                >
                  <div className="relative h-64 w-full overflow-hidden bg-gray-900">
                    <img
                      src={previewImage}
                      alt={listing.title}
                      className="h-full w-full object-cover"
                    />

                    <div className="absolute left-4 top-4 flex flex-wrap gap-2">
                      <StatusBadge status={listing.status} labels={statusLabels} />

                      {activeBoost && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-yellow-400 px-3 py-1 text-xs font-black text-black">
                          <Crown size={13} />
                          {t("boosted")}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="border-t border-gray-800 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="line-clamp-1 text-2xl font-bold">
                          {listing.title}
                        </h2>

                        <p className="mt-1 text-gray-400">
                          {listing.location || t("noLocation")}
                        </p>
                      </div>

                      <StatusBadge status={listing.status} labels={statusLabels} />
                    </div>

                    <p className="mt-3 text-3xl font-black">${listing.price}</p>

                    <p className="mt-3 line-clamp-2 text-sm leading-6 text-gray-400">
                      {listing.description || t("noDescription")}
                    </p>

                    {activeBoost ? (
                      <div className="mt-5 rounded-2xl border border-yellow-400/30 bg-yellow-500/10 p-4">
                        <p className="flex items-center gap-2 font-bold text-yellow-300">
                          <Crown size={16} />
                          {t("boostActive")}
                        </p>
                        <p className="mt-1 text-sm text-yellow-100/70">
                          {t("boostedUntil", {
                            date: formatDate(
                              listing.boost_until,
                              t("notAvailable")
                            ),
                          })}
                        </p>
                        <button
                          disabled
                          className="mt-4 w-full rounded-xl border border-yellow-400/30 bg-yellow-400/10 px-3 py-2 text-xs font-bold text-yellow-100/70"
                        >
                          Boost Active
                        </button>
                      </div>
                    ) : (
                      <div className="mt-5 rounded-2xl border border-yellow-400/20 bg-yellow-500/10 p-4">
                        <p className="flex items-center gap-2 font-bold text-yellow-300">
                          <Crown size={16} />
                          {t("boostThisListing")}
                        </p>

                        <p className="mt-1 text-sm text-yellow-100/70">
                          {t("boostText")}
                        </p>

                        <Link
                          href={`/dashboard/boosts?listing=${listing.id}`}
                          className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-yellow-400 px-3 py-3 text-sm font-black text-black hover:bg-yellow-300"
                        >
                          Boost Listing
                        </Link>
                      </div>
                    )}

                    {isDraft ? (
                      <div className="mt-5 rounded-2xl border border-pink-400/25 bg-pink-500/10 p-4">
                        <p className="text-sm font-bold text-pink-100">
                          Finish this draft before publishing.
                        </p>
                        <p className="mt-1 text-sm leading-6 text-pink-100/70">
                          Continue through Review & Publish so the listing is saved
                          with the current publishing checks.
                        </p>
                        <Link
                          href={`/listings/${listing.id}/edit`}
                          className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-[#FF2E72] px-3 py-3 text-sm font-black text-white hover:bg-[#ff4b84]"
                        >
                          Continue listing
                        </Link>
                      </div>
                    ) : (
                      <ListingStatusControls
                        listingId={listing.id}
                        currentStatus={listing.status}
                      />
                    )}

                    <div className="mt-5 flex flex-wrap gap-3">
                      <Link
                        href={`/listings/${listing.id}`}
                        className="rounded-xl border border-gray-600 px-4 py-2 text-white hover:bg-gray-900"
                      >
                        {t("view")}
                      </Link>

                      <Link
                        href={`/listings/${listing.id}/edit`}
                        className="rounded-xl bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
                      >
                        {t("edit")}
                      </Link>

                      <DuplicateListingButton listingId={listing.id} />

                      <DeleteListingButton
                        listingId={listing.id}
                        listingTitle={listing.title}
                        redirectTo="/my-listings"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
