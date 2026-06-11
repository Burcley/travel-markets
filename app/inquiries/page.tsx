import Link from "next/link";

export default function InquiriesHubPage() {
  return (
    <main className="min-h-screen bg-black px-6 py-10 text-white">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-4xl font-bold">Housing Inquiries</h1>
        <p className="mt-2 text-zinc-400">
          Manage student housing requests you sent and received.
        </p>

        <div className="mt-8 grid gap-5 md:grid-cols-2">
          <Link
            href="/inquiries/received"
            className="rounded-3xl border border-zinc-800 bg-zinc-950 p-8 transition hover:border-white/40"
          >
            <h2 className="text-2xl font-bold">Received Inquiries</h2>
            <p className="mt-3 text-zinc-400">
              Students who contacted you about your listings.
            </p>
          </Link>

          <Link
            href="/inquiries/sent"
            className="rounded-3xl border border-zinc-800 bg-zinc-950 p-8 transition hover:border-white/40"
          >
            <h2 className="text-2xl font-bold">Sent Inquiries</h2>
            <p className="mt-3 text-zinc-400">
              Housing requests you sent to property owners.
            </p>
          </Link>
        </div>

        <Link
          href="/dashboard"
          className="mt-8 inline-flex rounded-xl border border-zinc-700 px-5 py-3 font-semibold hover:bg-white/10"
        >
          Back to Dashboard
        </Link>
      </div>
    </main>
  );
}