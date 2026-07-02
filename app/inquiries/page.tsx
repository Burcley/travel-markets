import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function InquiriesHubPage() {
  const t = await getTranslations("inquiries.hub");

  return (
    <main className="min-h-screen bg-black px-6 py-10 text-white">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-4xl font-bold">{t("title")}</h1>
        <p className="mt-2 text-zinc-400">
          {t("subtitle")}
        </p>

        <div className="mt-8 grid gap-5 md:grid-cols-2">
          <Link
            href="/inquiries/received"
            className="rounded-3xl border border-zinc-800 bg-zinc-950 p-8 transition hover:border-white/40"
          >
            <h2 className="text-2xl font-bold">{t("receivedTitle")}</h2>
            <p className="mt-3 text-zinc-400">
              {t("receivedText")}
            </p>
          </Link>

          <Link
            href="/inquiries/sent"
            className="rounded-3xl border border-zinc-800 bg-zinc-950 p-8 transition hover:border-white/40"
          >
            <h2 className="text-2xl font-bold">{t("sentTitle")}</h2>
            <p className="mt-3 text-zinc-400">
              {t("sentText")}
            </p>
          </Link>
        </div>

        <Link
          href="/dashboard"
          className="mt-8 inline-flex rounded-xl border border-zinc-700 px-5 py-3 font-semibold hover:bg-white/10"
        >
          {t("backToDashboard")}
        </Link>
      </div>
    </main>
  );
}
