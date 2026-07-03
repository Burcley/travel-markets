"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";

type OnboardingPath = "find_housing" | "list_property";

type ExistingProfile = {
  id: string;
  onboarding_completed: boolean | null;
};

const totalGuideSteps = 4;

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
      .select("id, onboarding_completed")
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
        .select("id")
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

    setLoading(false);
  }

  async function completeOnboarding() {
    if (!userId) return;

    setSaving(true);
    setFallbackMessage("");

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
  const guideStep = step > 0 ? step : 1;

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
            {step === 0
              ? t("chooseRoleProgress")
              : t("progress", { step, total: totalGuideSteps })}
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
                  onClick={() => setStep(1)}
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
                  onClick={() => setStep((current) => Math.max(current - 1, 0))}
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
