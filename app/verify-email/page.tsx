"use client";

import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("accountPages.verifyEmail");
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function resendEmail() {
    setLoading(true);
    setMessage("");
    setError("");

    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/onboarding`,
      },
    });

    setLoading(false);

    if (error) {
      setError(isRateLimitError(error.message) ? t("rateLimit") : t("resendFailed"));
      return;
    }

    setMessage(t("sent"));
  }

  return (
    <main className="min-h-screen bg-black px-6 py-16 text-white">
      <div className="mx-auto max-w-xl rounded-3xl border border-white/10 bg-zinc-950 p-8">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-pink-500/10 text-3xl">
            ✉️
          </div>

          <h1 className="mt-6 text-3xl font-bold">{t("title")}</h1>

          <p className="mt-3 text-zinc-400">
            {t("subtitle")}
          </p>
        </div>

        <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-5">
          <label className="text-sm font-semibold text-zinc-300">
            {t("resendLabel")}
          </label>

          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("emailPlaceholder")}
            type="email"
            className="mt-3 w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 outline-none focus:border-pink-500"
          />

          {message && <p className="mt-3 text-sm text-emerald-400">{message}</p>}
          {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

          <button
            onClick={resendEmail}
            disabled={loading || !email}
            className="mt-5 w-full rounded-xl bg-white px-6 py-3 font-semibold text-black hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? t("sending") : t("resendButton")}
          </button>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/auth"
            className="flex-1 rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-center font-semibold hover:bg-white/10"
          >
            {t("backToLogin")}
          </Link>

          <Link
            href="/"
            className="flex-1 rounded-xl bg-white px-5 py-3 text-center font-semibold text-black hover:bg-zinc-200"
          >
            {t("backHome")}
          </Link>
        </div>
      </div>
    </main>
  );
}
