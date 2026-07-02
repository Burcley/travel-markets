import { useTranslations } from "next-intl";

const items = [
  "verifiedAccounts",
  "secureMessaging",
  "protectedAddresses",
  "viewingAppointments",
  "reviewsRatings",
  "reportsModeration",
];

export default function TrustSafety() {
  const t = useTranslations("home.trustSafety");

  return (
    <section className="px-6 py-20">
      <div className="mx-auto max-w-7xl">
        <p className="text-sm font-bold uppercase tracking-widest text-red-400">
          {t("eyebrow")}
        </p>

        <h2 className="mt-3 max-w-3xl text-3xl font-black sm:text-5xl">
          {t("title")}
        </h2>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <div
              key={item}
              className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 transition hover:-translate-y-1 hover:bg-white/[0.07]"
            >
              <h3 className="text-xl font-black">{t(`items.${item}.title`)}</h3>
              <p className="mt-3 text-sm leading-6 text-white/65">
                {t(`items.${item}.text`)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
