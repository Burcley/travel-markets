"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";

type Profile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  bio: string | null;
  role: "student" | "owner";
  avatar_url: string | null;
};

export default function ProfilePage() {
  const t = useTranslations("finalBatchD.legacyProfile");
  const supabase = createClient();

  const [userEmail, setUserEmail] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [role, setRole] = useState<"student" | "owner">("student");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/login";
      return;
    }

    setUserEmail(user.email ?? "");

    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (!data) {
      await supabase.from("profiles").insert({
        id: user.id,
        full_name: "",
        phone: "",
        bio: "",
        role: "student",
        avatar_url: null,
      });

      setProfile({
        id: user.id,
        full_name: "",
        phone: "",
        bio: "",
        role: "student",
        avatar_url: null,
      });
    } else {
      setProfile(data);
      setFullName(data.full_name ?? "");
      setPhone(data.phone ?? "");
      setBio(data.bio ?? "");
      setRole(data.role ?? "student");
      setAvatarUrl(data.avatar_url ?? null);
    }

    setLoading(false);
  }

  async function uploadAvatar(file: File) {
    if (!profile) return;

    const fileExt = file.name.split(".").pop();
    const filePath = `${profile.id}/avatar-${Date.now()}.${fileExt}`;

    const { error } = await supabase.storage
      .from("avatars")
      .upload(filePath, file, {
        upsert: true,
      });

    if (error) {
      alert(error.message);
      return;
    }

    const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);

    setAvatarUrl(data.publicUrl);
  }

  async function saveProfile() {
    if (!profile) return;

    setSaving(true);

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: fullName,
        phone,
        bio,
        role,
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", profile.id);

    setSaving(false);

    if (error) {
      alert(error.message);
      return;
    }

    alert(t("updated"));
    loadProfile();
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center">
        <p className="text-gray-400">{t("loading")}</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white px-6 py-10">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">{t("title")}</h1>
            <p className="text-gray-400 mt-1">
              {t("subtitle")}
            </p>
          </div>

          <Link
            href="/dashboard"
            className="rounded-xl bg-white text-black px-5 py-3 font-semibold hover:bg-gray-200"
          >
            {t("dashboard")}
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="flex flex-col items-center text-center">
              <div className="h-32 w-32 rounded-full bg-white/10 overflow-hidden border border-white/20">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={t("profileAlt")}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-4xl font-bold text-gray-500">
                    {fullName ? fullName.charAt(0).toUpperCase() : "U"}
                  </div>
                )}
              </div>

              <label className="mt-5 cursor-pointer rounded-xl bg-blue-600 px-5 py-3 font-semibold hover:bg-blue-700">
                {t("uploadImage")}
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

              <p className="text-gray-400 text-sm mt-4">{userEmail}</p>

              <span className="mt-4 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm capitalize">
                {role}
              </span>
            </div>
          </section>

          <section className="lg:col-span-2 rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-semibold mb-6">{t("editProfile")}</h2>

            <div className="space-y-5">
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  {t("fullName")}
                </label>
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full rounded-xl bg-black border border-white/10 px-4 py-3 outline-none focus:border-blue-500"
                  placeholder={t("fullNamePlaceholder")}
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  {t("email")}
                </label>
                <input
                  value={userEmail}
                  disabled
                  className="w-full rounded-xl bg-black border border-white/10 px-4 py-3 text-gray-500"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  {t("phone")}
                </label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-xl bg-black border border-white/10 px-4 py-3 outline-none focus:border-blue-500"
                  placeholder={t("phonePlaceholder")}
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  {t("role")}
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as "student" | "owner")}
                  className="w-full rounded-xl bg-black border border-white/10 px-4 py-3 outline-none focus:border-blue-500"
                >
                  <option value="student">{t("student")}</option>
                  <option value="owner">{t("owner")}</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  {t("bio")}
                </label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={5}
                  className="w-full rounded-xl bg-black border border-white/10 px-4 py-3 outline-none focus:border-blue-500"
                  placeholder={t("bioPlaceholder")}
                />
              </div>

              <button
                onClick={saveProfile}
                disabled={saving}
                className="rounded-xl bg-blue-600 px-6 py-3 font-semibold hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? t("saving") : t("saveProfile")}
              </button>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
