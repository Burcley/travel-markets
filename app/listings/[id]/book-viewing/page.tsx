"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, CheckCircle2, Clock, Send } from "lucide-react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";

type Listing = {
  id: string;
  title: string;
  user_id: string;
  status: "draft" | "available" | "pending" | "rented" | null;
  verification_status?: string | null;
};

type InquiryRow = {
  id: string;
  status: "pending" | "accepted" | "declined";
};

type ActiveViewing = {
  id: string;
  status: "pending" | "accepted" | "suggested";
  requested_date: string | null;
  requested_time: string | null;
  viewing_type: ViewingType | null;
};

type ViewingType = "in_person" | "video_call" | "video_tour";

type ViewingSlot = {
  id: string;
  listing_id: string;
  owner_id: string;
  slot_date: string;
  start_time: string;
  end_time: string;
  is_booked: boolean;
  status?: string | null;
  viewing_type?: "in_person" | "video_call" | "both" | null;
  timezone?: string | null;
  booked_viewing_id?: string | null;
};

const ACTIVE_LISTING_STATUSES = new Set(["available", "pending"]);

function isBookableListingStatus(status: Listing["status"]) {
  return status === null || ACTIVE_LISTING_STATUSES.has(status);
}

function localToday() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function isFutureDateTime(date: string, time: string, timezone?: string | null) {
  const slotTimestamp = new Date(`${date}T${time}`).getTime();
  const timezoneNow = timezone
    ? new Date(new Date().toLocaleString("en-US", { timeZone: timezone })).getTime()
    : Date.now();

  return Number.isFinite(slotTimestamp) && slotTimestamp > timezoneNow;
}

function formatSlotTime(slot: ViewingSlot) {
  return `${slot.start_time.slice(0, 5)} - ${slot.end_time.slice(0, 5)}`;
}

function slotTypeLabel(slot: ViewingSlot) {
  if (slot.viewing_type === "video_call") return "Video";
  if (slot.viewing_type === "both") return "In-person or video";
  return "In-person";
}

