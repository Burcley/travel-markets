"use client";

import { FileCheck2, Lightbulb, MapPinned } from "lucide-react";
import { useTranslations } from "next-intl";

const items = [
  {
    key: "campusDistance",
    icon: MapPinned,
  },
  {
    key: "utilities",
    icon: Lightbulb,
  },
  {
    key: "leaseConditions",
    icon: FileCheck2,
  },
] as const;

export default function TransparencyInfoStrip() {
  const t = useTranslations("home.transparencyStrip");

  return (
    <section className="bg-[#050505] px-6 py-10 text-white">
      <div className="mx-auto max-w-7xl rounded-3xl border border-white/10 bg-white/[0.03] p-6">
        <div className="grid gap-5 md:grid-cols-3">
          {items.map(({ key, icon: Icon }) => (
            <div
              key={key}
              className="rounded-2xl border border-white/10 bg-black/40 p-5"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-pink-500/15 text-pink-200">
                <Icon size={20} />
              </div>
              <h2 className="mt-4 text-lg font-bold">{t(`${key}.title`)}</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                {t(`${key}.text`)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
