import { getTranslations } from "next-intl/server";

export default async function TermsPage() {
  const t = await getTranslations("staticPages.terms");

  return (
    <main className="min-h-screen bg-black px-6 py-12 text-white">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-4xl font-bold">{t("title")}</h1>

        <div className="mt-8 space-y-6 text-zinc-300">
          <p>
            {t("intro")}
          </p>

          <h2 className="text-2xl font-semibold text-white">
            {t("responsibilitiesTitle")}
          </h2>

          <p>
            {t("responsibilitiesText")}
          </p>

          <h2 className="text-2xl font-semibold text-white">
            {t("contentTitle")}
          </h2>

          <p>
            {t("contentText")}
          </p>

          <h2 className="text-2xl font-semibold text-white">
            {t("liabilityTitle")}
          </h2>

          <p>
            {t("liabilityText")}
          </p>

          <p className="text-sm text-zinc-500">
            {t("lastUpdated", { year: new Date().getFullYear() })}
          </p>
        </div>
      </div>
    </main>
  );
}
