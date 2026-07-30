import Link from "next/link";
import { redirect } from "next/navigation";
import type { ComponentType } from "react";
import {
  BadgeCheck,
  Building2,
  ChevronRight,
  Clock3,
  FileWarning,
  GraduationCap,
  IdCard,
  Mail,
  Phone,
  ShieldCheck,
  Star,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  calculateProfileCompletion,
  calculateTrustScore,
  isHostRole,
  normalizeVerificationStatus,
  trustScoreLabel,
  trustStars,
  verificationLabel,
  type VerificationProfile,
  type VerificationStatus,
} from "@/lib/verification-center";

type VerificationCard = {
  title: string;
  explanation: string;
  status: VerificationStatus;
  cta: string;
  href: string;
  estimatedReviewTime: string;
  security: string;
  why: string;
  verifiedAt?: string | null;
  rejectedReason?: string | null;
  icon: ComponentType<{ className?: string }>;
};

type SubmissionRow = {
  verification_type: string;
  status: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
};

function statusClasses(status: VerificationStatus) {
  if (status === "verified") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
  if (status === "pending" || status === "code_sent") return "border-yellow-500/30 bg-yellow-500/10 text-yellow-200";
  if (status === "rejected" || status === "resubmission_required" || status === "failed" || status === "locked" || status === "expired") return "border-red-500/30 bg-red-500/10 text-red-200";
  return "border-white/10 bg-white/5 text-zinc-300";
}

function statusBanner(status: VerificationStatus, rejectedReason?: string | null) {
  if (status === "pending") {
    return {
      icon: Clock3,
      className: "border-yellow-500/25 bg-yellow-500/10 text-yellow-100",
      title: "Pending Identity Review",
      text: "Estimated review time: 24-48 hours. We will update your verification status as soon as review is complete.",
    };
  }

  if (status === "code_sent") {
    return {
      icon: Clock3,
      className: "border-yellow-500/25 bg-yellow-500/10 text-yellow-100",
      title: "Code sent",
      text: "Enter the six-digit SMS code to complete phone verification.",
    };
  }

  if (status === "rejected" || status === "resubmission_required" || status === "failed" || status === "locked" || status === "expired") {
    return {
      icon: FileWarning,
      className: "border-red-500/25 bg-red-500/10 text-red-100",
      title: "Rejected",
      text:
        rejectedReason ||
        "Travel Markets could not approve this verification. Review the reason and resubmit when ready.",
    };
  }

  if (status === "verified") {
    return {
      icon: BadgeCheck,
      className: "border-emerald-500/25 bg-emerald-500/10 text-emerald-100",
      title: "Verified by Travel Markets",
      text: "This trust signal is active on your account.",
    };
  }

  return null;
}

