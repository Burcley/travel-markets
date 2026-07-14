import Link from "next/link";
import type { ReactNode } from "react";
import { AlertTriangle, FileText, Info, Scale, ShieldCheck } from "lucide-react";

type NoticeTone = "info" | "warning" | "success";

const toneStyles: Record<NoticeTone, string> = {
  info: "border-blue-400/20 bg-blue-500/10 text-blue-100",
  warning: "border-amber-400/20 bg-amber-500/10 text-amber-100",
  success: "border-emerald-400/20 bg-emerald-500/10 text-emerald-100",
};

function Notice({
  icon,
  title,
  children,
  tone = "info",
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
  tone?: NoticeTone;
}) {
  return (
    <div className={`rounded-3xl border p-5 ${toneStyles[tone]}`}>
      <div className="flex gap-3">
        <div className="mt-0.5 shrink-0">{icon}</div>
        <div>
          <p className="font-bold text-white">{title}</p>
          <div className="mt-2 text-sm leading-6 text-current/80">{children}</div>
        </div>
      </div>
    </div>
  );
}

export function VerificationDisclaimer() {
  return (
    <Notice icon={<ShieldCheck size={18} />} title="Verification notice">
      Verification means Travel Markets reviewed selected information provided by
      the user. It does not guarantee identity, ownership, authority, property
      condition, legal compliance, availability, safety or the outcome of a
      rental transaction.
    </Notice>
  );
}

export function UnverifiedListingNotice() {
  return (
    <Notice
      icon={<AlertTriangle size={18} />}
      title="Independent review recommended"
      tone="warning"
    >
      Travel Markets has not completed verification of this account&apos;s
      relationship to the property. Independently verify the listing and the
      person you are dealing with before sending money or sensitive information.
    </Notice>
  );
}

export function PersonalInformationNotice() {
  return (
    <Notice icon={<FileText size={18} />} title="Protect your personal information">
      Only provide personal information reasonably necessary for the rental
      application. Redact unnecessary account numbers, identification numbers and
      unrelated financial information.
    </Notice>
  );
}

export function FairHousingNotice() {
  return (
    <Notice icon={<Scale size={18} />} title="Fair housing reminder">
      Housing providers must comply with applicable human-rights laws.
      Requirements and decisions must not unlawfully discriminate based on
      protected personal characteristics.
    </Notice>
  );
}

export function LegalInformationNotice() {
  return (
    <Notice icon={<Info size={18} />} title="Platform information">
      Travel Markets provides platform information, not legal advice. Rental laws
      and their application depend on the facts of each arrangement. Users should
      consult the Landlord and Tenant Board, the Ontario Human Rights Commission
      or a qualified legal professional when necessary.
    </Notice>
  );
}

export function OntarioOccupancyNotice() {
  return (
    <Notice
      icon={<AlertTriangle size={18} />}
      title="Important Ontario occupancy notice"
      tone="warning"
    >
      The Ontario Residential Tenancies Act may not apply when an occupant is
      required to share a kitchen or bathroom with the owner or the owner&apos;s
      immediate family. Travel Markets does not determine whether a particular
      occupancy is covered by the Act. Applicants should review their arrangement
      carefully and obtain independent advice where necessary.
    </Notice>
  );
}

export function HelpResourceLinks() {
  return (
    <div className="flex flex-wrap gap-3 text-sm">
      <Link
        href="https://tribunalsontario.ca/ltb/"
        className="rounded-full border border-white/10 bg-white/5 px-4 py-2 font-semibold text-zinc-200 hover:bg-white/10"
        target="_blank"
        rel="noreferrer"
      >
        Landlord and Tenant Board
      </Link>
      <Link
        href="https://www.ohrc.on.ca/"
        className="rounded-full border border-white/10 bg-white/5 px-4 py-2 font-semibold text-zinc-200 hover:bg-white/10"
        target="_blank"
        rel="noreferrer"
      >
        Ontario Human Rights Commission
      </Link>
    </div>
  );
}
