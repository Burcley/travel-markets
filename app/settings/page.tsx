"use client";

import {
  useEffect,
  useMemo,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  Camera,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  Globe2,
  HelpCircle,
  IdCard,
  Lock,
  Mail,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  User,
  WalletCards,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  Currency,
  Language,
  usePreferences,
} from "@/components/preferences/PreferencesProvider";
import {
  calculateProfileCompletion,
  isHostRole,
  normalizeVerificationStatus,
  verificationLabel,
  type VerificationStatus,
} from "@/lib/verification-center";
import InstitutionCampusSelector, {
  OTHER_CAMPUS_ID,
  UNLISTED_INSTITUTION_ID,
} from "@/components/institutions/InstitutionCampusSelector";
import {
  getCampusById,
  getInstitutionById,
} from "@/lib/data/canadian-institutions";

type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  bio: string | null;
  role: string | null;
  avatar_url: string | null;
  is_admin?: boolean | null;
  account_status?: string | null;
  created_at?: string | null;
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
  program_name?: string | null;
  expected_graduation?: string | null;
  host_type?: string | null;
  property_management_company?: string | null;
  management_role?: string | null;
  is_verified?: boolean | null;
  identity_verified?: boolean | null;
  identity_verification_status?: string | null;
  phone_verified?: boolean | null;
  phone_verified_at?: string | null;
  phone_verification_status?: string | null;
  student_email_verified?: boolean | null;
  student_verification_status?: string | null;
};

const currencies: Currency[] = [
  "CAD",
  "USD",
  "EUR",
  "GBP",
  "NGN",
  "INR",
  "CNY",
  "AED",
  "SAR",
  "QAR",
  "PKR",
  "BDT",
];

function normalizeRole(role?: string | null, isAdmin?: boolean | null) {
  const value = (role || "").toLowerCase();

  if (isAdmin || value === "admin") return "admin";
  if (value === "owner" || value === "landlord" || value === "host") return "owner";

  return "student";
}

