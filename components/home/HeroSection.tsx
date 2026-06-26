import Link from "next/link";

export default function Hero() {
  return (
    <section className="relative overflow-hidden px-6 py-24 sm:py-32">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#7f1d1d55,transparent_40%),radial-gradient(circle_at_bottom_right,#be123c33,transparent_35%)]" />

      <div className="relative mx-auto max-w-7xl">
        <div className="max-w-3xl">
          <p className="mb-5 inline-flex rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70">
            Student housing made safer and simpler
          </p>

          <h1 className="text-5xl font-black tracking-tight sm:text-7xl">
            Find trusted student housing near your campus.
          </h1>

          <p className="mt-6 max-w-2xl text-lg leading-8 text-white/70">
            Travel Markets connects students with trusted landlords through
            verified listings, secure messaging, viewing appointments, and a
            safer rental experience.
          </p>

          <div className="mt-10 flex flex-col gap-4 sm:flex-row">
            <Link
              href="/search"
              className="rounded-2xl bg-red-600 px-8 py-4 text-center font-bold text-white transition hover:bg-red-500"
            >
              Find Housing
            </Link>

            <Link
              href="/post"
              className="rounded-2xl border border-white/15 bg-white/10 px-8 py-4 text-center font-bold text-white transition hover:bg-white/15"
            >
              List Your Property
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}