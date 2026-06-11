"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  CheckCheck,
  CalendarCheck,
  XCircle,
  CheckCircle2,
  Home,
  Clock,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Notification = {
  id: string;
  user_id: string;
  title: string | null;
  body: string | null;
  link: string | null;
  type: string | null;
  is_read: boolean;
  created_at: string;
};

export default function NotificationsPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  useEffect(() => {
    loadNotifications();

    const channel = supabase
      .channel("notifications-live")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
        },
        () => loadNotifications()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadNotifications() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/auth");
      return;
    }

    const { data, error } = await supabase
      .from("notifications")
      .select("id, user_id, title, body, link, type, is_read, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      setNotifications([]);
      setLoading(false);
      return;
    }

    setNotifications((data || []) as Notification[]);
    setLoading(false);
  }

  async function markAsRead(id: string) {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    setNotifications((prev) =>
      prev.map((item) => (item.id === id ? { ...item, is_read: true } : item))
    );
  }

  async function markAllRead() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("is_read", false);

    await loadNotifications();
  }

  function formatDate(date: string) {
    return new Date(date).toLocaleString("en-CA", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function getIcon(type: string | null) {
    if (type === "viewing_confirmed") {
      return <CheckCircle2 className="h-5 w-5 text-emerald-300" />;
    }

    if (type === "viewing_declined" || type === "viewing_cancelled") {
      return <XCircle className="h-5 w-5 text-red-300" />;
    }

    if (type === "viewing_completed") {
      return <Home className="h-5 w-5 text-blue-300" />;
    }

    if (type?.includes("viewing")) {
      return <CalendarCheck className="h-5 w-5 text-yellow-300" />;
    }

    return <Bell className="h-5 w-5 text-zinc-300" />;
  }

  const unreadCount = notifications.filter((item) => !item.is_read).length;

  const filteredNotifications =
    filter === "unread"
      ? notifications.filter((item) => !item.is_read)
      : notifications;

  if (loading) {
    return (
      <main className="min-h-screen bg-black px-6 py-10 text-white">
        Loading notifications...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-6 py-10 text-white">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">
              Notifications
            </h1>

            <p className="mt-2 text-zinc-400">
              Booking updates, viewing approvals, cancellations, and address
              unlocks.
            </p>
          </div>

          <button
            onClick={markAllRead}
            disabled={unreadCount === 0}
            className="flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <CheckCheck className="h-5 w-5" />
            Mark all read
          </button>
        </div>

        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-3xl border border-white/10 bg-zinc-950 p-5">
            <p className="text-sm text-zinc-400">Total</p>
            <p className="mt-2 text-3xl font-bold">{notifications.length}</p>
          </div>

          <div className="rounded-3xl border border-red-500/20 bg-red-500/10 p-5">
            <p className="text-sm text-red-200">Unread</p>
            <p className="mt-2 text-3xl font-bold text-red-300">
              {unreadCount}
            </p>
          </div>

          <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-5">
            <p className="text-sm text-emerald-200">Read</p>
            <p className="mt-2 text-3xl font-bold text-emerald-300">
              {notifications.length - unreadCount}
            </p>
          </div>
        </div>

        <div className="mb-6 flex gap-3">
          <button
            onClick={() => setFilter("all")}
            className={`rounded-2xl px-5 py-3 text-sm font-semibold transition ${
              filter === "all"
                ? "bg-white text-black"
                : "border border-zinc-700 text-white hover:bg-white/10"
            }`}
          >
            All
          </button>

          <button
            onClick={() => setFilter("unread")}
            className={`rounded-2xl px-5 py-3 text-sm font-semibold transition ${
              filter === "unread"
                ? "bg-white text-black"
                : "border border-zinc-700 text-white hover:bg-white/10"
            }`}
          >
            Unread
          </button>
        </div>

        {filteredNotifications.length === 0 ? (
          <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-10 text-center">
            <Bell className="mx-auto h-10 w-10 text-zinc-600" />

            <p className="mt-4 text-lg font-semibold text-zinc-300">
              No notifications here
            </p>

            <p className="mt-2 text-sm text-zinc-500">
              Booking and viewing updates will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredNotifications.map((notification) => (
              <Link
                key={notification.id}
                href={notification.link || "/dashboard"}
                onClick={() => markAsRead(notification.id)}
                className={`block rounded-3xl border p-5 transition hover:bg-zinc-900 ${
                  notification.is_read
                    ? "border-zinc-800 bg-zinc-950"
                    : "border-red-500/30 bg-red-500/10"
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className="rounded-2xl border border-white/10 bg-black p-3">
                    {getIcon(notification.type)}
                  </div>

                  <div className="flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h2 className="text-lg font-semibold">
                        {notification.title || "Notification"}
                      </h2>

                      <div className="flex items-center gap-2 text-xs text-zinc-500">
                        <Clock className="h-4 w-4" />
                        {formatDate(notification.created_at)}
                      </div>
                    </div>

                    <p className="mt-2 text-sm leading-6 text-zinc-400">
                      {notification.body || "You have a new update."}
                    </p>

                    {!notification.is_read && (
                      <span className="mt-4 inline-flex rounded-full bg-red-500 px-3 py-1 text-xs font-semibold text-white">
                        New
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}