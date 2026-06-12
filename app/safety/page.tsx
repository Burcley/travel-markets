import Link from "next/link";

export default function SafetyPage() {
  return (
    <main className="min-h-screen bg-black px-6 py-16 text-white">
      <section className="mx-auto max-w-4xl rounded-3xl border border-white/10 bg-white/[0.04] p-8">
        <p className="mb-3 text-sm font-bold uppercase tracking-[0.25em] text-emerald-300">
          Safety
        </p>

        <h1 className="text-4xl font-black">Travel Markets Safety Guidelines</h1>

        <div className="mt-8 space-y-6 text-zinc-400">
          <div>
            <h2 className="text-xl font-bold text-white">Never pay outside trusted channels</h2>
            <p className="mt-2">
              Avoid sending deposits, rent, or fees through unknown payment links,
              crypto, gift cards, or direct transfers before verifying the listing.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-white">Verify before viewing</h2>
            <p className="mt-2">
              Use verified profiles, reviews, platform messaging, and viewing
              requests before sharing private details.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-white">Report suspicious activity</h2>
            <p className="mt-2">
              Report fake listings, pressure tactics, unsafe behavior, or users
              asking you to leave the platform.
            </p>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/reports"
            className="rounded-2xl bg-white px-5 py-3 text-center font-black text-black"
          >
            Report an issue
          </Link>

          <Link
            href="/contact"
            className="rounded-2xl border border-white/10 px-5 py-3 text-center font-bold text-white hover:bg-white/10"
          >
            Contact support
          </Link>
        </div>
      </section>
    </main>
  );
}