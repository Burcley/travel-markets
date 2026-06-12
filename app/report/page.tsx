import Link from "next/link";

export default function ReportsPage() {
  return (
    <main className="min-h-screen bg-black px-6 py-16 text-white">
      <section className="mx-auto max-w-4xl rounded-3xl border border-white/10 bg-white/[0.04] p-8">
        <p className="mb-3 text-sm font-bold uppercase tracking-[0.25em] text-red-300">
          Trust & Safety
        </p>

        <h1 className="text-4xl font-black">Report a problem</h1>

        <p className="mt-4 max-w-2xl text-zinc-400">
          Use this page to report unsafe listings, fake housing posts, suspicious
          users, scams, harassment, or platform abuse.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <Link
            href="/contact"
            className="rounded-2xl bg-white px-5 py-4 text-center font-black text-black hover:bg-zinc-200"
          >
            Contact Support
          </Link>

          <Link
            href="/safety"
            className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 text-center font-bold text-white hover:bg-white/10"
          >
            View Safety Guidelines
          </Link>
        </div>
      </section>
    </main>
  );
}