export default function SettingsPage() {
  const supabase = useMemo(() => createClient(), []);
  const { language, currency, setLanguage, setCurrency } = usePreferences();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [fullName, setFullName] = useState("");
  const [initialProfileSnapshot, setInitialProfileSnapshot] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [emailVerified, setEmailVerified] = useState(false);
  const [country, setCountry] = useState("Canada");
  const [preferredLanguage, setPreferredLanguage] = useState("English");
  const [school, setSchool] = useState("");
  const [institutionId, setInstitutionId] = useState("");
  const [institutionSearch, setInstitutionSearch] = useState("");
  const [unlistedInstitutionName, setUnlistedInstitutionName] = useState("");
  const [campusId, setCampusId] = useState("");
  const [campusName, setCampusName] = useState("");
  const [unlistedCampusName, setUnlistedCampusName] = useState("");
  const [program, setProgram] = useState("");
  const [expectedGraduation, setExpectedGraduation] = useState("");
  const [hostType, setHostType] = useState("");
  const [propertyManagementCompany, setPropertyManagementCompany] = useState("");
  const [managementRole, setManagementRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [notificationPrefs, setNotificationPrefs] = useState({
    email: true,
    inquiries: true,
    messages: true,
    viewings: true,
  });

  const role = normalizeRole(profile?.role, profile?.is_admin);
  const isOwner = isHostRole(profile?.role) || role === "admin";
  const phoneStatus = normalizeVerificationStatus(
    profile?.phone_verification_status || (profile?.phone_verified_at ? "verified" : null),
    Boolean(profile?.phone_verified || profile?.phone_verified_at)
  );
  const identityStatus = normalizeVerificationStatus(
    profile?.identity_verification_status,
    Boolean(profile?.identity_verified || profile?.is_verified)
  );
  const studentStatus = normalizeVerificationStatus(
    profile?.student_verification_status,
    Boolean(profile?.student_email_verified)
  );
  const completionPercent = calculateProfileCompletion({
    profile: {
      ...profile,
      full_name: fullName,
      phone,
      bio,
      avatar_url: avatarUrl,
      role,
      identity_verification_status: identityStatus,
      student_verification_status: studentStatus,
    },
    emailVerified,
    propertyVerification: isOwner ? { status: "not_started" } : null,
  });
  const accountLabel =
    role === "admin"
      ? "Admin account"
      : isOwner
        ? "Landlord account"
        : "Student account";
  const sections = [
    {
      id: "account",
      title: "Account",
      description: "Your identity, photo, and core contact details.",
      icon: User,
    },
    {
      id: "profile",
      title: "Profile",
      description: isOwner
        ? "How students understand who manages the rental."
        : "How landlords understand your rental interest.",
      icon: Sparkles,
    },
    {
      id: "verification",
      title: "Verification Centre",
      description: "Review account, identity, and role verification progress.",
      icon: IdCard,
    },
    {
      id: "notifications",
      title: "Notifications",
      description: "Choose the updates Travel Markets should surface.",
      icon: Bell,
    },
    {
      id: "privacy-and-safety",
      title: "Privacy & Safety",
      description: "Visibility, reporting, and safety resources.",
      icon: ShieldCheck,
    },
    {
      id: "preferences",
      title: "Preferences",
      description: "Language and currency used across the marketplace.",
      icon: SlidersHorizontal,
    },
    {
      id: "security",
      title: "Security",
      description: "Email access and password reset tools.",
      icon: Lock,
    },
    ...(isOwner
      ? [
          {
            id: "billing",
            title: "Billing",
            description: "Owner plans, boosts, and subscription access.",
            icon: CreditCard,
          },
        ]
      : []),
    {
      id: "support",
      title: "Support",
      description: "Get help with account, trust, and safety questions.",
      icon: HelpCircle,
    },
    {
      id: "delete-account",
      title: "Delete Account",
      description: "Review account closure and data removal options.",
      icon: Trash2,
    },
  ];
  const currentProfileSnapshot = JSON.stringify({
    fullName,
    phone,
    bio,
    avatarUrl,
    country,
    preferredLanguage,
    school,
    institutionId,
    institutionSearch,
    unlistedInstitutionName,
    campusId,
    campusName,
    unlistedCampusName,
    program,
    expectedGraduation,
    hostType,
    propertyManagementCompany,
    managementRole,
  });
  const hasUnsavedChanges =
    Boolean(initialProfileSnapshot) &&
    currentProfileSnapshot !== initialProfileSnapshot;

  useEffect(() => {
    function warnIfUnsaved(event: BeforeUnloadEvent) {
      if (!hasUnsavedChanges) return;

      event.preventDefault();
    }

    window.addEventListener("beforeunload", warnIfUnsaved);

    return () => window.removeEventListener("beforeunload", warnIfUnsaved);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("tm-notification-preferences");

    if (saved) {
      setNotificationPrefs(JSON.parse(saved));
    }
  }, []);

  async function loadSettings() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/auth?returnTo=/settings";
      return;
    }

    setEmail(user.email || "");
    setEmailVerified(Boolean(user.email_confirmed_at));

    const { data } = await supabase
      .from("profiles")
      .select("id, email, full_name, phone, bio, role, avatar_url, is_admin, account_status, created_at, country, preferred_language, school, program, institution_id, institution_name, institution_not_listed, unlisted_institution_name, campus_id, campus_name, campus_not_listed, unlisted_campus_name, program_name, expected_graduation, host_type, property_management_company, management_role, is_verified, identity_verified, identity_verification_status, phone_verified, phone_verified_at, phone_verification_status, student_email_verified, student_verification_status")
      .eq("id", user.id)
      .maybeSingle();

    const nextProfile = (data || {
      id: user.id,
      email: user.email || "",
      full_name: "",
      phone: "",
      bio: "",
      role: "student",
      avatar_url: null,
      is_admin: false,
    }) as Profile;

    if (!data) {
      await supabase.from("profiles").insert({
        id: user.id,
        email: user.email || "",
        full_name: "",
        phone: "",
        bio: "",
        role: "student",
        avatar_url: null,
        account_status: "active",
      });
    }

    setProfile(nextProfile);
    setFullName(nextProfile.full_name || "");
    setPhone(nextProfile.phone || "");
    setBio(nextProfile.bio || "");
    setAvatarUrl(nextProfile.avatar_url || null);
    setCountry(nextProfile.country || "Canada");
    setPreferredLanguage(nextProfile.preferred_language || "English");
    const loadedInstitutionId = nextProfile.institution_not_listed
      ? UNLISTED_INSTITUTION_ID
      : nextProfile.institution_id || "";
    const loadedInstitutionName =
      nextProfile.institution_name || nextProfile.school || "";
    const loadedCampusId = nextProfile.campus_not_listed
      ? OTHER_CAMPUS_ID
      : nextProfile.campus_id || "";
    const loadedCampusName = nextProfile.campus_name || "";

    setSchool(loadedInstitutionName);
    setInstitutionId(loadedInstitutionId);
    setInstitutionSearch(
      loadedInstitutionId === UNLISTED_INSTITUTION_ID
        ? "Other Ontario university"
        : loadedInstitutionName
    );
    setUnlistedInstitutionName(
      nextProfile.unlisted_institution_name ||
        (nextProfile.institution_not_listed ? loadedInstitutionName : "")
    );
    setCampusId(loadedCampusId);
    setCampusName(nextProfile.campus_name || "");
    setUnlistedCampusName(
      nextProfile.unlisted_campus_name ||
        (nextProfile.campus_not_listed ? loadedCampusName : "")
    );
    setProgram(nextProfile.program_name || nextProfile.program || "");
    setExpectedGraduation(nextProfile.expected_graduation || "");
    setHostType(nextProfile.host_type || "");
    setPropertyManagementCompany(nextProfile.property_management_company || "");
    setManagementRole(nextProfile.management_role || "");
    setInitialProfileSnapshot(
      JSON.stringify({
        fullName: nextProfile.full_name || "",
        phone: nextProfile.phone || "",
        bio: nextProfile.bio || "",
        avatarUrl: nextProfile.avatar_url || null,
        country: nextProfile.country || "Canada",
        preferredLanguage: nextProfile.preferred_language || "English",
        school: nextProfile.institution_name || nextProfile.school || "",
        institutionId: loadedInstitutionId,
        institutionSearch:
          loadedInstitutionId === UNLISTED_INSTITUTION_ID
            ? "Other Ontario university"
            : loadedInstitutionName,
        unlistedInstitutionName:
          nextProfile.unlisted_institution_name ||
          (nextProfile.institution_not_listed ? loadedInstitutionName : ""),
        campusId: loadedCampusId,
        campusName: nextProfile.campus_name || "",
        unlistedCampusName:
          nextProfile.unlisted_campus_name ||
          (nextProfile.campus_not_listed ? loadedCampusName : ""),
        program: nextProfile.program_name || nextProfile.program || "",
        expectedGraduation: nextProfile.expected_graduation || "",
        hostType: nextProfile.host_type || "",
        propertyManagementCompany:
          nextProfile.property_management_company || "",
        managementRole: nextProfile.management_role || "",
      })
    );
    setLoading(false);
  }

  async function uploadAvatar(file: File) {
    if (!profile?.id) return;

    if (!file.type.startsWith("image/")) {
      setError("Upload an image file for your profile photo.");
      return;
    }

    if (file.size > 4 * 1024 * 1024) {
      setError("Profile photos must be smaller than 4 MB.");
      return;
    }

    const ext = file.name.split(".").pop();
    const path = `${profile.id}/avatar-${Date.now()}.${ext}`;
    setAvatarUploading(true);
    setError("");
    const { error } = await supabase.storage.from("avatars").upload(path, file, {
      upsert: true,
    });
    setAvatarUploading(false);

    if (error) {
      setError(error.message);
      return;
    }

    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    setAvatarUrl(data.publicUrl);
  }

  async function saveProfile() {
    if (!profile?.id) return;

    setSaving(true);
    setNotice("");
    setError("");

    const selectedInstitution =
      institutionId && institutionId !== UNLISTED_INSTITUTION_ID
        ? getInstitutionById(institutionId)
        : null;
    const selectedCampus =
      campusId && campusId !== OTHER_CAMPUS_ID ? getCampusById(campusId) : null;
    const finalInstitutionName = !isOwner
      ? selectedInstitution?.name ||
        unlistedInstitutionName.trim() ||
        institutionSearch.trim() ||
        school.trim()
      : "";
    const finalCampusName = !isOwner
      ? selectedCampus?.name || unlistedCampusName.trim() || campusName.trim()
      : "";

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: fullName.trim(),
        phone: phone.trim() || null,
        bio: bio.trim() || null,
        avatar_url: avatarUrl,
        country: country.trim() || null,
        preferred_language: preferredLanguage.trim() || null,
        school: !isOwner ? finalInstitutionName || null : null,
        institution_id:
          !isOwner && selectedInstitution ? selectedInstitution.id : null,
        institution_name: !isOwner ? finalInstitutionName || null : null,
        institution_not_listed:
          !isOwner && institutionId === UNLISTED_INSTITUTION_ID,
        unlisted_institution_name:
          !isOwner && institutionId === UNLISTED_INSTITUTION_ID
            ? unlistedInstitutionName.trim() || null
            : null,
        campus_id: !isOwner && selectedCampus ? selectedCampus.id : null,
        campus_name: !isOwner ? finalCampusName || null : null,
        campus_not_listed: !isOwner && campusId === OTHER_CAMPUS_ID,
        unlisted_campus_name:
          !isOwner && campusId === OTHER_CAMPUS_ID
            ? unlistedCampusName.trim() || null
            : null,
        program: !isOwner ? program.trim() || null : null,
        program_name: !isOwner ? program.trim() || null : null,
        expected_graduation: !isOwner && expectedGraduation ? expectedGraduation : null,
        host_type: isOwner ? hostType.trim() || null : null,
        property_management_company:
          isOwner ? propertyManagementCompany.trim() || null : null,
        management_role: isOwner ? managementRole.trim() || null : null,
      })
      .eq("id", profile.id);

    setSaving(false);

    if (error) {
      setError(error.message);
      return;
    }

    setNotice("Settings saved.");
    await loadSettings();
  }

  async function sendPasswordReset() {
    if (!email) return;

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    setNotice(error ? error.message : "Password reset email sent.");
  }

  function updateNotificationPreference(
    key: keyof typeof notificationPrefs,
    value: boolean
  ) {
    const next = { ...notificationPrefs, [key]: value };

    setNotificationPrefs(next);
    localStorage.setItem("tm-notification-preferences", JSON.stringify(next));
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black text-white">
        <p className="text-zinc-400">Loading settings...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-4 py-6 text-white sm:px-6 lg:py-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(236,72,153,0.28),transparent_34%),linear-gradient(135deg,#111113_0%,#050505_52%,#0b0610_100%)] p-6 shadow-2xl sm:p-8 lg:p-10">
          <div className="absolute right-8 top-8 hidden h-28 w-28 rounded-full bg-pink-500/20 blur-3xl md:block" />
          <div className="relative grid gap-8 lg:grid-cols-[1fr_340px] lg:items-end">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-pink-400/20 bg-pink-500/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-pink-200">
                <Sparkles className="h-4 w-4" />
                Account settings
              </div>

              <h1 className="mt-6 text-4xl font-black tracking-tight sm:text-6xl">
                Settings
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-300 sm:text-base">
                Manage your account, profile, notifications, privacy, and preferences.
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm font-bold text-white">
                  <User className="h-4 w-4 text-pink-200" />
                  {accountLabel}
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-4 py-2 text-sm font-bold text-emerald-200">
                  <CheckCircle2 className="h-4 w-4" />
                  {completionPercent}% complete
                </span>
              </div>
            </div>

            <AccountSummaryCard
              fullName={fullName}
              email={email}
              avatarUrl={avatarUrl}
              roleLabel={accountLabel}
              completionPercent={completionPercent}
              emailVerified={emailVerified}
              phoneStatus={phoneStatus}
              identityStatus={identityStatus}
              roleStatus={isOwner ? "not_started" : studentStatus}
            />
          </div>
        </header>

        {hasUnsavedChanges && (
          <div className="rounded-3xl border border-yellow-500/25 bg-yellow-500/10 p-4 text-sm font-semibold text-yellow-100 shadow-xl">
            You have unsaved changes. Save or reset before leaving this page.
          </div>
        )}

        {error && (
          <div className="rounded-3xl border border-red-500/25 bg-red-500/10 p-4 text-sm font-semibold text-red-100 shadow-xl">
            {error}
          </div>
        )}

        {notice && (
          <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm font-semibold text-emerald-200 shadow-xl">
            {notice}
          </div>
        )}

        <nav className="flex gap-2 overflow-x-auto rounded-3xl border border-white/10 bg-white/[0.04] p-2 backdrop-blur-xl lg:hidden">
          {sections.map((section) => {
            const Icon = section.icon;

            return (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="inline-flex shrink-0 items-center gap-2 rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-bold text-zinc-200 transition hover:border-pink-400/40 hover:bg-pink-500/10 hover:text-white"
              >
                <Icon className="h-4 w-4 text-pink-300" />
                {section.title}
              </a>
            );
          })}
        </nav>

        <section className="grid gap-6 lg:grid-cols-[310px_1fr]">
          <aside className="sticky top-24 hidden self-start rounded-[2rem] border border-white/10 bg-zinc-950/80 p-4 shadow-2xl backdrop-blur-xl lg:block">
            <div className="mb-4 rounded-3xl border border-pink-400/20 bg-pink-500/10 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-pink-200">
                Travel Markets
              </p>
              <p className="mt-2 text-sm leading-6 text-zinc-300">
                Tune the details that shape your marketplace experience.
              </p>
            </div>

            <AccountMiniCard
              fullName={fullName}
              email={email}
              avatarUrl={avatarUrl}
              completionPercent={completionPercent}
            />

            <div className="space-y-2">
              {sections.map((section) => {
                const Icon = section.icon;

                return (
                  <a
                    key={section.id}
                    href={`#${section.id}`}
                    className="group flex items-start gap-3 rounded-2xl px-4 py-3 text-sm transition hover:bg-white/10"
                  >
                    <span className="rounded-xl border border-white/10 bg-white/5 p-2 text-pink-300 transition group-hover:border-pink-400/40 group-hover:bg-pink-500/10">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span>
                      <span className="block font-bold text-white">
                        {section.title}
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-zinc-500">
                        {section.description}
                      </span>
                    </span>
                  </a>
                );
              })}
            </div>
          </aside>

          <div className="space-y-6">
            <SettingsSection
              id="account"
              title="Account"
              description="Keep your core identity and contact details accurate."
              icon={User}
            >
              <div className="grid gap-5 xl:grid-cols-[280px_1fr]">
                <AvatarUploader
                  avatarUrl={avatarUrl}
                  fullName={fullName}
                  email={email}
                  uploading={avatarUploading}
                  onUpload={uploadAvatar}
                  onRemove={() => setAvatarUrl(null)}
                />

                <div className="grid gap-4">
                  <Field
                    label="Full name"
                    required
                    helper="This name appears in messages, inquiries, and profile cards."
                    value={fullName}
                    onChange={setFullName}
                  />
                  <Field
                    label="Public display name"
                    helper="Currently matched to your full name so your profile stays consistent."
                    value={fullName}
                    onChange={setFullName}
                  />
                  <InfoRow label="Email" value={email} icon={Mail} />
                  <Field
                    label="Phone number"
                    type="tel"
                    helper="Optional, but useful when a landlord or student needs follow-up."
                    value={phone}
                    onChange={setPhone}
                  />
                  <Textarea
                    label="Bio"
                    helper={
                      isOwner
                        ? "Share what students should know about you as a landlord."
                        : "Write a short intro that helps landlords understand your housing search."
                    }
                    value={bio}
                    onChange={setBio}
                  />

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <button
                      onClick={saveProfile}
                      disabled={saving || !fullName.trim()}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-6 py-3 font-black text-black shadow-lg shadow-white/10 transition hover:-translate-y-0.5 hover:bg-zinc-200 disabled:translate-y-0 disabled:opacity-50"
                    >
                      {saving ? "Saving..." : "Save settings"}
                    </button>
                    <button
                      onClick={loadSettings}
                      disabled={saving || !hasUnsavedChanges}
                      className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-6 py-3 font-bold text-white transition hover:border-pink-400/40 hover:bg-pink-500/10 disabled:opacity-50"
                    >
                      Reset changes
                    </button>
                    <p className="text-sm text-zinc-500">
                      Changes update your Travel Markets profile.
                    </p>
                  </div>
                </div>
              </div>
            </SettingsSection>

            <SettingsSection
              id="profile"
              title="Profile"
              description={
                isOwner
                  ? "Build confidence with students reviewing your listings."
                  : "Help landlords evaluate your serious housing interest."
              }
              icon={Sparkles}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <InfoRow
                  label="Public display name"
                  value={fullName || "Not added"}
                  icon={User}
                />
                <InfoRow label="Profile type" value={accountLabel} icon={ShieldCheck} />
                <InfoRow
                  label="Country"
                  value={country || "Not added"}
                  icon={Globe2}
                />
                <InfoRow
                  label="Member since"
                  value={formatDate(profile?.created_at) || "Not available"}
                  icon={CalendarDays}
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Field
                  label="Country"
                  value={country}
                  onChange={setCountry}
                />
                <Field
                  label="Preferred language"
                  value={preferredLanguage}
                  onChange={setPreferredLanguage}
                />
                {!isOwner ? (
                  <>
                    <div className="md:col-span-2">
                      <InstitutionCampusSelector
                        institutionId={institutionId}
                        institutionSearch={institutionSearch}
                        campusId={campusId}
                        unlistedInstitutionName={unlistedInstitutionName}
                        unlistedCampusName={unlistedCampusName}
                        onInstitutionSearchChange={setInstitutionSearch}
                        onInstitutionChange={(nextInstitutionId) => {
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
                          setSchool(institution?.name || "");
                          setCampusId("");
                          setCampusName("");
                          setUnlistedCampusName("");
                        }}
                        onCampusChange={(nextCampusId) => {
                          const campus =
                            nextCampusId === OTHER_CAMPUS_ID
                              ? null
                              : getCampusById(nextCampusId);

                          setCampusId(nextCampusId);
                          setCampusName(campus?.name || "");
                          if (nextCampusId !== OTHER_CAMPUS_ID) {
                            setUnlistedCampusName("");
                          }
                        }}
                        onUnlistedInstitutionNameChange={(value) => {
                          setUnlistedInstitutionName(value);
                          setSchool(value);
                        }}
                        onUnlistedCampusNameChange={(value) => {
                          setUnlistedCampusName(value);
                          setCampusName(value);
                        }}
                      />
                    </div>
                    <Field label="Program" value={program} onChange={setProgram} />
                    <Field
                      label="Expected graduation"
                      type="date"
                      value={expectedGraduation}
                      onChange={setExpectedGraduation}
                    />
                  </>
                ) : (
                  <>
                    <Field
                      label="Host type"
                      value={hostType}
                      onChange={setHostType}
                    />
                    <Field
                      label="Property management company"
                      value={propertyManagementCompany}
                      onChange={setPropertyManagementCompany}
                    />
                    <Field
                      label="Management role"
                      value={managementRole}
                      onChange={setManagementRole}
                    />
                  </>
                )}
              </div>
              <div className="rounded-3xl border border-white/10 bg-black/40 p-5">
                <p className="text-sm leading-6 text-zinc-300">
                  {isOwner
                    ? "Your owner profile helps students understand who manages the listing, how responsive you are, and where to continue next."
                    : "Your student profile helps landlords review serious inquiries with more confidence before accepting messages or viewing requests."}
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Link
                    href={`/users/${profile?.id}`}
                    className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white transition hover:border-pink-400/40 hover:bg-pink-500/10"
                  >
                    View public profile
                    <ExternalLink className="h-4 w-4" />
                  </Link>
                  <Link
                    href="/profile"
                    className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white transition hover:border-pink-400/40 hover:bg-pink-500/10"
                  >
                    Open profile editor
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </SettingsSection>

            <SettingsSection
              id="verification"
              title="Verification Centre"
              description="Track the trust checks attached to your account."
              icon={IdCard}
            >
              <div className="grid gap-3 md:grid-cols-2">
                <VerificationSummaryRow
                  title="Email"
                  status={emailVerified ? "verified" : "not_started"}
                  href="/verify-email"
                />
                <VerificationSummaryRow
                  title="Phone"
                  status={phoneStatus}
                  href="/verify-phone"
                />
                <VerificationSummaryRow
                  title="Identity"
                  status={identityStatus}
                  href="/verify-identity"
                />
                <VerificationSummaryRow
                  title={isOwner ? "Property relationship" : "Student status"}
                  status={isOwner ? "not_started" : studentStatus}
                  href={
                    isOwner
                      ? "/verify-identity?type=property_relationship"
                      : "/verify-identity?type=student_status"
                  }
                />
              </div>
              <Link
                href="/dashboard/verification"
                className="inline-flex items-center gap-2 rounded-2xl bg-[#FF2E72] px-5 py-3 text-sm font-black text-white shadow-lg shadow-pink-950/30 transition hover:-translate-y-0.5 hover:bg-pink-500"
              >
                Open Verification Centre
                <ArrowRight className="h-4 w-4" />
              </Link>
            </SettingsSection>

            <SettingsSection
              id="notifications"
              title="Notifications"
              description="Control which marketplace updates should stay visible."
              icon={Bell}
            >
              <div className="grid gap-3 md:grid-cols-2">
                {Object.entries(notificationPrefs).map(([key, value]) => (
                  <ToggleRow
                    key={key}
                    label={`${key.charAt(0).toUpperCase()}${key.slice(1)} notifications`}
                    text={
                      key === "email"
                        ? "Email delivery for important account updates."
                        : key === "inquiries"
                          ? "New inquiry activity and applicant movement."
                          : key === "messages"
                            ? "New replies in accepted housing conversations."
                            : "Viewing requests, approvals, declines, and suggestions."
                    }
                    checked={value}
                    onChange={(next) =>
                      updateNotificationPreference(
                        key as keyof typeof notificationPrefs,
                        next
                      )
                    }
                  />
                ))}
              </div>
            </SettingsSection>

            <SettingsSection
              id="privacy-and-safety"
              title="Privacy & Safety"
              description="Review safety resources and reporting tools."
              icon={ShieldCheck}
            >
              <InfoRow
                label="Profile visibility"
                value="Visible when you contact, message, or list on Travel Markets."
                icon={Globe2}
              />
              <InfoRow
                label="Private documents"
                value="Identity and property documents are never shown on public profiles."
                icon={Lock}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <ActionLink href="/safety" title="Safety center" text="Review safer rental guidance." />
                <ActionLink href="/reports" title="Reports" text="Open the reporting tools." />
              </div>
            </SettingsSection>

            <SettingsSection
              id="preferences"
              title="Preferences"
              description="Set the language and currency used across Travel Markets."
              icon={SlidersHorizontal}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <Select
                  label="Language"
                  value={language}
                  onChange={(value) => setLanguage(value as Language)}
                  options={[
                    ["en", "English"],
                    ["fr", "Français"],
                  ]}
                />
                <Select
                  label="Currency"
                  value={currency}
                  onChange={(value) => setCurrency(value as Currency)}
                  options={currencies.map((item) => [item, item])}
                />
              </div>
            </SettingsSection>

            <SettingsSection
              id="security"
              title="Security"
              description="Manage account access and password recovery."
              icon={Lock}
            >
              <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
                <InfoRow label="Email" value={email} icon={Mail} />
                <button
                  onClick={sendPasswordReset}
                  className="inline-flex h-full items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold text-white transition hover:border-pink-400/40 hover:bg-pink-500/10"
                >
                  Send password reset email
                </button>
              </div>
            </SettingsSection>

            {isOwner && (
              <SettingsSection
                id="billing"
                title="Billing"
                description="Owner-only subscription and visibility controls."
                icon={CreditCard}
              >
                <div className="rounded-3xl border border-yellow-400/20 bg-gradient-to-br from-yellow-500/10 via-white/[0.03] to-pink-500/10 p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-bold text-white">
                        Landlord billing center
                      </p>
                      <p className="mt-2 text-sm leading-6 text-zinc-400">
                        Billing, subscriptions, boosts, and owner plan management are available for landlord accounts.
                      </p>
                    </div>
                    <Link
                      href="/billing"
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-black text-black transition hover:bg-zinc-200"
                    >
                      <WalletCards className="h-4 w-4" />
                      Manage billing
                    </Link>
                  </div>
                </div>
              </SettingsSection>
            )}

            <SettingsSection
              id="support"
              title="Support"
              description="Get help from Travel Markets without leaving account settings."
              icon={HelpCircle}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <ActionLink
                  href="/help"
                  title="Help centre"
                  text="Find guidance for account, verification, listings, and bookings."
                />
                <ActionLink
                  href="/support"
                  title="Contact support"
                  text="Reach Travel Markets when something needs personal review."
                />
              </div>
            </SettingsSection>

            <SettingsSection
              id="delete-account"
              title="Delete Account"
              description="Review account closure options."
              icon={Trash2}
            >
              <div className="rounded-3xl border border-red-500/25 bg-red-500/10 p-5 text-red-100">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-1 h-5 w-5 shrink-0" />
                  <div>
                    <p className="font-black">Danger zone</p>
                    <p className="mt-2 text-sm leading-6 text-red-100/75">
                      Account deletion is handled from your profile page so the
                      confirmation step and existing safeguards remain in one place.
                    </p>
                    <Link
                      href="/profile#delete-account"
                      className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-black text-black transition hover:bg-zinc-200"
                    >
                      Review deletion options
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              </div>
            </SettingsSection>
          </div>
        </section>
      </div>
    </main>
  );
}

