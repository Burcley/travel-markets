"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BadgeCheck,
  Building2,
  CheckCircle2,
  ChevronRight,
  Clock3,
  GraduationCap,
  IdCard,
  Loader2,
  Mail,
  Phone,
  ShieldCheck,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { isHostRole, normalizeVerificationStatus, verificationLabel, type VerificationStatus } from "@/lib/verification-center";

type VerificationCard = {
  title: string;
  explanation: string;
  why: string;
  security: string;
  reviewTime: string;
  status: VerificationStatus;
  href: string;
  action: string;
  icon: React.ReactNode;
};

type SubmissionRow = {
  verification_type: string;
  status: string | null;
};

function statusClass(status: VerificationStatus) {
  if (status === "verified") return "border-emerald-500/25 bg-emerald-500/10 text-emerald-200";
  if (status === "pending") return "border-yellow-500/25 bg-yellow-500/10 text-yellow-200";
  if (status === "rejected") return "border-red-500/25 bg-red-500/10 text-red-200";
  return "border-white/10 bg-white/5 text-zinc-300";
}

function hasValidPublicRole(role?: string | null, isAdmin?: boolean | null) {
  const value = String(role || "").toLowerCase();

  return (
    isAdmin === true ||
    value === "admin" ||
    value === "student" ||
    value === "owner" ||
    value === "landlord" ||
    value === "host"
  );
}

