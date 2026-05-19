"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Viewing = {
  id: string;
  inquiry_id: string;
  listing_id: string;
  owner_id: string;
  requester_id: string;
  requested_date: string;
  requested_time: string;
  note: string | null;
  status: "pending" | "accepted" | "declined" | "completed";
  created_at: string;
};

export default function ViewingsPage() {
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
        {
          event: "*",
          schema: "public",
          table: "viewings",
        },
        () => loadViewings()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function loadViewings() {
    setLoading(true);
    setError("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("You must be logged in.");
      setLoading(false);
      return;
    }

    setUserId(user.id);

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, status")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.role === "banned" || profile?.status === "banned") {
      setIsBanned(true);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("viewings")
      .select("*")
      .or(`owner_id.eq.${user.id},requester_id.eq.${user.id}`)
      .order("created_at", { ascending: false });

    if (error) {
      setError(error.message);
      setViewings([]);
    } else {
      setViewings((data || []) as Viewing[]);
    }

    setLoading(false);
  }

  async function updateViewingStatus(
    viewing: Viewing,
    status: "accepted" | "declined" | "completed"
  ) {
    setUpdatingId(viewing.id);

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
        type: "viewing_confirmed",
        link: `/address-unlocked/${viewing.listing_id}`,
      });
    }

    if (status === "declined") {
      await supabase.from("notifications").insert({
        user_id: viewing.requester_id,
        title: "Viewing declined",
        message: "The owner declined your viewing request.",
        type: "viewing_declined",
        link: `/viewings`,
      });
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
        type: "viewing_completed",
        link: `/listings/${viewing.listing_id}`,
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

  if (loading) {
    return (
      <main className="min-h-screen bg-black px-6 py-10 text-white">
        Loading viewings...
      </main>
    );
  }

  if (isBanned) {
    return (
      <main className="min-h-screen bg-black px-6 py-10 text-white">
        <div className="mx-auto max-w-2xl rounded-3xl border border-red-800 bg-red-950/40 p-6">
          <h1 className="text-2xl font-bold text-red-300">
            Account Restricted
          </h1>

          <p className="mt-3 text-red-200">
            You cannot access viewing appointments.
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
              Viewing Appointments
            </h1>

            <p className="mt-2 text-zinc-400">
              Manage approvals, address unlocks, and completed property tours.
            </p>
          </div>

          <Link
            href="/listings"
            className="rounded-2xl border border-zinc-700 px-5 py-3 text-sm font-semibold transition hover:bg-white/10"
          >
            Browse Listings
          </Link>
        </div>

        {error && (
          <div className="mt-6 rounded-2xl border border-red-900 bg-red-950/40 p-4 text-red-300">
            {error}
          </div>
        )}

        {viewings.length === 0 ? (
          <div className="mt-10 rounded-3xl border border-zinc-800 bg-zinc-950 p-10 text-center">
            <p className="text-zinc-400">No viewing appointments yet.</p>
          </div>
        ) : (
          <div className="mt-8 space-y-6">
            {viewings.map((viewing) => {
              const isOwner = viewing.owner_id === userId;
              const isRequester = viewing.requester_id === userId;

              return (
                <div
                  key={viewing.id}
                  className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950"
                >
                  {viewing.status === "accepted" && (
                    <div className="border-b border-emerald-500/20 bg-emerald-500/10 px-6 py-4">
                      <p className="font-semibold text-emerald-300">
                        Viewing Approved
                      </p>

                      <p className="mt-1 text-sm text-emerald-200/80">
                        Secure address access is now unlocked for the approved
                        user.
                      </p>
                    </div>
                  )}

                  <div className="p-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h2 className="text-xl font-semibold">
                          Property Viewing
                        </h2>

                        <p className="mt-2 text-zinc-400">
                          {viewing.requested_date} at{" "}
                          {viewing.requested_time}
                        </p>
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

                    <div className="mt-6 flex flex-wrap gap-3">
                      <Link
                        href={`/messages/${viewing.inquiry_id}`}
                        className="rounded-xl border border-blue-500/20 bg-blue-500/10 px-4 py-2 text-sm font-semibold text-blue-300 transition hover:bg-blue-500/20"
                      >
                        Open Chat
                      </Link>

                      <Link
                        href={`/listings/${viewing.listing_id}`}
                        className="rounded-xl border border-zinc-700 px-4 py-2 text-sm font-semibold transition hover:bg-white/10"
                      >
                        View Listing
                      </Link>

                      {viewing.status === "accepted" && isRequester && (
                        <Link
                          href={`/address-unlocked/${viewing.listing_id}`}
                          className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold text-black transition hover:bg-emerald-400"
                        >
                          View Unlocked Address
                        </Link>
                      )}
                    </div>

                    {isOwner && viewing.status === "pending" && (
                      <div className="mt-6 flex gap-3">
                        <button
                          onClick={() =>
                            updateViewingStatus(viewing, "accepted")
                          }
                          disabled={updatingId === viewing.id}
                          className="w-full rounded-2xl bg-white px-4 py-3 font-semibold text-black transition hover:bg-zinc-200 disabled:bg-zinc-600"
                        >
                          {updatingId === viewing.id
                            ? "Updating..."
                            : "Accept Viewing"}
                        </button>

                        <button
                          onClick={() =>
                            updateViewingStatus(viewing, "declined")
                          }
                          disabled={updatingId === viewing.id}
                          className="w-full rounded-2xl bg-red-600 px-4 py-3 font-semibold text-white transition hover:bg-red-500 disabled:bg-zinc-600"
                        >
                          {updatingId === viewing.id
                            ? "Updating..."
                            : "Decline"}
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
                          ? "Completing..."
                          : "Mark Viewing as Completed"}
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