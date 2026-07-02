import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createSeo } from "@/lib/seo";

export const metadata = createSeo({
  title: "FAQ",
  description:
    "Find answers about student housing, landlord listings, secure messaging, viewing appointments, and Travel Markets safety features.",
  path: "/faq",
});

export default async function FAQPage() {
  const t = await getTranslations("staticPages.faq");
  const faqs = [0, 1, 2, 3, 4, 5, 6, 7].map((index) => ({
    q: t(`items.${index}.q`),
    a: t(`items.${index}.a`),
  }));

  return (
    <main className="min-h-screen bg-[#050505] px-6 py-24 text-white">
      <section className="mx-auto max-w-5xl text-center">
        <p className="text-sm font-bold uppercase tracking-widest text-red-400">
          {t("eyebrow")}
        </p>

        <h1 className="mt-5 text-4xl font-black sm:text-6xl">
          {t("title")}
        </h1>

        <p className="mx-auto mt-6 max-w-3xl text-lg leading-8 text-white/70">
          {t("subtitle")}
        </p>
      </section>

      <section className="mx-auto mt-16 max-w-5xl space-y-4">
        {faqs.map((item) => (
          <div
            key={item.q}
            className="rounded-3xl border border-white/10 bg-white/[0.04] p-6"
          >
            <h2 className="text-xl font-black">{item.q}</h2>
            <p className="mt-3 leading-7 text-white/65">{item.a}</p>
          </div>
        ))}
      </section>

      <section className="mx-auto mt-20 max-w-5xl rounded-[2rem] border border-white/10 bg-white/[0.04] p-8 text-center sm:p-12">
        <h2 className="text-3xl font-black">{t("helpTitle")}</h2>

        <p className="mx-auto mt-4 max-w-2xl text-white/70">
          {t("helpText")}
        </p>

        <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
          <Link
            href="/contact"
            className="rounded-2xl bg-red-600 px-8 py-4 font-bold hover:bg-red-500"
          >
            {t("contactSupport")}
          </Link>

          <Link
            href="/safety"
            className="rounded-2xl border border-white/15 bg-white/10 px-8 py-4 font-bold hover:bg-white/15"
          >
            {t("safetyCentre")}
          </Link>
        </div>
      </section>
    </main>
  );
}
