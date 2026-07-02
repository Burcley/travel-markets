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

export default function ForgotPasswordPage() {
  const t = useTranslations("auth.forgotPassword");
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  async function sendResetEmail(e: React.FormEvent) {
    e.preventDefault();

    setLoading(true);
    setMessage("");
    setErrorMessage("");

    const redirectTo = `${window.location.origin}/reset-password`;

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    setLoading(false);

    if (error) {
      setErrorMessage(
        isRateLimitError(error.message) ? t("rateLimit") : t("sendFailed")
      );
      return;
    }

    setMessage(t("sentMessage"));
  }

  return (
    <main className="min-h-screen bg-black px-6 py-16 text-white">
      <div className="mx-auto max-w-md rounded-3xl border border-white/10 bg-zinc-950 p-8 shadow-2xl">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-pink-500 text-xl font-black">
          TM
        </div>

        <h1 className="text-center text-3xl font-bold">{t("title")}</h1>

        <p className="mt-3 text-center text-sm leading-6 text-zinc-400">
          {t("subtitle")}
        </p>

        <form onSubmit={sendResetEmail} className="mt-8 space-y-4">
          <input
            type="email"
            required
            placeholder={t("emailPlaceholder")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 outline-none focus:border-pink-500"
          />

          {message && (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-300">
              {message}
            </div>
          )}

          {errorMessage && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">
              {errorMessage}
            </div>
          )}

          <button
            disabled={loading}
            className="w-full rounded-xl bg-white px-5 py-3 font-bold text-black hover:bg-zinc-200 disabled:opacity-50"
          >
            {loading ? t("sending") : t("sendResetLink")}
          </button>
        </form>

        <Link
          href="/auth"
          className="mt-5 block text-center text-sm text-zinc-500 hover:text-white"
        >
          {t("backToLogin")}
        </Link>
      </div>
    </main>
  );
}
