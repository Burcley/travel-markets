"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";

type Inquiry = {
  id: string;
  listing_id: string;
  owner_id: string;
  requester_id: string;
  status: "pending" | "accepted" | "declined";
  listings?: {
    title: string;
    status?: "available" | "pending" | "rented" | null;
  } | null;
};

type ViewingType = "in_person" | "video_call" | "video_tour";

export default function RequestViewingPage() {
  const t = useTranslations("viewings.request");
  const router = useRouter();
  const params = useParams();
  const supabase = useMemo(() => createClient(), []);

  const inquiryId = Array.isArray(params.inquiryId)
    ? params.inquiryId[0]
    : params.inquiryId;

  const [inquiry, setInquiry] = useState<Inquiry | null>(null);
  const [viewingType, setViewingType] = useState<ViewingType>("in_person");
  const [requestedDate, setRequestedDate] = useState("");
  const [requestedTime, setRequestedTime] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    loadInquiry();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inquiryId]);

  async function loadInquiry() {
    setLoading(true);
    setErrorMessage("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/auth");
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, status")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.role === "banned" || profile?.status === "banned") {
      setErrorMessage(t("restrictedError"));
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("inquiries")
      .select(
        `
        id,
        listing_id,
        owner_id,
        requester_id,
        status,
        listings (
          title,
          status
        )
      `
      )
      .eq("id", inquiryId)
      .single();

    if (error || !data) {
      setErrorMessage(error?.message || t("inquiryNotFound"));
      setLoading(false);
      return;
    }

    const inquiryData = data as unknown as Inquiry;

    if (inquiryData.requester_id !== user.id) {
      setErrorMessage(t("onlyRequester"));
      setLoading(false);
      return;
    }

    if (inquiryData.status !== "accepted") {
      setErrorMessage(t("onlyAfterAccepted"));
      setLoading(false);
      return;
    }

    if (inquiryData.listings?.status === "rented") {
      setErrorMessage(t("listingUnavailable"));
      setLoading(false);
      return;
    }

    setInquiry(inquiryData);
    setLoading(false);
  }

  async function sendViewingRequestedEmail(viewingId: string) {
    try {
      const response = await fetch("/api/emails/viewing-requested", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ viewingId }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        console.error("VIEWING REQUESTED EMAIL API ERROR:", data);
      }
    } catch (error) {
      console.error("VIEWING REQUESTED EMAIL FETCH ERROR:", error);
    }
  }

  async function submitViewing(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!inquiry) return;

    if (viewingType !== "video_tour" && (!requestedDate || !requestedTime)) {
      setErrorMessage(t("chooseDateTime"));
      return;
    }

    setSubmitting(true);
    setErrorMessage("");

    const { data: insertedViewing, error } = await supabase
      .from("viewings")
      .insert({
        inquiry_id: inquiry.id,
        listing_id: inquiry.listing_id,
        owner_id: inquiry.owner_id,
        requester_id: inquiry.requester_id,
        requested_date: viewingType === "video_tour" ? null : requestedDate,
        requested_time: viewingType === "video_tour" ? null : requestedTime,
        note: note.trim() || null,
        status: "pending",
        viewing_type: viewingType,
      })
      .select("id")
      .single();

    setSubmitting(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    await supabase.from("notifications").insert({
      user_id: inquiry.owner_id,
      inquiry_id: inquiry.id,
      title: "New viewing request",
      body: "A student requested a viewing for your listing.",
      message: "A student requested a viewing for your listing.",
      type: "viewing_requested",
      link: "/viewings",
    });

    if (insertedViewing?.id) {
      await sendViewingRequestedEmail(insertedViewing.id);
    }

    router.push("/viewings");
    router.refresh();
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black px-4 py-10 text-white">
        <div className="mx-auto max-w-2xl">
          <p className="text-zinc-400">{t("loading")}</p>
        </div>
      </main>
    );
  }

  if (errorMessage && !inquiry) {
    return (
      <main className="min-h-screen bg-black px-4 py-10 text-white">
        <div className="mx-auto max-w-2xl rounded-3xl border border-zinc-800 bg-zinc-950 p-8">
          <h1 className="text-2xl font-bold">{t("unavailableTitle")}</h1>
          <p className="mt-3 text-zinc-400">{errorMessage}</p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/inquiries/sent"
              className="rounded-xl bg-white px-5 py-3 font-semibold text-black"
            >
              {t("backToSentInquiries")}
            </Link>

            <Link
              href="/viewings"
              className="rounded-xl border border-zinc-700 px-5 py-3 font-semibold text-white"
            >
              {t("viewAppointments")}
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-4 py-10 text-white">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/inquiries/sent"
          className="text-sm text-zinc-400 hover:text-white"
        >
          {t("backToSentInquiriesArrow")}
        </Link>

        <div className="mt-6 rounded-3xl border border-zinc-800 bg-zinc-950 p-6">
          <h1 className="text-3xl font-bold">{t("title")}</h1>

          <p className="mt-2 text-sm text-zinc-400">
            {inquiry?.listings?.title || t("listingFallback")}
          </p>

          {errorMessage && (
            <div className="mt-5 rounded-2xl border border-red-900/60 bg-red-950/40 p-4 text-sm text-red-300">
              {errorMessage}
            </div>
          )}

          <form onSubmit={submitViewing} className="mt-6 space-y-5">
            <div className="grid gap-3 sm:grid-cols-3">
              {(["in_person", "video_call", "video_tour"] as ViewingType[]).map(
                (type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setViewingType(type)}
                    className={`rounded-2xl border p-4 text-left transition ${
                      viewingType === type
                        ? "border-white bg-white text-black"
                        : "border-white/10 bg-black text-white hover:border-white/30"
                    }`}
                  >
                    <p className="font-semibold">
                      {t(`types.${type}.title`)}
                    </p>
                    <p
                      className={`mt-2 text-sm ${
                        viewingType === type ? "text-zinc-700" : "text-zinc-400"
                      }`}
                    >
                      {t(`types.${type}.text`)}
                    </p>
                  </button>
                )
              )}
            </div>

            {viewingType !== "video_tour" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-zinc-300">
                    {t("viewingDate")}
                  </label>
                  <input
                    type="date"
                    required
                    value={requestedDate}
                    onChange={(e) => setRequestedDate(e.target.value)}
                    className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-white outline-none focus:border-zinc-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-zinc-300">
                    {t("viewingTime")}
                  </label>
                  <input
                    type="time"
                    required
                    value={requestedTime}
                    onChange={(e) => setRequestedTime(e.target.value)}
                    className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-white outline-none focus:border-zinc-500"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-300">
                {t("noteToOwner")}
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={5}
                placeholder={t("notePlaceholder")}
                className="w-full resize-none rounded-xl border border-zinc-800 bg-black px-4 py-3 text-white outline-none placeholder:text-zinc-600 focus:border-zinc-500"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-white px-5 py-4 font-semibold text-black hover:bg-zinc-200 disabled:opacity-50"
            >
              {submitting ? t("submitting") : t("requestViewing")}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
