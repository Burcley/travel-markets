import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function AccountDisabledPage() {
  const t = await getTranslations("accountPages.accountDisabled");

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center px-6">
      <div className="max-w-lg rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
        <h1 className="text-3xl font-bold">{t("title")}</h1>

        <p className="mt-4 text-white/70">
          {t("text")}
        </p>

        <Link
          href="/"
          className="mt-8 inline-flex rounded-full bg-white px-6 py-3 text-sm font-semibold text-black"
        >
          {t("backToHomepage")}
        </Link>
      </div>
    </main>
  );
}
