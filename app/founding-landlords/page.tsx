import Link from "next/link";
import { ArrowRight, BadgeCheck, Gift, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { getFoundingPublicStats } from "@/lib/founding-landlords/server";

const benefits = [
  {
    title: "Permanent founder status",
    text: "Confirmed owners receive a public Founding Landlord number from the first 30 seats.",
    icon: BadgeCheck,
  },
  {
    title: "12 months at 0% platform commission",
    text: "Travel Markets platform commission is waived for the first year. Stripe fees still apply.",
    icon: Gift,
  },
  {
    title: "Lifetime 25% platform discount",
    text: "After the first year, founders keep a permanent 25% discount on eligible platform fees.",
    icon: Sparkles,
  },
  {
    title: "Two free boosts every month",
    text: "Use two 7-day listing boosts per calendar month. Unused boosts do not roll over.",
    icon: Zap,
  },
  {
    title: "Priority verification and support",
    text: "Founder listings and trust checks receive priority admin handling.",
    icon: ShieldCheck,
  },
];

export default async function FoundingLandlordsPage() {
  const stats = await getFoundingPublicStats();

  return (
    <main className="min-h-screen bg-black px-4 py-10 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-10">
        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top,#3b1028_0%,#0f172a_42%,#020617_100%)] p-6 shadow-2xl sm:p-10 lg:p-12">
          <div className="max-w-3xl">
            <p className="inline-flex rounded-full border border-pink-300/30 bg-pink-500/20 px-4 py-2 text-sm font-bold text-pink-100">
              First 30 qualifying landlords
            </p>
            <h1 className="mt-6 text-4xl font-black tracking-tight sm:text-6xl">
              Join the Travel Markets Founding Landlord Program
            </h1>
            <p className="mt-5 text-lg leading-8 text-zinc-300">
              We are reserving founder status for the first 30 qualified
              landlords who help build Canada&apos;s trusted student housing
              marketplace from the ground up.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/auth?role=owner"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-6 py-3 text-sm font-black text-black"
              >
                Create landlord account
                <ArrowRight size={18} />
              </Link>
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-6 py-3 text-sm font-bold text-white"
              >
                Check my status
              </Link>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-4">
          <Stat label="Confirmed" value={stats.confirmedCount} />
          <Stat label="Reserved" value={stats.reservedCount} />
          <Stat label="Available" value={stats.availablePositions} />
          <Stat label="Program size" value={stats.maxPositions} />
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {benefits.map((benefit) => {
            const Icon = benefit.icon;

            return (
              <article
                key={benefit.title}
                className="rounded-3xl border border-white/10 bg-[#080808] p-6 shadow-xl"
              >
                <div className="mb-5 inline-flex rounded-2xl border border-pink-300/25 bg-pink-500/15 p-3 text-pink-100">
                  <Icon size={22} />
                </div>
                <h2 className="text-xl font-black">{benefit.title}</h2>
                <p className="mt-3 text-sm leading-6 text-zinc-400">{benefit.text}</p>
              </article>
            );
          })}
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-[#080808] p-6 sm:p-8">
          <h2 className="text-2xl font-black">Qualification terms</h2>
          <div className="mt-5 grid gap-4 text-sm leading-6 text-zinc-300 md:grid-cols-2">
            <p>
              Founder seats are reserved only for owner, landlord, or host
              accounts. Student, admin, test, incomplete, duplicate, rejected,
              suspended, or banned accounts do not qualify.
            </p>
            <p>
              A reserved seat becomes confirmed after landlord or identity
              verification and at least one legitimate verified active listing.
              Pending reservations expire after 14 days. Confirmed founder
              numbers are never reused.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-[#080808] p-5">
      <p className="text-sm text-zinc-400">{label}</p>
      <p className="mt-2 text-4xl font-black">{value}</p>
    </div>
  );
}
