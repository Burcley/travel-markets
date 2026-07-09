"use client";

import { useEffect, useState } from "react";
import { Send } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";

type Listing = {
  id: string;
  title: string;
  user_id: string;
};

type InquiryRow = {
  id: string;
};

type ViewingType = "in_person" | "video_call" | "video_tour";

export default function BookViewingPage() {
  const t = useTranslations("listingManagement.bookViewing");
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();

  const [listing, setListing] = useState<Listing | null>(null);
  const [viewingType, setViewingType] = useState<ViewingType>("in_person");
  const [requestedDate, setRequestedDate] = useState("");
  const [requestedTime, setRequestedTime] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    loadBookingData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function loadBookingData() {
    setLoading(true);

    const { data: listingData, error: listingError } = await supabase
      .from("listings")
      .select("id,title,user_id")
      .eq("id", id)
      .maybeSingle();

    if (listingError) {
      alert(listingError.message);
      setLoading(false);
      return;
    }

    setListing(listingData);
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
        console.error("VIEWING REQUEST EMAIL API ERROR:", data);
      } else {
        console.log("VIEWING REQUEST EMAIL SENT:", data);
      }
    } catch (error) {
      console.error("VIEWING REQUEST EMAIL FETCH ERROR:", error);
    }
  }

  async function findAcceptedInquiry(userId: string, listingData: Listing) {
    const { data, error } = await supabase
      .from("inquiries")
      .select("id")
      .eq("listing_id", listingData.id)
      .eq("owner_id", listingData.user_id)
      .eq("requester_id", userId)
      .eq("status", "accepted")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("FIND ACCEPTED INQUIRY ERROR:", error);
      return null;
    }

    return data as InquiryRow | null;
  }

  async function requestViewing() {
    if (viewingType !== "video_tour" && (!requestedDate || !requestedTime)) {
      alert(t("chooseVideoDateTime"));
      return;
    }

    setRequesting(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || !listing) {
      setRequesting(false);
      alert(t("loginRequired"));
      return;
    }

    const acceptedInquiry = await findAcceptedInquiry(user.id, listing);

    const { data: insertedViewing, error: insertError } = await supabase
      .from("viewings")
      .insert({
        inquiry_id: acceptedInquiry?.id || null,
        listing_id: listing.id,
        owner_id: listing.user_id,
        requester_id: user.id,
        slot_id: null,
        requested_date: viewingType === "video_tour" ? null : requestedDate,
        requested_time: viewingType === "video_tour" ? null : requestedTime,
        note: message || null,
        status: "pending",
        viewing_type: viewingType,
      })
      .select("id")
      .single();

    if (insertError) {
      setRequesting(false);
      alert(insertError.message);
      return;
    }

    await supabase.from("notifications").insert({
      user_id: listing.user_id,
      title: "New viewing request",
      message: "A student requested a viewing for your listing.",
      body: "A student requested a viewing for your listing.",
      type: "viewing_requested",
      link: "/viewings",
      is_read: false,
    });

    if (insertedViewing?.id) {
      await sendViewingRequestedEmail(insertedViewing.id);
    }

    setRequesting(false);

    alert(t("requestSent"));
    router.push("/viewings");
    router.refresh();
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black text-white">
        {t("loading")}
      </main>
    );
  }

  if (!listing) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black text-white">
        {t("notFound")}
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-4 py-8 text-white">
      <div className="mx-auto max-w-4xl space-y-6">
        <section className="rounded-3xl border border-white/10 bg-zinc-950 p-6 shadow-2xl">
          <div className="mb-6">
            <h1 className="text-2xl font-bold">{t("title")}</h1>
            <p className="mt-1 text-zinc-400">{listing.title}</p>
          </div>

          <div className="mb-6 grid gap-3 md:grid-cols-3">
            {(["in_person", "video_call", "video_tour"] as ViewingType[]).map(
              (type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => {
                    setViewingType(type);
                  }}
                  className={`rounded-2xl border p-4 text-left transition ${
                    viewingType === type
                      ? "border-white bg-white text-black"
                      : "border-white/10 bg-black text-white hover:border-white/30"
                  }`}
                >
                  <p className="font-semibold">{t(`types.${type}.title`)}</p>
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
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold text-zinc-300">
                  {t("preferredDate")}
                </label>
                <input
                  type="date"
                  value={requestedDate}
                  onChange={(e) => setRequestedDate(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-white/30"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-zinc-300">
                  {t("preferredTime")}
                </label>
                <input
                  type="time"
                  value={requestedTime}
                  onChange={(e) => setRequestedTime(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-white/30"
                />
              </div>
            </div>
          )}

          <div className="mt-6 space-y-4">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t("messagePlaceholder")}
              className="min-h-32 w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none placeholder:text-zinc-600"
            />

            <button
              onClick={requestViewing}
              disabled={requesting}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 font-semibold text-black transition hover:bg-zinc-200 disabled:opacity-50"
            >
              <Send className="h-5 w-5" />
              {requesting ? t("sending") : t("requestViewing")}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
