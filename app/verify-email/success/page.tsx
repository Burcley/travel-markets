import Link from "next/link";
import { CheckCircle2, ShieldCheck } from "lucide-react";

export default function EmailVerificationSuccessPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-4 py-12 text-white">
      <section className="w-full max-w-2xl overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.20),rgba(24,24,27,0.96)_42%,rgba(0,0,0,1)_100%)] p-7 text-center shadow-2xl sm:p-10">
        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border border-emerald-400/25 bg-emerald-500/10 text-emerald-300 shadow-2xl shadow-emerald-500/10">
          <CheckCircle2 className="h-14 w-14 animate-in zoom-in duration-500" />
        </div>

        <p className="mt-7 text-sm font-black uppercase tracking-[0.2em] text-emerald-300">
          Email Verified
        </p>

        <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
          Your account is now secure.
        </h1>

        <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-zinc-300">
          Your account is protected and your registration is almost complete.
          Continue to your recommended verification options before entering the
          platform.
        </p>

        <div className="mx-auto mt-7 flex max-w-md items-center gap-3 rounded-2xl border border-white/10 bg-black/40 p-4 text-left">
          <ShieldCheck className="h-6 w-6 shrink-0 text-emerald-300" />
          <p className="text-sm leading-6 text-zinc-300">
            Verification helps protect students, property owners, and every
            rental conversation on Travel Markets.
          </p>
        </div>

        <Link
          href="/onboarding/verifications"
          className="mt-8 inline-flex rounded-2xl bg-white px-7 py-3 text-sm font-black text-black shadow-lg shadow-white/10 transition hover:-translate-y-0.5 hover:bg-zinc-200"
        >
          Continue
        </Link>
      </section>
    </main>
  );
}
