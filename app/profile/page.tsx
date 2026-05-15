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

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
        "id, full_name, phone, bio, role, avatar_url, is_verified, is_admin"
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
        })
        .select(
          "id, full_name, phone, bio, role, avatar_url, is_verified, is_admin"
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

    alert("Saved!");
    await loadProfile();
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
          <h1 className="text-3xl font-bold">My Profile</h1>

          <Link
            href="/dashboard"
            className="rounded-xl bg-white px-4 py-2 font-semibold text-black"
          >
            Dashboard
          </Link>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-2xl bg-zinc-900 p-6">
            <div className="flex flex-col items-center">
              <div className="h-32 w-32 overflow-hidden rounded-full bg-zinc-800">
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

              <label className="mt-4 cursor-pointer rounded-xl bg-blue-600 px-4 py-2">
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

              <p className="mt-3 text-sm text-gray-400">{email}</p>

              <div className="mt-3 flex flex-wrap justify-center gap-2">
                <span className="rounded-full bg-zinc-800 px-3 py-1 text-sm capitalize">
                  {role}
                </span>

                {isVerified && (
                  <span className="rounded-full bg-blue-500/10 px-3 py-1 text-sm text-blue-300">
                    ✓ Verified
                  </span>
                )}

                {isAdmin && (
                  <span className="rounded-full bg-purple-500/10 px-3 py-1 text-sm text-purple-300">
                    Admin
                  </span>
                )}
              </div>

              {isAdmin && (
                <Link
                  href="/admin"
                  className="mt-5 w-full rounded-xl border border-zinc-700 bg-white/5 px-4 py-3 text-center font-semibold hover:bg-white/10"
                >
                  Open Admin Dashboard
                </Link>
              )}
            </div>
          </div>

          <div className="space-y-4 rounded-2xl bg-zinc-900 p-6 lg:col-span-2">
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Full name"
              className="w-full rounded-xl border border-zinc-800 bg-black p-3"
            />

            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Phone"
              className="w-full rounded-xl border border-zinc-800 bg-black p-3"
            />

            <select
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              className="w-full rounded-xl border border-zinc-800 bg-black p-3"
            >
              <option value="student">Student</option>
              <option value="owner">Owner</option>
            </select>

            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Bio"
              rows={4}
              className="w-full rounded-xl border border-zinc-800 bg-black p-3"
            />

            <button
              onClick={saveProfile}
              disabled={saving}
              className="rounded-xl bg-blue-600 px-6 py-3 disabled:bg-zinc-700"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}