"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Logo from "@/components/logo";

type Notification = {
  id: string;
  user_id: string;
  inquiry_id: string | null;
  type: string | null;
  title: string | null;
  body: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
};

const navLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/profile", label: "Profile" },
  { href: "/my-listings", label: "My Listings" },
  { href: "/saved-listings", label: "Saved Listings" },
  { href: "/messages", label: "Messages" },
  { href: "/viewings", label: "Viewings" },
];

export default function Navbar() {
  const supabase = createClient();
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const [open, setOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userId, setUserId] = useState("");
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  async function loadData() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setUserId("");
      setNotifications([]);
      setUnreadNotifications(0);
      setUnreadMessages(0);
      return;
    }

    setUserId(user.id);

    const { count } = await supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .eq("receiver_id", user.id)
      .is("read_at", null);

    setUnreadMessages(count || 0);

    const { data } = await supabase
      .from("notifications")
      .select("id, user_id, inquiry_id, type, title, body, link, is_read, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10);

    const list = (data || []) as Notification[];

    setNotifications(list);
    setUnreadNotifications(list.filter((n) => !n.is_read).length);
  }

  async function markAsRead(id: string) {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    await loadData();
  }

  async function markAllRead() {
    if (!userId) return;

    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", userId)
      .eq("is_read", false);

    await loadData();
  }

  function getNotificationLink(notification: Notification) {
    if (notification.link) return notification.link;

    if (
      (notification.type === "new_message" ||
        notification.type === "inquiry_accepted") &&
      notification.inquiry_id
    ) {
      return `/messages/${notification.inquiry_id}`;
    }

    if (notification.type === "new_inquiry") return "/inquiries/received";
    if (notification.type === "viewing_requested") return "/viewings";

    return "/notifications";
  }

  function formatNotificationTime(date: string) {
    return new Date(date).toLocaleDateString("en-CA", {
      month: "short",
      day: "numeric",
    });
  }

  useEffect(() => {
    loadData();

    const notificationChannel = supabase
      .channel("navbar-notifications")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications" },
        loadData
      )
      .subscribe();

    const messageChannel = supabase
      .channel("navbar-messages")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        loadData
      )
      .subscribe();

    return () => {
      supabase.removeChannel(notificationChannel);
      supabase.removeChannel(messageChannel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function closeDropdown(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", closeDropdown);

    return () => {
      document.removeEventListener("mousedown", closeDropdown);
    };
  }, []);

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-800 bg-black/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
        <div className="flex items-center gap-8">
          <Logo />

          <nav className="hidden items-center gap-6 text-sm text-zinc-400 lg:flex">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="whitespace-nowrap hover:text-white"
              >
                {link.label === "Messages" ? (
                  <>
                    Messages
                    {unreadMessages > 0 && (
                      <span className="ml-2 rounded-full bg-red-500 px-2 py-0.5 text-xs text-white">
                        {unreadMessages}
                      </span>
                    )}
                  </>
                ) : (
                  link.label
                )}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setOpen((current) => !current)}
              className="relative rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-white hover:bg-zinc-900"
            >
              🔔
              {unreadNotifications > 0 && (
                <span className="absolute -right-2 -top-2 rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">
                  {unreadNotifications}
                </span>
              )}
            </button>

            {open && (
              <div className="absolute right-0 z-50 mt-3 w-[340px] overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl sm:w-96">
                <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
                  <div>
                    <p className="font-semibold text-white">Notifications</p>
                    <p className="text-xs text-zinc-500">
                      {unreadNotifications} unread
                    </p>
                  </div>

                  {unreadNotifications > 0 && (
                    <button
                      onClick={markAllRead}
                      className="text-xs font-medium text-zinc-400 hover:text-white"
                    >
                      Mark all read
                    </button>
                  )}
                </div>

                {notifications.length === 0 ? (
                  <div className="p-6 text-center">
                    <p className="text-sm text-zinc-400">
                      No notifications yet.
                    </p>
                  </div>
                ) : (
                  <div className="max-h-[420px] overflow-y-auto">
                    {notifications.map((notification) => (
                      <Link
                        key={notification.id}
                        href={getNotificationLink(notification)}
                        onClick={async () => {
                          await markAsRead(notification.id);
                          setOpen(false);
                        }}
                        className={`block border-b border-zinc-900 px-4 py-4 transition hover:bg-zinc-900 ${
                          !notification.is_read ? "bg-white/[0.04]" : ""
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex gap-3">
                            <div
                              className={`mt-1 h-2.5 w-2.5 rounded-full ${
                                notification.is_read
                                  ? "bg-zinc-700"
                                  : "bg-red-500"
                              }`}
                            />

                            <div>
                              <p className="text-sm font-semibold text-white">
                                {notification.title || "Notification"}
                              </p>
                              <p className="mt-1 line-clamp-2 text-xs leading-5 text-zinc-400">
                                {notification.body || "You have a new update."}
                              </p>
                            </div>
                          </div>

                          <span className="shrink-0 text-[11px] text-zinc-500">
                            {formatNotificationTime(notification.created_at)}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}

                <div className="border-t border-zinc-800 p-3">
                  <Link
                    href="/notifications"
                    onClick={() => setOpen(false)}
                    className="block rounded-xl border border-zinc-800 px-4 py-3 text-center text-sm font-semibold text-zinc-300 hover:bg-zinc-900"
                  >
                    View all notifications
                  </Link>
                </div>
              </div>
            )}
          </div>

          <Link
            href="/post"
            className="hidden rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-zinc-200 md:block"
          >
            Post Listing
          </Link>

          <button
            onClick={() => setMobileOpen((current) => !current)}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950 text-xl text-white hover:bg-zinc-900 lg:hidden"
          >
            {mobileOpen ? "×" : "☰"}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-zinc-800 bg-black px-4 py-4 lg:hidden">
          <div className="mx-auto max-w-7xl rounded-2xl border border-zinc-800 bg-zinc-950 p-3 shadow-2xl">
            <div className="grid gap-2">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center justify-between rounded-xl px-4 py-3 text-sm font-semibold text-zinc-300 hover:bg-zinc-900 hover:text-white"
                >
                  <span>{link.label}</span>

                  {link.label === "Messages" && unreadMessages > 0 && (
                    <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs text-white">
                      {unreadMessages}
                    </span>
                  )}
                </Link>
              ))}

              <Link
                href="/post"
                onClick={() => setMobileOpen(false)}
                className="mt-2 rounded-xl bg-white px-4 py-3 text-center text-sm font-bold text-black hover:bg-zinc-200"
              >
                Post Listing
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}