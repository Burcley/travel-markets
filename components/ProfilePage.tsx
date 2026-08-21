"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import FoundingLandlordBadge from "@/components/founding/FoundingLandlordBadge";
import {
  calculateProfileCompletion,
  calculateTrustScore,
  isHostRole,
  normalizeVerificationStatus,
  trustScoreLabel,
  trustStars,
  verificationLabel,
  type PropertyVerificationRecord,
  type VerificationStatus,
} from "@/lib/verification-center";

type Role = "student" | "owner";

type Profile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  bio: string | null;
  role: Role | null;
  avatar_url: string | null;
  is_verified: boolean | null;
  identity_verified: boolean | null;
  identity_verification_status: string | null;
  identity_verified_at: string | null;
  phone_verified: boolean | null;
  phone_verified_at: string | null;
  student_email_verified: boolean | null;
  student_verification_status: string | null;
  profile_completion_percentage: number | null;
  is_admin: boolean | null;
  trust_score: number | null;
  trust_level: string | null;
  is_founding_landlord?: boolean | null;
  founding_landlord_number?: number | null;
  founding_status?: string | null;
};

export default function ProfilePage() {
  const t = useTranslations("profile");
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [id, setId] = useState("");
  const [emailVerified, setEmailVerified] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [role, setRole] = useState<Role>("student");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [identityStatus, setIdentityStatus] =
    useState<VerificationStatus>("not_started");
  const [phoneStatus, setPhoneStatus] =
    useState<VerificationStatus>("not_started");
  const [studentStatus, setStudentStatus] =
    useState<VerificationStatus>("not_started");
  const [propertyVerification, setPropertyVerification] =
    useState<PropertyVerificationRecord | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [trustScore, setTrustScore] = useState(20);
  const [trustLevel, setTrustLevel] = useState("new");
  const [foundingNumber, setFoundingNumber] = useState<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [recalculating, setRecalculating] = useState(false);

  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    setLoading(true);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      window.location.href = "/auth/login";
      return;
    }

    setEmail(user.email || "");
    setEmailVerified(Boolean(user.email_confirmed_at));
    setId(user.id);

    const { data, error } = await supabase
      .from("profiles")
      .select(
        "id, full_name, phone, bio, role, avatar_url, is_verified, identity_verified, identity_verification_status, identity_verified_at, phone_verified, phone_verified_at, student_email_verified, student_verification_status, profile_completion_percentage, is_admin, trust_score, trust_level, is_founding_landlord, founding_landlord_number, founding_status"
      )
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      console.error("Profile load error:", error);
    }

    if (!data) {
      const { data: newProfile, error: insertError } = await supabase
        .from("profiles")
        .insert({
          id: user.id,
          email: user.email || "",
          full_name: "",
          phone: "",
          bio: "",
          role: "student",
          avatar_url: null,
          is_verified: false,
          identity_verified: false,
          identity_verification_status: "not_started",
          is_admin: false,
          trust_score: 20,
          trust_level: "new",
          account_status: "active",
        })
        .select(
          "id, full_name, phone, bio, role, avatar_url, is_verified, identity_verified, identity_verification_status, identity_verified_at, phone_verified, phone_verified_at, student_email_verified, student_verification_status, profile_completion_percentage, is_admin, trust_score, trust_level, is_founding_landlord, founding_landlord_number, founding_status"
        )
        .single();

      if (insertError) {
        console.error("Profile create error:", insertError);
        setLoading(false);
        return;
      }

      await applyProfile(newProfile as Profile, Boolean(user.email_confirmed_at));
      setLoading(false);
      return;
    }

    await applyProfile(data as Profile, Boolean(user.email_confirmed_at));
    setLoading(false);
  }

  async function applyProfile(profile: Profile, verifiedEmail: boolean) {
    setFullName(profile.full_name || "");
    setPhone(profile.phone || "");
    setBio(profile.bio || "");
    setRole(profile.role || "student");
    setAvatarUrl(profile.avatar_url || null);
    setIsVerified(Boolean(profile.is_verified));
    setIdentityStatus(
      normalizeVerificationStatus(
        profile.identity_verification_status,
        Boolean(profile.identity_verified || profile.is_verified)
      )
    );
    setPhoneStatus(
      normalizeVerificationStatus(
        profile.phone_verified_at ? "verified" : null,
        Boolean(profile.phone_verified || profile.phone_verified_at)
      )
    );
    setStudentStatus(
      normalizeVerificationStatus(
        profile.student_verification_status,
        Boolean(profile.student_email_verified)
      )
    );
    setIsAdmin(Boolean(profile.is_admin));
    setFoundingNumber(
      profile.is_founding_landlord && profile.founding_status === "confirmed"
        ? profile.founding_landlord_number || null
        : null
    );
    let latestPropertyVerification: PropertyVerificationRecord | null = null;

    if (isHostRole(profile.role)) {
      const { data: verification } = await supabase
        .from("verification_submissions")
        .select("status, reviewed_at, submitted_at, rejection_reason")
        .eq("user_id", profile.id)
        .eq("verification_type", "property_relationship")
        .order("submitted_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      latestPropertyVerification = verification
        ? {
            status: verification.status,
            reviewed_at: verification.reviewed_at,
            submitted_at: verification.submitted_at,
            owner_visible_reason: verification.rejection_reason,
          }
        : null;
    }

    setPropertyVerification(latestPropertyVerification);
    setTrustScore(
      profile.trust_score ??
        calculateTrustScore({
          profile,
          emailVerified: verifiedEmail,
          propertyVerification: latestPropertyVerification,
        })
    );
    setTrustLevel(profile.trust_level || "new");
  }

  async function uploadAvatar(file: File) {
    if (!id) return;

    const ext = file.name.split(".").pop();
    const path = `${id}/avatar-${Date.now()}.${ext}`;

    const { error } = await supabase.storage.from("avatars").upload(path, file, {
      upsert: true,
    });

    if (error) {
      alert(error.message);
      return;
    }

    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    setAvatarUrl(data.publicUrl);
  }

  async function recalculateTrustScore() {
    try {
      setRecalculating(true);

      const res = await fetch("/api/trust-score/recalculate", {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || t("errors.recalculateTrust"));
      }

      setTrustScore(data.trust_score);
      setTrustLevel(data.trust_level);

      await loadProfile();
    } catch (error) {
      alert(error instanceof Error ? error.message : t("errors.generic"));
    } finally {
      setRecalculating(false);
    }
  }

  async function saveProfile() {
    if (!id) return;

    setSaving(true);

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: fullName,
        phone,
        bio,
        role,
        avatar_url: avatarUrl,
      })
      .eq("id", id);

    setSaving(false);

    if (error) {
      alert(error.message);
      return;
    }

    await recalculateTrustScore();
    alert(t("savedAlert"));
    await loadProfile();
  }

  async function deleteAccount() {
    setDeleteError("");

    if (deleteConfirmation !== "DELETE") {
      setDeleteError(t("delete.typeDeleteError"));
      return;
    }

    const confirmed = window.confirm(
      t("delete.confirmMessage")
    );

    if (!confirmed) return;

    setDeleteLoading(true);

    const response = await fetch("/api/account/delete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ confirmation: deleteConfirmation }),
    });

    const result = await response.json();

    if (!response.ok) {
      setDeleteError(result.error || t("delete.failed"));
      setDeleteLoading(false);
      return;
    }

    await supabase.auth.signOut();
    window.location.href = "/";
  }

  function getTrustLabel(level: string) {
    if (level === "elite") return t("trust.labels.elite");
    if (level === "trusted") return t("trust.labels.trusted");
    if (level === "basic") return t("trust.labels.basic");
    return t("trust.labels.new");
  }

  function badgeClass(status: VerificationStatus) {
    if (status === "verified") return "border border-emerald-500/25 bg-emerald-500/10 text-emerald-200";
    if (status === "pending" || status === "code_sent") return "border border-yellow-500/25 bg-yellow-500/10 text-yellow-200";
    if (status === "rejected" || status === "resubmission_required" || status === "failed" || status === "locked" || status === "expired") return "border border-red-500/25 bg-red-500/10 text-red-200";
    return "border border-white/10 bg-zinc-800 text-zinc-300";
  }

  const propertyStatus = normalizeVerificationStatus(propertyVerification?.status);
  const roleSpecificStatus = isHostRole(role) ? propertyStatus : studentStatus;
  const completionPercent = calculateProfileCompletion({
    profile: {
      full_name: fullName,
      phone,
      bio,
      role,
      avatar_url: avatarUrl,
      is_verified: isVerified,
      identity_verification_status: identityStatus,
      phone_verified_at: phoneStatus === "verified" ? "verified" : null,
      student_verification_status: studentStatus,
    },
    emailVerified,
    propertyVerification,
  });
  const displayTrustScore = calculateTrustScore({
    profile: {
      full_name: fullName,
      phone,
      bio,
      role,
      avatar_url: avatarUrl,
      is_verified: isVerified,
      identity_verification_status: identityStatus,
      phone_verified_at: phoneStatus === "verified" ? "verified" : null,
      student_verification_status: studentStatus,
    },
    emailVerified,
    propertyVerification,
    reviewCount: 0,
    responseRate: 80,
    listingQuality: isHostRole(role) ? 70 : 40,
  });
  const effectiveTrustScore = Math.max(trustScore, displayTrustScore);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black text-white">
        {t("loading")}
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-4 py-8 text-white sm:px-6 lg:py-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-col gap-4 rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(255,46,114,0.16),transparent_32%),linear-gradient(135deg,#09090b,#020202)] p-6 shadow-2xl sm:flex-row sm:items-end sm:justify-between sm:p-8">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-pink-300">
              {t("eyebrow")}
            </p>
            <h1 className="mt-3 text-4xl font-black tracking-tight">{t("title")}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
              Preview and maintain the profile students and landlords use to build trust.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href={`/users/${id}`}
              className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-black text-white transition hover:border-pink-400/40 hover:bg-pink-500/10"
            >
              Public preview
            </Link>
            <Link
              href="/dashboard"
              className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-black transition hover:bg-zinc-200"
            >
              {t("dashboard")}
            </Link>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-[2rem] border border-white/10 bg-zinc-950 p-6 shadow-2xl">
            <div className="flex flex-col items-center">
              <div className="h-32 w-32 overflow-hidden rounded-[2rem] bg-zinc-800 ring-2 ring-pink-400/30">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={fullName || t("userAlt")}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-3xl">
                    {fullName ? fullName[0].toUpperCase() : "U"}
                  </div>
                )}
              </div>

              <label className="mt-4 cursor-pointer rounded-2xl bg-[#FF2E72] px-4 py-2 text-sm font-black text-white shadow-lg shadow-pink-950/30 transition hover:-translate-y-0.5 hover:bg-pink-500">
                {t("upload")}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) uploadAvatar(file);
                  }}
                />
              </label>

              <h2 className="mt-4 text-xl font-bold">
                {fullName || t("unnamedUser")}
              </h2>

              <p className="mt-1 text-sm text-gray-400">{email}</p>

              <div className="mt-3 flex flex-wrap justify-center gap-2">
                <span className="rounded-full bg-zinc-800 px-3 py-1 text-sm capitalize">
                  {role}
                </span>

                <FoundingLandlordBadge number={foundingNumber} compact />

                <span className={`rounded-full px-3 py-1 text-sm ${badgeClass(emailVerified ? "verified" : "not_started")}`}>
                  Email: {verificationLabel(emailVerified ? "verified" : "not_started")}
                </span>

                <span className={`rounded-full px-3 py-1 text-sm ${badgeClass(identityStatus)}`}>
                  Identity: {verificationLabel(identityStatus)}
                </span>

                <span className={`rounded-full px-3 py-1 text-sm ${badgeClass(roleSpecificStatus)}`}>
                  {isHostRole(role) ? "Property" : "Student"}:{" "}
                  {verificationLabel(roleSpecificStatus)}
                </span>

                {roleSpecificStatus === "rejected" && (
                  <Link
                    href="/dashboard/verification"
                    className="rounded-full border border-red-500/25 bg-red-500/10 px-3 py-1 text-sm font-semibold text-red-200 underline underline-offset-4"
                  >
                    View reason
                  </Link>
                )}

                {isAdmin && (
                  <span className="rounded-full bg-purple-500/10 px-3 py-1 text-sm text-purple-300">
                    {t("admin")}
                  </span>
                )}
              </div>

              {(identityStatus === "pending" || roleSpecificStatus === "pending") && (
                <div className="mt-4 w-full rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-4 text-left text-sm text-yellow-100">
                  <p className="font-black">Pending Identity Review</p>
                  <p className="mt-1 leading-6 text-yellow-100/75">
                    Estimated review time: 24-48 hours.
                  </p>
                </div>
              )}

              <div className="mt-6 w-full rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-emerald-300">
                    {t("trust.score")}
                  </p>

                  <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-300 capitalize">
                    {getTrustLabel(trustLevel)}
                  </span>
                </div>

                <div className="mt-3 text-4xl font-black text-white">
                  {effectiveTrustScore}/100
                </div>

                <p className="mt-2 text-sm font-semibold text-emerald-100">
                  {trustStars(effectiveTrustScore)} {trustScoreLabel(effectiveTrustScore)}
                </p>

                <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/50">
                  <div
                    className="h-full rounded-full bg-emerald-400"
                    style={{ width: `${Math.min(effectiveTrustScore, 100)}%` }}
                  />
                </div>

                <p className="mt-3 text-sm leading-6 text-emerald-100/70">
                  Based on verification, profile completion, reviews, response rate,
                  and listing quality.
                </p>

                <button
                  onClick={recalculateTrustScore}
                  disabled={recalculating}
                  className="mt-4 w-full rounded-xl border border-emerald-500/20 bg-black/30 px-4 py-3 text-sm font-semibold text-emerald-300 hover:bg-black/50 disabled:opacity-50"
                >
                  {recalculating ? t("updating") : t("trust.refresh")}
                </button>
              </div>

              {!isVerified && (
                <Link
                  href="/dashboard/verification"
                  className="mt-4 w-full rounded-2xl border border-pink-400/25 bg-pink-500/10 px-4 py-3 text-center font-black text-pink-100 transition hover:bg-pink-500/20"
                >
                  Open Verification Center
                </Link>
              )}

              <div className="mt-4 w-full rounded-2xl border border-white/10 bg-black/30 p-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-white">Profile completeness</p>
                  <p className="text-sm font-black text-pink-200">
                    {completionPercent}%
                  </p>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-900">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-pink-500 to-emerald-400"
                    style={{ width: `${completionPercent}%` }}
                  />
                </div>
                <p className="mt-3 text-sm text-zinc-400">
                  Complete your profile to build trust.
                </p>
              </div>

              {isAdmin && (
                <Link
                  href="/admin"
                  className="mt-4 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center font-bold hover:bg-white/10"
                >
                  {t("openAdminDashboard")}
                </Link>
              )}
            </div>
          </div>

          <div className="space-y-4 rounded-[2rem] border border-white/10 bg-zinc-950 p-6 shadow-2xl lg:col-span-2">
            <div>
              <label className="mb-2 block text-sm font-semibold text-zinc-300">
                {t("fields.fullName")}
              </label>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={t("fields.fullName")}
                className="w-full rounded-2xl border border-white/10 bg-black p-3 outline-none transition focus:border-pink-400/60 focus:ring-4 focus:ring-pink-500/10"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-zinc-300">
                {t("fields.phone")}
              </label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={t("fields.phone")}
                className="w-full rounded-2xl border border-white/10 bg-black p-3 outline-none transition focus:border-pink-400/60 focus:ring-4 focus:ring-pink-500/10"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-zinc-300">
                {t("fields.role")}
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
                disabled={isAdmin}
                className="w-full rounded-2xl border border-white/10 bg-black p-3 outline-none transition focus:border-pink-400/60 focus:ring-4 focus:ring-pink-500/10 disabled:opacity-50"
              >
                <option value="student">{t("roles.student")}</option>
                <option value="owner">{t("roles.owner")}</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-zinc-300">
                {t("fields.bio")}
              </label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder={t("fields.bio")}
                rows={4}
                className="w-full rounded-2xl border border-white/10 bg-black p-3 outline-none transition focus:border-pink-400/60 focus:ring-4 focus:ring-pink-500/10"
              />
            </div>

            <button
              onClick={saveProfile}
              disabled={saving || recalculating}
              className="rounded-2xl bg-[#FF2E72] px-6 py-3 font-black text-white transition hover:bg-pink-500 disabled:bg-zinc-700"
            >
              {saving ? t("saving") : t("save")}
            </button>
          </div>
        </div>

        {!isAdmin && (
          <section id="delete-account" className="mt-8 scroll-mt-24 rounded-[2rem] border border-red-500/30 bg-red-500/10 p-6">
            <h2 className="text-2xl font-bold text-red-300">{t("delete.title")}</h2>

            <p className="mt-2 text-sm text-white/70">
              {t("delete.description")}
            </p>

            <div className="mt-5">
              <label className="text-sm text-white/70">
                {t("delete.typePrefix")}{" "}
                <span className="font-bold text-red-300">DELETE</span>{" "}
                {t("delete.typeSuffix")}
              </label>

              <input
                value={deleteConfirmation}
                onChange={(e) => setDeleteConfirmation(e.target.value)}
                placeholder="DELETE"
                className="mt-2 w-full rounded-xl border border-red-500/20 bg-black p-3 text-white outline-none focus:border-red-400"
              />
            </div>

            {deleteError && (
              <p className="mt-3 text-sm text-red-300">{deleteError}</p>
            )}

            <button
              onClick={deleteAccount}
              disabled={deleteLoading || deleteConfirmation !== "DELETE"}
              className="mt-5 rounded-xl bg-red-600 px-6 py-3 font-semibold text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {deleteLoading ? t("deleting") : t("delete.button")}
            </button>
          </section>
        )}
      </div>
    </main>
  );
}
