"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";

type Role = "student" | "owner";

type Profile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  bio: string | null;
  role: Role | null;
  avatar_url: string | null;
  is_verified: boolean | null;
  is_admin: boolean | null;
  trust_score: number | null;
  trust_level: string | null;
};

export default function ProfilePage() {
  const t = useTranslations("profile");
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [id, setId] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [role, setRole] = useState<Role>("student");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [trustScore, setTrustScore] = useState(20);
  const [trustLevel, setTrustLevel] = useState("new");

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
    setId(user.id);

    const { data, error } = await supabase
      .from("profiles")
      .select(
        "id, full_name, phone, bio, role, avatar_url, is_verified, is_admin, trust_score, trust_level"
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
          is_admin: false,
          trust_score: 20,
          trust_level: "new",
          account_status: "active",
        })
        .select(
          "id, full_name, phone, bio, role, avatar_url, is_verified, is_admin, trust_score, trust_level"
        )
        .single();

      if (insertError) {
        console.error("Profile create error:", insertError);
        setLoading(false);
        return;
      }

      applyProfile(newProfile as Profile);
      setLoading(false);
      return;
    }

    applyProfile(data as Profile);
    setLoading(false);
  }

  function applyProfile(profile: Profile) {
    setFullName(profile.full_name || "");
    setPhone(profile.phone || "");
    setBio(profile.bio || "");
    setRole(profile.role || "student");
    setAvatarUrl(profile.avatar_url || null);
    setIsVerified(Boolean(profile.is_verified));
    setIsAdmin(Boolean(profile.is_admin));
    setTrustScore(profile.trust_score ?? 20);
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

  function getTrustMessage(level: string) {
    if (level === "elite") {
      return t("trust.messages.elite");
    }

    if (level === "trusted") {
      return t("trust.messages.trusted");
    }

    if (level === "basic") {
      return t("trust.messages.basic");
    }

    return t("trust.messages.new");
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black text-white">
        {t("loading")}
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-6 py-10 text-white">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-emerald-400">
              {t("eyebrow")}
            </p>
            <h1 className="mt-1 text-3xl font-bold">{t("title")}</h1>
          </div>

          <Link
            href="/dashboard"
            className="rounded-xl bg-white px-4 py-2 font-semibold text-black"
          >
            {t("dashboard")}
          </Link>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-zinc-900 p-6">
            <div className="flex flex-col items-center">
              <div className="h-32 w-32 overflow-hidden rounded-full bg-zinc-800 ring-2 ring-white/10">
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

              <label className="mt-4 cursor-pointer rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold hover:bg-blue-500">
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

                {isVerified && (
                  <span className="rounded-full bg-blue-500/10 px-3 py-1 text-sm text-blue-300">
                    ✓ {t("identityVerified")}
                  </span>
                )}

                {isAdmin && (
                  <span className="rounded-full bg-purple-500/10 px-3 py-1 text-sm text-purple-300">
                    {t("admin")}
                  </span>
                )}
              </div>

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
                  {trustScore}/100
                </div>

                <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/50">
                  <div
                    className="h-full rounded-full bg-emerald-400"
                    style={{ width: `${Math.min(trustScore, 100)}%` }}
                  />
                </div>

                <p className="mt-3 text-sm leading-6 text-emerald-100/70">
                  {getTrustMessage(trustLevel)}
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
                  href="/verify-identity"
                  className="mt-4 w-full rounded-xl border border-blue-500/20 bg-blue-500/10 px-4 py-3 text-center font-semibold text-blue-300 hover:bg-blue-500/20"
                >
                  {t("verifyIdentity")}
                </Link>
              )}

              {isAdmin && (
                <Link
                  href="/admin"
                  className="mt-4 w-full rounded-xl border border-zinc-700 bg-white/5 px-4 py-3 text-center font-semibold hover:bg-white/10"
                >
                  {t("openAdminDashboard")}
                </Link>
              )}
            </div>
          </div>

          <div className="space-y-4 rounded-2xl border border-white/10 bg-zinc-900 p-6 lg:col-span-2">
            <div>
              <label className="mb-2 block text-sm font-semibold text-zinc-300">
                {t("fields.fullName")}
              </label>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={t("fields.fullName")}
                className="w-full rounded-xl border border-zinc-800 bg-black p-3 outline-none focus:border-blue-500"
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
                className="w-full rounded-xl border border-zinc-800 bg-black p-3 outline-none focus:border-blue-500"
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
                className="w-full rounded-xl border border-zinc-800 bg-black p-3 outline-none focus:border-blue-500 disabled:opacity-50"
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
                className="w-full rounded-xl border border-zinc-800 bg-black p-3 outline-none focus:border-blue-500"
              />
            </div>

            <button
              onClick={saveProfile}
              disabled={saving || recalculating}
              className="rounded-xl bg-blue-600 px-6 py-3 font-semibold disabled:bg-zinc-700"
            >
              {saving ? t("saving") : t("save")}
            </button>
          </div>
        </div>

        {!isAdmin && (
          <section className="mt-8 rounded-2xl border border-red-500/30 bg-red-500/10 p-6">
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
