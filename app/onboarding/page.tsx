"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";

type OnboardingPath = "find_housing" | "list_property";

type ExistingProfile = {
  id: string;
  onboarding_completed: boolean | null;
  full_name?: string | null;
  phone?: string | null;
  bio?: string | null;
  avatar_url?: string | null;
};

const totalGuideSteps = 5;

function isMissingOnboardingInfrastructure(error: unknown) {
  if (!error || typeof error !== "object") return false;

  const maybeError = error as { code?: string; message?: string };
  const message = (maybeError.message || "").toLowerCase();

  return (
    maybeError.code === "42703" ||
    maybeError.code === "42883" ||
    message.includes("onboarding_completed") ||
    message.includes("ensure_profile_for_current_user") ||
    message.includes("complete_onboarding_for_current_user")
  );
}

function getLocalOnboardingKey(userId: string) {
  return `travel_markets_onboarding_completed_${userId}`;
}

export default function OnboardingPage() {
  const t = useTranslations("accountPages.onboarding");
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [userId, setUserId] = useState("");
  const [email, setEmail] = useState("");
  const [selectedPath, setSelectedPath] =
    useState<OnboardingPath>("find_housing");
  const [step, setStep] = useState(0);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fallbackMessage, setFallbackMessage] = useState("");
  const [supportsOnboardingColumn, setSupportsOnboardingColumn] =
    useState(true);

  useEffect(() => {
    loadUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadUser() {
    setLoading(true);
    setFallbackMessage("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.replace("/auth");
      return;
    }

    setUserId(user.id);
    setEmail(user.email || "");

    if (localStorage.getItem(getLocalOnboardingKey(user.id)) === "true") {
      router.replace("/dashboard");
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, phone, bio, avatar_url, onboarding_completed")
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      console.error("ONBOARDING PROFILE LOAD ERROR:", error);

      if (!isMissingOnboardingInfrastructure(error)) {
        setFallbackMessage(t("preparingProfile"));
        setLoading(false);
        return;
      }

      setSupportsOnboardingColumn(false);

      const { data: profileWithoutFlag, error: idOnlyError } = await supabase
        .from("profiles")
        .select("id, full_name, phone, bio, avatar_url")
        .eq("id", user.id)
        .maybeSingle();

      if (idOnlyError) {
        console.error("ONBOARDING PROFILE FALLBACK LOAD ERROR:", idOnlyError);
        setFallbackMessage(t("preparingProfile"));
        setLoading(false);
        return;
      }

      if (!profileWithoutFlag) {
        const { error: createFallbackError } = await supabase
          .from("profiles")
          .insert({
            id: user.id,
            email: user.email || "",
            updated_at: new Date().toISOString(),
          });

        if (createFallbackError && createFallbackError.code !== "23505") {
          console.error(
            "ONBOARDING PROFILE FALLBACK CREATE ERROR:",
            createFallbackError
          );
          setFallbackMessage(t("preparingProfile"));
        }
      }

      setLoading(false);
      return;
    }

    const profile = data as ExistingProfile | null;

    if (!profile) {
      const { error: createError } = await supabase.from("profiles").insert({
        id: user.id,
        email: user.email || "",
        onboarding_completed: false,
        updated_at: new Date().toISOString(),
      });

      if (createError && createError.code !== "23505") {
        console.error("ONBOARDING PROFILE CREATE ERROR:", createError);
        setFallbackMessage(t("preparingProfile"));
      }

      setLoading(false);
      return;
    }

    if (profile?.onboarding_completed) {
      router.replace("/dashboard");
      return;
    }

    setFullName(profile?.full_name || "");
    setPhone(profile?.phone || "");
    setBio(profile?.bio || "");
    setAvatarUrl(profile?.avatar_url || null);

    setLoading(false);
  }

  async function uploadAvatar(file: File) {
    if (!userId) return;

    const ext = file.name.split(".").pop();
    const path = `${userId}/avatar-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, {
      upsert: true,
    });

    if (error) {
      console.error("ONBOARDING AVATAR UPLOAD ERROR:", error);
      return;
    }

    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    setAvatarUrl(data.publicUrl);
  }

  async function saveProfileSetup() {
    if (!userId) return true;

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: fullName,
        phone,
        bio,
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (error) {
      console.error("ONBOARDING PROFILE SAVE ERROR:", error);
      setFallbackMessage(t("preparingProfile"));
      return false;
    }

    return true;
  }

  async function continueFromProfile() {
    setSaving(true);
    const saved = await saveProfileSetup();
    setSaving(false);

    if (saved) setStep(1);
  }

  async function completeOnboarding() {
    if (!userId) return;

    setSaving(true);
    setFallbackMessage("");
    await saveProfileSetup();

    if (!supportsOnboardingColumn) {
      localStorage.setItem(getLocalOnboardingKey(userId), "true");
      router.push(selectedPath === "list_property" ? "/dashboard" : "/search");
      router.refresh();
      return;
    }

    const { error } = await supabase.rpc(
      "complete_onboarding_for_current_user"
    );

    if (error) {
      console.error("ONBOARDING COMPLETE ERROR:", error);

      if (isMissingOnboardingInfrastructure(error)) {
        localStorage.setItem(getLocalOnboardingKey(userId), "true");
        router.push(selectedPath === "list_property" ? "/dashboard" : "/search");
        router.refresh();
        return;
      }

      setFallbackMessage(t("preparingProfile"));
      setSaving(false);
      return;
    }

    router.push(selectedPath === "list_property" ? "/dashboard" : "/search");
    router.refresh();
  }

  const guideRole =
    selectedPath === "list_property" ? "landlordGuide" : "studentGuide";
  const guideStep = step > 1 ? step - 1 : 1;

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black px-6 text-white">
        <p className="text-zinc-400">{t("loading")}</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-6 py-12 text-white">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8">
          <div className="flex items-center justify-between gap-3">
            {Array.from({ length: totalGuideSteps + 1 }).map((_, index) => {
              const active = index <= step;

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
            {step <= 1
              ? t("chooseRoleProgress")
              : t("progress", { step: step - 1, total: totalGuideSteps - 1 })}
          </p>
        </div>

        <section className="rounded-3xl border border-white/10 bg-zinc-950 p-6 shadow-2xl sm:p-8">
          <div className="mb-6 flex justify-end">
            <button
              type="button"
              onClick={() => completeOnboarding()}
              disabled={saving}
              className="text-sm font-semibold text-zinc-500 transition hover:text-white disabled:opacity-50"
            >
              {saving ? t("saving") : t("skip")}
            </button>
          </div>

          {step === 0 ? (
            <div>
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-pink-500 text-xl font-black">
                TM
              </div>

              <div className="mt-6 text-center">
                <p className="text-sm font-bold uppercase tracking-[0.18em] text-pink-300">
                  {t("profileSetupEyebrow")}
                </p>
                <h1 className="mt-3 text-3xl font-black sm:text-5xl">
                  {t("profileSetupTitle")}
                </h1>
                <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-zinc-400 sm:text-base">
                  {t("profileSetupText")}
                </p>
              </div>

              <div className="mx-auto mt-8 max-w-2xl space-y-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <div className="h-24 w-24 overflow-hidden rounded-full border border-white/10 bg-black">
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt={fullName || email || "User"}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-3xl font-black">
                        {(fullName || email || "U").charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>

                  <label className="cursor-pointer rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-center text-sm font-semibold hover:bg-white/10">
                    {t("uploadPhoto")}
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
                </div>

                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder={t("fullName")}
                  className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-white/30"
                />

                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder={t("phone")}
                  className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-white/30"
                />

                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder={t("bio")}
                  rows={4}
                  className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-white/30"
                />
              </div>

              {fallbackMessage && (
                <p className="mx-auto mt-4 max-w-xl text-center text-sm leading-6 text-zinc-500">
                  {fallbackMessage}
                </p>
              )}

              <div className="mt-8 flex justify-center">
                <button
                  onClick={continueFromProfile}
                  disabled={saving}
                  className="rounded-2xl bg-white px-8 py-3 font-bold text-black shadow-lg shadow-white/10 transition hover:bg-zinc-200 disabled:opacity-50"
                >
                  {saving ? t("saving") : t("continue")}
                </button>
              </div>
            </div>
          ) : step === 1 ? (
            <div className="text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-pink-500 text-xl font-black">
                TM
              </div>

              <p className="mt-6 text-sm font-bold uppercase tracking-[0.18em] text-pink-300">
                {t("eyebrow")}
              </p>
              <h1 className="mt-3 text-3xl font-black sm:text-5xl">
                {t("welcomeTitle")}
              </h1>
              <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-zinc-400 sm:text-base">
                {t("welcomeText")}
              </p>

              {fallbackMessage && (
                <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-zinc-500">
                  {fallbackMessage}
                </p>
              )}

              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                <RoleButton
                  active={selectedPath === "find_housing"}
                  icon="🎓"
                  title={t("findHousing")}
                  text={t("findHousingText")}
                  onClick={() => setSelectedPath("find_housing")}
                />
                <RoleButton
                  active={selectedPath === "list_property"}
                  icon="🏠"
                  title={t("listProperty")}
                  text={t("listPropertyText")}
                  onClick={() => setSelectedPath("list_property")}
                />
              </div>

              <div className="mt-8 flex justify-center">
                <button
                  onClick={() => setStep(2)}
                  className="rounded-2xl bg-white px-8 py-3 font-bold text-black shadow-lg shadow-white/10 transition hover:bg-zinc-200"
                >
                  {t("continue")}
                </button>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-pink-300">
                {t(`${guideRole}.eyebrow`)}
              </p>
              <h1 className="mt-3 text-3xl font-black sm:text-5xl">
                {t(`${guideRole}.steps.${guideStep}.title`)}
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-400 sm:text-base">
                {t(`${guideRole}.steps.${guideStep}.text`)}
              </p>

              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                {[1, 2, 3].map((item) => (
                  <div
                    key={item}
                    className="rounded-2xl border border-white/10 bg-black p-5"
                  >
                    <p className="font-bold text-white">
                      {t(`${guideRole}.steps.${guideStep}.points.${item}.title`)}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-zinc-500">
                      {t(`${guideRole}.steps.${guideStep}.points.${item}.text`)}
                    </p>
                  </div>
                ))}
              </div>

              {fallbackMessage && (
                <p className="mt-6 text-sm leading-6 text-zinc-500">
                  {fallbackMessage}
                </p>
              )}

              <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
                <button
                  onClick={() => setStep((current) => Math.max(current - 1, 1))}
                  className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-bold text-white hover:bg-white/10"
                >
                  {t("back")}
                </button>

                <div className="flex flex-col gap-3 sm:flex-row">
                  {step < totalGuideSteps ? (
                    <button
                      onClick={() =>
                        setStep((current) =>
                          Math.min(current + 1, totalGuideSteps)
                        )
                      }
                      className="rounded-2xl bg-white px-8 py-3 font-bold text-black shadow-lg shadow-white/10 transition hover:bg-zinc-200"
                    >
                      {t("continue")}
                    </button>
                  ) : (
                    <button
                      onClick={() => completeOnboarding()}
                      disabled={saving}
                      className="rounded-2xl bg-white px-8 py-3 font-bold text-black shadow-lg shadow-white/10 transition hover:bg-zinc-200 disabled:opacity-50"
                    >
                      {saving ? t("saving") : t("getStarted")}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function RoleButton({
  active,
  icon,
  title,
  text,
  onClick,
}: {
  active: boolean;
  icon: string;
  title: string;
  text: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-3xl border p-5 text-left transition ${
        active
          ? "border-pink-400 bg-pink-500/15"
          : "border-white/10 bg-black hover:bg-white/5"
      }`}
    >
      <p className="text-3xl">{icon}</p>
      <p className="mt-4 text-xl font-black">{title}</p>
      <p className="mt-2 text-sm leading-6 text-zinc-400">{text}</p>
    </button>
  );
}
