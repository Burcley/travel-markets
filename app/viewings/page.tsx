"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Calendar,
  Clock,
  Home,
  Lock,
  MessageCircle,
  XCircle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type ViewingStatus = "pending" | "accepted" | "declined" | "completed";

type Viewing = {
  id: string;
  inquiry_id: string | null;
  listing_id: string;
  owner_id: string;
  requester_id: string;
  slot_id: string | null;
  requested_date: string | null;
  requested_time: string | null;
  note: string | null;
  status: ViewingStatus;
  created_at: string;
  viewing_slot?: {
    id: string;
    slot_date: string;
    start_time: string;
    end_time: string;
  } | null;
  listing?: {
    id: string;
    title: string | null;
    address: string | null;
    city: string | null;
    campus: string | null;
  } | null;
};

export default function ViewingsPage() {
  const t = useTranslations("viewings.list");
  const supabase = useMemo(() => createClient(), []);

  const [userId, setUserId] = useState("");
  const [isBanned, setIsBanned] = useState(false);
  const [viewings, setViewings] = useState<Viewing[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    loadViewings();

    const channel = supabase
      .channel("viewings-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "viewings" },
        () => loadViewings()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadViewings() {
    setLoading(true);
    setError("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError(t("mustBeLoggedIn"));
      setLoading(false);
      return;
    }

    setUserId(user.id);

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, status, account_status")
      .eq("id", user.id)
      .maybeSingle();

    if (
      profile?.role === "banned" ||
      profile?.status === "banned" ||
      profile?.account_status === "banned" ||
      profile?.account_status === "suspended"
    ) {
      setIsBanned(true);
      setLoading(false);
      return;
    }

    const { data: viewingData, error: viewingError } = await supabase
      .from("viewings")
      .select("*")
      .or(`owner_id.eq.${user.id},requester_id.eq.${user.id}`)
      .order("created_at", { ascending: false });

    if (viewingError) {
      setError(viewingError.message);
      setViewings([]);
      setLoading(false);
      return;
    }

    const baseViewings = (viewingData || []) as Viewing[];

    const slotIds = baseViewings
      .map((viewing) => viewing.slot_id)
      .filter(Boolean) as string[];

    const listingIds = baseViewings
      .map((viewing) => viewing.listing_id)
      .filter(Boolean);

    let slots: any[] = [];
    let listings: any[] = [];

    if (slotIds.length > 0) {
      const { data: slotData } = await supabase
        .from("viewing_slots")
        .select("id, slot_date, start_time, end_time")
        .in("id", slotIds);

      slots = slotData || [];
    }

    if (listingIds.length > 0) {
      const { data: listingData } = await supabase
        .from("listings")
        .select("id, title, address, city, campus")
        .in("id", listingIds);

      listings = listingData || [];
    }

    const merged = baseViewings.map((viewing) => ({
      ...viewing,
      viewing_slot: slots.find((slot) => slot.id === viewing.slot_id) || null,
      listing:
        listings.find((listing) => listing.id === viewing.listing_id) || null,
    }));

    setViewings(merged);
    setLoading(false);
  }

  async function sendViewingApprovedEmail(viewingId: string) {
    try {
      const response = await fetch("/api/emails/viewing-approved", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ viewingId }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        console.error("VIEWING APPROVED EMAIL API ERROR:", data);
      }
    } catch (error) {
      console.error("VIEWING APPROVED EMAIL FETCH ERROR:", error);
    }
  }

  async function sendViewingDeclinedEmail(viewingId: string) {
    try {
      const response = await fetch("/api/emails/viewing-declined", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ viewingId }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        console.error("VIEWING DECLINED EMAIL API ERROR:", data);
      }
    } catch (error) {
      console.error("VIEWING DECLINED EMAIL FETCH ERROR:", error);
    }
  }

  async function cancelViewing(viewing: Viewing) {
    const confirmCancel = confirm(t("confirmCancel"));
    if (!confirmCancel) return;

    setUpdatingId(viewing.id);

    const { error: cancelError } = await supabase.rpc(
      "cancel_viewing_and_reopen_slot",
      {
        p_viewing_id: viewing.id,
      }
    );

    if (cancelError) {
      alert(cancelError.message);
      setUpdatingId("");
      return;
    }

    await supabase.from("notifications").insert({
      user_id: viewing.owner_id,
      title: "Viewing cancelled",
      message: "A student cancelled their viewing request.",
      body: "A student cancelled their viewing request.",
      type: "viewing_cancelled",
      link: `/viewings`,
      is_read: false,
    });

    await loadViewings();
    setUpdatingId("");
  }

  async function updateViewingStatus(
    viewing: Viewing,
    status: "accepted" | "declined" | "completed"
  ) {
    setUpdatingId(viewing.id);

    if (status === "declined") {
      const { error: declineError } = await supabase.rpc(
        "decline_viewing_and_reopen_slot",
        {
          p_viewing_id: viewing.id,
        }
      );

      if (declineError) {
        alert(declineError.message);
        setUpdatingId("");
        return;
      }

      await supabase.from("notifications").insert({
        user_id: viewing.requester_id,
        title: "Viewing declined",
        message: "The owner declined your viewing request.",
        body: "The owner declined your viewing request.",
        type: "viewing_declined",
        link: `/viewings`,
        is_read: false,
      });

      await sendViewingDeclinedEmail(viewing.id);

      await loadViewings();
      setUpdatingId("");
      return;
    }

    const { error } = await supabase
      .from("viewings")
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", viewing.id);

    if (error) {
      alert(error.message);
      setUpdatingId("");
      return;
    }

    if (status === "accepted") {
      await supabase.from("notifications").insert({
        user_id: viewing.requester_id,
        title: "Viewing approved",
        message:
          "Your viewing request was approved. Your address has now been unlocked.",
        body:
          "Your viewing request was approved. Your address has now been unlocked.",
        type: "viewing_confirmed",
        link: `/address-unlocked/${viewing.listing_id}`,
        is_read: false,
      });

      await sendViewingApprovedEmail(viewing.id);
    }

    if (status === "completed") {
      const { error: listingError } = await supabase
        .from("listings")
        .update({ status: "rented" })
        .eq("id", viewing.listing_id);

      if (listingError) {
        alert(listingError.message);
        setUpdatingId("");
        return;
      }

      await supabase.from("notifications").insert({
        user_id: viewing.requester_id,
        title: "Viewing completed",
        message: "The viewing was marked as completed.",
        body: "The viewing was marked as completed.",
        type: "viewing_completed",
        link: `/listings/${viewing.listing_id}`,
        is_read: false,
      });
    }

    await loadViewings();
    setUpdatingId("");
  }

  function statusClass(status: string) {
    if (status === "accepted") {
      return "bg-emerald-500/15 text-emerald-300 border border-emerald-500/20";
    }

    if (status === "declined") {
      return "bg-red-500/15 text-red-300 border border-red-500/20";
    }

    if (status === "completed") {
      return "bg-blue-500/15 text-blue-300 border border-blue-500/20";
    }

    return "bg-yellow-500/15 text-yellow-300 border border-yellow-500/20";
  }

  function getViewingDate(viewing: Viewing) {
    return (
      viewing.viewing_slot?.slot_date ||
      viewing.requested_date ||
      t("dateUnavailable")
    );
  }

  function getViewingTime(viewing: Viewing) {
    const start = viewing.viewing_slot?.start_time || viewing.requested_time;
    const end = viewing.viewing_slot?.end_time;

    if (start && end) return `${start.slice(0, 5)} - ${end.slice(0, 5)}`;
    if (start) return start.slice(0, 5);

    return t("timeUnavailable");
  }

  function getListingTitle(viewing: Viewing) {
    return viewing.listing?.title || t("propertyViewing");
  }

  function getLocationText(viewing: Viewing) {
    const parts = [viewing.listing?.city, viewing.listing?.campus].filter(
      Boolean
    );

    return parts.length > 0 ? parts.join(" • ") : t("locationNotAdded");
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black px-6 py-10 text-white">
        {t("loading")}
      </main>
    );
  }

  if (isBanned) {
    return (
      <main className="min-h-screen bg-black px-6 py-10 text-white">
        <div className="mx-auto max-w-2xl rounded-3xl border border-red-800 bg-red-950/40 p-6">
          <h1 className="text-2xl font-bold text-red-300">
            {t("accountRestricted")}
          </h1>
          <p className="mt-3 text-red-200">
            {t("restrictedText")}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-6 py-10 text-white">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">
              {t("title")}
            </h1>
            <p className="mt-2 text-zinc-400">
              {t("subtitle")}
            </p>
          </div>

          <Link
            href="/"
            className="rounded-2xl border border-zinc-700 px-5 py-3 text-sm font-semibold transition hover:bg-white/10"
          >
            {t("browseListings")}
          </Link>
        </div>

        {error && (
          <div className="mt-6 rounded-2xl border border-red-900 bg-red-950/40 p-4 text-red-300">
            {error}
          </div>
        )}

        {viewings.length === 0 ? (
          <div className="mt-10 rounded-3xl border border-zinc-800 bg-zinc-950 p-10 text-center">
            <p className="text-zinc-400">{t("empty")}</p>
          </div>
        ) : (
          <div className="mt-8 space-y-6">
            {viewings.map((viewing) => {
              const isOwner = viewing.owner_id === userId;
              const isRequester = viewing.requester_id === userId;

              return (
                <div
                  key={viewing.id}
                  className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950 shadow-2xl"
                >
                  {viewing.status === "accepted" && (
                    <div className="border-b border-emerald-500/20 bg-emerald-500/10 px-6 py-4">
                      <p className="font-semibold text-emerald-300">
                        {t("approvedTitle")}
                      </p>
                      <p className="mt-1 text-sm text-emerald-200/80">
                        {t("approvedText")}
                      </p>
                    </div>
                  )}

                  {viewing.status === "declined" && (
                    <div className="border-b border-red-500/20 bg-red-500/10 px-6 py-4">
                      <p className="font-semibold text-red-300">
                        {t("declinedTitle")}
                      </p>
                      <p className="mt-1 text-sm text-red-200/80">
                        {t("declinedText")}
                      </p>
                    </div>
                  )}

                  <div className="p-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h2 className="text-xl font-semibold">
                          {getListingTitle(viewing)}
                        </h2>

                        <div className="mt-4 grid gap-3 text-sm text-zinc-300 sm:grid-cols-3">
                          <div className="rounded-2xl border border-zinc-800 bg-black p-4">
                            <p className="flex items-center gap-2 font-semibold text-white">
                              <Calendar className="h-4 w-4" />
                              {t("date")}
                            </p>
                            <p className="mt-2 text-zinc-400">
                              {getViewingDate(viewing)}
                            </p>
                          </div>

                          <div className="rounded-2xl border border-zinc-800 bg-black p-4">
                            <p className="flex items-center gap-2 font-semibold text-white">
                              <Clock className="h-4 w-4" />
                              {t("time")}
                            </p>
                            <p className="mt-2 text-zinc-400">
                              {getViewingTime(viewing)}
                            </p>
                          </div>

                          <div className="rounded-2xl border border-zinc-800 bg-black p-4">
                            <p className="flex items-center gap-2 font-semibold text-white">
                              <Home className="h-4 w-4" />
                              {t("location")}
                            </p>
                            <p className="mt-2 text-zinc-400">
                              {getLocationText(viewing)}
                            </p>
                          </div>
                        </div>
                      </div>

                      <span
                        className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide ${statusClass(
                          viewing.status
                        )}`}
                      >
                        {viewing.status}
                      </span>
                    </div>

                    {viewing.note && (
                      <div className="mt-5 rounded-2xl border border-zinc-800 bg-black/40 p-5">
                        <p className="text-sm leading-relaxed text-zinc-300">
                          {viewing.note}
                        </p>
                      </div>
                    )}

                    {viewing.status === "accepted" && isRequester && (
                      <div className="mt-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-5">
                        <p className="flex items-center gap-2 font-semibold text-emerald-300">
                          <Lock className="h-4 w-4" />
                          {t("addressUnlocked")}
                        </p>
                        <p className="mt-2 text-sm text-emerald-100/80">
                          {t("addressUnlockedText")}
                        </p>
                      </div>
                    )}

                    <div className="mt-6 flex flex-wrap gap-3">
                      {viewing.inquiry_id && (
                        <Link
                          href={`/messages/${viewing.inquiry_id}`}
                          className="flex items-center gap-2 rounded-xl border border-blue-500/20 bg-blue-500/10 px-4 py-2 text-sm font-semibold text-blue-300 transition hover:bg-blue-500/20"
                        >
                          <MessageCircle className="h-4 w-4" />
                          {t("openChat")}
                        </Link>
                      )}

                      <Link
                        href={`/listings/${viewing.listing_id}`}
                        className="rounded-xl border border-zinc-700 px-4 py-2 text-sm font-semibold transition hover:bg-white/10"
                      >
                        {t("viewListing")}
                      </Link>

                      {viewing.status === "accepted" && isRequester && (
                        <Link
                          href={`/address-unlocked/${viewing.listing_id}`}
                          className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold text-black transition hover:bg-emerald-400"
                        >
                          {t("viewUnlockedAddress")}
                        </Link>
                      )}

                      {isRequester && viewing.status === "pending" && (
                        <button
                          onClick={() => cancelViewing(viewing)}
                          disabled={updatingId === viewing.id}
                          className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-300 transition hover:bg-red-500/20 disabled:opacity-50"
                        >
                          <XCircle className="h-4 w-4" />
                          {updatingId === viewing.id
                            ? t("cancelling")
                            : t("cancelViewing")}
                        </button>
                      )}
                    </div>

                    {isOwner && viewing.status === "pending" && (
                      <div className="mt-6 grid gap-3 sm:grid-cols-2">
                        <button
                          onClick={() =>
                            updateViewingStatus(viewing, "accepted")
                          }
                          disabled={updatingId === viewing.id}
                          className="w-full rounded-2xl bg-white px-4 py-3 font-semibold text-black transition hover:bg-zinc-200 disabled:bg-zinc-600"
                        >
                          {updatingId === viewing.id
                            ? t("updating")
                            : t("acceptViewing")}
                        </button>

                        <button
                          onClick={() =>
                            updateViewingStatus(viewing, "declined")
                          }
                          disabled={updatingId === viewing.id}
                          className="w-full rounded-2xl bg-red-600 px-4 py-3 font-semibold text-white transition hover:bg-red-500 disabled:bg-zinc-600"
                        >
                          {updatingId === viewing.id ? t("updating") : t("decline")}
                        </button>
                      </div>
                    )}

                    {isOwner && viewing.status === "accepted" && (
                      <button
                        onClick={() =>
                          updateViewingStatus(viewing, "completed")
                        }
                        disabled={updatingId === viewing.id}
                        className="mt-6 w-full rounded-2xl bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-500 disabled:bg-zinc-600"
                      >
                        {updatingId === viewing.id
                          ? t("completing")
                          : t("markCompleted")}
                      </button>
                    )}
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
