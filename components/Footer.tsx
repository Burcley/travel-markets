import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-zinc-800 bg-black px-4 py-10 text-white">
      <div className="mx-auto grid max-w-7xl gap-8 md:grid-cols-4">
        <div>
          <div className="mb-3 text-xl font-black">Travel Markets</div>

          <p className="text-sm leading-6 text-zinc-400">
            A safer marketplace for student housing, travel stays, and trusted
            owner connections.
          </p>
        </div>

        <FooterGroup
          title="Marketplace"
          links={[
            ["Explore", "/"],
            ["Post Listing", "/post"],
            ["Saved Listings", "/saved-listings"],
            ["Dashboard", "/dashboard"],
          ]}
        />

        <FooterGroup
          title="Account"
          links={[
            ["Profile", "/profile"],
            ["Messages", "/messages"],
            ["Inquiries", "/inquiries/sent"],
            ["Viewings", "/viewings"],
          ]}
        />

        <FooterGroup
          title="Trust"
          links={[
            ["Admin", "/admin"],
            ["Reports", "/admin/reports"],
            ["Safety", "/"],
            ["Support", "/"],
          ]}
        />
      </div>

      <div className="mx-auto mt-10 flex max-w-7xl flex-col gap-3 border-t border-zinc-800 pt-6 text-sm text-zinc-500 md:flex-row md:items-center md:justify-between">
        <p>© {new Date().getFullYear()} Travel Markets. All rights reserved.</p>
        <p>Exact addresses stay private until approved access.</p>
      </div>
    </footer>
  );
}

function FooterGroup({
  title,
  links,
}: {
  title: string;
  links: [string, string][];
}) {
  return (
    <div>
      <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-zinc-300">
        {title}
      </h3>

      <div className="space-y-2">
        {links.map(([label, href]) => (
          <Link
            key={label}
            href={href}
            className="block text-sm text-zinc-500 hover:text-white"
          >
            {label}
          </Link>
        ))}
      </div>
    </div>
  );
}