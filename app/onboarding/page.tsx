"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Camera,
  CheckCircle2,
  GraduationCap,
  Languages,
  Loader2,
  Sparkles,
  UserRound,
} from "lucide-react";
import {
  CANADIAN_INSTITUTIONS,
  OTHER_CAMPUS_ID,
  PROGRAM_OPTIONS,
  UNLISTED_INSTITUTION_ID,
  getCampusById,
  getCampusesForInstitution,
  getInstitutionById,
} from "@/lib/data/canadian-institutions";
import { createClient } from "@/lib/supabase/client";

type OnboardingRole = "student" | "host";

type ExistingProfile = {
  id: string;
  onboarding_completed: boolean | null;
  full_name?: string | null;
  phone?: string | null;
  bio?: string | null;
  avatar_url?: string | null;
  role?: string | null;
  is_admin?: boolean | null;
  country?: string | null;
  preferred_language?: string | null;
  school?: string | null;
  program?: string | null;
  institution_id?: string | null;
  institution_name?: string | null;
  institution_not_listed?: boolean | null;
  unlisted_institution_name?: string | null;
  campus_id?: string | null;
  campus_name?: string | null;
  campus_not_listed?: boolean | null;
  unlisted_campus_name?: string | null;
  program_category?: string | null;
  program_name?: string | null;
  expected_graduation?: string | null;
  host_type?: string | null;
  property_management_company?: string | null;
  management_role?: string | null;
  onboarding_completed_at?: string | null;
};

const TOTAL_STEPS = 5;
const OTHER_PROGRAM_NAME = "Other";

function isMissingOnboardingInfrastructure(error: unknown) {
  if (!error || typeof error !== "object") return false;

  const maybeError = error as { code?: string; message?: string };
  const message = (maybeError.message || "").toLowerCase();

  return (
    maybeError.code === "42703" ||
    maybeError.code === "42883" ||
    message.includes("onboarding_completed") ||
    message.includes("country") ||
    message.includes("preferred_language") ||
    message.includes("expected_graduation") ||
    message.includes("institution_id") ||
    message.includes("campus_id") ||
    message.includes("program_category") ||
    message.includes("program_name") ||
    message.includes("host_type") ||
    message.includes("property_management_company") ||
    message.includes("management_role") ||
    message.includes("ensure_profile_for_current_user") ||
    message.includes("complete_onboarding_for_current_user")
  );
}

function getLocalOnboardingKey(userId: string) {
  return `travel_markets_onboarding_completed_${userId}`;
}

function normalizeRole(role?: string | null): OnboardingRole {
  const value = String(role || "").toLowerCase();

  if (["host", "owner", "landlord"].includes(value)) return "host";
  return "student";
}

function profileRole(role: OnboardingRole) {
  if (role === "host") return "owner";
  return "student";
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<OnboardingLoading />}>
      <OnboardingWizard />
    </Suspense>
  );
}

function OnboardingLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-6 text-white">
      <div className="text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-pink-300" />
        <p className="mt-4 text-zinc-400">Preparing your onboarding...</p>
      </div>
    </main>
  );
}

function OnboardingWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [userId, setUserId] = useState("");
  const [email, setEmail] = useState("");
  const [emailVerified, setEmailVerified] = useState(false);
  const [supportsOnboardingColumn, setSupportsOnboardingColumn] = useState(true);
  const [supportsExtendedProfileFields, setSupportsExtendedProfileFields] =
    useState(true);

  const [step, setStep] = useState(0);
  const [role, setRole] = useState<OnboardingRole>("student");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [country, setCountry] = useState("Canada");
  const [preferredLanguage, setPreferredLanguage] = useState("English");
  const [school, setSchool] = useState("");
  const [program, setProgram] = useState("");
  const [institutionId, setInstitutionId] = useState("");
  const [institutionSearch, setInstitutionSearch] = useState("");
  const [unlistedInstitutionName, setUnlistedInstitutionName] = useState("");
  const [campusId, setCampusId] = useState("");
  const [unlistedCampusName, setUnlistedCampusName] = useState("");
  const [programCategory, setProgramCategory] = useState("");
  const [programName, setProgramName] = useState("");
  const [customProgramName, setCustomProgramName] = useState("");
  const [expectedGraduation, setExpectedGraduation] = useState("");
  const [hostType, setHostType] = useState("Individual host");
  const [propertyManagementCompany, setPropertyManagementCompany] = useState("");
  const [managementRole, setManagementRole] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const requestedStep = searchParams.get("step");
    if (requestedStep === "role") setStep(0);
    if (requestedStep === "profile") setStep(2);
    loadUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!userId || loading) return;

    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);

    autosaveTimer.current = setTimeout(() => {
      saveDraft({ quiet: true });
    }, 900);

    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    role,
    fullName,
    phone,
    bio,
    country,
    preferredLanguage,
    school,
    program,
    institutionId,
    institutionSearch,
    unlistedInstitutionName,
    campusId,
    unlistedCampusName,
    programCategory,
    programName,
    customProgramName,
    expectedGraduation,
    hostType,
    propertyManagementCompany,
    managementRole,
    avatarUrl,
    userId,
    loading,
  ]);

  async function loadUser() {
    setLoading(true);
    setErrorMessage("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.replace("/auth");
      return;
    }

    setUserId(user.id);
    setEmail(user.email || "");
    setEmailVerified(Boolean(user.email_confirmed_at));

    if (localStorage.getItem(getLocalOnboardingKey(user.id)) === "true") {
      router.replace("/dashboard");
      return;
    }

    const selectFields =
      "id, full_name, phone, bio, avatar_url, role, is_admin, onboarding_completed, onboarding_completed_at, country, preferred_language, school, program, institution_id, institution_name, institution_not_listed, unlisted_institution_name, campus_id, campus_name, campus_not_listed, unlisted_campus_name, program_category, program_name, expected_graduation, host_type, property_management_company, management_role";
    const { data, error } = await supabase
      .from("profiles")
      .select(selectFields)
      .eq("id", user.id)
      .maybeSingle();

    if (error && isMissingOnboardingInfrastructure(error)) {
      setSupportsExtendedProfileFields(false);

      const fallback = await supabase
        .from("profiles")
        .select("id, full_name, phone, bio, avatar_url, role, is_admin, onboarding_completed")
        .eq("id", user.id)
        .maybeSingle();

      if (fallback.error && isMissingOnboardingInfrastructure(fallback.error)) {
        setSupportsOnboardingColumn(false);
      } else if (fallback.error) {
        console.error("ONBOARDING PROFILE LOAD ERROR:", fallback.error);
        setErrorMessage("We are preparing your profile. You can keep going.");
      } else {
        applyProfile(fallback.data as ExistingProfile | null);
      }

      if (!fallback.data) {
        await ensureProfile(user.id, user.email || "");
      }

      setLoading(false);
      return;
    }

    if (error) {
      console.error("ONBOARDING PROFILE LOAD ERROR:", error);
      setErrorMessage("We are preparing your profile. You can keep going.");
      setLoading(false);
      return;
    }

    if (!data) {
      await ensureProfile(user.id, user.email || "");
      setLoading(false);
      return;
    }

    const profile = data as ExistingProfile;

    if (profile.onboarding_completed_at || profile.onboarding_completed) {
      router.replace("/dashboard");
      return;
    }

    applyProfile(profile);
    setLoading(false);
  }

  function applyProfile(profile: ExistingProfile | null) {
    if (!profile) return;

    const nextRole = normalizeRole(profile.role);

    setRole(nextRole);
    setFullName(profile.full_name || "");
    setPhone(profile.phone || "");
    setBio(profile.bio || "");
    setAvatarUrl(profile.avatar_url || null);
    setCountry(profile.country || "Canada");
    setPreferredLanguage(profile.preferred_language || "English");
    setSchool(profile.school || "");
    setProgram(profile.program || "");
    const nextInstitutionId =
      profile.institution_not_listed === true
        ? UNLISTED_INSTITUTION_ID
        : profile.institution_id || "";
    const institution = nextInstitutionId
      ? getInstitutionById(nextInstitutionId)
      : null;
    const nextProgramName = profile.program_name || profile.program || "";

    setInstitutionId(nextInstitutionId);
    setInstitutionSearch(
      profile.institution_not_listed
        ? "Other Ontario university"
        : institution?.name || profile.institution_name || profile.school || ""
    );
    setUnlistedInstitutionName(profile.unlisted_institution_name || "");
    setCampusId(
      profile.campus_not_listed === true
        ? OTHER_CAMPUS_ID
        : profile.campus_id || ""
    );
    setUnlistedCampusName(profile.unlisted_campus_name || "");
    setProgramCategory(profile.program_category || "");
    setProgramName(nextProgramName);
    setCustomProgramName(
      nextProgramName &&
        !PROGRAM_OPTIONS.some((option) => option.name === nextProgramName)
        ? nextProgramName
        : ""
    );
    setExpectedGraduation(profile.expected_graduation || "");
    setHostType(profile.host_type || "Individual host");
    setPropertyManagementCompany(profile.property_management_company || "");
    setManagementRole(profile.management_role || "");
  }

  async function ensureProfile(nextUserId: string, nextEmail: string) {
    const { error } = await supabase.from("profiles").insert({
      id: nextUserId,
      email: nextEmail,
      role: "student",
      onboarding_completed: false,
      updated_at: new Date().toISOString(),
    });

    if (error && error.code !== "23505") {
      console.error("ONBOARDING PROFILE CREATE ERROR:", error);
      setErrorMessage("We could not create every profile detail yet, but you can continue.");
    }
  }

  function buildProfilePayload(includeExtendedFields = supportsExtendedProfileFields) {
    const payload: Record<string, string | boolean | null> = {
      full_name: fullName.trim(),
      phone: phone.trim() || null,
      bio: bio.trim() || null,
      avatar_url: avatarUrl,
      role: profileRole(role),
      updated_at: new Date().toISOString(),
    };

    if (supportsOnboardingColumn) {
      payload.onboarding_completed = false;
    }

    if (includeExtendedFields) {
      payload.country = country.trim() || null;
      payload.preferred_language = preferredLanguage.trim() || null;
      const selectedInstitution =
        institutionId && institutionId !== UNLISTED_INSTITUTION_ID
          ? getInstitutionById(institutionId)
          : null;
      const selectedCampus =
        campusId && campusId !== OTHER_CAMPUS_ID ? getCampusById(campusId) : null;
      const finalInstitutionName =
        role === "student"
          ? institutionId === UNLISTED_INSTITUTION_ID
            ? unlistedInstitutionName.trim()
            : selectedInstitution?.name || school.trim()
          : "";
      const finalCampusName =
        role === "student"
          ? campusId === OTHER_CAMPUS_ID
            ? unlistedCampusName.trim()
            : selectedCampus?.name || ""
          : "";
      const finalProgramName =
        role === "student"
          ? programName === OTHER_PROGRAM_NAME
            ? customProgramName.trim()
            : programName.trim()
          : "";

      payload.school = role === "student" ? finalInstitutionName || null : null;
      payload.program = role === "student" ? finalProgramName || null : null;
      payload.institution_id =
        role === "student" && institutionId !== UNLISTED_INSTITUTION_ID
          ? institutionId || null
          : null;
      payload.institution_name =
        role === "student" ? finalInstitutionName || null : null;
      payload.institution_not_listed =
        role === "student" && institutionId === UNLISTED_INSTITUTION_ID;
      payload.unlisted_institution_name =
        role === "student" && institutionId === UNLISTED_INSTITUTION_ID
          ? unlistedInstitutionName.trim() || null
          : null;
      payload.campus_id =
        role === "student" && campusId !== OTHER_CAMPUS_ID
          ? campusId || null
          : null;
      payload.campus_name = role === "student" ? finalCampusName || null : null;
      payload.campus_not_listed =
        role === "student" && campusId === OTHER_CAMPUS_ID;
      payload.unlisted_campus_name =
        role === "student" && campusId === OTHER_CAMPUS_ID
          ? unlistedCampusName.trim() || null
          : null;
      payload.program_category =
        role === "student" ? programCategory.trim() || null : null;
      payload.program_name = role === "student" ? finalProgramName || null : null;
      payload.expected_graduation =
        role === "student" && expectedGraduation ? expectedGraduation : null;
      payload.host_type = role === "host" ? hostType.trim() || null : null;
      payload.property_management_company =
        role === "host" ? propertyManagementCompany.trim() || null : null;
      payload.management_role = role === "host" ? managementRole.trim() || null : null;
    }

    return payload;
  }

  async function saveDraft({ quiet = false } = {}) {
    if (!userId) return true;

    if (!quiet) {
      setSaving(true);
      setSaveMessage("");
      setErrorMessage("");
    }

    const { error } = await supabase
      .from("profiles")
      .update(buildProfilePayload())
      .eq("id", userId);

    if (error && isMissingOnboardingInfrastructure(error)) {
      setSupportsExtendedProfileFields(false);

      const retry = await supabase
        .from("profiles")
        .update(buildProfilePayload(false))
        .eq("id", userId);

      if (retry.error) {
        console.error("ONBOARDING PROFILE SAVE RETRY ERROR:", retry.error);
        if (!quiet) setErrorMessage("We could not autosave your profile yet.");
        setSaving(false);
        return false;
      }
    } else if (error) {
      console.error("ONBOARDING PROFILE SAVE ERROR:", error);
      if (!quiet) setErrorMessage("We could not autosave your profile yet.");
      setSaving(false);
      return false;
    }

    if (!quiet) {
      setSaveMessage("Saved");
      setSaving(false);
    }

    return true;
  }

  async function uploadAvatar(file: File) {
    if (!userId) return;

    setAvatarUploading(true);
    setErrorMessage("");

    const ext = file.name.split(".").pop() || "jpg";
    const path = `${userId}/avatar-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, {
      upsert: true,
    });

    setAvatarUploading(false);

    if (error) {
      console.error("ONBOARDING AVATAR UPLOAD ERROR:", error);
      setErrorMessage("We could not upload that photo. You can skip it for now.");
      return;
    }

    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    setAvatarUrl(data.publicUrl);
  }

  async function goToStep(nextStep: number) {
    const validationError = validateCurrentStep();
    if (nextStep > step && validationError) {
      setErrorMessage(validationError);
      return;
    }

    const saved = await saveDraft();
    if (!saved) return;
    setErrorMessage("");
    setStep(Math.min(Math.max(nextStep, 0), TOTAL_STEPS - 1));
  }

  function validateCurrentStep() {
    if (step === 2) {
      if (!fullName.trim()) return "Enter your full name to continue.";
      if (!phone.trim()) return "Enter your phone number to continue.";
      if (!country.trim()) return "Enter your country to continue.";
      if (!preferredLanguage.trim()) return "Choose your preferred language.";
    }

    if (step === 3 && role === "student") {
      const selectedCampuses =
        institutionId && institutionId !== UNLISTED_INSTITUTION_ID
          ? getCampusesForInstitution(institutionId)
          : [];
      const finalProgram =
        programName === OTHER_PROGRAM_NAME ? customProgramName.trim() : programName;

      if (!institutionId) return "Choose your institution to continue.";
      if (
        institutionId === UNLISTED_INSTITUTION_ID &&
        !unlistedInstitutionName.trim()
      ) {
        return "Enter the institution name so Travel Markets can review it.";
      }
      if (selectedCampuses.length > 0 && !campusId) {
        return "Choose your campus to continue.";
      }
      if (campusId === OTHER_CAMPUS_ID && !unlistedCampusName.trim()) {
        return "Enter the campus name so Travel Markets can review it.";
      }
      if (!programName) return "Choose your program to continue.";
      if (!finalProgram.trim()) return "Enter your program name to continue.";
      if (!expectedGraduation) return "Enter your expected graduation date.";

      const graduationDate = new Date(`${expectedGraduation}T00:00:00`);
      const now = new Date();
      const earliest = new Date(now.getFullYear(), 0, 1);
      const latest = new Date(now.getFullYear() + 8, 11, 31);

      if (
        Number.isNaN(graduationDate.getTime()) ||
        graduationDate < earliest ||
        graduationDate > latest
      ) {
        return "Enter a reasonable current or future graduation date.";
      }
    }

    if (step === 3 && role === "host" && !hostType.trim()) {
      return "Choose whether you are an individual landlord or property manager.";
    }

    return "";
  }

  async function continueToEmailVerification() {
    const validationError = validateCurrentStep();
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setSaving(true);
    const saved = await saveDraft({ quiet: true });
    setSaving(false);

    if (!saved) return;

    router.push(emailVerified ? "/onboarding/verifications" : "/onboarding/verify-email");
  }

  function chooseInstitution(nextInstitutionId: string) {
    const institution =
      nextInstitutionId === UNLISTED_INSTITUTION_ID
        ? null
        : getInstitutionById(nextInstitutionId);

    setInstitutionId(nextInstitutionId);
    setInstitutionSearch(
      nextInstitutionId === UNLISTED_INSTITUTION_ID
        ? "Other Ontario university"
        : institution?.name || ""
    );
    setCampusId("");
    setUnlistedCampusName("");
    setSchool(
      nextInstitutionId === UNLISTED_INSTITUTION_ID ? "" : institution?.name || ""
    );
  }

  function chooseProgram(nextProgramName: string) {
    const option = PROGRAM_OPTIONS.find((item) => item.name === nextProgramName);

    setProgramName(nextProgramName);
    setProgramCategory(option?.category || "");
    if (nextProgramName !== OTHER_PROGRAM_NAME) {
      setProgram(nextProgramName);
      setCustomProgramName("");
    } else {
      setProgram(customProgramName);
    }
  }

  const progress = ((step + 1) / TOTAL_STEPS) * 100;
  const selectedCampuses =
    institutionId && institutionId !== UNLISTED_INSTITUTION_ID
      ? getCampusesForInstitution(institutionId)
      : [];

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black px-6 text-white">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-pink-300" />
          <p className="mt-4 text-zinc-400">Preparing your onboarding...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-4 py-8 text-white sm:px-6">
      <div className="mx-auto max-w-5xl">
        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(244,63,94,0.24),rgba(24,24,27,0.96)_38%,rgba(0,0,0,1)_100%)] shadow-2xl">
          <div className="border-b border-white/10 px-5 py-5 sm:px-8">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-pink-300">
                  Travel Markets
                </p>
                <h1 className="mt-2 text-2xl font-black sm:text-3xl">
                  Welcome to Travel Markets
                </h1>
              </div>
              <div className="rounded-full border border-white/10 bg-black/40 px-4 py-2 text-sm text-zinc-300">
                Step {step + 1} of {TOTAL_STEPS}
              </div>
            </div>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-pink-500 to-white transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className="p-5 sm:p-8">
            {step === 0 && (
              <WizardPanel
                icon={<Sparkles className="h-7 w-7" />}
                title="How would you like to use Travel Markets?"
                text="Choose the path that best matches what you want to do first. You can still explore other features later when your account has access."
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <RoleCard
                    active={role === "student"}
                    icon={<GraduationCap className="h-7 w-7" />}
                    title="Student"
                    text="Find housing, message landlords, and book viewings."
                    onClick={() => setRole("student")}
                  />
                  <RoleCard
                    active={role === "host"}
                    icon={<Building2 className="h-7 w-7" />}
                    title="Host"
                    text="List a property, manage applicants, and coordinate viewings."
                    onClick={() => setRole("host")}
                  />
                </div>
              </WizardPanel>
            )}

            {step === 1 && (
              <WizardPanel
                icon={<Camera className="h-7 w-7" />}
                title="Add a profile picture"
                text="A clear photo helps students and hosts recognize who they are speaking with. You can skip this for now."
              >
                <div className="flex flex-col items-center gap-5">
                  <div className="relative h-36 w-36 overflow-hidden rounded-full border border-white/10 bg-black shadow-2xl">
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt={fullName || email || "Profile"}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-5xl font-black">
                        {(fullName || email || "U").charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 bg-black/70 py-2 text-center text-xs font-bold">
                      {avatarUploading ? "Uploading..." : "Preview"}
                    </div>
                  </div>

                  <label className="cursor-pointer rounded-2xl bg-white px-6 py-3 text-sm font-black text-black transition hover:bg-zinc-200">
                    Upload profile picture
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) uploadAvatar(file);
                      }}
                    />
                  </label>
                </div>
              </WizardPanel>
            )}

            {step === 2 && (
              <WizardPanel
                icon={<UserRound className="h-7 w-7" />}
                title="Tell people a little about you"
                text="These details make your profile feel real and help with safer rental conversations."
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Full name" value={fullName} onChange={setFullName} />
                  <Field label="Phone" value={phone} onChange={setPhone} />
                  <Field label="Country" value={country} onChange={setCountry} />
                  <SelectField
                    label="Preferred language"
                    value={preferredLanguage}
                    onChange={setPreferredLanguage}
                    options={["English", "French", "Spanish", "Mandarin", "Hindi", "Other"]}
                  />
                  <div className="md:col-span-2">
                    <TextArea label="Bio" value={bio} onChange={setBio} />
                  </div>
                </div>
              </WizardPanel>
            )}

            {step === 3 && role === "host" && (
              <WizardPanel
                icon={<Building2 className="h-7 w-7" />}
                title="Set up your host profile"
                text="This helps students understand whether they are speaking with an owner, landlord, or property manager."
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <SelectField
                    label="Host type"
                    value={hostType}
                    onChange={setHostType}
                    options={[
                      "Individual host",
                      "Property owner",
                      "Landlord",
                      "Property manager",
                      "Student sublet host",
                    ]}
                  />
                  <Field
                    label="Property management company (optional)"
                    value={propertyManagementCompany}
                    onChange={setPropertyManagementCompany}
                  />
                  <Field
                    label="Management role (optional)"
                    value={managementRole}
                    onChange={setManagementRole}
                  />
                </div>
              </WizardPanel>
            )}

            {step === 3 && role !== "host" && (
              <WizardPanel
                icon={<GraduationCap className="h-7 w-7" />}
                title="Set up your student profile"
                text="Institution details help hosts understand your rental timeline. This does not verify student status; verification happens separately."
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <InstitutionSelector
                      search={institutionSearch}
                      selectedId={institutionId}
                      onSearch={setInstitutionSearch}
                      onSelect={chooseInstitution}
                    />
                  </div>

                  {institutionId === UNLISTED_INSTITUTION_ID && (
                    <Field
                      label="Institution name for review"
                      value={unlistedInstitutionName}
                      onChange={(value) => {
                        setUnlistedInstitutionName(value);
                        setSchool(value);
                      }}
                      placeholder="Enter the official institution name"
                    />
                  )}

                  {(selectedCampuses.length > 0 ||
                    institutionId === UNLISTED_INSTITUTION_ID) && (
                    <CampusSelector
                      campuses={selectedCampuses}
                      value={campusId}
                      onChange={(value) => {
                        setCampusId(value);
                        const campus = getCampusById(value);
                        if (campus) setUnlistedCampusName("");
                      }}
                    />
                  )}

                  {campusId === OTHER_CAMPUS_ID && (
                    <Field
                      label="Campus name for review"
                      value={unlistedCampusName}
                      onChange={setUnlistedCampusName}
                      placeholder="Enter the campus name"
                    />
                  )}

                  <ProgramSelector value={programName} onChange={chooseProgram} />

                  {programName === OTHER_PROGRAM_NAME && (
                    <Field
                      label="Program name"
                      value={customProgramName}
                      onChange={(value) => {
                        setCustomProgramName(value);
                        setProgram(value);
                      }}
                      placeholder="Enter your program"
                    />
                  )}

                  <Field
                    label="Expected graduation"
                    type="date"
                    value={expectedGraduation}
                    onChange={setExpectedGraduation}
                  />
                </div>
              </WizardPanel>
            )}

            {step === 4 && (
              <WizardPanel
                icon={<CheckCircle2 className="h-7 w-7" />}
                title="Your profile is ready."
                text="Next, verify your email address. Email verification is mandatory before normal account access."
              >
                <div className="grid gap-4 md:grid-cols-3">
                  <SummaryCard title="Role" value={role === "host" ? "Host" : "Student"} />
                  <SummaryCard title="Profile" value={fullName ? "Required fields complete" : "Profile incomplete"} />
                  <SummaryCard title="Email" value={emailVerified ? "Verified" : "Verification pending"} />
                </div>
              </WizardPanel>
            )}

            {errorMessage && (
              <p className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
                {errorMessage}
              </p>
            )}

            <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={() => goToStep(step - 1)}
                disabled={step === 0 || saving}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                {saveMessage && <span className="text-sm text-emerald-300">{saveMessage}</span>}
                {step < TOTAL_STEPS - 1 ? (
                  <button
                    type="button"
                    onClick={() => goToStep(step + 1)}
                    disabled={saving || avatarUploading}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-7 py-3 text-sm font-black text-black shadow-lg shadow-white/10 transition hover:bg-zinc-200 disabled:opacity-50"
                  >
                    {saving ? "Saving..." : "Continue"}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={continueToEmailVerification}
                    disabled={saving}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-7 py-3 text-sm font-black text-black shadow-lg shadow-white/10 transition hover:bg-zinc-200 disabled:opacity-50"
                  >
                    {saving ? "Saving..." : "Continue to email verification"}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function WizardPanel({
  icon,
  title,
  text,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
  children: React.ReactNode;
}) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-3 duration-500">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-pink-400/30 bg-pink-500/15 text-pink-200">
          {icon}
        </div>
        <div>
          <h2 className="text-3xl font-black sm:text-5xl">{title}</h2>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-400 sm:text-base">
            {text}
          </p>
        </div>
      </div>
      <div className="mt-8">{children}</div>
    </div>
  );
}

function RoleCard({
  active,
  disabled,
  icon,
  title,
  text,
  onClick,
}: {
  active: boolean;
  disabled?: boolean;
  icon: React.ReactNode;
  title: string;
  text: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-3xl border p-5 text-left transition ${
        active
          ? "border-pink-400 bg-pink-500/15 shadow-lg shadow-pink-500/10"
          : "border-white/10 bg-black/60 hover:border-white/25 hover:bg-white/[0.04]"
      } disabled:cursor-not-allowed disabled:opacity-50`}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-pink-200">
        {icon}
      </div>
      <p className="mt-5 text-xl font-black">{title}</p>
      <p className="mt-2 text-sm leading-6 text-zinc-400">{text}</p>
    </button>
  );
}