export default function OnboardingVerificationsPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [role, setRole] = useState("student");
  const [emailVerified, setEmailVerified] = useState(false);
  const [phoneStatus, setPhoneStatus] = useState<VerificationStatus>("not_started");
  const [identityStatus, setIdentityStatus] = useState<VerificationStatus>("not_started");
  const [studentStatus, setStudentStatus] = useState<VerificationStatus>("not_started");
  const [propertyStatus, setPropertyStatus] = useState<VerificationStatus>("not_started");

  useEffect(() => {
    loadStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadStatus() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.replace("/auth");
      return;
    }

    if (!user.email_confirmed_at) {
      router.replace("/onboarding/verify-email");
      return;
    }

    setEmailVerified(true);

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, is_admin, phone_verified, phone_verified_at, phone_verification_status, identity_verified, is_verified, identity_verification_status, student_email_verified, student_verification_status")
      .eq("id", user.id)
      .maybeSingle();

    if (!hasValidPublicRole(profile?.role, profile?.is_admin)) {
      router.replace("/onboarding?step=role");
      return;
    }

    const nextRole = profile?.is_admin ? "admin" : profile?.role || "student";
    setRole(nextRole);
    setPhoneStatus(
      normalizeVerificationStatus(
        profile?.phone_verification_status || (profile?.phone_verified_at ? "verified" : null),
        Boolean(profile?.phone_verified || profile?.phone_verified_at)
      )
    );
    const { data: submissions, error: submissionsError } = await supabase
      .from("verification_submissions")
      .select("verification_type, status")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    if (submissionsError) {
      console.error("ONBOARDING VERIFICATION SUBMISSIONS LOAD ERROR:", submissionsError);
    }

    const submissionsByType = ((submissions || []) as SubmissionRow[]).reduce(
      (records, submission) => {
        if (!records[submission.verification_type]) {
          records[submission.verification_type] = submission;
        }
        return records;
      },
      {} as Record<string, SubmissionRow>
    );

    setIdentityStatus(
      normalizeVerificationStatus(
        submissionsByType.identity?.status || profile?.identity_verification_status,
        Boolean(profile?.identity_verified || profile?.is_verified)
      )
    );
    setStudentStatus(
      normalizeVerificationStatus(
        submissionsByType.student_status?.status || profile?.student_verification_status,
        Boolean(profile?.student_email_verified)
      )
    );

    if (isHostRole(nextRole)) {
      const { data: propertyVerification } = await supabase
        .from("listing_verifications")
        .select("status")
        .eq("owner_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      setPropertyStatus(
        normalizeVerificationStatus(
          submissionsByType.property_relationship?.status || propertyVerification?.status
        )
      );
    }

    setLoading(false);
  }

  async function completeOnboarding() {
    setSaving(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.replace("/auth");
      return;
    }

    if (!user.email_confirmed_at) {
      router.replace("/onboarding/verify-email");
      return;
    }

    const completedAt = new Date().toISOString();
    const { error } = await supabase
      .from("profiles")
      .update({
        verification_intro_viewed_at: completedAt,
        onboarding_completed_at: completedAt,
        onboarding_completed: true,
        email_verified_at: user.email_confirmed_at,
        updated_at: completedAt,
      })
      .eq("id", user.id);

    if (error) {
      console.error("ONBOARDING VERIFICATION INTRO COMPLETE ERROR:", error);
      setSaving(false);
      return;
    }

    router.push(isHostRole(role) ? "/dashboard" : "/search");
    router.refresh();
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black text-white">
        <Loader2 className="h-8 w-8 animate-spin text-pink-300" />
      </main>
    );
  }

  const cards: VerificationCard[] = [
    {
      title: "Email Verification",
      explanation: "Your email is confirmed and ready for trusted account actions.",
      why: "Email verification protects rental conversations and account recovery.",
      security: "Verified directly through Supabase Auth.",
      reviewTime: "Complete",
      status: emailVerified ? "verified" : "not_started",
      href: "/onboarding/verify-email",
      action: "View Email Status",
      icon: <Mail className="h-6 w-6" />,
    },
    {
      title: "Phone Verification",
      explanation: "Confirm a phone number with a one-time SMS code.",
      why: "Helps coordinate viewings and safety follow-up.",
      security: "Your phone number is private account information.",
      reviewTime: "Usually instant",
      status: phoneStatus,
      href: "/verify-phone",
      action: "Verify Phone",
      icon: <Phone className="h-6 w-6" />,
    },
    {
      title: "Identity Verification",
      explanation: "Upload government ID for Travel Markets admin review.",
      why: "Helps reduce fake accounts and unsafe interactions.",
      security: "Documents are stored privately and reviewed by authorized admins.",
      reviewTime: "24-48 hours",
      status: identityStatus,
      href: "/verify-identity?type=identity",
      action: "Upload Government ID",
      icon: <IdCard className="h-6 w-6" />,
    },
  ];

  if (isHostRole(role)) {
    cards.push({
      title: "Property Relationship Verification",
      explanation: "Verify ownership, management authority, or authorization to advertise.",
      why: "Students can trust that listings are connected to a real authorized host.",
      security: "Property documents are private and never shown publicly.",
      reviewTime: "1-3 business days",
      status: propertyStatus,
      href: "/verify-identity?type=property_relationship",
      action: "Upload Property Ownership",
      icon: <Building2 className="h-6 w-6" />,
    });
  } else {
    cards.push({
      title: "Student Status Verification",
      explanation: "Upload proof of enrollment or admission for admin review.",
      why: "Helps hosts identify serious student renters.",
      security: "Academic documents are private and only reviewed by authorized admins.",
      reviewTime: "24-48 hours",
      status: studentStatus,
      href: "/verify-identity?type=student_status",
      action: "Upload Proof of Enrollment",
      icon: <GraduationCap className="h-6 w-6" />,
    });
  }

  return (
    <main className="min-h-screen bg-black px-4 py-10 text-white">
      <div className="mx-auto max-w-6xl space-y-8">
        <section className="rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(244,63,94,0.22),rgba(24,24,27,0.95)_42%,rgba(0,0,0,1)_100%)] p-8 shadow-2xl">
          <p className="text-sm font-black uppercase tracking-[0.2em] text-pink-300">
            Step 5 — Verification
          </p>
          <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
            Build trust on Travel Markets
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-zinc-300">
            Complete your recommended verifications now, or return to them later
            from your Verification Center.
          </p>
        </section>

        <section className="grid gap-5 md:grid-cols-2">
          {cards.map((card) => (
            <article
              key={card.title}
              className="rounded-3xl border border-white/10 bg-zinc-950 p-6 shadow-xl transition hover:-translate-y-1 hover:border-pink-400/40"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="rounded-2xl bg-white/10 p-3 text-pink-200">
                    {card.icon}
                  </div>
                  <div>
                    <h2 className="text-xl font-black">{card.title}</h2>
                    <p className="mt-2 text-sm leading-6 text-zinc-400">
                      {card.explanation}
                    </p>
                  </div>
                </div>
                <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusClass(card.status)}`}>
                  {verificationLabel(card.status)}
                </span>
              </div>

              <div className="mt-5 grid gap-3 text-sm sm:grid-cols-3">
                <Info icon={<BadgeCheck className="h-4 w-4" />} label="Why it matters" value={card.why} />
                <Info icon={<ShieldCheck className="h-4 w-4" />} label="Security" value={card.security} />
                <Info icon={<Clock3 className="h-4 w-4" />} label="Review time" value={card.reviewTime} />
              </div>

              {card.status !== "verified" && (
                <Link
                  href={card.href}
                  className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-black text-black transition hover:bg-zinc-200"
                >
                  {card.action}
                  <ChevronRight className="h-4 w-4" />
                </Link>
              )}
              {card.status === "verified" && (
                <div className="mt-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm font-bold text-emerald-200">
                  <CheckCircle2 className="mr-2 inline h-4 w-4" />
                  Verified by Travel Markets
                </div>
              )}
            </article>
          ))}
        </section>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button
            onClick={completeOnboarding}
            disabled={saving}
            className="rounded-2xl bg-white px-7 py-3 text-sm font-black text-black transition hover:bg-zinc-200 disabled:opacity-50"
          >
            {saving ? "Completing..." : "Complete verifications"}
          </button>
          <button
            onClick={completeOnboarding}
            disabled={saving}
            className="rounded-2xl border border-white/10 bg-white/5 px-7 py-3 text-sm font-bold text-white transition hover:bg-white/10 disabled:opacity-50"
          >
            I&apos;ll do this later
          </button>
        </div>
      </div>
    </main>
  );
}

function Info({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/50 p-4">
      <div className="text-zinc-400">{icon}</div>
      <p className="mt-2 font-bold text-white">{label}</p>
      <p className="mt-1 leading-6 text-zinc-500">{value}</p>
    </div>
  );
}
