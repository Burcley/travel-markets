import Link from "next/link";
import { createSeo } from "@/lib/seo";

export const metadata = createSeo({
  title: "For Landlords",
  description:
    "List your property on Travel Markets and reach students actively looking for trusted housing near campus.",
  path: "/landlords",
});

const benefits = [
  "Reach students actively looking for housing",
  "Receive organized inquiries",
  "Chat securely with potential tenants",
  "Manage viewing appointments",
  "Protect your exact address until needed",
  "Promote listings with featured boosts",
];

const steps = [
  ["1", "Create your listing"],
  ["2", "Students discover your property"],
  ["3", "Receive inquiries"],
  ["4", "Schedule viewings"],
  ["5", "Choose your tenant"],
];

export default function LandlordsPage() {
  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <section className="px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <p className="text-sm font-bold uppercase tracking-widest text-red-400">
            For Landlords
          </p>

          <h1 className="mt-5 max-w-4xl text-4xl font-black sm:text-6xl">
            Rent to students with more confidence.
          </h1>

          <p className="mt-6 max-w-3xl text-lg leading-8 text-white/70">
            Travel Markets helps landlords reach serious student renters, manage
            inquiries, schedule viewings, and list properties professionally in
            one student-focused marketplace.
          </p>

          <div className="mt-9 flex flex-col gap-4 sm:flex-row">
            <Link
              href="/post"
              className="rounded-2xl bg-red-600 px-8 py-4 text-center font-bold hover:bg-red-500"
            >
              Start Listing
            </Link>

            <Link
              href="/billing"
              className="rounded-2xl border border-white/15 bg-white/10 px-8 py-4 text-center font-bold hover:bg-white/15"
            >
              View Pricing
            </Link>
          </div>
        </div>
      </section>

      <section className="px-6 py-16">
        <div className="mx-auto grid max-w-6xl gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {benefits.map((item) => (
            <div
              key={item}
              className="rounded-3xl border border-white/10 bg-white/[0.04] p-6"
            >
              <p className="font-bold">✓ {item}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="px-6 py-20">
        <div className="mx-auto max-w-6xl rounded-[2rem] border border-white/10 bg-white/[0.04] p-8 sm:p-12">
          <h2 className="text-3xl font-black sm:text-5xl">How it works</h2>

          <div className="mt-10 grid gap-5 md:grid-cols-5">
            {steps.map(([num, title]) => (
              <div key={num} className="rounded-3xl bg-black/30 p-5">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-red-600 font-black">
                  {num}
                </div>

                <h3 className="mt-5 font-black">{title}</h3>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-20">
        <div className="mx-auto max-w-5xl text-center">
          <h2 className="text-3xl font-black sm:text-5xl">
            Ready to list your property?
          </h2>

          <p className="mx-auto mt-5 max-w-2xl text-white/70">
            Start with a free listing and upgrade when you want more exposure.
          </p>

          <Link
            href="/post"
            className="mt-8 inline-flex rounded-2xl bg-red-600 px-8 py-4 font-bold hover:bg-red-500"
          >
            List Your Property
          </Link>
        </div>
      </section>
    </main>
  );
}