function AccountSummaryCard({
  fullName,
  email,
  avatarUrl,
  roleLabel,
  completionPercent,
  emailVerified,
  phoneStatus,
  identityStatus,
  roleStatus,
}: {
  fullName: string;
  email: string;
  avatarUrl: string | null;
  roleLabel: string;
  completionPercent: number;
  emailVerified: boolean;
  phoneStatus: VerificationStatus;
  identityStatus: VerificationStatus;
  roleStatus: VerificationStatus;
}) {
  const initial = fullName?.trim()?.[0]?.toUpperCase() || email?.[0]?.toUpperCase() || "U";
  const verifiedCount = [
    emailVerified,
    phoneStatus === "verified",
    identityStatus === "verified",
    roleStatus === "verified",
  ].filter(Boolean).length;

  return (
    <div className="rounded-[1.75rem] border border-white/10 bg-black/45 p-5 shadow-2xl backdrop-blur-xl">
      <div className="flex items-center gap-4">
        <div className="h-16 w-16 overflow-hidden rounded-2xl border border-white/10 bg-zinc-900">
          {avatarUrl ? (
            <img src={avatarUrl} alt={fullName || "Profile"} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-[#FF2E72] text-2xl font-black text-white">
              {initial}
            </div>
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate text-lg font-black text-white">
            {fullName || "Unnamed account"}
          </p>
          <p className="truncate text-sm text-zinc-400">{email}</p>
          <p className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-pink-200">
            {roleLabel}
          </p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <SummaryMetric label="Completion" value={`${completionPercent}%`} />
        <SummaryMetric label="Verified checks" value={`${verifiedCount}/4`} />
      </div>

      <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-[#FF2E72]" style={{ width: `${completionPercent}%` }} />
      </div>
    </div>
  );
}

function AccountMiniCard({
  fullName,
  email,
  avatarUrl,
  completionPercent,
}: {
  fullName: string;
  email: string;
  avatarUrl: string | null;
  completionPercent: number;
}) {
  const initial = fullName?.trim()?.[0]?.toUpperCase() || email?.[0]?.toUpperCase() || "U";

  return (
    <div className="mb-4 flex items-center gap-3 rounded-3xl border border-white/10 bg-black/40 p-4">
      <div className="h-12 w-12 overflow-hidden rounded-2xl bg-[#FF2E72]">
        {avatarUrl ? (
          <img src={avatarUrl} alt={fullName || "Profile"} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center font-black text-white">
            {initial}
          </div>
        )}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-black text-white">
          {fullName || "Unnamed account"}
        </p>
        <p className="truncate text-xs text-zinc-500">{completionPercent}% complete</p>
      </div>
    </div>
  );
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
      <p className="text-xs font-semibold text-zinc-500">{label}</p>
      <p className="mt-1 text-lg font-black text-white">{value}</p>
    </div>
  );
}

function SettingsSection({
  id,
  title,
  description,
  icon: Icon,
  children,
}: {
  id: string;
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-24 space-y-6 rounded-[2rem] border border-white/10 bg-zinc-950/90 p-5 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-6"
    >
      <div className="flex items-start gap-4">
        <div className="rounded-2xl border border-pink-400/20 bg-pink-500/10 p-3 text-pink-200">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-2xl font-black tracking-tight text-white">
            {title}
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-400">
            {description}
          </p>
        </div>
      </div>
      {children}
    </section>
  );
}

function AvatarUploader({
  avatarUrl,
  fullName,
  email,
  uploading,
  onUpload,
  onRemove,
}: {
  avatarUrl: string | null;
  fullName: string;
  email: string;
  uploading: boolean;
  onUpload: (file: File) => void;
  onRemove: () => void;
}) {
  const initial = fullName?.trim()?.[0]?.toUpperCase() || email?.[0]?.toUpperCase() || "U";

  return (
    <div className="rounded-3xl border border-white/10 bg-black/40 p-5">
      <div className="relative mx-auto h-36 w-36 overflow-hidden rounded-full border border-white/10 bg-zinc-900 shadow-2xl">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={fullName || "Profile avatar"}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-pink-500 to-rose-700 text-5xl font-black text-white">
            {initial}
          </div>
        )}

        <label className="absolute inset-x-0 bottom-0 flex cursor-pointer items-center justify-center gap-2 bg-black/70 px-3 py-3 text-xs font-bold text-white backdrop-blur transition hover:bg-pink-600/80">
          <Camera className="h-4 w-4" />
          {uploading ? "Uploading..." : "Edit photo"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={uploading}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onUpload(file);
            }}
          />
        </label>
      </div>

      <p className="mt-5 text-center text-sm font-semibold text-white">
        Profile photo
      </p>
      <p className="mt-2 text-center text-xs leading-5 text-zinc-500">
        Use a clear image so conversations and inquiries feel more personal.
      </p>
      {avatarUrl && (
        <button
          type="button"
          onClick={onRemove}
          className="mx-auto mt-4 flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-zinc-200 transition hover:border-red-400/40 hover:bg-red-500/10 hover:text-red-100"
        >
          <X className="h-3.5 w-3.5" />
          Remove photo
        </button>
      )}
    </div>
  );
}

