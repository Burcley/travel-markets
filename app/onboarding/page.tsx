"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";

type Role = "student" | "landlord";

type ExistingProfile = {
  full_name: string | null;
  phone: string | null;
  bio: string | null;
  role: string | null;
  avatar_url: string | null;
};

const totalSteps = 4;

export default function OnboardingPage() {
  const t = useTranslations("accountPages.onboarding");
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [userId, setUserId] = useState("");
  const [email, setEmail] = useState("");
  const [existingProfile, setExistingProfile] = useState<ExistingProfile | null>(
    null
  );
  const [step, setStep] = useState(1);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<Role>("student");
  const [bio, setBio] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadUser() {
    setLoading(true);
    setError("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.replace("/auth");
      return;
    }

    setUserId(user.id);
    setEmail(user.email || "");

    const { data, error } = await supabase
      .from("profiles")
      .select("full_name, phone, bio, role, avatar_url")
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      setError(t("loadError"));
      setLoading(false);
      return;
    }

    const profile = data as ExistingProfile | null;
    setExistingProfile(profile);
    setFullName(profile?.full_name || "");
    setPhone(profile?.phone || "");
    setBio(profile?.bio || "");
    setRole(profile?.role === "landlord" ? "landlord" : "student");
    setLoading(false);
  }

  async function saveProfile(skip = false) {
    if (!userId) return;

    setSaving(true);
    setError("");

    const payload = {
      id: userId,
      email,
      full_name: skip ? existingProfile?.full_name || "" : fullName.trim(),
      phone: skip ? existingProfile?.phone || null : phone.trim() || null,
      bio: skip ? existingProfile?.bio || null : bio.trim() || null,
      role: skip ? existingProfile?.role || "student" : role,
      avatar_url: existingProfile?.avatar_url || null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("profiles").upsert(payload, {
      onConflict: "id",
    });

    setSaving(false);

    if (error) {
      setError(t("saveError"));
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  function nextStep() {
    setStep((current) => Math.min(current + 1, totalSteps));
  }

  function previousStep() {
    setStep((current) => Math.max(current - 1, 1));
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black px-6 text-white">
        <p className="text-zinc-400">{t("loading")}</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-6 py-12 text-white">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8">
          <div className="flex items-center justify-between gap-3">
            {Array.from({ length: totalSteps }).map((_, index) => {
              const active = index + 1 <= step;

              return (
                <div
                  key={index}
                  className={`h-2 flex-1 rounded-full ${
                    active ? "bg-pink-500" : "bg-white/10"
                  }`}
                />
              );
            })}
          </div>

          <p className="mt-3 text-center text-sm text-zinc-500">
            {t("progress", { step, total: totalSteps })}
          </p>
        </div>

        <section className="rounded-3xl border border-white/10 bg-zinc-950 p-6 shadow-2xl sm:p-8">
          {step === 1 && (
            <div className="text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-pink-500 text-xl font-black">
                TM
              </div>

              <h1 className="mt-6 text-3xl font-black sm:text-5xl">
                {t("welcomeTitle")}
              </h1>

              <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-zinc-400 sm:text-base">
                {t("welcomeText")}
              </p>

              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                <button
                  onClick={nextStep}
                  className="rounded-2xl bg-white px-5 py-4 font-bold text-black hover:bg-zinc-200"
                >
                  {t("startSetup")}
                </button>

                <button
                  onClick={() => saveProfile(true)}
                  disabled={saving}
                  className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 font-bold text-white hover:bg-white/10 disabled:opacity-50"
                >
                  {saving ? t("saving") : t("skipForNow")}
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <h1 className="text-3xl font-black">{t("basicInfoTitle")}</h1>
              <p className="mt-2 text-sm text-zinc-400">{t("basicInfoText")}</p>

              <div className="mt-7 space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-zinc-300">
                    {t("fullName")}
                  </label>
                  <input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder={t("fullNamePlaceholder")}
                    className="w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3 outline-none focus:border-pink-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-zinc-300">
                    {t("phone")}
                  </label>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder={t("phonePlaceholder")}
                    className="w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3 outline-none focus:border-pink-500"
                  />
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <h1 className="text-3xl font-black">{t("roleTitle")}</h1>
              <p className="mt-2 text-sm text-zinc-400">{t("roleText")}</p>

              <div className="mt-7 grid gap-4 sm:grid-cols-2">
                <button
                  onClick={() => setRole("student")}
                  className={`rounded-3xl border p-5 text-left transition ${
                    role === "student"
                      ? "border-pink-400 bg-pink-500/15"
                      : "border-white/10 bg-black hover:bg-white/5"
                  }`}
                >
                  <p className="text-xl font-black">{t("student")}</p>
                  <p className="mt-2 text-sm text-zinc-400">
                    {t("studentText")}
                  </p>
                </button>

                <button
                  onClick={() => setRole("landlord")}
                  className={`rounded-3xl border p-5 text-left transition ${
                    role === "landlord"
                      ? "border-pink-400 bg-pink-500/15"
                      : "border-white/10 bg-black hover:bg-white/5"
                  }`}
                >
                  <p className="text-xl font-black">{t("landlord")}</p>
                  <p className="mt-2 text-sm text-zinc-400">
                    {t("landlordText")}
                  </p>
                </button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div>
              <h1 className="text-3xl font-black">{t("bioTitle")}</h1>
              <p className="mt-2 text-sm text-zinc-400">{t("bioText")}</p>

              <div className="mt-7 grid gap-4 lg:grid-cols-[1fr_260px]">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-zinc-300">
                    {t("bio")}
                  </label>
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value.slice(0, 200))}
                    maxLength={200}
                    rows={6}
                    placeholder={t("bioPlaceholder")}
                    className="w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3 outline-none focus:border-pink-500"
                  />
                  <p className="mt-2 text-right text-xs text-zinc-500">
                    {t("bioCount", { count: bio.length })}
                  </p>
                </div>

                <div className="rounded-3xl border border-dashed border-white/10 bg-black p-5">
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/10 text-2xl">
                    {fullName ? fullName[0].toUpperCase() : "TM"}
                  </div>
                  <h2 className="mt-5 font-bold">{t("photoLaterTitle")}</h2>
                  <p className="mt-2 text-sm leading-6 text-zinc-500">
                    {t("photoLaterText")}
                  </p>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
              {error}
            </div>
          )}

          {step > 1 && (
            <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
              <button
                onClick={previousStep}
                className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-bold text-white hover:bg-white/10"
              >
                {t("back")}
              </button>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={() => saveProfile(true)}
                  disabled={saving}
                  className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-bold text-white hover:bg-white/10 disabled:opacity-50"
                >
                  {saving ? t("saving") : t("skip")}
                </button>

                {step < totalSteps ? (
                  <button
                    onClick={nextStep}
                    className="rounded-2xl bg-white px-5 py-3 font-bold text-black hover:bg-zinc-200"
                  >
                    {t("continue")}
                  </button>
                ) : (
                  <button
                    onClick={() => saveProfile(false)}
                    disabled={saving}
                    className="rounded-2xl bg-white px-5 py-3 font-bold text-black hover:bg-zinc-200 disabled:opacity-50"
                  >
                    {saving ? t("saving") : t("finishSetup")}
                  </button>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
