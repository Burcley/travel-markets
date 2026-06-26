"use client";

import Link from "next/link";
import { useState } from "react";

export default function VerifyEmailPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function resendEmail() {
    setLoading(true);
    setMessage("");
    setError("");

    const res = await fetch("/api/auth/resend-verification", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email }),
    });

    const data = await res.json();

    setLoading(false);

    if (!res.ok) {
      setError(data.error || "Failed to resend verification email.");
      return;
    }

    setMessage("Verification email sent. Check your inbox and spam folder.");
  }

  return (
    <main className="min-h-screen bg-black px-6 py-16 text-white">
      <div className="mx-auto max-w-xl rounded-3xl border border-white/10 bg-zinc-950 p-8">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-500/10 text-3xl">
            ✉️
          </div>

          <h1 className="mt-6 text-3xl font-bold">Verify your email</h1>

          <p className="mt-3 text-zinc-400">
            We sent you a verification link. Open your inbox and click the link
            before using Travel Markets.
          </p>
        </div>

        <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-5">
          <label className="text-sm font-semibold text-zinc-300">
            Resend verification email
          </label>

          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            type="email"
            className="mt-3 w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 outline-none focus:border-blue-500"
          />

          {message && <p className="mt-3 text-sm text-emerald-400">{message}</p>}
          {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

          <button
            onClick={resendEmail}
            disabled={loading || !email}
            className="mt-5 w-full rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Sending..." : "Resend verification email"}
          </button>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/auth"
            className="flex-1 rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-center font-semibold hover:bg-white/10"
          >
            Back to login
          </Link>

          <Link
            href="/"
            className="flex-1 rounded-xl bg-white px-5 py-3 text-center font-semibold text-black hover:bg-zinc-200"
          >
            Back home
          </Link>
        </div>
      </div>
    </main>
  );
}