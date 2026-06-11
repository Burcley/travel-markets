"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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

  useEffect(() => {
    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          full_name: "",
          phone: "",
          bio: "",
          role: "student",
          avatar_url: null,
          is_verified: false,
          is_admin: false,
          trust_score: 20,
          trust_level: "new",
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
        throw new Error(data.error || "Failed to recalculate trust score.");
      }

      setTrustScore(data.trust_score);
      setTrustLevel(data.trust_level);

      await loadProfile();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Something went wrong.");
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
    alert("Saved!");
    await loadProfile();
  }

  function getTrustLabel(level: string) {
    if (level === "elite") return "Elite Trust";
    if (level === "trusted") return "Trusted";
    if (level === "basic") return "Basic Trust";
    return "New User";
  }

  function getTrustMessage(level: string) {
    if (level === "elite") {
      return "Your account has strong trust signals across Travel Markets.";
    }

    if (level === "trusted") {
      return "Your account has good trust signals. Add more profile details to improve.";
    }

    if (level === "basic") {
      return "Your account has basic trust. Complete verification and profile details to improve.";
    }

    return "Complete your profile and verify your identity to build trust.";
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black text-white">
        Loading profile...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-6 py-10 text-white">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-emerald-400">
              Travel Markets Account
            </p>
            <h1 className="mt-1 text-3xl font-bold">My Profile</h1>
          </div>

          <Link
            href="/dashboard"
            className="rounded-xl bg-white px-4 py-2 font-semibold text-black"
          >
            Dashboard
          </Link>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-zinc-900 p-6">
            <div className="flex flex-col items-center">
              <div className="h-32 w-32 overflow-hidden rounded-full bg-zinc-800 ring-2 ring-white/10">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={fullName || "User"}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-3xl">
                    {fullName ? fullName[0].toUpperCase() : "U"}
                  </div>
                )}
              </div>

              <label className="mt-4 cursor-pointer rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold hover:bg-blue-500">
                Upload
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
                {fullName || "Unnamed user"}
              </h2>

              <p className="mt-1 text-sm text-gray-400">{email}</p>

              <div className="mt-3 flex flex-wrap justify-center gap-2">
                <span className="rounded-full bg-zinc-800 px-3 py-1 text-sm capitalize">
                  {role}
                </span>

                {isVerified && (
                  <span className="rounded-full bg-blue-500/10 px-3 py-1 text-sm text-blue-300">
                    ✓ Identity Verified
                  </span>
                )}

                {isAdmin && (
                  <span className="rounded-full bg-purple-500/10 px-3 py-1 text-sm text-purple-300">
                    Admin
                  </span>
                )}
              </div>

              <div className="mt-6 w-full rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-emerald-300">
                    Trust Score
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
                  {recalculating ? "Updating..." : "Refresh Trust Score"}
                </button>
              </div>

              {!isVerified && (
                <Link
                  href="/verify-identity"
                  className="mt-4 w-full rounded-xl border border-blue-500/20 bg-blue-500/10 px-4 py-3 text-center font-semibold text-blue-300 hover:bg-blue-500/20"
                >
                  Verify Identity
                </Link>
              )}

              {isAdmin && (
                <Link
                  href="/admin"
                  className="mt-4 w-full rounded-xl border border-zinc-700 bg-white/5 px-4 py-3 text-center font-semibold hover:bg-white/10"
                >
                  Open Admin Dashboard
                </Link>
              )}
            </div>
          </div>

          <div className="space-y-4 rounded-2xl border border-white/10 bg-zinc-900 p-6 lg:col-span-2">
            <div>
              <label className="mb-2 block text-sm font-semibold text-zinc-300">
                Full name
              </label>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Full name"
                className="w-full rounded-xl border border-zinc-800 bg-black p-3 outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-zinc-300">
                Phone
              </label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Phone"
                className="w-full rounded-xl border border-zinc-800 bg-black p-3 outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-zinc-300">
                Role
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
                className="w-full rounded-xl border border-zinc-800 bg-black p-3 outline-none focus:border-blue-500"
              >
                <option value="student">Student</option>
                <option value="owner">Owner</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-zinc-300">
                Bio
              </label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Bio"
                rows={4}
                className="w-full rounded-xl border border-zinc-800 bg-black p-3 outline-none focus:border-blue-500"
              />
            </div>

            <button
              onClick={saveProfile}
              disabled={saving || recalculating}
              className="rounded-xl bg-blue-600 px-6 py-3 font-semibold disabled:bg-zinc-700"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}