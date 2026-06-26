import Link from "next/link";
import { createSeo } from "@/lib/seo";

export const metadata = createSeo({
  title: "FAQ",
  description:
    "Find answers about student housing, landlord listings, secure messaging, viewing appointments, and Travel Markets safety features.",
  path: "/faq",
});

const faqs = [
  {
    q: "What is Travel Markets?",
    a: "Travel Markets is a student housing marketplace that helps students find rentals near campus and helps landlords reach serious student tenants.",
  },
  {
    q: "Is Travel Markets only for students?",
    a: "Travel Markets is built mainly for student housing, but landlords and property owners can also use it to list rentals for students.",
  },
  {
    q: "How do students contact landlords?",
    a: "Students can send inquiries and message landlords directly through the platform instead of relying on scattered social media messages.",
  },
  {
    q: "Can landlords post listings?",
    a: "Yes. Landlords can create listings, upload photos, manage inquiries, schedule viewings, and promote listings.",
  },
  {
    q: "Are exact addresses shown publicly?",
    a: "No. Travel Markets is designed to protect exact addresses until the right stage of the rental process.",
  },
  {
    q: "How do viewing appointments work?",
    a: "Students can request viewings and landlords can manage viewing requests from inside the platform.",
  },
  {
    q: "How does Travel Markets improve safety?",
    a: "The platform supports secure messaging, reporting, profile reviews, identity verification, protected addresses, and moderation tools.",
  },
  {
    q: "How do I report a suspicious listing or user?",
    a: "Use the report option on listings or profiles, or contact the Travel Markets safety team through the contact page.",
  },
];

export default function FAQPage() {
  return (
    <main className="min-h-screen bg-[#050505] px-6 py-24 text-white">
      <section className="mx-auto max-w-5xl text-center">
        <p className="text-sm font-bold uppercase tracking-widest text-red-400">
          Help Centre
        </p>

        <h1 className="mt-5 text-4xl font-black sm:text-6xl">
          Frequently asked questions.
        </h1>

        <p className="mx-auto mt-6 max-w-3xl text-lg leading-8 text-white/70">
          Answers for students, landlords, and anyone using Travel Markets to
          find or list student housing.
        </p>
      </section>

      <section className="mx-auto mt-16 max-w-5xl space-y-4">
        {faqs.map((item) => (
          <div
            key={item.q}
            className="rounded-3xl border border-white/10 bg-white/[0.04] p-6"
          >
            <h2 className="text-xl font-black">{item.q}</h2>
            <p className="mt-3 leading-7 text-white/65">{item.a}</p>
          </div>
        ))}
      </section>

      <section className="mx-auto mt-20 max-w-5xl rounded-[2rem] border border-white/10 bg-white/[0.04] p-8 text-center sm:p-12">
        <h2 className="text-3xl font-black">Still need help?</h2>

        <p className="mx-auto mt-4 max-w-2xl text-white/70">
          Contact our support team or visit the Safety Centre for guidance on
          reporting issues and using the platform safely.
        </p>

        <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
          <Link
            href="/contact"
            className="rounded-2xl bg-red-600 px-8 py-4 font-bold hover:bg-red-500"
          >
            Contact Support
          </Link>

          <Link
            href="/safety"
            className="rounded-2xl border border-white/15 bg-white/10 px-8 py-4 font-bold hover:bg-white/15"
          >
            Safety Centre
          </Link>
        </div>
      </section>
    </main>
  );
}