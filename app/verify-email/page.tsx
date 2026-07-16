"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2, Mail, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

function isRateLimitError(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("rate limit") ||
    normalized.includes("too many") ||
    normalized.includes("over_email_send_rate_limit")
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<VerifyEmailLoading />}>
      <VerifyEmailContent />
    </Suspense>
  );
}

function VerifyEmailLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-black text-white">
      <Loader2 className="h-8 w-8 animate-spin text-pink-300" />
    </main>
  );
}

function VerifyEmailContent() {
  const supabase = createClient();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(searchParams.get("message") || "");
  const [error, setError] = useState(searchParams.get("error") || "");

  useEffect(() => {
    async function loadEmail() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user?.email) setEmail(user.email);
    }

    loadEmail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function resendEmail() {
    setLoading(true);
    setMessage("");
    setError("");

    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    setLoading(false);

    if (error) {
      setError(
        isRateLimitError(error.message)
          ? "Too many verification emails were requested. Please wait a moment and try again."
          : "We could not send the verification email. Please try again."
      );
      return;
    }

    setMessage("Verification email sent. Check your inbox to continue.");
  }

  return (
    <main className="min-h-screen bg-black px-4 py-12 text-white sm:px-6">
      <div className="mx-auto max-w-5xl">
        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(244,63,94,0.24),rgba(24,24,27,0.96)_40%,rgba(0,0,0,1)_100%)] shadow-2xl">
          <div className="grid gap-0 lg:grid-cols-[1fr_420px]">
            <div className="p-7 sm:p-10">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-pink-500 text-xl font-black shadow-2xl shadow-pink-500/20">
                TM
              </div>

              <p className="mt-8 text-sm font-black uppercase tracking-[0.2em] text-pink-300">
                Verify your email
              </p>
              <h1 className="mt-3 max-w-2xl text-4xl font-black tracking-tight sm:text-6xl">
                Unlock trusted Travel Markets features.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-zinc-300">
                Email verification protects your account and helps us maintain a
                safe marketplace for students, hosts, and property owners.
              </p>

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                {[
                  "Messaging",
                  "Viewing bookings",
                  "Listing actions",
                ].map((item) => (
                  <div
                    key={item}
                    className="rounded-2xl border border-white/10 bg-black/40 p-4"
                  >
                    <CheckCircle2 className="h-5 w-5 text-emerald-300" />
                    <p className="mt-3 text-sm font-bold">{item}</p>
                    <p className="mt-1 text-xs leading-5 text-zinc-500">
                      Requires verified email
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-white/10 bg-black/45 p-6 sm:p-8 lg:border-l lg:border-t-0">
              <div className="rounded-3xl border border-white/10 bg-zinc-950 p-6 shadow-xl">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-pink-500/10 p-3 text-pink-200">
                    <Mail className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black">Send verification email</h2>
                    <p className="mt-1 text-sm text-zinc-500">
                      We will send a secure verification link.
                    </p>
                  </div>
                </div>

                <label className="mt-6 block text-sm font-bold text-zinc-300">
                  Email address
                </label>
                <input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  type="email"
                  className="mt-3 w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none transition placeholder:text-zinc-600 focus:border-pink-400"
                />

                {message && (
                  <div className="mt-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-200">
                    {message}
                  </div>
                )}
                {error && (
                  <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
                    {error}
                  </div>
                )}

                <button
                  onClick={resendEmail}
                  disabled={loading || !email}
                  className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-6 py-3 font-black text-black transition hover:-translate-y-0.5 hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {loading ? "Sending..." : "Send Verification Email"}
                </button>

                <div className="mt-5 flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-pink-200" />
                  <p className="text-sm leading-6 text-zinc-400">
                    If you did not create this account, you can safely ignore the
                    verification email.
                  </p>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <Link
                    href="/dashboard"
                    className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-center text-sm font-bold text-white transition hover:bg-white/10"
                  >
                    Dashboard
                  </Link>
                  <Link
                    href="/support"
                    className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-center text-sm font-bold text-white transition hover:bg-white/10"
                  >
                    Support
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