function InstitutionSelector({
  search,
  selectedId,
  onSearch,
  onSelect,
}: {
  search: string;
  selectedId: string;
  onSearch: (value: string) => void;
  onSelect: (value: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [provinceFilter, setProvinceFilter] = useState("Ontario");
  const [typeFilter, setTypeFilter] = useState("university");
  const normalizedSearch = search.trim().toLowerCase();
  const matches = CANADIAN_INSTITUTIONS.filter((institution) => {
    if (!institution.active) return false;
    if (provinceFilter && institution.province !== provinceFilter) return false;
    if (typeFilter && institution.type !== typeFilter) return false;
    if (!normalizedSearch) return true;

    return [
      institution.name,
      institution.city,
      institution.province,
      institution.type,
      institution.domain || "",
      ...institution.aliases,
    ]
      .join(" ")
      .toLowerCase()
      .includes(normalizedSearch);
  }).slice(0, 20);
  const options = [
    ...matches.map((institution) => ({
      id: institution.id,
      label: institution.name,
      description: `${institution.city}, ${institution.province}`,
      type: institution.type,
    })),
    {
      id: UNLISTED_INSTITUTION_ID,
      label: "Other Ontario university",
      description: "Submit the institution name for Travel Markets review.",
      type: "review",
    },
  ];
  const provinces = Array.from(
    new Set(CANADIAN_INSTITUTIONS.map((institution) => institution.province))
  ).sort();
  const types = Array.from(
    new Set(CANADIAN_INSTITUTIONS.map((institution) => institution.type))
  ).sort();

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  function selectOption(id: string) {
    onSelect(id);
    setOpen(false);
    setActiveIndex(0);
  }

  return (
    <div ref={containerRef}>
      <label className="block">
        <span className="text-sm font-bold text-zinc-300">Select your university</span>
        <input
          role="combobox"
          aria-expanded={open}
          aria-controls="institution-options"
          aria-autocomplete="list"
          value={search}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onChange={(event) => {
            onSearch(event.target.value);
            setOpen(true);
            setActiveIndex(0);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setOpen(true);
              setActiveIndex((index) => Math.min(index + 1, options.length - 1));
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              setActiveIndex((index) => Math.max(index - 1, 0));
            }
            if (event.key === "Enter" && open && options[activeIndex]) {
              event.preventDefault();
              selectOption(options[activeIndex].id);
            }
            if (event.key === "Escape") {
              setOpen(false);
            }
          }}
          placeholder="Search Ontario universities by name, abbreviation, or city"
          className="mt-2 w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none transition placeholder:text-zinc-600 focus:border-pink-400/70"
          aria-label="Search institution"
        />
      </label>

      {selectedId && (
        <p className="mt-2 text-sm font-semibold text-pink-200">
          Selected:{" "}
          {selectedId === UNLISTED_INSTITUTION_ID
            ? "Other Ontario university"
            : getInstitutionById(selectedId)?.name || selectedId}
        </p>
      )}

      {open && (
        <div className="mt-3 rounded-3xl border border-white/10 bg-zinc-950 p-3 shadow-2xl">
          <div className="grid gap-2 sm:grid-cols-2">
            <select
              value={provinceFilter}
              onChange={(event) => setProvinceFilter(event.target.value)}
              className="rounded-2xl border border-white/10 bg-black px-3 py-2 text-sm text-white"
            >
              <option value="">All provinces</option>
              {provinces.map((province) => (
                <option key={province} value={province}>
                  {province}
                </option>
              ))}
            </select>
            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
              className="rounded-2xl border border-white/10 bg-black px-3 py-2 text-sm text-white"
            >
              <option value="">All institution types</option>
              {types.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          <div
            id="institution-options"
            role="listbox"
            className="mt-3 max-h-80 overflow-y-auto"
          >
            {options.map((option, index) => (
              <button
                key={option.id}
                type="button"
                role="option"
                aria-selected={selectedId === option.id}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => selectOption(option.id)}
                className={`mb-2 w-full rounded-2xl border p-4 text-left transition ${
                  selectedId === option.id || activeIndex === index
                    ? "border-pink-400 bg-pink-500/15"
                    : "border-white/10 bg-black/50 hover:border-white/25"
                }`}
              >
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <p className="font-black text-white">{option.label}</p>
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-pink-200">
                    {option.type}
                  </p>
                </div>
                <p className="mt-1 text-sm text-zinc-500">{option.description}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CampusSelector({
  campuses,
  value,
  onChange,
}: {
  campuses: ReturnType<typeof getCampusesForInstitution>;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-zinc-300">Select your campus</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none transition focus:border-pink-400/70"
      >
        <option value="">Choose campus</option>
        {campuses.map((campus) => (
          <option key={campus.id} value={campus.id}>
            {campus.name} — {campus.city}, {campus.province}
          </option>
        ))}
        <option value={OTHER_CAMPUS_ID}>Other campus / campus not listed</option>
      </select>
    </label>
  );
}

function ProgramSelector({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-zinc-300">Program</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none transition focus:border-pink-400/70"
      >
        <option value="">Choose program</option>
        {PROGRAM_OPTIONS.map((option) => (
          <option key={`${option.category}-${option.name}`} value={option.name}>
            {option.name} · {option.category}
          </option>
        ))}
      </select>
    </label>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-zinc-300">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-2 w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none transition placeholder:text-zinc-600 focus:border-pink-400/70"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <label className="block">
      <span className="flex items-center gap-2 text-sm font-bold text-zinc-300">
        <Languages className="h-4 w-4" />
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none transition focus:border-pink-400/70"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-zinc-300">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={4}
        className="mt-2 w-full resize-none rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none transition placeholder:text-zinc-600 focus:border-pink-400/70"
      />
    </label>
  );
}

function SummaryCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-black/60 p-5">
      <p className="text-sm text-zinc-500">{title}</p>
      <p className="mt-2 text-lg font-black text-white">{value}</p>
    </div>
  );
}
