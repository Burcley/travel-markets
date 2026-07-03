"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";

type Listing = {
  id: string;
  title: string;
  user_id: string;
  status?: "available" | "pending" | "rented" | null;
};

type LocationType = "canada" | "international";

const canadaViewingPreferences = [
  "in_person",
  "video_call",
  "recorded_video",
] as const;

const internationalViewingPreferences = [
  "live_video",
  "recorded_video",
  "representative",
] as const;

const visaStatuses = ["approved", "waiting", "applying", "not_started"] as const;

export default function ContactOwnerPage() {
  const t = useTranslations("listingManagement.contact");
  const params = useParams();
  const router = useRouter();
  const listingId = params.id as string;
  const supabase = useMemo(() => createClient(), []);

  const [listing, setListing] = useState<Listing | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [sent, setSent] = useState(false);

  const [locationType, setLocationType] = useState<LocationType>("canada");
  const [currentCountry, setCurrentCountry] = useState("");
  const [school, setSchool] = useState("");
  const [campus, setCampus] = useState("");
  const [program, setProgram] = useState("");
  const [expectedMoveInDate, setExpectedMoveInDate] = useState("");
  const [expectedArrivalDate, setExpectedArrivalDate] = useState("");
  const [semesterStartDate, setSemesterStartDate] = useState("");
  const [leaseDuration, setLeaseDuration] = useState("");
  const [monthlyBudget, setMonthlyBudget] = useState("");
  const [viewingPreference, setViewingPreference] = useState("");
  const [visaStatus, setVisaStatus] = useState("");
  const [readyToProvideDocuments, setReadyToProvideDocuments] = useState("");
  const [proofOfAdmissionAvailable, setProofOfAdmissionAvailable] = useState("");
  const [readyToReserve, setReadyToReserve] = useState("");
  const [message, setMessage] = useState("");
  const [seriousConfirmation, setSeriousConfirmation] = useState(false);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listingId]);

  async function loadData() {
    setLoading(true);
    setErrorMessage("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/auth");
      return;
    }

    setCurrentUserId(user.id);

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, status")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.role === "banned" || profile?.status === "banned") {
      setErrorMessage(t("restricted"));
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("listings")
      .select("id, title, user_id, status")
      .eq("id", listingId)
      .single();

    if (error || !data) {
      setErrorMessage(t("notFound"));
      setLoading(false);
      return;
    }

    if (data.user_id === user.id) {
      setErrorMessage(t("ownListing"));
      setLoading(false);
      return;
    }

    if (data.status === "rented") {
      setErrorMessage(t("unavailable"));
      setLoading(false);
      return;
    }

    setListing(data as Listing);
    setLoading(false);
  }

  async function sendNewInquiryEmail(inquiryId: string) {
    try {
      const response = await fetch("/api/emails/new-inquiry", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inquiryId,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        console.error("NEW INQUIRY EMAIL ERROR:", data);
      }
    } catch (error) {
      console.error("NEW INQUIRY EMAIL FETCH ERROR:", error);
    }
  }

  function validateForm() {
    if (!school.trim() || !campus.trim() || !program.trim()) {
      return t("requiredSchoolProgram");
    }

    if (!monthlyBudget || Number(monthlyBudget) <= 0) {
      return t("budgetRequired");
    }

    if (!viewingPreference) {
      return t("viewingPreferenceRequired");
    }

    if (!message.trim()) {
      return t("messageRequired");
    }

    if (!seriousConfirmation) {
      return t("seriousConfirmationRequired");
    }

    if (locationType === "canada") {
      if (!expectedMoveInDate || !leaseDuration.trim()) {
        return t("canadaRequired");
      }

      if (!readyToProvideDocuments) {
        return t("documentsRequired");
      }
    }

    if (locationType === "international") {
      if (
        !currentCountry.trim() ||
        !expectedArrivalDate ||
        !semesterStartDate ||
        !visaStatus ||
        !proofOfAdmissionAvailable ||
        !readyToReserve
      ) {
        return t("internationalRequired");
      }
    }

    return "";
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");

    if (!listing || !currentUserId) return;

    const validationError = validateForm();

    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setSubmitting(true);

    const { data: inquiry, error } = await supabase
      .from("inquiries")
      .insert({
        listing_id: listing.id,
        requester_id: currentUserId,
        owner_id: listing.user_id,
        message: message.trim(),
        phone: null,
        status: "pending",
        student_location_type: locationType,
        current_country:
          locationType === "international" ? currentCountry.trim() : null,
        school: school.trim(),
        campus: campus.trim(),
        program: program.trim(),
        expected_move_in_date:
          locationType === "canada" ? expectedMoveInDate : null,
        expected_arrival_date:
          locationType === "international" ? expectedArrivalDate : null,
        semester_start_date:
          locationType === "international" ? semesterStartDate : null,
        lease_duration: locationType === "canada" ? leaseDuration.trim() : null,
        monthly_budget: Number(monthlyBudget),
        viewing_preference: viewingPreference,
        visa_status: locationType === "international" ? visaStatus : null,
        ready_to_provide_documents:
          locationType === "canada" ? readyToProvideDocuments === "yes" : null,
        proof_of_admission_available:
          locationType === "international"
            ? proofOfAdmissionAvailable === "yes"
            : null,
        ready_to_reserve:
          locationType === "international" ? readyToReserve === "yes" : null,
        serious_confirmation: seriousConfirmation,
        applicant_status: "new",
      })
      .select("id")
      .single();

    if (error) {
      console.error(error.message);
      setErrorMessage(error.message);
      setSubmitting(false);
      return;
    }

    await supabase.from("notifications").insert({
      user_id: listing.user_id,
      inquiry_id: inquiry?.id || null,
      title: "New Housing Inquiry",
      body: "A student sent an inquiry for your listing.",
      message: "A student sent an inquiry for your listing.",
      type: "inquiry_received",
      link: "/inquiries/received",
    });

    if (inquiry?.id) {
      await sendNewInquiryEmail(inquiry.id);
    }

    setSubmitting(false);
    setSent(true);
    router.refresh();
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black px-4 py-10 text-white">
        <div className="mx-auto max-w-3xl">
          <p className="text-zinc-400">{t("loading")}</p>
        </div>
      </main>
    );
  }

  if (errorMessage && !listing) {
    return (
      <main className="min-h-screen bg-black px-4 py-10 text-white">
        <div className="mx-auto max-w-2xl rounded-3xl border border-red-900/60 bg-red-950/40 p-6">
          <p className="text-red-300">{errorMessage}</p>

          <Link
            href={`/listings/${listingId}`}
            className="mt-4 inline-block rounded-xl bg-white px-5 py-3 font-semibold text-black"
          >
            {t("backToListing")}
          </Link>
        </div>
      </main>
    );
  }

  const viewingOptions =
    locationType === "canada"
      ? canadaViewingPreferences
      : internationalViewingPreferences;

  if (sent) {
    return (
      <main className="min-h-screen bg-black px-4 py-10 text-white">
        <div className="mx-auto max-w-3xl">
          <div className="rounded-3xl border border-emerald-500/20 bg-zinc-950 p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-300">
              {t("successEyebrow")}
            </p>
            <h1 className="mt-2 text-3xl font-bold">{t("successTitle")}</h1>
            <p className="mt-3 text-sm leading-6 text-zinc-400">
              {t("successText")}
            </p>

            <div className="mt-6 rounded-2xl border border-white/10 bg-black p-5">
              <p className="font-semibold text-white">{t("successNextTitle")}</p>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-zinc-300">
                <li>{t("successNext.reviewed")}</li>
                <li>{t("successNext.accepted")}</li>
                <li>{t("successNext.viewing")}</li>
              </ul>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/inquiries/sent"
                className="rounded-xl bg-white px-5 py-3 text-center font-semibold text-black hover:bg-zinc-200"
              >
                {t("viewSentInquiries")}
              </Link>

              <Link
                href="/search"
                className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-center font-semibold text-white hover:bg-white/10"
              >
                {t("continueBrowsing")}
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-4 py-10 text-white">
      <div className="mx-auto max-w-4xl">
        <Link
          href={`/listings/${listingId}`}
          className="text-sm text-zinc-400 hover:text-white"
        >
          {t("backToListingArrow")}
        </Link>

        <div className="mt-6 rounded-3xl border border-zinc-800 bg-zinc-950 p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-300">
            {t("seriousInquiryEyebrow")}
          </p>
          <h1 className="mt-2 text-3xl font-bold">{t("seriousInquiryTitle")}</h1>

          <p className="mt-2 text-sm text-zinc-400">
            {t("sendRequestFor")}{" "}
            <span className="font-semibold">
              {listing?.title || t("listingFallback")}
            </span>
          </p>

          <div className="mt-5 rounded-2xl border border-blue-500/20 bg-blue-500/10 p-4 text-sm leading-6 text-blue-100/80">
            {t("disclaimer")}
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-6">
            <FieldGroup title={t("locationQuestion")}>
              <div className="grid gap-3 sm:grid-cols-2">
                <ChoiceButton
                  active={locationType === "canada"}
                  onClick={() => {
                    setLocationType("canada");
                    setViewingPreference("");
                  }}
                >
                  {t("alreadyInCanada")}
                </ChoiceButton>
                <ChoiceButton
                  active={locationType === "international"}
                  onClick={() => {
                    setLocationType("international");
                    setViewingPreference("");
                  }}
                >
                  {t("outsideCanada")}
                </ChoiceButton>
              </div>
            </FieldGroup>

            <FieldGroup title={t("studentDetails")}>
              <div className="grid gap-4 sm:grid-cols-2">
                {locationType === "international" && (
                  <Input
                    label={t("currentCountry")}
                    value={currentCountry}
                    onChange={setCurrentCountry}
                    required
                  />
                )}
                <Input label={t("school")} value={school} onChange={setSchool} required />
                <Input label={t("campus")} value={campus} onChange={setCampus} required />
                <Input label={t("program")} value={program} onChange={setProgram} required />
                {locationType === "canada" ? (
                  <>
                    <Input
                      label={t("expectedMoveInDate")}
                      value={expectedMoveInDate}
                      onChange={setExpectedMoveInDate}
                      type="date"
                      required
                    />
                    <Input
                      label={t("leaseDuration")}
                      value={leaseDuration}
                      onChange={setLeaseDuration}
                      placeholder={t("leaseDurationPlaceholder")}
                      required
                    />
                  </>
                ) : (
                  <>
                    <Input
                      label={t("expectedArrivalDate")}
                      value={expectedArrivalDate}
                      onChange={setExpectedArrivalDate}
                      type="date"
                      required
                    />
                    <Input
                      label={t("semesterStartDate")}
                      value={semesterStartDate}
                      onChange={setSemesterStartDate}
                      type="date"
                      required
                    />
                  </>
                )}
                <Input
                  label={t("monthlyBudget")}
                  value={monthlyBudget}
                  onChange={setMonthlyBudget}
                  type="number"
                  placeholder={t("monthlyBudgetPlaceholder")}
                  required
                />
                {locationType === "international" && (
                <Select
                  label={t("visaStatus")}
                  value={visaStatus}
                  onChange={setVisaStatus}
                  placeholder={t("select")}
                  options={visaStatuses.map((value) => ({
                    value,
                    label: t(`visaStatuses.${value}`),
                    }))}
                    required
                  />
                )}
              </div>
            </FieldGroup>

            <FieldGroup title={t("viewingReadiness")}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Select
                  label={t("viewingPreference")}
                  value={viewingPreference}
                  onChange={setViewingPreference}
                  placeholder={t("select")}
                  options={viewingOptions.map((value) => ({
                    value,
                    label: t(`viewingPreferences.${value}`),
                  }))}
                  required
                />
                {locationType === "canada" ? (
                  <Select
                    label={t("readyDocuments")}
                    value={readyToProvideDocuments}
                    onChange={setReadyToProvideDocuments}
                    placeholder={t("select")}
                    options={[
                      { value: "yes", label: t("yes") },
                      { value: "no", label: t("no") },
                    ]}
                    required
                  />
                ) : (
                  <>
                    <Select
                      label={t("proofAdmission")}
                      value={proofOfAdmissionAvailable}
                      onChange={setProofOfAdmissionAvailable}
                      placeholder={t("select")}
                      options={[
                        { value: "yes", label: t("yes") },
                        { value: "no", label: t("no") },
                      ]}
                      required
                    />
                    <Select
                      label={t("readyReserve")}
                      value={readyToReserve}
                      onChange={setReadyToReserve}
                      placeholder={t("select")}
                      options={[
                        { value: "yes", label: t("yes") },
                        { value: "no", label: t("no") },
                      ]}
                      required
                    />
                  </>
                )}
              </div>
            </FieldGroup>

            <FieldGroup title={t("message")}>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t("messagePlaceholder")}
                className="min-h-[140px] w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-white outline-none placeholder:text-zinc-600 focus:border-zinc-500"
                required
              />
            </FieldGroup>

            <label className="flex gap-3 rounded-2xl border border-white/10 bg-black p-4 text-sm leading-6 text-zinc-300">
              <input
                type="checkbox"
                checked={seriousConfirmation}
                onChange={(e) => setSeriousConfirmation(e.target.checked)}
                className="mt-1 h-4 w-4"
                required
              />
              <span>{t("seriousConfirmation")}</span>
            </label>

            {errorMessage && (
              <div className="rounded-xl border border-red-900/60 bg-red-950/40 p-4 text-sm text-red-300">
                {errorMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-white px-5 py-4 font-semibold text-black hover:bg-zinc-200 disabled:opacity-50"
            >
              {submitting ? t("sending") : t("sendInquiry")}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}

function FieldGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <h2 className="mb-4 font-semibold text-white">{title}</h2>
      {children}
    </section>
  );
}

function ChoiceButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border px-4 py-4 text-left font-semibold transition ${
        active
          ? "border-emerald-400 bg-emerald-500/15 text-emerald-100"
          : "border-zinc-800 bg-black text-zinc-300 hover:border-zinc-600"
      }`}
    >
      {children}
    </button>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-zinc-300">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        type={type}
        placeholder={placeholder}
        required={required}
        className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-white outline-none placeholder:text-zinc-600 focus:border-zinc-500"
      />
    </label>
  );
}

function Select({
  label,
  value,
  onChange,
  placeholder,
  options,
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  options: Array<{ value: string; label: string }>;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-zinc-300">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-white outline-none focus:border-zinc-500"
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
