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
  Bell,
  Camera,
  CheckCircle2,
  CreditCard,
  Globe2,
  Lock,
  Mail,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  User,
  WalletCards,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  Currency,
  Language,
  usePreferences,
} from "@/components/preferences/PreferencesProvider";

type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  bio: string | null;
  role: string | null;
  avatar_url: string | null;
  is_admin?: boolean | null;
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
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [notificationPrefs, setNotificationPrefs] = useState({
    email: true,
    inquiries: true,
    messages: true,
    viewings: true,
  });

  const role = normalizeRole(profile?.role, profile?.is_admin);
  const isOwner = role === "owner" || role === "admin";
  const profileItems = [
    Boolean(fullName.trim()),
    Boolean(phone.trim()),
    Boolean(bio.trim()),
    Boolean(avatarUrl),
  ];
  const completionPercent = Math.round(
    (profileItems.filter(Boolean).length / profileItems.length) * 100
  );
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
  ];

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

    const { data } = await supabase
      .from("profiles")
      .select("id, email, full_name, phone, bio, role, avatar_url, is_admin")
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
    setLoading(false);
  }

  async function uploadAvatar(file: File) {
    if (!profile?.id) return;

    const ext = file.name.split(".").pop();
    const path = `${profile.id}/avatar-${Date.now()}.${ext}`;
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
    if (!profile?.id) return;

    setSaving(true);
    setNotice("");

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: fullName,
        phone,
        bio,
        avatar_url: avatarUrl,
      })
      .eq("id", profile.id);

    setSaving(false);

    if (error) {
      alert(error.message);
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

            <CompletionCard percent={completionPercent} isOwner={isOwner} />
          </div>
        </header>

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
                  onUpload={uploadAvatar}
                />

                <div className="grid gap-4">
                  <Field
                    label="Name"
                    helper="This name appears in messages, inquiries, and profile cards."
                    value={fullName}
                    onChange={setFullName}
                  />
                  <Field
                    label="Phone number"
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
                      disabled={saving}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-6 py-3 font-black text-black shadow-lg shadow-white/10 transition hover:-translate-y-0.5 hover:bg-zinc-200 disabled:translate-y-0 disabled:opacity-50"
                    >
                      {saving ? "Saving..." : "Save settings"}
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
              </div>
              <div className="rounded-3xl border border-white/10 bg-black/40 p-5">
                <p className="text-sm leading-6 text-zinc-300">
                  {isOwner
                    ? "Your owner profile helps students understand who manages the listing, how responsive you are, and where to continue next."
                    : "Your student profile helps landlords review serious inquiries with more confidence before accepting messages or viewing requests."}
                </p>
              </div>
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
          </div>
        </section>
      </div>
    </main>
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

function CompletionCard({
  percent,
  isOwner,
}: {
  percent: number;
  isOwner: boolean;
}) {
  return (
    <div className="rounded-[1.75rem] border border-white/10 bg-black/40 p-5 shadow-2xl backdrop-blur-xl">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-white">Profile completion</p>
          <p className="mt-1 text-xs leading-5 text-zinc-400">
            {isOwner
              ? "Complete your owner profile to build more trust with students."
              : "Complete your student profile to make serious inquiries easier to review."}
          </p>
        </div>
        <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-sm font-black text-white">
          {percent}%
        </span>
      </div>
      <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-pink-500 via-rose-400 to-emerald-300"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

function AvatarUploader({
  avatarUrl,
  fullName,
  email,
  onUpload,
}: {
  avatarUrl: string | null;
  fullName: string;
  email: string;
  onUpload: (file: File) => void;
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
          Edit photo
          <input
            type="file"
            accept="image/*"
            className="hidden"
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
}: {
  label: string;
  helper?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-zinc-300">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-2xl border border-white/10 bg-black/70 px-4 py-3 text-white outline-none transition placeholder:text-zinc-600 focus:border-pink-400/50 focus:ring-4 focus:ring-pink-500/10"
      />
      {helper && <span className="mt-2 block text-xs leading-5 text-zinc-500">{helper}</span>}
    </label>
  );
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
