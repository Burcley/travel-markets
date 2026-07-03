import Link from "next/link";
import { getTranslations } from "next-intl/server";

const sections = ["students", "landlords", "safety"] as const;
const faqs = ["payments", "addresses", "messages", "support"] as const;

export default async function HelpPage() {
  const t = await getTranslations("help");

  return (
    <main className="min-h-screen bg-black px-6 py-12 text-white">
      <div className="mx-auto max-w-6xl">
        <section className="max-w-3xl">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-pink-300">
            {t("eyebrow")}
          </p>
          <h1 className="mt-3 text-4xl font-black sm:text-6xl">
            {t("title")}
          </h1>
          <p className="mt-5 text-base leading-7 text-zinc-400">
            {t("subtitle")}
          </p>
        </section>

        <section className="mt-10 grid gap-5 md:grid-cols-3">
          {sections.map((section) => (
            <div
              key={section}
              className="rounded-3xl border border-white/10 bg-zinc-950 p-6"
            >
              <h2 className="text-xl font-black">{t(`${section}.title`)}</h2>
              <p className="mt-3 text-sm leading-6 text-zinc-400">
                {t(`${section}.text`)}
              </p>
            </div>
          ))}
        </section>

        <section className="mt-10 rounded-3xl border border-white/10 bg-zinc-950 p-6">
          <h2 className="text-2xl font-black">{t("faqTitle")}</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {faqs.map((faq) => (
              <div key={faq} className="rounded-2xl border border-white/10 bg-black p-5">
                <p className="font-bold">{t(`faqs.${faq}.question`)}</p>
                <p className="mt-2 text-sm leading-6 text-zinc-400">
                  {t(`faqs.${faq}.answer`)}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-10 rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-6">
          <h2 className="text-2xl font-black text-emerald-100">
            {t("contactTitle")}
          </h2>
          <p className="mt-3 text-sm leading-6 text-emerald-50/80">
            {t("contactText")}
          </p>
          <Link
            href="/contact"
            className="mt-5 inline-flex rounded-xl bg-white px-5 py-3 font-semibold text-black hover:bg-zinc-200"
          >
            {t("contactSupport")}
          </Link>
        </section>
      </div>
    </main>
  );
}
