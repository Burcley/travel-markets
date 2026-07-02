"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const t = useTranslations("auth.resetPassword");
  const router = useRouter();
  const supabase = createClient();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  async function updatePassword(e: React.FormEvent) {
    e.preventDefault();

    setMessage("");
    setErrorMessage("");

    if (password.length < 6) {
      setErrorMessage(t("passwordTooShort"));
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage(t("passwordsDoNotMatch"));
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({
      password,
    });

    setLoading(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setMessage(t("successMessage"));
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

        {message ? (
          <div className="mt-8 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-5 text-center">
            <p className="text-sm text-emerald-300">{message}</p>
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                router.push("/auth");
                router.refresh();
              }}
              className="mt-5 w-full rounded-xl bg-white px-5 py-3 font-bold text-black hover:bg-zinc-200"
            >
              {t("goToLogin")}
            </button>
          </div>
        ) : (
        <form onSubmit={updatePassword} className="mt-8 space-y-4">
          <input
            type="password"
            required
            minLength={6}
            placeholder={t("newPassword")}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 outline-none focus:border-pink-500"
          />

          <input
            type="password"
            required
            minLength={6}
            placeholder={t("confirmNewPassword")}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
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
            {loading ? t("updating") : t("updatePassword")}
          </button>
        </form>
        )}

        {!message && (
          <Link
            href="/auth"
            className="mt-5 block text-center text-sm text-zinc-500 hover:text-white"
          >
            {t("backToLogin")}
          </Link>
        )}
      </div>
    </main>
  );
}
