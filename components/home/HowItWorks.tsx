import { useTranslations } from "next-intl";

const steps = [
  ["1", "searchTitle", "searchText"],
  ["2", "messageTitle", "messageText"],
  ["3", "viewingTitle", "viewingText"],
  ["4", "chooseTitle", "chooseText"],
];

export default function HowItWorks() {
  const t = useTranslations("home.howItWorks");

  return (
    <section className="px-6 py-20">
      <div className="mx-auto max-w-7xl">
        <h2 className="text-3xl font-black sm:text-5xl">{t("title")}</h2>

        <div className="mt-10 grid gap-5 md:grid-cols-4">
          {steps.map(([num, title, text]) => (
            <div key={num} className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-600 font-black">
                {num}
              </div>
              <h3 className="mt-5 text-xl font-black">{t(title)}</h3>
              <p className="mt-3 text-sm leading-6 text-white/65">{t(text)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
