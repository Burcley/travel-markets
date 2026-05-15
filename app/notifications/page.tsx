"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Notification = {
  id: string;
  user_id: string;
  title: string | null;
  body: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
};

export default function NotificationsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadNotifications();
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

    const { data } = await supabase
      .from("notifications")
      .select("id, user_id, title, body, link, is_read, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    setNotifications((data || []) as Notification[]);
    setLoading(false);
  }

  async function markAsRead(id: string) {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    await loadNotifications();
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

  if (loading) {
    return (
      <main className="min-h-screen bg-black px-6 py-10 text-white">
        Loading notifications...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-6 py-10 text-white">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Notifications</h1>
            <p className="mt-2 text-zinc-400">All your latest updates.</p>
          </div>

          <button
            onClick={markAllRead}
            className="rounded-xl bg-white px-5 py-3 font-semibold text-black"
          >
            Mark all read
          </button>
        </div>

        {notifications.length === 0 ? (
          <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-8 text-center text-zinc-400">
            No notifications yet.
          </div>
        ) : (
          <div className="space-y-4">
            {notifications.map((notification) => (
              <Link
                key={notification.id}
                href={notification.link || "/dashboard"}
                onClick={() => markAsRead(notification.id)}
                className={`block rounded-2xl border p-5 transition hover:bg-zinc-900 ${
                  notification.is_read
                    ? "border-zinc-800 bg-zinc-950"
                    : "border-red-500/30 bg-red-500/10"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold">
                      {notification.title || "Notification"}
                    </h2>
                    <p className="mt-2 text-sm text-zinc-400">
                      {notification.body || "You have a new update."}
                    </p>
                  </div>

                  {!notification.is_read && (
                    <span className="rounded-full bg-red-500 px-3 py-1 text-xs font-semibold text-white">
                      New
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}