function ActionLink({
  href,
  title,
  text,
}: {
  href: string;
  title: string;
  text: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-3xl border border-white/10 bg-black/40 p-5 transition hover:border-pink-400/40 hover:bg-pink-500/10"
    >
      <p className="font-bold text-white transition group-hover:text-pink-100">
        {title}
      </p>
      <p className="mt-2 text-sm leading-6 text-zinc-400">{text}</p>
    </Link>
  );
}

function Field({
  label,
  helper,
  value,
  onChange,
  type = "text",
  required = false,
}: {
  label: string;
  helper?: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-zinc-300">
        {label}
        {required && <span className="text-pink-300"> *</span>}
      </span>
      <input
        type={type}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-2xl border border-white/10 bg-black/70 px-4 py-3 text-white outline-none transition placeholder:text-zinc-600 focus:border-pink-400/50 focus:ring-4 focus:ring-pink-500/10"
      />
      {helper && <span className="mt-2 block text-xs leading-5 text-zinc-500">{helper}</span>}
    </label>
  );
}

function VerificationSummaryRow({
  title,
  status,
  href,
}: {
  title: string;
  status: VerificationStatus;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center justify-between gap-4 rounded-3xl border border-white/10 bg-black/40 p-4 transition hover:border-pink-400/40 hover:bg-pink-500/10"
    >
      <div>
        <p className="font-bold text-white">{title}</p>
        <p className="mt-1 text-xs text-zinc-500">
          {status === "verified"
            ? "Verified by Travel Markets"
            : "Open the verification flow to continue."}
        </p>
      </div>
      <StatusBadge status={status} />
    </Link>
  );
}

