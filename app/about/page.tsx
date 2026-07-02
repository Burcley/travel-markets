import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createSeo } from "@/lib/seo";

export const metadata = createSeo({
  title: "About Travel Markets",
  description:
    "Learn why Travel Markets was built to help students find trusted housing near campus and help landlords reach serious student renters.",
  path: "/about",
});

export default async function AboutPage() {
  const t = await getTranslations("staticPages.about");
  const cards = [
    {
      title: t("studentsTitle"),
      text: t("studentsText"),
    },
    {
      title: t("landlordsTitle"),
      text: t("landlordsText"),
    },
    {
      title: t("trustTitle"),
      text: t("trustText"),
    },
  ];

  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <section className="px-6 py-24">
        <div className="mx-auto max-w-5xl text-center">
          <p className="text-sm font-bold uppercase tracking-widest text-red-400">
            {t("eyebrow")}
          </p>

          <h1 className="mt-5 text-4xl font-black sm:text-6xl">
            {t("title")}
          </h1>

          <p className="mx-auto mt-6 max-w-3xl text-lg leading-8 text-white/70">
            {t("subtitle")}
          </p>
        </div>
      </section>

      <section className="px-6 py-16">
        <div className="mx-auto max-w-6xl rounded-[2rem] border border-white/10 bg-white/[0.04] p-8 sm:p-12">
          <h2 className="text-3xl font-black">{t("whyTitle")}</h2>

          <p className="mt-5 text-lg leading-8 text-white/70">
            {t("whyText1")}
          </p>

          <p className="mt-5 text-lg leading-8 text-white/70">
            {t("whyText2")}
          </p>
        </div>
      </section>

      <section className="px-6 py-16">
        <div className="mx-auto grid max-w-6xl gap-6 md:grid-cols-3">
          {cards.map(({ title, text }) => (
            <div
              key={title}
              className="rounded-3xl border border-white/10 bg-white/[0.04] p-6"
            >
              <h3 className="text-2xl font-black">{title}</h3>
              <p className="mt-4 leading-7 text-white/65">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="px-6 py-20">
        <div className="mx-auto max-w-5xl text-center">
          <h2 className="text-3xl font-black sm:text-5xl">
            {t("missionTitle")}
          </h2>

          <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
            <Link
              href="/search"
              className="rounded-2xl bg-red-600 px-8 py-4 font-bold hover:bg-red-500"
            >
              {t("findHousing")}
            </Link>

            <Link
              href="/landlords"
              className="rounded-2xl border border-white/15 bg-white/10 px-8 py-4 font-bold hover:bg-white/15"
            >
              {t("forLandlords")}
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
