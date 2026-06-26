import Link from "next/link";

export default function FinalCTA() {
  return (
    <section className="px-6 py-24">
      <div className="mx-auto max-w-7xl rounded-[2rem] bg-red-600 p-10 text-center sm:p-16">
        <h2 className="text-3xl font-black sm:text-5xl">
          Ready to find your next student home?
        </h2>

        <p className="mx-auto mt-5 max-w-2xl text-white/80">
          Search trusted student rentals or list your property for students today.
        </p>

        <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
          <Link href="/search" className="rounded-2xl bg-white px-8 py-4 font-bold text-black">
            Find Housing
          </Link>

          <Link href="/post" className="rounded-2xl bg-black/20 px-8 py-4 font-bold text-white">
            List Property
          </Link>
        </div>
      </div>
    </section>
  );
}