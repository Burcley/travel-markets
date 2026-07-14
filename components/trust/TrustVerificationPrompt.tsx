"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ShieldCheck, X } from "lucide-react";

type PromptKind = "landlord_identity" | "listing_relationship" | "student_identity";

const promptCopy: Record<
  PromptKind,
  { title: string; body: string; href: string; action: string }
> = {
  landlord_identity: {
    title: "Build trust with students by verifying your identity.",
    body: "Verification can help students know they are communicating with a real account. It does not guarantee safety, honesty, financial reliability or rental outcomes.",
    href: "/verify-identity",
    action: "Verify identity",
  },
  listing_relationship: {
    title: "Verify your relationship to this property to strengthen your listing.",
    body: "Travel Markets can review selected documents connecting your account to the property or authorized management.",
    href: "#property-verification",
    action: "Verify this listing",
  },
  student_identity: {
    title: "Verify your identity to help landlords know they are communicating with a real applicant.",
    body: "Identity verification is a trust signal, not a guarantee of rental approval or financial reliability.",
    href: "/verify-identity",
    action: "Verify identity",
  },
};

export default function TrustVerificationPrompt({
  kind,
  storageKey,
  className = "",
}: {
  kind: PromptKind;
  storageKey: string;
  className?: string;
}) {
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem(storageKey) === "dismissed";
  });

  const copy = useMemo(() => promptCopy[kind], [kind]);

  if (dismissed) return null;

  return (
    <div
      className={`rounded-3xl border border-pink-400/20 bg-pink-500/10 p-5 text-white ${className}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex gap-3">
          <div className="rounded-2xl border border-pink-400/20 bg-black/30 p-3 text-pink-200">
            <ShieldCheck size={20} />
          </div>
          <div>
            <p className="font-bold">{copy.title}</p>
            <p className="mt-2 text-sm leading-6 text-pink-100/75">
              {copy.body}
            </p>
            <Link
              href={copy.href}
              className="mt-4 inline-flex rounded-2xl bg-white px-5 py-3 text-sm font-black text-black hover:bg-zinc-200"
            >
              {copy.action}
            </Link>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            sessionStorage.setItem(storageKey, "dismissed");
            setDismissed(true);
          }}
          className="rounded-full border border-white/10 bg-black/30 p-2 text-zinc-300 hover:bg-white/10 hover:text-white"
          aria-label="Dismiss verification prompt"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
