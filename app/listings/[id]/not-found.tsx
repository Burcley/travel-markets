import Link from "next/link";

export default function ListingNotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-6 text-white">
      <div className="max-w-lg text-center">
        <div className="mb-5 text-7xl">🏠</div>

        <h1 className="text-4xl font-bold">
          Listing not found
        </h1>

        <p className="mt-4 leading-7 text-zinc-400">
          This listing may have been deleted, rented, or no longer exists.
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <Link
            href="/"
            className="rounded-2xl bg-white px-6 py-4 font-bold text-black hover:bg-zinc-200"
          >
            Explore Listings
          </Link>

          <Link
            href="/saved-listings"
            className="rounded-2xl border border-zinc-700 px-6 py-4 font-bold text-white hover:bg-white/10"
          >
            Saved Listings
          </Link>
        </div>
      </div>
    </main>
  );
}