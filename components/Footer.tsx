import Link from "next/link";
import {
  Building2,
  GraduationCap,
  Globe2,
  HelpCircle,
  Home,
  Mail,
  MapPin,
  ShieldCheck,
} from "lucide-react";

const FACEBOOK_URL =
  "https://www.facebook.com/profile.php?id=61591102028180";
const X_URL = "https://x.com/travel_markets";
const INSTAGRAM_URL =
  "https://www.instagram.com/official_travelmarkets/";

const popularSearches: [string, string][] = [
  ["Oshawa student housing", "/search?city=Oshawa"],
  ["Toronto student rentals", "/search?city=Toronto"],
  ["Durham rentals", "/search?city=Durham"],
  ["Campus housing", "/search"],
];

const students: [string, string][] = [
  ["Search Listings", "/search"],
  ["Saved Listings", "/saved-listings"],
  ["Saved Searches", "/saved-searches"],
  ["Recently Viewed", "/recently-viewed"],
  ["Messages", "/messages"],
];

const landlords: [string, string][] = [
  ["For Landlords", "/landlords"],
  ["Post Listing", "/post"],
  ["Pricing", "/billing"],
  ["Dashboard", "/dashboard"],
  ["Manage Listings", "/my-listings"],
];

const support: [string, string][] = [
  ["Help Centre", "/faq"],
  ["Safety Centre", "/safety"],
  ["Contact Support", "/contact"],
  ["Report an Issue", "/reports"],
  ["Privacy Policy", "/privacy"],
  ["Terms of Service", "/terms"],
];

const company: [string, string][] = [
  ["About", "/about"],
  ["Marketplace", "/search"],
  ["Landlord Resources", "/landlords"],
  ["Trust & Safety", "/safety"],
];

export default function Footer() {
  return (
    <footer className="border-t border-white/10 bg-[#050505] text-white">
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-6 sm:p-8">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div>
              <p className="inline-flex rounded-full border border-red-500/20 bg-red-500/10 px-4 py-2 text-xs font-bold uppercase tracking-widest text-red-300">
                Student housing made safer
              </p>

              <h2 className="mt-5 max-w-2xl text-3xl font-black tracking-tight sm:text-4xl">
                Find trusted student housing near campus.
              </h2>

              <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-400">
                Travel Markets helps students discover rentals, message
                landlords, book viewings, and protect exact addresses until the
                right stage of the rental process.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row lg:justify-end">
              <Link
                href="/search"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-black text-black transition hover:bg-zinc-200"
              >
                <Home size={18} />
                Find Housing
              </Link>

              <Link
                href="/landlords"
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] px-5 py-3 text-sm font-bold text-white transition hover:bg-white/10"
              >
                <Building2 size={18} />
                List Property
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-12 grid gap-10 lg:grid-cols-[1.1fr_2fr]">
          <div>
            <Link href="/" className="inline-flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-red-600 text-lg font-black text-white shadow-lg shadow-red-600/20">
                TM
              </div>

              <div>
                <p className="text-xl font-black">Travel Markets</p>
                <p className="text-xs text-zinc-500">
                  Student housing marketplace
                </p>
              </div>
            </Link>

            <p className="mt-5 max-w-sm text-sm leading-6 text-zinc-400">
              Canada&apos;s student housing marketplace connecting students with
              trusted landlords near campus.
            </p>

            <div className="mt-6 grid gap-3 text-sm text-zinc-400">
              <div className="flex items-center gap-3">
                <ShieldCheck size={18} className="text-emerald-400" />
                Protected addresses until approved access
              </div>

              <div className="flex items-center gap-3">
                <GraduationCap size={18} className="text-red-400" />
                Built for students and landlords
              </div>

              <div className="flex items-center gap-3">
                <MapPin size={18} className="text-sky-400" />
                Campus-focused housing discovery
              </div>
            </div>
          </div>

          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <FooterGroup title="Popular" links={popularSearches} />
            <FooterGroup title="Students" links={students} />
            <FooterGroup title="Landlords" links={landlords} />
            <FooterGroup title="Support" links={support} />
          </div>
        </div>

        <div className="mt-10 grid gap-8 border-t border-white/10 pt-8 lg:grid-cols-[1fr_3fr]">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wide text-zinc-300">
              Company
            </h3>

            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
              {company.map(([label, href]) => (
                <Link
                  key={`${label}-${href}`}
                  href={href}
                  className="text-sm text-zinc-500 transition hover:text-white"
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <MiniCard
              icon={<ShieldCheck size={18} />}
              title="Trust first"
              text="Verification, reports, reviews, and safer communication tools."
            />

            <MiniCard
              icon={<HelpCircle size={18} />}
              title="Support ready"
              text="Students and landlords can contact support when they need help."
            />

            <MiniCard
              icon={<Mail size={18} />}
              title="Stay connected"
              text="Notifications keep users updated on inquiries, messages, and viewings."
            />
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-6 border-t border-white/10 pt-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-zinc-500">
            <span>© {new Date().getFullYear()} Travel Markets.</span>

            <Link href="/privacy" className="transition hover:text-white">
              Privacy
            </Link>

            <span>·</span>

            <Link href="/terms" className="transition hover:text-white">
              Terms
            </Link>

            <span>·</span>

            <Link href="/safety" className="transition hover:text-white">
              Safety
            </Link>
          </div>

          <div className="flex flex-wrap items-center gap-5 text-sm font-semibold text-zinc-300">
            <div className="inline-flex items-center gap-2">
              <Globe2 size={18} />
              English (CA)
            </div>

            <div className="inline-flex items-center gap-2">
              <span className="text-lg font-black">$</span>
              CAD
            </div>

            <div className="hidden h-5 w-px bg-white/10 sm:block" />

            <SocialLink href={FACEBOOK_URL} label="Facebook">
              <span className="text-lg font-black">f</span>
            </SocialLink>

            <SocialLink href={X_URL} label="X">
              <span className="text-lg font-black">𝕏</span>
            </SocialLink>

            <SocialLink href={INSTAGRAM_URL} label="Instagram">
              <InstagramSvg />
            </SocialLink>
          </div>
        </div>

        <p className="mt-5 text-xs leading-5 text-zinc-600">
          Exact addresses stay private until approved access. Always review
          listings carefully and report suspicious activity. Travel Markets does
          not guarantee lease approval, property availability, or landlord
          decisions.
        </p>
      </section>
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
      <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-zinc-300">
        {title}
      </h3>

      <div className="space-y-3">
        {links.map(([label, href]) => (
          <Link
            key={`${label}-${href}`}
            href={href}
            className="block text-sm text-zinc-500 transition hover:text-white"
          >
            {label}
          </Link>
        ))}
      </div>
    </div>
  );
}

function MiniCard({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <div className="mb-3 inline-flex rounded-xl bg-white/10 p-2 text-red-300">
        {icon}
      </div>

      <h4 className="font-bold text-white">{title}</h4>
      <p className="mt-2 text-xs leading-5 text-zinc-500">{text}</p>
    </div>
  );
}

function SocialLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-zinc-400 transition hover:border-white/20 hover:bg-white/10 hover:text-white"
    >
      {children}
    </Link>
  );
}

function InstagramSvg() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}