import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function SafetyPage() {
  const t = await getTranslations("staticPages.safety");
  const sections = [
    {
      title: t("payTitle"),
      text: t("payText"),
    },
    {
      title: t("verifyTitle"),
      text: t("verifyText"),
    },
    {
      title: t("reportTitle"),
      text: t("reportText"),
    },
  ];

  return (
    <main className="min-h-screen bg-black px-6 py-16 text-white">
      <section className="mx-auto max-w-4xl rounded-3xl border border-white/10 bg-white/[0.04] p-8">
        <p className="mb-3 text-sm font-bold uppercase tracking-[0.25em] text-emerald-300">
          {t("eyebrow")}
        </p>

        <h1 className="text-4xl font-black">{t("title")}</h1>

        <div className="mt-8 space-y-6 text-zinc-400">
          {sections.map((section) => (
            <div key={section.title}>
              <h2 className="text-xl font-bold text-white">{section.title}</h2>
              <p className="mt-2">{section.text}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/reports"
            className="rounded-2xl bg-white px-5 py-3 text-center font-black text-black"
          >
            {t("reportIssue")}
          </Link>

          <Link
            href="/contact"
            className="rounded-2xl border border-white/10 px-5 py-3 text-center font-bold text-white hover:bg-white/10"
          >
            {t("contactSupport")}
          </Link>
        </div>
      </section>
    </main>
  );
}
