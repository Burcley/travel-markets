"use client";

import { useTranslations } from "next-intl";

const studentSteps = ["search", "contact", "viewing", "move"] as const;
const landlordSteps = ["list", "review", "schedule", "lease"] as const;
type TranslationFn = (key: string) => string;

export default function HowTravelMarketsWorks() {
  const t = useTranslations("home.howTravelMarketsWorks");

  return (
    <section className="border-b border-white/10 bg-[#050505] px-6 py-16">
      <div className="mx-auto max-w-7xl">
        <div className="max-w-3xl">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-pink-300">
            {t("eyebrow")}
          </p>
          <h2 className="mt-3 text-3xl font-black text-white sm:text-5xl">
            {t("title")}
          </h2>
          <p className="mt-4 text-base leading-7 text-zinc-400">
            {t("text")}
          </p>
        </div>

        <div className="mt-10 grid gap-5 lg:grid-cols-2">
          <FlowCard title={t("studentsTitle")} steps={studentSteps} t={t} />
          <FlowCard title={t("landlordsTitle")} steps={landlordSteps} t={t} />
        </div>
      </div>
    </section>
  );
}

function FlowCard({
  title,
  steps,
  t,
}: {
  title: string;
  steps: readonly string[];
  t: TranslationFn;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-zinc-950 p-6">
      <h3 className="text-2xl font-black text-white">{title}</h3>

      <div className="mt-6 space-y-4">
        {steps.map((step, index) => (
          <div key={step} className="flex gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-sm font-black text-black">
              {index + 1}
            </div>
            <div>
              <p className="font-bold text-white">{t(`${step}.title`)}</p>
              <p className="mt-1 text-sm leading-6 text-zinc-400">
                {t(`${step}.text`)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
