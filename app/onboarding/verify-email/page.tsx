"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Inbox, Loader2, Mail, RefreshCw, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const RESEND_SECONDS = 45;

export default function OnboardingVerifyEmailPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [email, setEmail] = useState("");
  const [editingEmail, setEditingEmail] = useState(false);
  const [nextEmail, setNextEmail] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    loadUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (countdown <= 0) return;

    const timer = setTimeout(() => setCountdown((value) => Math.max(0, value - 1)), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  async function loadUser() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.replace("/auth");
      return;
    }

    if (user.email_confirmed_at) {
      await supabase
        .from("profiles")
        .update({
          email_verified_at: user.email_confirmed_at,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      router.replace("/onboarding/verifications");
      return;
    }

    setEmail(user.email || "");
    setNextEmail(user.email || "");
    setLoading(false);
  }

  async function sendVerificationEmail() {
    if (!email || countdown > 0) return;

    setSending(true);
    setMessage("");
    setError("");

    const { error: sendError } = await supabase.auth.resend({
      type: "signup",
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    setSending(false);

    if (sendError) {
      console.error("ONBOARDING EMAIL RESEND ERROR:", sendError);
      setError(sendError.message || "We could not send that email. Please try again.");
      return;
    }

    setCountdown(RESEND_SECONDS);
    setMessage("Verification email sent. Check your inbox and spam folder.");
  }

  async function changeEmail() {
    if (!nextEmail.trim() || nextEmail.trim() === email) {
      setEditingEmail(false);
      return;
    }

    setSending(true);
    setError("");
    setMessage("");

    const { error: updateError } = await supabase.auth.updateUser(
      { email: nextEmail.trim() },
      { emailRedirectTo: `${window.location.origin}/auth/callback` }
    );

    setSending(false);

    if (updateError) {
      console.error("ONBOARDING EMAIL CHANGE ERROR:", updateError);
      setError(updateError.message || "We could not change your email address.");
      return;
    }

    setEmail(nextEmail.trim());
    setEditingEmail(false);
    setCountdown(RESEND_SECONDS);
    setMessage("Email updated. Check the new inbox for your verification link.");
  }

  async function checkVerification() {
    setChecking(true);
    setError("");

    const { data, error: refreshError } = await supabase.auth.refreshSession();

    if (refreshError) {
      console.error("ONBOARDING EMAIL CHECK ERROR:", refreshError);
    }

    const user = data.user || (await supabase.auth.getUser()).data.user;

    setChecking(false);

    if (user?.email_confirmed_at) {
      await supabase
        .from("profiles")
        .update({
          email_verified_at: user.email_confirmed_at,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      router.push("/onboarding/verifications");
      return;
    }

    setError("Email is not verified yet. Open the link we sent, then try again.");
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black text-white">
        <Loader2 className="h-8 w-8 animate-spin text-pink-300" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-4 py-10 text-white">
      <div className="mx-auto max-w-5xl">
        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(244,63,94,0.24),rgba(24,24,27,0.96)_38%,rgba(0,0,0,1)_100%)] shadow-2xl">
          <div className="grid lg:grid-cols-[1fr_420px]">
            <div className="p-7 sm:p-10">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-pink-500 text-xl font-black shadow-2xl shadow-pink-500/20">
                TM
              </div>
              <p className="mt-8 text-sm font-black uppercase tracking-[0.2em] text-pink-300">
                Step 4 — Verify Email
              </p>
              <h1 className="mt-3 max-w-2xl text-4xl font-black tracking-tight sm:text-6xl">
                Verify your email before entering Travel Markets.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-zinc-300">
                Email verification is required before normal account access.
                It protects your account and helps keep messages, viewings, and
                listings trustworthy.
              </p>

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                {["Messaging", "Viewing bookings", "Listing actions"].map((item) => (
                  <div key={item} className="rounded-2xl border border-white/10 bg-black/40 p-4">
                    <ShieldCheck className="h-5 w-5 text-emerald-300" />
                    <p className="mt-3 text-sm font-bold">{item}</p>
                    <p className="mt-1 text-xs text-zinc-500">Unlocked after email verification</p>
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
                    <h2 className="text-xl font-black">Check your inbox</h2>
                    <p className="mt-1 text-sm text-zinc-500">We are verifying:</p>
                  </div>
                </div>

                {editingEmail ? (
                  <div className="mt-5">
                    <label className="text-sm font-bold text-zinc-300">Email address</label>
                    <input
                      value={nextEmail}
                      onChange={(event) => setNextEmail(event.target.value)}
                      type="email"
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-pink-400"
                    />
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <button onClick={changeEmail} disabled={sending} className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-black disabled:opacity-50">
                        Save email
                      </button>
                      <button onClick={() => setEditingEmail(false)} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-5 rounded-2xl border border-white/10 bg-black p-4">
                    <p className="break-all font-black">{email}</p>
                    <button
                      type="button"
                      onClick={() => setEditingEmail(true)}
                      className="mt-2 text-sm font-bold text-pink-200 underline underline-offset-4"
                    >
                      Change email address
                    </button>
                  </div>
                )}

                {message && <p className="mt-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-200">{message}</p>}
                {error && <p className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">{error}</p>}

                <div className="mt-5 grid gap-3">
                  <button
                    onClick={sendVerificationEmail}
                    disabled={sending || countdown > 0}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-black text-black transition hover:bg-zinc-200 disabled:opacity-50"
                  >
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    {countdown > 0 ? `Resend in ${countdown}s` : "Send verification email"}
                  </button>

                  <a
                    href="mailto:"
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/10"
                  >
                    <Inbox className="h-4 w-4" />
                    Open email app
                  </a>

                  <button
                    onClick={checkVerification}
                    disabled={checking}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-pink-500/30 bg-pink-500/10 px-5 py-3 text-sm font-bold text-pink-100 transition hover:bg-pink-500/20"
                  >
                    {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                    I verified my email
                  </button>
                </div>

                <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm leading-6 text-zinc-400">
                  <p className="font-bold text-white">Troubleshooting</p>
                  <p className="mt-2">Check spam or promotions. If the link expired, resend the email. If you used the wrong email, change it above.</p>
                  <Link href="/support" className="mt-3 inline-flex font-bold text-pink-200 underline underline-offset-4">
                    Contact support
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
