"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";

type Inquiry = {
  id: string;
  listing_id: string;
  requester_id: string;
  owner_id: string;
  message: string;
  phone?: string | null;
  status: "pending" | "accepted" | "declined";
  applicant_status: string | null;
  student_location_type: "canada" | "international" | null;
  current_country: string | null;
  school: string | null;
  campus: string | null;
  program: string | null;
  expected_move_in_date: string | null;
  expected_arrival_date: string | null;
  semester_start_date: string | null;
  lease_duration: string | null;
  monthly_budget: number | null;
  viewing_preference: string | null;
  visa_status: string | null;
  ready_to_provide_documents: boolean | null;
  proof_of_admission_available: boolean | null;
  ready_to_reserve: boolean | null;
  serious_confirmation: boolean | null;
  created_at: string;
  listings?: {
    title: string;
  } | null;
  requester?: {
    full_name: string | null;
    email: string | null;
  } | null;
};

const applicantStatuses = [
  "new",
  "under_review",
  "viewing_scheduled",
  "application_requested",
  "accepted",
  "declined",
  "no_show",
];

export default function ReceivedInquiriesPage() {
  const t = useTranslations("inquiries.received");
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    loadInquiries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadInquiries() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/auth");
      return;
    }

    const { data, error } = await supabase
      .from("inquiries")
      .select(
        `
        id,
        listing_id,
        requester_id,
        owner_id,
        message,
        phone,
        status,
        applicant_status,
        student_location_type,
        current_country,
        school,
        campus,
        program,
        expected_move_in_date,
        expected_arrival_date,
        semester_start_date,
        lease_duration,
        monthly_budget,
        viewing_preference,
        visa_status,
        ready_to_provide_documents,
        proof_of_admission_available,
        ready_to_reserve,
        serious_confirmation,
        created_at,
        listings (
          title
        )
      `
      )
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      setInquiries([]);
      setLoading(false);
      return;
    }

    const inquiryRows = (data ?? []) as unknown as Inquiry[];
    const requesterIds = Array.from(new Set(inquiryRows.map((item) => item.requester_id)));

    let profilesById = new Map<string, { full_name: string | null; email: string | null }>();

    if (requesterIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", requesterIds);

      profilesById = new Map(
        (profiles || []).map((profile: any) => [
          profile.id,
          { full_name: profile.full_name, email: profile.email },
        ])
      );
    }

    setInquiries(
      inquiryRows.map((inquiry) => ({
        ...inquiry,
        requester: profilesById.get(inquiry.requester_id) || null,
      }))
    );

    setLoading(false);
  }

  async function sendInquiryAcceptedEmail(inquiryId: string) {
    try {
      const response = await fetch("/api/emails/inquiry-accepted", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ inquiryId }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        console.error("INQUIRY ACCEPTED EMAIL API ERROR:", data);
      }
    } catch (error) {
      console.error("INQUIRY ACCEPTED EMAIL FETCH ERROR:", error);
    }
  }

  async function sendInquiryDeclinedEmail(inquiryId: string) {
    try {
      const response = await fetch("/api/emails/inquiry-declined", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ inquiryId }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        console.error("INQUIRY DECLINED EMAIL API ERROR:", data);
      }
    } catch (error) {
      console.error("INQUIRY DECLINED EMAIL FETCH ERROR:", error);
    }
  }

  async function updateApplicantStatus(inquiryId: string, applicantStatus: string) {
    setUpdatingId(inquiryId);

    const { error } = await supabase
      .from("inquiries")
      .update({ applicant_status: applicantStatus })
      .eq("id", inquiryId);

    if (error) {
      alert(error.message);
      setUpdatingId(null);
      return;
    }

    setInquiries((current) =>
      current.map((item) =>
        item.id === inquiryId
          ? { ...item, applicant_status: applicantStatus }
          : item
      )
    );

    setUpdatingId(null);
  }

  async function acceptInquiry(inquiry: Inquiry) {
    try {
      setUpdatingId(inquiry.id);

      const { error: inquiryError } = await supabase
        .from("inquiries")
        .update({ status: "accepted", applicant_status: "accepted" })
        .eq("id", inquiry.id);

      if (inquiryError) {
        alert(inquiryError.message);
        return;
      }

      const { error: listingError } = await supabase
        .from("listings")
        .update({ status: "pending" })
        .eq("id", inquiry.listing_id);

      if (listingError) {
        alert(listingError.message);
        return;
      }

      await supabase.from("notifications").insert({
        user_id: inquiry.requester_id,
        inquiry_id: inquiry.id,
        title: "Inquiry accepted",
        body:
          "Your housing inquiry was accepted. You can now request a viewing.",
        message:
          "Your housing inquiry was accepted. You can now request a viewing.",
        type: "inquiry_accepted",
        link: `/inquiries/sent`,
      });

      await sendInquiryAcceptedEmail(inquiry.id);

      setInquiries((current) =>
        current.map((item) =>
          item.id === inquiry.id
            ? { ...item, status: "accepted", applicant_status: "accepted" }
            : item
        )
      );

      router.refresh();
    } finally {
      setUpdatingId(null);
    }
  }

  async function declineInquiry(inquiry: Inquiry) {
    try {
      setUpdatingId(inquiry.id);

      const { error } = await supabase
        .from("inquiries")
        .update({ status: "declined", applicant_status: "declined" })
        .eq("id", inquiry.id);

      if (error) {
        alert(error.message);
        return;
      }

      await supabase.from("notifications").insert({
        user_id: inquiry.requester_id,
        inquiry_id: inquiry.id,
        title: "Inquiry declined",
        body: "The owner declined your inquiry for this listing.",
        message: "The owner declined your inquiry for this listing.",
        type: "inquiry_declined",
        link: `/inquiries/sent`,
      });

      await sendInquiryDeclinedEmail(inquiry.id);

      setInquiries((current) =>
        current.map((item) =>
          item.id === inquiry.id
            ? { ...item, status: "declined", applicant_status: "declined" }
            : item
        )
      );

      router.refresh();
    } finally {
      setUpdatingId(null);
    }
  }

  function formatDate(date: string | null) {
    if (!date) return t("notProvided");
    return new Date(date).toLocaleDateString("en-CA");
  }

  function formatBoolean(value: boolean | null) {
    if (value === true) return t("yes");
    if (value === false) return t("no");
    return t("notProvided");
  }

  function formatKey(namespace: string, value: string | null) {
    if (!value) return t("notProvided");
    return t(`${namespace}.${value}`);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black px-4 py-10 text-white">
        {t("loading")}
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-4 py-10 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">{t("title")}</h1>
            <p className="mt-1 text-zinc-400">{t("subtitle")}</p>
          </div>

          <Link
            href="/my-listings"
            className="rounded-xl border border-zinc-700 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10"
          >
            {t("myListings")}
          </Link>
        </div>

        {inquiries.length === 0 ? (
          <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-8 text-center">
            <p className="text-zinc-400">{t("empty")}</p>
          </div>
        ) : (
          <div className="space-y-5">
            {inquiries.map((inquiry) => {
              const isInternational =
                inquiry.student_location_type === "international";
              const applicantName =
                inquiry.requester?.full_name ||
                inquiry.requester?.email ||
                t("studentFallback");

              return (
                <div
                  key={inquiry.id}
                  className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6"
                >
                  <div className="grid gap-6 lg:grid-cols-[1fr_240px]">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-3">
                        <h2 className="text-xl font-semibold">
                          {inquiry.listings?.title ?? t("listingFallback")}
                        </h2>

                        {inquiry.serious_confirmation && (
                          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-300">
                            {t("seriousApplicant")}
                          </span>
                        )}
                      </div>

                      <p className="mt-2 text-sm text-zinc-500">
                        {t("sentOn")} {formatDate(inquiry.created_at)}
                      </p>

                      <div className="mt-5 rounded-2xl border border-white/10 bg-black p-5">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div>
                            <p className="text-sm text-zinc-500">
                              {t("studentName")}
                            </p>
                            <p className="mt-1 font-bold text-white">
                              {applicantName}
                            </p>
                          </div>

                          <div className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-zinc-200">
                            {isInternational
                              ? t("internationalStudent")
                              : t("canadaStudent")}
                          </div>
                        </div>

                        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                          {isInternational && (
                            <Info label={t("country")} value={inquiry.current_country || t("notProvided")} />
                          )}
                          <Info label={t("schoolCampus")} value={[inquiry.school, inquiry.campus].filter(Boolean).join(" / ") || t("notProvided")} />
                          <Info label={t("program")} value={inquiry.program || t("notProvided")} />
                          <Info
                            label={isInternational ? t("arrivalDate") : t("moveInDate")}
                            value={formatDate(
                              isInternational
                                ? inquiry.expected_arrival_date
                                : inquiry.expected_move_in_date
                            )}
                          />
                          {isInternational && (
                            <Info label={t("semesterStartDate")} value={formatDate(inquiry.semester_start_date)} />
                          )}
                          {!isInternational && (
                            <Info label={t("leaseDuration")} value={inquiry.lease_duration || t("notProvided")} />
                          )}
                          <Info
                            label={t("budget")}
                            value={
                              inquiry.monthly_budget == null
                                ? t("notProvided")
                                : t("budgetValue", { amount: inquiry.monthly_budget })
                            }
                          />
                          {isInternational && (
                            <Info label={t("visaStatus")} value={formatKey("visaStatuses", inquiry.visa_status)} />
                          )}
                          <Info
                            label={t("viewingPreference")}
                            value={formatKey("viewingPreferences", inquiry.viewing_preference)}
                          />
                          {!isInternational && (
                            <Info
                              label={t("readyDocuments")}
                              value={formatBoolean(inquiry.ready_to_provide_documents)}
                            />
                          )}
                          {isInternational && (
                            <>
                              <Info
                                label={t("proofAdmission")}
                                value={formatBoolean(inquiry.proof_of_admission_available)}
                              />
                              <Info
                                label={t("readyReserve")}
                                value={formatBoolean(inquiry.ready_to_reserve)}
                              />
                            </>
                          )}
                        </div>

                        <div className="mt-5">
                          <p className="text-sm font-semibold text-zinc-300">
                            {t("message")}
                          </p>
                          <p className="mt-2 whitespace-pre-wrap rounded-2xl border border-white/10 bg-zinc-950 p-4 leading-7 text-zinc-300">
                            {inquiry.message}
                          </p>
                        </div>

                        {inquiry.phone && (
                          <p className="mt-3 text-zinc-300">
                            {t("phone")} {inquiry.phone}
                          </p>
                        )}
                      </div>

                      <div className="mt-5 flex flex-wrap gap-3">
                        <Link
                          href={`/listings/${inquiry.listing_id}`}
                          className="rounded-xl border border-zinc-700 px-4 py-2 text-sm text-white hover:bg-white/10"
                        >
                          {t("viewListing")}
                        </Link>

                        {inquiry.status === "accepted" && (
                          <Link
                            href={`/messages/${inquiry.id}`}
                            className="rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-sm text-blue-300"
                          >
                            {t("openChat")}
                          </Link>
                        )}
                      </div>
                    </div>

                    <div className="min-w-[220px]">
                      <p className="mb-4 text-sm text-zinc-400">
                        {t("status")}{" "}
                        <span className="font-semibold capitalize text-white">
                          {inquiry.status}
                        </span>
                      </p>

                      <label className="mb-4 block">
                        <span className="mb-2 block text-sm font-semibold text-zinc-300">
                          {t("applicantStatus")}
                        </span>
                        <select
                          value={inquiry.applicant_status || "new"}
                          onChange={(event) =>
                            updateApplicantStatus(inquiry.id, event.target.value)
                          }
                          disabled={updatingId === inquiry.id}
                          className="w-full rounded-xl border border-zinc-800 bg-black px-3 py-3 text-white outline-none"
                        >
                          {applicantStatuses.map((status) => (
                            <option key={status} value={status}>
                              {t(`applicantStatuses.${status}`)}
                            </option>
                          ))}
                        </select>
                      </label>

                      {inquiry.status === "pending" && (
                        <div className="space-y-2">
                          <button
                            onClick={() => acceptInquiry(inquiry)}
                            disabled={updatingId === inquiry.id}
                            className="w-full rounded-xl bg-white px-4 py-3 font-semibold text-black disabled:bg-zinc-600"
                          >
                            {updatingId === inquiry.id ? t("accepting") : t("accept")}
                          </button>

                          <button
                            onClick={() => declineInquiry(inquiry)}
                            disabled={updatingId === inquiry.id}
                            className="w-full rounded-xl bg-red-600 px-4 py-3 font-semibold text-white disabled:bg-zinc-600"
                          >
                            {updatingId === inquiry.id ? t("updating") : t("decline")}
                          </button>
                        </div>
                      )}

                      {inquiry.status === "accepted" && (
                        <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-300">
                          {t("acceptedNotice")}
                        </div>
                      )}

                      {inquiry.status === "declined" && (
                        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
                          {t("declinedNotice")}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-zinc-200">{value}</p>
    </div>
  );
}
