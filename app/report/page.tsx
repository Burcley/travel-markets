import Link from "next/link";

export default function ReportsPage() {
  return (
    <main className="min-h-screen bg-black px-6 py-16 text-white">
      <div className="mx-auto max-w-3xl rounded-3xl border border-white/10 bg-white/[0.04] p-8">
        <h1 className="text-3xl font-black">Reports</h1>
        <p className="mt-4 text-zinc-400">
          Report unsafe listings, suspicious users, scams, fake housing posts,
          or platform abuse.
        </p>

        <div className="mt-8 grid gap-3">
          <Link
            href="/contact"
            className="rounded-2xl bg-white px-5 py-4 text-center font-bold text-black"
          >
            Contact Support
          </Link>

          <Link
            href="/safety"
            className="rounded-2xl border border-white/10 px-5 py-4 text-center font-bold text-white hover:bg-white/10"
          >
            View Safety Guidelines
          </Link>
        </div>
      </div>
    </main>
  );
}