function formatDate(value?: string | null) {
  if (!value) return null;

  return new Intl.DateTimeFormat("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export default async function VerificationCenterPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth?returnTo=/dashboard/verification");

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "id, email, full_name, phone, bio, role, avatar_url, is_verified, identity_verified, identity_verification_status, identity_verified_at, phone_verified, phone_verified_at, phone_verification_status, student_email_verified, student_verification_status, profile_completion_percentage, trust_score, trust_level"
    )
    .eq("id", user.id)
    .maybeSingle();

  const safeProfile: VerificationProfile & { id: string; email?: string | null } = profile || {
    id: user.id,
    email: user.email,
    role: "student",
  };
  const host = isHostRole(safeProfile.role);

  const { data: propertyVerification } = host
    ? await supabase
        .from("listing_verifications")
        .select("status, reviewed_at, submitted_at, owner_visible_reason")
        .eq("owner_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };

  const { data: submissions, error: submissionsError } = await supabase
    .from("verification_submissions")
    .select("verification_type, status, submitted_at, reviewed_at, rejection_reason")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (submissionsError) {
    console.error("VERIFICATION SUBMISSIONS LOAD ERROR:", submissionsError);
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
  const identitySubmission = submissionsByType.identity;
  const studentSubmission = submissionsByType.student_status;
  const propertySubmission = submissionsByType.property_relationship;

  const { count: reviewCount } = await supabase
    .from("reviews")
    .select("*", { count: "exact", head: true })
    .eq("owner_id", user.id);

  const { count: listingCount } = host
    ? await supabase
        .from("listings")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
    : { count: 0 };

  const emailVerified = Boolean(user.email_confirmed_at);
  const phoneStatus = normalizeVerificationStatus(
    safeProfile.phone_verification_status || (safeProfile.phone_verified_at ? "verified" : null),
    Boolean(safeProfile.phone_verified || safeProfile.phone_verified_at)
  );
  const identityStatus = normalizeVerificationStatus(
    identitySubmission?.status || safeProfile.identity_verification_status,
    Boolean(safeProfile.identity_verified || safeProfile.is_verified)
  );
  const studentStatus = normalizeVerificationStatus(
    studentSubmission?.status || safeProfile.student_verification_status,
    Boolean(safeProfile.student_email_verified)
  );
  const hostStatus = normalizeVerificationStatus(
    propertySubmission?.status || propertyVerification?.status
  );
  const profileForScore = {
    ...safeProfile,
    identity_verification_status:
      identitySubmission?.status || safeProfile.identity_verification_status,
    student_verification_status:
      studentSubmission?.status || safeProfile.student_verification_status,
  };
  const propertyForScore = propertySubmission
    ? {
        status: propertySubmission.status,
        reviewed_at: propertySubmission.reviewed_at,
        submitted_at: propertySubmission.submitted_at,
        owner_visible_reason: propertySubmission.rejection_reason,
      }
    : propertyVerification;
  const completion = calculateProfileCompletion({
    profile: profileForScore,
    emailVerified,
    propertyVerification: propertyForScore,
  });
  const computedTrustScore = calculateTrustScore({
    profile: profileForScore,
    emailVerified,
    propertyVerification: propertyForScore,
    reviewCount: reviewCount || 0,
    responseRate: 80,
    listingQuality: listingCount ? 80 : 40,
  });
  const trustScore = safeProfile.trust_score ?? computedTrustScore;

  const cards: VerificationCard[] = [
    {
      title: "Email Verification",
      explanation: "Confirm that you control the email address connected to your account.",
      status: emailVerified ? "verified" : "not_started",
      cta: "Verify Email",
      href: "/verify-email",
      estimatedReviewTime: "Instant after confirmation",
      security: "Email verification helps protect account access and important rental updates.",
      why: "Landlords and students need a reliable way to reach each other.",
      verifiedAt: user.email_confirmed_at,
      icon: Mail,
    },
    {
      title: "Phone Verification",
      explanation: "Add a reachable phone number for safer viewing coordination.",
      status: phoneStatus,
      cta: "Verify Phone",
      href: "/verify-phone",
      estimatedReviewTime: "Usually instant",
      security: "Phone details are handled as private account information.",
      why: "A verified phone number makes booking and safety follow-up easier.",
      verifiedAt: safeProfile.phone_verified_at,
      icon: Phone,
    },
    {
      title: "Identity Verification",
      explanation: "Upload government ID so Travel Markets can review your identity.",
      status: identityStatus,
      cta: "Upload Government ID",
      href: "/verify-identity",
      estimatedReviewTime: "Usually 1-2 business days",
      security: "Your documents are used for review and are not shown publicly.",
      why: "Identity verification helps reduce fake accounts and unsafe interactions.",
      verifiedAt: identitySubmission?.reviewed_at || safeProfile.identity_verified_at,
      rejectedReason:
        identityStatus === "rejected"
          ? identitySubmission?.rejection_reason ||
            "Your identity document could not be approved. Please resubmit a clear document."
          : null,
      icon: IdCard,
    },
  ];

  if (host) {
    cards.push({
      title: "Property Relationship Verification",
      explanation: "Show that you own, manage, or are authorized to advertise a property.",
      status: hostStatus,
      cta: "Upload Property Ownership",
      href: "/verify-identity?type=property_relationship",
      estimatedReviewTime: "Usually 1-3 business days",
      security: "Students cannot view your uploaded property documents.",
      why: "Verified property relationships help students trust that listings are legitimate.",
      verifiedAt: propertySubmission?.reviewed_at || propertyVerification?.reviewed_at,
      rejectedReason:
        propertySubmission?.rejection_reason || propertyVerification?.owner_visible_reason,
      icon: Building2,
    });
  } else {
    cards.push({
      title: "Student Status Verification",
      explanation: "Upload proof of enrollment or use a student email signal.",
      status: studentStatus,
      cta: "Upload Proof of Enrollment",
      href: "/verify-identity?type=student_status",
      estimatedReviewTime: "Usually 1-2 business days",
      security: "Enrollment documents are reviewed privately by Travel Markets.",
      why: "Student verification helps landlords identify serious student renters.",
      verifiedAt: studentSubmission?.reviewed_at || (safeProfile.student_email_verified ? safeProfile.identity_verified_at : null),
      rejectedReason: studentSubmission?.rejection_reason,
      icon: GraduationCap,
    });
  }

  return (
    <main className="min-h-screen bg-black px-4 py-10 text-white">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(244,63,94,0.22),rgba(24,24,27,0.95)_42%,rgba(0,0,0,1)_100%)] p-8 shadow-2xl">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-pink-300">
                Trust & Safety
              </p>
              <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
                Verification Centre
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-300">
                Build trust with students and landlords by completing the checks that
                matter most before messaging, viewings, and rental decisions.
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-black/40 p-5">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-emerald-500/10 p-3 text-emerald-300">
                  <Star className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm text-zinc-400">Trust Score</p>
                  <p className="text-2xl font-black">
                    {trustStars(trustScore)} {trustScoreLabel(trustScore)}
                  </p>
                </div>
              </div>
              <p className="mt-4 text-sm leading-6 text-zinc-400">
                Based on verification, profile completion, reviews, response signals,
                and listing quality.
              </p>
            </div>
          </div>
        </div>

        {!emailVerified && (
          <section className="animate-in fade-in slide-in-from-top-2 rounded-3xl border border-yellow-500/25 bg-yellow-500/10 p-5 text-yellow-100 shadow-xl">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <Mail className="mt-1 h-5 w-5 shrink-0" />
                <div>
                  <p className="font-black">Verify your email to unlock messaging and bookings.</p>
                  <p className="mt-1 text-sm leading-6 text-yellow-100/75">
                    You can browse Travel Markets now, but trusted account actions
                    require a verified email.
                  </p>
                </div>
              </div>
              <Link
                href="/verify-email"
                className="rounded-2xl bg-white px-5 py-3 text-center text-sm font-black text-black transition hover:-translate-y-0.5 hover:bg-zinc-200"
              >
                Verify Email
              </Link>
            </div>
          </section>
        )}

        <section className="grid gap-6 lg:grid-cols-[300px_1fr]">
          <aside className="sticky top-24 hidden self-start rounded-[2rem] border border-white/10 bg-zinc-950/90 p-4 shadow-2xl lg:block">
            <div className="rounded-3xl border border-pink-400/20 bg-pink-500/10 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-pink-200">
                Verification progress
              </p>
              <p className="mt-3 text-4xl font-black">{completion}%</p>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-black/60">
                <div
                  className="h-full rounded-full bg-[#FF2E72]"
                  style={{ width: `${completion}%` }}
                />
              </div>
            </div>
            <nav className="mt-4 space-y-2" aria-label="Verification sections">
              {cards.map((card) => {
                const Icon = card.icon;

                return (
                  <a
                    key={card.title}
                    href={`#${slugify(card.title)}`}
                    className="flex items-center justify-between gap-3 rounded-2xl px-3 py-3 text-sm transition hover:bg-white/10"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <Icon className="h-4 w-4 shrink-0 text-pink-200" />
                      <span className="truncate font-bold text-white">{card.title}</span>
                    </span>
                    <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-black ${statusClasses(card.status)}`}>
                      {verificationLabel(card.status)}
                    </span>
                  </a>
                );
              })}
            </nav>
          </aside>

          <div className="space-y-6">
            <section className="grid gap-5 md:grid-cols-2">
              {cards.map((card) => {
                const Icon = card.icon;
                const verifiedDate = formatDate(card.verifiedAt);
                const banner = statusBanner(card.status, card.rejectedReason);
                const BannerIcon = banner?.icon;

                return (
                  <article
                    id={slugify(card.title)}
                    key={card.title}
                    className="group scroll-mt-24 rounded-3xl border border-white/10 bg-zinc-950 p-6 shadow-xl transition duration-300 hover:-translate-y-1 hover:border-pink-400/40 hover:bg-zinc-900"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div className="rounded-2xl bg-white/10 p-3">
                          <Icon className="h-6 w-6 text-pink-200" />
                        </div>
                        <div>
                          <h2 className="text-xl font-bold">{card.title}</h2>
                          <p className="mt-2 text-sm leading-6 text-zinc-400">
                            {card.explanation}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`shrink-0 rounded-full border px-3 py-1 text-xs font-bold ${statusClasses(
                          card.status
                        )}`}
                      >
                        {verificationLabel(card.status)}
                      </span>
                    </div>

                    <div className="mt-5 grid gap-3 text-sm text-zinc-300 sm:grid-cols-3">
                      <div className="rounded-2xl border border-white/10 bg-black/50 p-4">
                        <Clock3 className="h-4 w-4 text-zinc-400" />
                        <p className="mt-2 font-semibold">Review time</p>
                        <p className="mt-1 text-zinc-500">{card.estimatedReviewTime}</p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-black/50 p-4">
                        <ShieldCheck className="h-4 w-4 text-zinc-400" />
                        <p className="mt-2 font-semibold">Security</p>
                        <p className="mt-1 text-zinc-500">{card.security}</p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-black/50 p-4">
                        <BadgeCheck className="h-4 w-4 text-zinc-400" />
                        <p className="mt-2 font-semibold">Why it matters</p>
                        <p className="mt-1 text-zinc-500">{card.why}</p>
                      </div>
                    </div>

                    {card.status === "verified" && (
                      <div className="mt-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-200">
                        <p className="font-semibold">Verified by Travel Markets</p>
                        {verifiedDate && <p className="mt-1 text-emerald-100/70">{verifiedDate}</p>}
                      </div>
                    )}

                    {banner && card.status !== "verified" && BannerIcon && (
                      <div className={`mt-5 rounded-2xl border p-4 text-sm ${banner.className}`}>
                        <div className="flex items-start gap-3">
                          <BannerIcon className="mt-0.5 h-4 w-4 shrink-0" />
                          <div>
                            <p className="font-black">{banner.title}</p>
                            <p className="mt-1 leading-6 opacity-80">{banner.text}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {card.status !== "verified" && (
                      <Link
                        href={card.href}
                        className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-bold text-black transition hover:-translate-y-0.5 hover:bg-zinc-200"
                      >
                        {card.cta}
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    )}
                  </article>
                );
              })}
            </section>

            <section className="rounded-3xl border border-white/10 bg-zinc-950 p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-2xl font-bold">Profile Completeness</h2>
                  <p className="mt-2 text-zinc-400">
                    Complete your profile to build trust.
                  </p>
                </div>
                <p className="text-3xl font-black">{completion}%</p>
              </div>
              <div className="mt-5 h-3 overflow-hidden rounded-full bg-black">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-pink-500 to-emerald-400"
                  style={{ width: `${completion}%` }}
                />
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
