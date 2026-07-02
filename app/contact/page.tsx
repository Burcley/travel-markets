"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

export default function ContactPage() {
  const t = useTranslations("staticPages.contact");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setLoading(true);
    setSuccess(false);

    const form = new FormData(e.currentTarget);

    const response = await fetch("/api/support", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: form.get("name"),
        email: form.get("email"),
        category: form.get("category"),
        subject: form.get("subject"),
        message: form.get("message"),
      }),
    });

    setLoading(false);

    if (response.ok) {
      setSuccess(true);
      e.currentTarget.reset();
    }
  }

  return (
    <main className="min-h-screen bg-black px-6 py-12 text-white">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-4xl font-bold">{t("title")}</h1>

        <div className="mt-8 rounded-3xl border border-zinc-800 bg-zinc-950 p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              name="name"
              placeholder={t("fullName")}
              required
              className="w-full rounded-xl bg-zinc-900 p-3"
            />

            <input
              name="email"
              type="email"
              placeholder={t("emailAddress")}
              required
              className="w-full rounded-xl bg-zinc-900 p-3"
            />

            <select
              name="category"
              className="w-full rounded-xl bg-zinc-900 p-3"
            >
              <option value="support">{t("categories.support")}</option>
              <option value="listing">{t("categories.listing")}</option>
              <option value="payment">{t("categories.payment")}</option>
              <option value="report">{t("categories.report")}</option>
              <option value="technical">{t("categories.technical")}</option>
            </select>

            <input
              name="subject"
              placeholder={t("subject")}
              required
              className="w-full rounded-xl bg-zinc-900 p-3"
            />

            <textarea
              name="message"
              rows={6}
              placeholder={t("message")}
              required
              className="w-full rounded-xl bg-zinc-900 p-3"
            />

            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-white px-6 py-3 text-black font-semibold"
            >
              {loading ? t("submitting") : t("submitTicket")}
            </button>

            {success && (
              <p className="text-green-500">
                {t("success")}
              </p>
            )}
          </form>
        </div>
      </div>
    </main>
  );
}
