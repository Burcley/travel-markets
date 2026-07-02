import Link from "next/link";
import { useTranslations } from "next-intl";

const benefits = [
  "reachStudents",
  "receiveInquiries",
  "manageViewings",
  "chatSecurely",
  "promoteListings",
  "buildTrust",
];

export default function LandlordBenefits() {
  const t = useTranslations("home.landlordBenefits");

  return (
    <section className="px-6 py-20">
      <div className="mx-auto max-w-7xl rounded-[2rem] border border-white/10 bg-white/[0.04] p-8 sm:p-12">
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <p className="text-sm font-bold uppercase tracking-widest text-red-400">
              {t("eyebrow")}
            </p>

            <h2 className="mt-3 text-3xl font-black sm:text-5xl">
              {t("title")}
            </h2>

            <p className="mt-5 text-white/70">
              {t("text")}
            </p>

            <Link
              href="/post"
              className="mt-8 inline-flex rounded-2xl bg-red-600 px-7 py-4 font-bold text-white hover:bg-red-500"
            >
              {t("startListing")}
            </Link>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {benefits.map((item) => (
              <div key={item} className="rounded-2xl bg-black/30 p-5 font-bold">
                ✓ {t(item)}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
