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
        title: "Viewing confirmed",
        message:
          "Your viewing request was accepted. Check the listing page for the unlocked address.",
        type: "viewing_confirmed",
        link: `/listings/${viewing.listing_id}`,
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
    if (status === "accepted") return "bg-green-500/15 text-green-300";
    if (status === "declined") return "bg-red-500/15 text-red-300";
    if (status === "completed") return "bg-blue-500/15 text-blue-300";
    return "bg-yellow-500/15 text-yellow-300";
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
        <div className="mx-auto max-w-2xl rounded-2xl border border-red-800 bg-red-950/40 p-6">
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
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Viewing Appointments</h1>
            <p className="mt-1 text-zinc-400">
              Manage viewing requests and confirmations.
            </p>
          </div>

          <Link
            href="/listings"
            className="rounded-xl border border-zinc-700 px-5 py-3 text-sm font-semibold hover:bg-white/10"
          >
            Browse Listings
          </Link>
        </div>

        {error && (
          <div className="mt-6 rounded-xl border border-red-900 bg-red-950/40 p-4 text-red-300">
            {error}
          </div>
        )}

        {viewings.length === 0 ? (
          <p className="mt-6 text-zinc-400">No viewing appointments.</p>
        ) : (
          <div className="mt-6 space-y-5">
            {viewings.map((viewing) => {
              const isOwner = viewing.owner_id === userId;

              return (
                <div
                  key={viewing.id}
                  className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6"
                >
                  <div className="flex justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-semibold">
                        Viewing Request
                      </h2>
                      <p className="mt-2 text-sm text-zinc-400">
                        {viewing.requested_date} — {viewing.requested_time}
                      </p>
                    </div>

                    <span
                      className={`h-fit rounded-full px-3 py-1 text-xs capitalize ${statusClass(
                        viewing.status
                      )}`}
                    >
                      {viewing.status}
                    </span>
                  </div>

                  {viewing.note && (
                    <p className="mt-4 rounded-2xl border border-zinc-800 bg-black p-4 text-sm text-zinc-400">
                      {viewing.note}
                    </p>
                  )}

                  <div className="mt-5 flex flex-wrap gap-3 text-sm">
                    <Link
                      href={`/messages/${viewing.inquiry_id}`}
                      className="rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-blue-300"
                    >
                      Chat
                    </Link>

                    <Link
                      href={`/listings/${viewing.listing_id}`}
                      className="rounded-xl border border-zinc-700 px-4 py-2 text-white hover:bg-white/10"
                    >
                      Listing
                    </Link>
                  </div>

                  {isOwner && viewing.status === "accepted" && (
                    <button
                      onClick={() => updateViewingStatus(viewing, "completed")}
                      disabled={updatingId === viewing.id}
                      className="mt-4 w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white disabled:bg-zinc-600"
                    >
                      {updatingId === viewing.id
                        ? "Completing..."
                        : "Mark as Completed"}
                    </button>
                  )}

                  {isOwner && viewing.status === "pending" && (
                    <div className="mt-4 flex gap-3">
                      <button
                        onClick={() => updateViewingStatus(viewing, "accepted")}
                        disabled={updatingId === viewing.id}
                        className="w-full rounded-xl bg-white px-4 py-3 font-semibold text-black disabled:bg-zinc-600"
                      >
                        {updatingId === viewing.id ? "Updating..." : "Accept"}
                      </button>

                      <button
                        onClick={() => updateViewingStatus(viewing, "declined")}
                        disabled={updatingId === viewing.id}
                        className="w-full rounded-xl bg-red-600 px-4 py-3 font-semibold text-white disabled:bg-zinc-600"
                      >
                        {updatingId === viewing.id ? "Updating..." : "Decline"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}