export default function BookViewingPage() {
  const t = useTranslations("listingManagement.bookViewing");
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [listing, setListing] = useState<Listing | null>(null);
  const [inquiry, setInquiry] = useState<InquiryRow | null>(null);
  const [activeViewing, setActiveViewing] = useState<ActiveViewing | null>(null);
  const [slots, setSlots] = useState<ViewingSlot[]>([]);
  const [selectedSlotId, setSelectedSlotId] = useState("");
  const [viewingType, setViewingType] = useState<ViewingType>("in_person");
  const [requestedDate, setRequestedDate] = useState("");
  const [requestedTime, setRequestedTime] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    loadBookingData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function loadBookingData() {
    setLoading(true);
    setError("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push(`/auth?returnTo=/listings/${id}/book-viewing`);
      return;
    }

    if (!user.email_confirmed_at) {
      router.push("/verify-email");
      return;
    }

    const { data: listingData, error: listingError } = await supabase
      .from("listings")
      .select("id,title,user_id,status")
      .eq("id", id)
      .maybeSingle();

    if (listingError) {
      if (process.env.NODE_ENV !== "production") {
        console.error("Failed to load listing for viewing booking:", listingError);
      }
      setError(t("listingLoadError"));
      setLoading(false);
      return;
    }

    if (!listingData) {
      setError(t("notFound"));
      setLoading(false);
      return;
    }

    const safeListing = listingData as Listing;
    setListing(safeListing);

    if (safeListing.user_id === user.id) {
      setError(t("ownerCannotBook"));
      setLoading(false);
      return;
    }

    const { data: viewingData, error: viewingError } = await supabase
      .from("viewings")
      .select("id,status,requested_date,requested_time,viewing_type")
      .eq("listing_id", safeListing.id)
      .eq("requester_id", user.id)
      .in("status", ["pending", "accepted", "suggested"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (viewingError) {
      if (process.env.NODE_ENV !== "production") {
        console.error("Failed to load existing viewing for booking:", viewingError);
      }
      setError(t("viewingLoadError"));
      setLoading(false);
      return;
    }

    const currentViewing = (viewingData as ActiveViewing | null) || null;
    setActiveViewing(currentViewing);

    if (currentViewing) {
      if (process.env.NODE_ENV !== "production") {
        console.log("Viewing booking existing request found", {
          authenticatedStudentId: user.id,
          listingId: safeListing.id,
          listingOwnerId: safeListing.user_id,
          listingStatus: safeListing.status,
          viewingId: currentViewing.id,
          viewingStatus: currentViewing.status,
        });
      }
      setLoading(false);
      return;
    }

    if (!isBookableListingStatus(safeListing.status)) {
      if (process.env.NODE_ENV !== "production") {
        console.log("Viewing booking rejected by listing status", {
          listingId: safeListing.id,
          listingOwnerId: safeListing.user_id,
          listingStatus: safeListing.status,
          acceptedStatuses: ["available", "pending", null],
        });
      }
      setError(t("listingUnavailable"));
      setLoading(false);
      return;
    }

    const inquiryId = searchParams.get("inquiry");
    let acceptedInquiryQuery = supabase
      .from("inquiries")
      .select("id,status")
      .eq("listing_id", safeListing.id)
      .eq("owner_id", safeListing.user_id)
      .eq("requester_id", user.id)
      .eq("status", "accepted")
      .order("created_at", { ascending: false })
      .limit(1);

    if (inquiryId) {
      acceptedInquiryQuery = acceptedInquiryQuery.eq("id", inquiryId);
    }

    const { data: acceptedInquiryData, error: acceptedInquiryError } =
      await acceptedInquiryQuery.maybeSingle();

    if (acceptedInquiryError) {
      if (process.env.NODE_ENV !== "production") {
        console.error(
          "Failed to load accepted inquiry for viewing booking:",
          acceptedInquiryError
        );
      }
      setError(t("inquiryLoadError"));
      setLoading(false);
      return;
    }

    let latestInquiryData: InquiryRow | null = null;

    if (!acceptedInquiryData) {
      let latestInquiryQuery = supabase
        .from("inquiries")
        .select("id,status")
        .eq("listing_id", safeListing.id)
        .eq("owner_id", safeListing.user_id)
        .eq("requester_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1);

      if (inquiryId) {
        latestInquiryQuery = latestInquiryQuery.eq("id", inquiryId);
      }

      const { data: latestInquiry, error: latestInquiryError } =
        await latestInquiryQuery.maybeSingle();

      if (latestInquiryError) {
        if (process.env.NODE_ENV !== "production") {
          console.error(
            "Failed to load latest inquiry for viewing booking:",
            latestInquiryError
          );
        }
        setError(t("inquiryLoadError"));
        setLoading(false);
        return;
      }

      latestInquiryData = latestInquiry as InquiryRow | null;
    }

    const currentInquiry = (acceptedInquiryData || latestInquiryData) as
      | InquiryRow
      | null;
    setInquiry(currentInquiry);

    if (process.env.NODE_ENV !== "production") {
      console.log("Viewing booking eligibility", {
        authenticatedStudentId: user.id,
        listingId: safeListing.id,
        listingOwnerId: safeListing.user_id,
        listingStatus: safeListing.status,
        inquiryId: currentInquiry?.id || null,
        inquiryStatus: currentInquiry?.status || null,
        inquiryFilter: {
          listing_id: safeListing.id,
          owner_id: safeListing.user_id,
          requester_id: user.id,
          accepted_status: "accepted",
          explicit_inquiry_id: inquiryId || null,
        },
      });
    }

    if (!currentInquiry) {
      setError(t("acceptedInquiryRequired"));
      setLoading(false);
      return;
    }

    if (currentInquiry.status === "pending") {
      setError(t("inquiryPending"));
      setLoading(false);
      return;
    }

    if (currentInquiry.status === "declined") {
      setError(t("inquiryDeclined"));
      setLoading(false);
      return;
    }

    const today = localToday();
    const slotFilters = {
      listing_id: safeListing.id,
      owner_id: safeListing.user_id,
      status: "available",
      is_booked: false,
      slot_date_gte: today,
      booked_viewing_id: null,
    };
    const { data: slotData, error: slotError } = await supabase
      .from("viewing_slots")
      .select("id,listing_id,owner_id,slot_date,start_time,end_time,is_booked,status,viewing_type,timezone,booked_viewing_id")
      .eq("listing_id", safeListing.id)
      .eq("owner_id", safeListing.user_id)
      .eq("is_booked", false)
      .eq("status", "available")
      .is("booked_viewing_id", null)
      .gte("slot_date", today)
      .order("slot_date", { ascending: true })
      .order("start_time", { ascending: true });

    if (slotError) {
      if (process.env.NODE_ENV !== "production") {
        console.error("VIEWING SLOT LOAD ERROR:", slotError, {
          slotFilters,
        });
      }
      setError(t("slotLoadError"));
      setSlots([]);
      setLoading(false);
      return;
    }

    const futureSlots = ((slotData || []) as ViewingSlot[]).filter((slot) =>
      isFutureDateTime(slot.slot_date, slot.start_time, slot.timezone)
    );

    if (process.env.NODE_ENV !== "production") {
      console.log("Viewing booking slot query result", {
        slotFilters,
        slotQueryError: null,
        slotsReturned: slotData?.length || 0,
        futureSlotsReturned: futureSlots.length,
      });
    }

    setSlots(futureSlots);
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

      if (!response.ok) {
        console.error("VIEWING REQUEST EMAIL API ERROR:", await response.json().catch(() => null));
      }
    } catch (emailError) {
      console.error("VIEWING REQUEST EMAIL FETCH ERROR:", emailError);
    }
  }

  async function requestViewing(slotId: string | null = null) {
    if (!listing || !inquiry) return;

    if (!slotId && viewingType !== "video_tour" && (!requestedDate || !requestedTime)) {
      setError(t("chooseVideoDateTime"));
      return;
    }

    setRequesting(true);
    setError("");
    setSuccess("");

    const selectedSlot = slotId
      ? slots.find((slot) => slot.id === slotId) || null
      : null;
    const requestType =
      selectedSlot?.viewing_type === "video_call"
        ? "video_call"
        : selectedSlot?.viewing_type === "in_person"
          ? "in_person"
          : selectedSlot?.viewing_type === "both" && viewingType === "video_tour"
            ? "in_person"
          : viewingType;

    const response = await fetch("/api/viewings/request", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        listingId: listing.id,
        inquiryId: inquiry.id,
        slotId,
        viewingType: requestType,
        requestedDate: slotId ? null : requestedDate,
        requestedTime: slotId ? null : requestedTime,
        note: message,
      }),
    });
    const data = await response.json().catch(() => null);

    setRequesting(false);

    if (!response.ok) {
      setError(data?.error || t("requestFailed"));
      return;
    }

    if (data?.viewingId) {
      await sendViewingRequestedEmail(data.viewingId);
    }

    setSuccess(t("requestSent"));
    router.push("/viewings");
    router.refresh();
  }

  const groupedSlots = useMemo(() => {
    return slots.reduce<Record<string, ViewingSlot[]>>((groups, slot) => {
      groups[slot.slot_date] = [...(groups[slot.slot_date] || []), slot];
      return groups;
    }, {});
  }, [slots]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black text-white">
        {t("loading")}
      </main>
    );
  }

  if (!listing || error && !inquiry) {
    return (
      <main className="min-h-screen bg-black px-4 py-10 text-white">
        <div className="mx-auto max-w-2xl rounded-3xl border border-white/10 bg-zinc-950 p-8">
          <h1 className="text-2xl font-bold">{t("unavailableTitle")}</h1>
          <p className="mt-3 text-zinc-400">{error || t("notFound")}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href={`/listings/${id}`}
              className="rounded-xl bg-white px-5 py-3 font-semibold text-black"
            >
              {t("backToListing")}
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

  if (activeViewing) {
    return (
      <main className="min-h-screen bg-black px-4 py-10 text-white">
        <div className="mx-auto max-w-2xl rounded-3xl border border-white/10 bg-zinc-950 p-8">
          <h1 className="text-2xl font-bold">
            {activeViewing.status === "accepted"
              ? t("viewingConfirmed")
              : t("viewingPending")}
          </h1>
          {activeViewing.requested_date && (
            <p className="mt-3 text-zinc-400">
              {activeViewing.requested_date}
              {activeViewing.requested_time
                ? ` • ${activeViewing.requested_time.slice(0, 5)}`
                : ""}
            </p>
          )}
          <Link
            href="/viewings"
            className="mt-6 inline-flex rounded-xl bg-white px-5 py-3 font-semibold text-black"
          >
            {t("viewAppointments")}
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-4 py-8 text-white">
      <div className="mx-auto max-w-5xl space-y-6">
        <Link href={`/listings/${listing.id}`} className="text-sm text-zinc-400 hover:text-white">
          {t("backToListing")}
        </Link>

        <section className="rounded-3xl border border-white/10 bg-zinc-950 p-6 shadow-2xl">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-pink-300">
              {t("acceptedOnly")}
            </p>
            <h1 className="mt-2 text-3xl font-bold">{t("title")}</h1>
            <p className="mt-2 text-zinc-400">{listing.title}</p>
          </div>

          {error && (
            <div className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
              {error}
            </div>
          )}

          {success && (
            <div className="mt-5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">
              {success}
            </div>
          )}

          <div className="mt-8 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-3xl border border-white/10 bg-black/40 p-5">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-white/10 p-3">
                  <CalendarDays className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">{t("optionSlotsTitle")}</h2>
                  <p className="text-sm text-zinc-400">{t("optionSlotsText")}</p>
                </div>
              </div>

              {slots.length === 0 ? (
                <div className="mt-5 rounded-2xl border border-dashed border-zinc-700 p-5 text-sm text-zinc-400">
                  {t("noLandlordSlots")}
                </div>
              ) : (
                <div className="mt-5 space-y-5">
                  {Object.entries(groupedSlots).map(([date, daySlots]) => (
                    <div key={date}>
                      <p className="mb-3 font-semibold text-white">{date}</p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {daySlots.map((slot) => {
                          const selected = selectedSlotId === slot.id;
                          return (
                            <button
                              key={slot.id}
                              type="button"
                              onClick={() => setSelectedSlotId(slot.id)}
                              className={`rounded-2xl border p-4 text-left transition ${
                                selected
                                  ? "border-white bg-white text-black"
                                  : "border-white/10 bg-zinc-950 text-white hover:border-white/30"
                              }`}
                            >
                              <p className="flex items-center gap-2 font-bold">
                                <Clock className="h-4 w-4" />
                                {formatSlotTime(slot)}
                              </p>
                              <p className={`mt-2 text-sm ${selected ? "text-zinc-700" : "text-zinc-400"}`}>
                                {slotTypeLabel(slot)} • {slot.timezone || "America/Toronto"}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={() => requestViewing(selectedSlotId)}
                disabled={!selectedSlotId || requesting}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <CheckCircle2 className="h-5 w-5" />
                {requesting ? t("sending") : t("requestSelectedSlot")}
              </button>
            </div>

            <div className="rounded-3xl border border-white/10 bg-black/40 p-5">
              <h2 className="text-xl font-bold">{t("optionCustomTitle")}</h2>
              <p className="mt-1 text-sm text-zinc-400">{t("optionCustomText")}</p>

              <div className="mt-5 grid gap-3">
                {(["in_person", "video_call", "video_tour"] as ViewingType[]).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setViewingType(type)}
                    className={`rounded-2xl border p-4 text-left transition ${
                      viewingType === type
                        ? "border-white bg-white text-black"
                        : "border-white/10 bg-zinc-950 text-white hover:border-white/30"
                    }`}
                  >
                    <p className="font-semibold">{t(`types.${type}.title`)}</p>
                    <p className={`mt-2 text-sm ${viewingType === type ? "text-zinc-700" : "text-zinc-400"}`}>
                      {t(`types.${type}.text`)}
                    </p>
                  </button>
                ))}
              </div>

              {viewingType !== "video_tour" && (
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
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

              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t("messagePlaceholder")}
                className="mt-5 min-h-32 w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none placeholder:text-zinc-600"
              />

              <button
                onClick={() => requestViewing(null)}
                disabled={requesting}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 font-semibold text-black transition hover:bg-zinc-200 disabled:opacity-50"
              >
                <Send className="h-5 w-5" />
                {requesting ? t("sending") : t("requestViewing")}
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
