import Link from "next/link";
import { useTranslations } from "next-intl";

export default function FinalCTA() {
  const t = useTranslations("home.finalCta");

  return (
    <section className="px-6 py-24">
      <div className="mx-auto max-w-7xl rounded-[2rem] bg-red-600 p-10 text-center sm:p-16">
        <h2 className="text-3xl font-black sm:text-5xl">
          {t("title")}
        </h2>

        <p className="mx-auto mt-5 max-w-2xl text-white/80">
          {t("text")}
        </p>

        <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
          <Link href="/search" className="rounded-2xl bg-white px-8 py-4 font-bold text-black">
            {t("findHousing")}
          </Link>

          <Link href="/post" className="rounded-2xl bg-black/20 px-8 py-4 font-bold text-white">
            {t("listProperty")}
          </Link>
        </div>
      </div>
    </section>
  );
}
