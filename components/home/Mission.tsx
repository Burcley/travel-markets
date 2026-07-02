import { useTranslations } from "next-intl";

export default function Mission() {
  const t = useTranslations("home.mission");

  return (
    <section className="px-6 py-20">
      <div className="mx-auto max-w-5xl text-center">
        <p className="text-sm font-bold uppercase tracking-widest text-red-400">
          {t("eyebrow")}
        </p>

        <h2 className="mt-4 text-3xl font-black sm:text-5xl">
          {t("title")}
        </h2>

        <p className="mt-6 text-lg leading-8 text-white/70">
          {t("text")}
        </p>
      </div>
    </section>
  );
}
