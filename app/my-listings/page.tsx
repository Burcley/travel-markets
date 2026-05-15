import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DeleteListingButton from "@/components/DeleteListingButton";
import ListingStatusControls from "@/components/ListingStatusControls";

type Listing = {
  id: string;
  title: string;
  price: number;
  location: string | null;
  description: string | null;
  status: string | null;
  created_at: string;
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
    .select("id, title, price, location, description, status, created_at")
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
    <main className="mx-auto max-w-7xl px-4 py-10 text-white">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold">My Listings</h1>
          <p className="mt-2 text-gray-400">
            Manage your properties, status, edits, and deletion.
          </p>
        </div>

        <Link
          href="/post"
          className="rounded-lg bg-white px-5 py-3 font-semibold text-black hover:bg-gray-200"
        >
          Create Listing
        </Link>
      </div>

      {!listings || listings.length === 0 ? (
        <div className="rounded-xl border border-gray-700 p-8 text-center text-gray-300">
          No listings yet.
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {listings.map((listing: Listing) => {
            const previewImage = previewMap[listing.id] || "/placeholder.jpg";

            return (
              <div
                key={listing.id}
                className="overflow-hidden rounded-2xl border border-gray-700 bg-black"
              >
                <div className="relative h-64 w-full overflow-hidden bg-gray-900">
                  <img
                    src={previewImage}
                    alt={listing.title}
                    className="h-full w-full object-cover"
                  />

                  <div className="absolute left-4 top-4">
                    <StatusBadge status={listing.status} />
                  </div>
                </div>

                <div className="border-t border-gray-700 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-2xl font-semibold">
                        {listing.title}
                      </h2>

                      <p className="mt-1 text-gray-400">
                        {listing.location || "No location"}
                      </p>
                    </div>

                    <StatusBadge status={listing.status} />
                  </div>

                  <p className="mt-3 text-3xl font-bold">${listing.price}</p>

                  <p className="mt-3 line-clamp-2 text-sm leading-6 text-gray-400">
                    {listing.description || "No description provided."}
                  </p>

                  <ListingStatusControls
                    listingId={listing.id}
                    currentStatus={listing.status}
                  />

                  <div className="mt-5 flex flex-wrap gap-3">
                    <Link
                      href={`/listings/${listing.id}`}
                      className="rounded-lg border border-gray-500 px-4 py-2 text-white hover:bg-gray-900"
                    >
                      View
                    </Link>

                    <Link
                      href={`/listings/${listing.id}/edit`}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
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
    </main>
  );
}