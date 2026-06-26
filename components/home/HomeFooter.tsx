import Link from "next/link";

const groups = [
  {
    title: "Company",
    links: [
      ["About", "/about"],
      ["Contact", "/contact"],
      ["Safety", "/safety"],
      ["FAQ", "/faq"],
    ],
  },
  {
    title: "Students",
    links: [
      ["Browse Listings", "/search"],
      ["Saved Listings", "/saved"],
      ["Messages", "/messages"],
    ],
  },
  {
    title: "Landlords",
    links: [
      ["List Property", "/post"],
      ["Pricing", "/billing"],
      ["Dashboard", "/dashboard"],
    ],
  },
  {
    title: "Legal",
    links: [
      ["Privacy Policy", "/privacy"],
      ["Terms of Service", "/terms"],
      ["Report a Problem", "/contact"],
    ],
  },
];

export default function HomeFooter() {
  return (
    <footer className="border-t border-white/10 px-6 py-14">
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <h3 className="text-2xl font-black">Travel Markets</h3>
          <p className="mt-4 max-w-md text-sm leading-6 text-white/60">
            Canada&apos;s student housing marketplace connecting students with
            trusted landlords near campus.
          </p>
        </div>

        {groups.map((group) => (
          <div key={group.title}>
            <h4 className="font-black">{group.title}</h4>
            <div className="mt-4 flex flex-col gap-3">
              {group.links.map(([label, href]) => (
                <Link
                  key={label}
                  href={href}
                  className="text-sm text-white/60 hover:text-white"
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mx-auto mt-12 max-w-7xl border-t border-white/10 pt-6 text-sm text-white/40">
        © {new Date().getFullYear()} Travel Markets. All rights reserved.
      </div>
    </footer>
  );
}