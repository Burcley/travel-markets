import { useTranslations } from "next-intl";

const testimonials = [
  {
    quote: "landlordQuote",
    name: "landlordName",
  },
  {
    quote: "studentQuote",
    name: "studentName",
  },
  {
    quote: "missionQuote",
    name: "missionName",
  },
];

export default function Testimonials() {
  const t = useTranslations("home.testimonials");

  return (
    <section className="px-6 py-20">
      <div className="mx-auto max-w-7xl">
        <p className="text-sm font-bold uppercase tracking-widest text-red-400">
          {t("eyebrow")}
        </p>

        <h2 className="mt-3 text-3xl font-black sm:text-5xl">
          {t("title")}
        </h2>

        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {testimonials.map((item) => (
            <div
              key={item.name}
              className="rounded-3xl border border-white/10 bg-white/[0.04] p-6"
            >
              <p className="text-lg leading-8 text-white/80">
                “{t(item.quote)}”
              </p>
              <p className="mt-6 text-sm font-bold text-red-400">
                {t(item.name)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
