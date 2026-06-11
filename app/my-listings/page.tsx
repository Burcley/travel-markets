import Link from "next/link";
import { redirect } from "next/navigation";
import { Crown } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import DeleteListingButton from "@/components/DeleteListingButton";
import ListingStatusControls from "@/components/ListingStatusControls";
import BoostCheckoutButton from "@/components/BoostCheckoutButton";

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

function StatusBadge({ status }: { status: string | null }) {
  const safeStatus = status || "available";

  if (safeStatus === "rented") {
    return (
      <span className="rounded-full bg-red-500/20 px-3 py-1 text-xs font-semibold text-red-300">
        Rented
      </span>
    );
  }

  if (safeStatus === "pending") {
    return (
      <span className="rounded-full bg-yellow-500/20 px-3 py-1 text-xs font-semibold text-yellow-300">
        Pending
      </span>
    );
  }

  return (
    <span className="rounded-full bg-green-500/20 px-3 py-1 text-xs font-semibold text-green-300">
      Available
    </span>
  );
}

function isBoostActive(boostUntil: string | null) {
  if (!boostUntil) return false;
  return new Date(boostUntil).getTime() > Date.now();
}

function formatDate(date: string | null) {
  if (!date) return "Not available";

  return new Intl.DateTimeFormat("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
}

export default async function MyListingsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth");
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
        <h1 className="text-3xl font-bold">My Listings</h1>
        <p className="mt-4 text-red-500">Failed to load your listings.</p>
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
              Owner Control Center
            </p>
            <h1 className="mt-2 text-4xl font-black">My Listings</h1>
            <p className="mt-2 text-gray-400">
              Manage your properties, status, edits, deletion, and paid visibility boosts.
            </p>
          </div>

          <Link
            href="/post"
            className="rounded-2xl bg-white px-5 py-3 font-bold text-black hover:bg-gray-200"
          >
            Create Listing
          </Link>
        </div>

        {!listings || listings.length === 0 ? (
          <div className="rounded-3xl border border-gray-800 bg-[#070707] p-10 text-center text-gray-300">
            No listings yet.
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {listings.map((listing: Listing) => {
              const previewImage = previewMap[listing.id] || "/placeholder.jpg";
              const activeBoost = isBoostActive(listing.boost_until);

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
                      <StatusBadge status={listing.status} />

                      {activeBoost && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-yellow-400 px-3 py-1 text-xs font-black text-black">
                          <Crown size={13} />
                          Boosted
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
                          {listing.location || "No location"}
                        </p>
                      </div>

                      <StatusBadge status={listing.status} />
                    </div>

                    <p className="mt-3 text-3xl font-black">${listing.price}</p>

                    <p className="mt-3 line-clamp-2 text-sm leading-6 text-gray-400">
                      {listing.description || "No description provided."}
                    </p>

                    {activeBoost ? (
                      <div className="mt-5 rounded-2xl border border-yellow-400/30 bg-yellow-500/10 p-4">
                        <p className="flex items-center gap-2 font-bold text-yellow-300">
                          <Crown size={16} />
                          Boost active
                        </p>
                        <p className="mt-1 text-sm text-yellow-100/70">
                          This listing is boosted until{" "}
                          {formatDate(listing.boost_until)}.
                        </p>

                        <div className="mt-4 grid grid-cols-3 gap-2">
                          <BoostCheckoutButton
                            listingId={listing.id}
                            days={1}
                            label="+1 Day"
                          />
                          <BoostCheckoutButton
                            listingId={listing.id}
                            days={7}
                            label="+7 Days"
                          />
                          <BoostCheckoutButton
                            listingId={listing.id}
                            days={30}
                            label="+30 Days"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="mt-5 rounded-2xl border border-yellow-400/20 bg-yellow-500/10 p-4">
                        <p className="flex items-center gap-2 font-bold text-yellow-300">
                          <Crown size={16} />
                          Boost this listing
                        </p>

                        <p className="mt-1 text-sm text-yellow-100/70">
                          Push this listing higher in search visibility.
                        </p>

                        <div className="mt-4 grid grid-cols-3 gap-2">
                          <BoostCheckoutButton
                            listingId={listing.id}
                            days={1}
                            label="1 Day"
                          />
                          <BoostCheckoutButton
                            listingId={listing.id}
                            days={7}
                            label="7 Days"
                          />
                          <BoostCheckoutButton
                            listingId={listing.id}
                            days={30}
                            label="30 Days"
                          />
                        </div>
                      </div>
                    )}

                    <ListingStatusControls
                      listingId={listing.id}
                      currentStatus={listing.status}
                    />

                    <div className="mt-5 flex flex-wrap gap-3">
                      <Link
                        href={`/listings/${listing.id}`}
                        className="rounded-xl border border-gray-600 px-4 py-2 text-white hover:bg-gray-900"
                      >
                        View
                      </Link>

                      <Link
                        href={`/listings/${listing.id}/edit`}
                        className="rounded-xl bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
                      >
                        Edit
                      </Link>

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