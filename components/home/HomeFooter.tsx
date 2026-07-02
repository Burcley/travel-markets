import Link from "next/link";
import { useTranslations } from "next-intl";

const groups = [
  {
    title: "company",
    links: [
      ["about", "/about"],
      ["contact", "/contact"],
      ["safety", "/safety"],
      ["faq", "/faq"],
    ],
  },
  {
    title: "students",
    links: [
      ["browseListings", "/search"],
      ["savedListings", "/saved"],
      ["messages", "/messages"],
    ],
  },
  {
    title: "landlords",
    links: [
      ["listProperty", "/post"],
      ["pricing", "/billing"],
      ["dashboard", "/dashboard"],
    ],
  },
  {
    title: "legal",
    links: [
      ["privacyPolicy", "/privacy"],
      ["termsOfService", "/terms"],
      ["reportProblem", "/contact"],
    ],
  },
];

export default function HomeFooter() {
  const t = useTranslations("home.homeFooter");

  return (
    <footer className="border-t border-white/10 px-6 py-14">
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <h3 className="text-2xl font-black">Travel Markets</h3>
          <p className="mt-4 max-w-md text-sm leading-6 text-white/60">
            {t("description")}
          </p>
        </div>

        {groups.map((group) => (
          <div key={group.title}>
            <h4 className="font-black">{t(group.title)}</h4>
            <div className="mt-4 flex flex-col gap-3">
              {group.links.map(([label, href]) => (
                <Link
                  key={label}
                  href={href}
                  className="text-sm text-white/60 hover:text-white"
                >
                  {t(label)}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mx-auto mt-12 max-w-7xl border-t border-white/10 pt-6 text-sm text-white/40">
        {t("copyright", { year: new Date().getFullYear() })}
      </div>
    </footer>
  );
}
