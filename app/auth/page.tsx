"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";

export default function AuthPage() {
  const t = useTranslations("accountPages.auth");
  const router = useRouter();
  const supabase = createClient();

  const [isLogin, setIsLogin] = useState(true);
  const [signupComplete, setSignupComplete] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();

    setLoading(true);
    setMessage("");
    setErrorMessage("");

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          if (
            error.message.toLowerCase().includes("email not confirmed") ||
            error.message.toLowerCase().includes("email_not_confirmed")
          ) {
            setErrorMessage(t("emailNotVerified"));
            return;
          }

          throw error;
        }

        router.push("/");
        router.refresh();
        return;
      }

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth`,
        },
      });

      if (error) throw error;

      setSignupComplete(true);
      setMessage(t("accountCreated"));
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : t("genericError")
      );
    } finally {
      setLoading(false);
    }
  }

  if (signupComplete) {
    return (
      <main className="min-h-screen bg-black px-6 py-16 text-white">
        <div className="mx-auto max-w-xl rounded-3xl border border-white/10 bg-zinc-950 p-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 text-3xl">
            ✉️
          </div>

          <h1 className="mt-6 text-3xl font-bold">{t("checkEmailTitle")}</h1>

          <p className="mt-4 text-zinc-400">
            {t("sentVerificationTo")}
          </p>

          <p className="mt-2 font-semibold text-white">{email}</p>

          <p className="mt-4 text-sm text-zinc-500">
            {t("checkEmailText")}
          </p>

          <div className="mt-6 flex flex-col gap-3">
            <button
              onClick={() => {
                setSignupComplete(false);
                setIsLogin(true);
                setMessage("");
                setErrorMessage("");
              }}
              className="rounded-xl bg-white px-5 py-3 font-semibold text-black hover:bg-zinc-200"
            >
              {t("backToLogin")}
            </button>

            <Link
              href="/verify-email"
              className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 font-semibold hover:bg-white/10"
            >
              {t("resendVerification")}
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-6 py-16 text-white">
      <div className="mx-auto max-w-md rounded-3xl border border-white/10 bg-zinc-950 p-8">
        <div className="mb-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-pink-500 text-xl font-black">
            TM
          </div>

          <h1 className="mt-5 text-3xl font-bold">
            {isLogin ? t("welcomeBack") : t("createAccountTitle")}
          </h1>

          <p className="mt-2 text-sm text-zinc-400">
            {isLogin
              ? t("loginSubtitle")
              : t("signupSubtitle")}
          </p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-semibold text-zinc-300">
              {t("email")}
            </label>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 outline-none focus:border-pink-500"
            />
          </div>
          {isLogin && (
  <Link
    href="/forgot-password"
    className="block text-right text-sm text-zinc-400 hover:text-white"
  >
    {t("forgotPassword")}
  </Link>
)}

          <div>
            <label className="mb-2 block text-sm font-semibold text-zinc-300">
              {t("password")}
            </label>
            <input
              type="password"
              placeholder={t("passwordPlaceholder")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 outline-none focus:border-pink-500"
            />
          </div>

          {message && (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-300">
              {message}
            </div>
          )}

          {errorMessage && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">
              <p>{errorMessage}</p>

              {(errorMessage === t("emailNotVerified") ||
                errorMessage.toLowerCase().includes("verified")) && (
                <Link
                  href="/verify-email"
                  className="mt-2 inline-block font-semibold text-red-200 underline"
                >
                  {t("resendVerification")}
                </Link>
              )}
            </div>
          )}

          <button
            disabled={loading}
            className="w-full rounded-xl bg-white px-5 py-3 font-bold text-black hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading
              ? t("pleaseWait")
              : isLogin
              ? t("login")
              : t("createAccount")}
          </button>
        </form>

        <button
          onClick={() => {
            setIsLogin(!isLogin);
            setMessage("");
            setErrorMessage("");
          }}
          className="mt-5 w-full rounded-xl border border-white/10 bg-white/5 px-5 py-3 font-semibold hover:bg-white/10"
        >
          {isLogin ? t("createNewAccount") : t("alreadyHaveAccount")}
        </button>

        <Link
          href="/"
          className="mt-4 block text-center text-sm text-zinc-500 hover:text-white"
        >
          {t("backToHomepage")}
        </Link>
      </div>
    </main>
  );
}
