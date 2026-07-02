"use client";

import { useTranslations } from "next-intl";

const items = ["verifiedListings", "secureMessaging", "viewingAppointments", "builtForStudents"];

export default function TrustBar() {
  const t = useTranslations("home.trustStrip");

  return (
    <section className="border-y border-white/10 bg-white/[0.03] px-6 py-6">
      <div className="mx-auto grid max-w-7xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item) => (
          <div key={item} className="rounded-2xl bg-white/5 px-5 py-4 text-sm font-semibold text-white/80">
            ✓ {t(item)}
          </div>
        ))}
      </div>
    </section>
  );
}