function StatusBadge({ status }: { status: VerificationStatus }) {
  const className =
    status === "verified"
      ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-200"
      : status === "pending" || status === "code_sent"
        ? "border-yellow-500/25 bg-yellow-500/10 text-yellow-200"
        : status === "rejected" ||
            status === "resubmission_required" ||
            status === "failed" ||
            status === "expired" ||
            status === "locked"
          ? "border-red-500/25 bg-red-500/10 text-red-200"
          : "border-white/10 bg-white/5 text-zinc-300";

  return (
    <span className={`shrink-0 rounded-full border px-3 py-1 text-xs font-black ${className}`}>
      {verificationLabel(status)}
    </span>
  );
}

function formatDate(value?: string | null) {
  if (!value) return null;

  return new Intl.DateTimeFormat("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function Textarea({
  label,
  helper,
  value,
  onChange,
}: {
  label: string;
  helper?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-zinc-300">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        className="w-full rounded-2xl border border-white/10 bg-black/70 px-4 py-3 text-white outline-none transition placeholder:text-zinc-600 focus:border-pink-400/50 focus:ring-4 focus:ring-pink-500/10"
      />
      {helper && <span className="mt-2 block text-xs leading-5 text-zinc-500">{helper}</span>}
    </label>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[][];
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-zinc-300">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-2xl border border-white/10 bg-black/70 px-4 py-3 text-white outline-none transition focus:border-pink-400/50 focus:ring-4 focus:ring-pink-500/10"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

function InfoRow({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon?: ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex gap-4 rounded-3xl border border-white/10 bg-black/40 p-4">
      {Icon && (
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-pink-300">
          <Icon className="h-4 w-4" />
        </span>
      )}
      <div>
        <p className="text-sm font-semibold text-zinc-500">{label}</p>
        <p className="mt-1 text-sm font-bold leading-6 text-zinc-200">{value}</p>
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  text,
  checked,
  onChange,
}: {
  label: string;
  text?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="group flex cursor-pointer items-center justify-between gap-4 rounded-3xl border border-white/10 bg-black/40 p-4 transition hover:border-pink-400/40 hover:bg-pink-500/10">
      <span>
        <span className="block text-sm font-bold text-zinc-100">{label}</span>
        {text && <span className="mt-1 block text-xs leading-5 text-zinc-500">{text}</span>}
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-5 w-5 shrink-0 accent-pink-500"
      />
    </label>
  );
}
