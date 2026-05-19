import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function UnlockedAddressPage({
  params,
}: {
  params: Promise<{ listingId: string }>;
}) {
  const { listingId } = await params;
  const supabase = await createClient();

  if (!listingId) {
    return (
      <main className="min-h-screen bg-black px-6 py-10 text-white">
        Invalid listing address link.
      </main>
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth");

  const { data: address, error } = await supabase
    .from("unlocked_listing_addresses")
    .select("*")
    .eq("listing_id", listingId)
    .maybeSingle();

  if (error || !address) {
    return (
      <main className="min-h-screen bg-black px-6 py-10 text-white">
        <div className="mx-auto max-w-2xl rounded-3xl border border-red-500/30 bg-red-950/20 p-8">
          <h1 className="text-2xl font-bold">Address locked</h1>
          <p className="mt-3 text-zinc-300">
            This address is only available after the owner accepts your viewing request.
          </p>

          <Link
            href={`/listings/${listingId}`}
            className="mt-6 inline-flex rounded-xl bg-white px-5 py-3 font-semibold text-black"
          >
            Back to listing
          </Link>
        </div>
      </main>
    );
  }

  const fullAddress = [
    address.address_line,
    address.unit ? `Unit ${address.unit}` : null,
    address.city,
    address.province,
    address.postal_code,
    address.country,
  ]
    .filter(Boolean)
    .join(", ");

  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    fullAddress
  )}`;

  return (
    <main className="min-h-screen bg-black px-6 py-10 text-white">
      <div className="mx-auto max-w-3xl rounded-3xl border border-emerald-500/30 bg-emerald-950/20 p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-emerald-400">
          Approved Viewing
        </p>

        <h1 className="mt-3 text-3xl font-bold">{address.title}</h1>

        <div className="mt-8 rounded-2xl border border-white/10 bg-black p-6">
          <p className="text-sm text-zinc-400">Exact Address</p>
          <p className="mt-2 text-xl font-semibold">
            {fullAddress || "Exact address not added yet"}
          </p>
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-black p-6">
          <p className="text-sm text-zinc-400">Safety Instructions</p>
          <p className="mt-2 whitespace-pre-line text-zinc-200">
            {address.safety_instructions ||
              "Arrive on time. Do not share this address publicly."}
          </p>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl bg-emerald-500 px-5 py-3 text-center font-bold text-black"
          >
            Open in Google Maps
          </a>

          <Link
            href={`/listings/${listingId}`}
            className="rounded-xl border border-white/10 px-5 py-3 text-center font-semibold"
          >
            Back to listing
          </Link>
        </div>
      </div>
    </main>
  );
}