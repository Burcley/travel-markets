import Link from "next/link";
import { createSeo } from "@/lib/seo";

export const metadata = createSeo({
  title: "About Travel Markets",
  description:
    "Learn why Travel Markets was built to help students find trusted housing near campus and help landlords reach serious student renters.",
  path: "/about",
});

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <section className="px-6 py-24">
        <div className="mx-auto max-w-5xl text-center">
          <p className="text-sm font-bold uppercase tracking-widest text-red-400">
            About Travel Markets
          </p>

          <h1 className="mt-5 text-4xl font-black sm:text-6xl">
            Student housing should feel safer, simpler, and more trusted.
          </h1>

          <p className="mx-auto mt-6 max-w-3xl text-lg leading-8 text-white/70">
            Travel Markets was built to help students find trusted rentals near
            campus while helping landlords connect with serious student tenants.
          </p>
        </div>
      </section>

      <section className="px-6 py-16">
        <div className="mx-auto max-w-6xl rounded-[2rem] border border-white/10 bg-white/[0.04] p-8 sm:p-12">
          <h2 className="text-3xl font-black">Why we built it</h2>

          <p className="mt-5 text-lg leading-8 text-white/70">
            Every semester, students search through scattered Facebook groups,
            outdated posts, random listings, and messages that often go
            unanswered. At the same time, landlords struggle to reach reliable
            student renters who are actively looking for housing.
          </p>

          <p className="mt-5 text-lg leading-8 text-white/70">
            Travel Markets brings both sides together in one focused student
            housing marketplace with listings, messaging, viewings, reviews, and
            safer address sharing built into the platform.
          </p>
        </div>
      </section>

      <section className="px-6 py-16">
        <div className="mx-auto grid max-w-6xl gap-6 md:grid-cols-3">
          {[
            [
              "For Students",
              "Find rentals near campus, message landlords, book viewings, and stay organized.",
            ],
            [
              "For Landlords",
              "Reach serious student renters and manage inquiries from one professional dashboard.",
            ],
            [
              "For Trust",
              "Use verification, protected addresses, reports, reviews, and safer communication tools.",
            ],
          ].map(([title, text]) => (
            <div
              key={title}
              className="rounded-3xl border border-white/10 bg-white/[0.04] p-6"
            >
              <h3 className="text-2xl font-black">{title}</h3>
              <p className="mt-4 leading-7 text-white/65">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="px-6 py-20">
        <div className="mx-auto max-w-5xl text-center">
          <h2 className="text-3xl font-black sm:text-5xl">
            Our mission is to become Canada&apos;s most trusted student housing
            marketplace.
          </h2>

          <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
            <Link
              href="/search"
              className="rounded-2xl bg-red-600 px-8 py-4 font-bold hover:bg-red-500"
            >
              Find Housing
            </Link>

            <Link
              href="/landlords"
              className="rounded-2xl border border-white/15 bg-white/10 px-8 py-4 font-bold hover:bg-white/15"
            >
              For Landlords
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}