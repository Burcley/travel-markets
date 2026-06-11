"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Logo from "@/components/logo";

type Notification = {
  id: string;
  user_id: string;
  inquiry_id?: string | null;
  type?: string | null;
  title?: string | null;
  body?: string | null;
  message?: string | null;
  link?: string | null;
  is_read?: boolean | null;
  created_at: string;
};

type Profile = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
};

const navLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/inquiries", label: "Inquiries" },
  { href: "/my-listings", label: "My Listings" },
  { href: "/saved-listings", label: "Saved" },
  { href: "/saved-searches", label: "Searches" },
  { href: "/recently-viewed", label: "Viewed" },
  { href: "/messages", label: "Messages" },
  { href: "/viewings", label: "Viewings" },
];

const accountLinks = [
  { href: "/profile", label: "Profile" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/inquiries", label: "Inquiries" },
  { href: "/saved-searches", label: "Saved Searches" },
  { href: "/recently-viewed", label: "Recently Viewed" },
  { href: "/verify-identity", label: "Verify Identity" },
];

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  const notificationRef = useRef<HTMLDivElement | null>(null);
  const accountRef = useRef<HTMLDivElement | null>(null);

  const [open, setOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const [userId, setUserId] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);

  const [unreadMessages, setUnreadMessages] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [loggingOut, setLoggingOut] = useState(false);

  const displayName =
    profile?.full_name?.trim() || userEmail?.split("@")[0] || "User";

  const avatarLetter = displayName.charAt(0).toUpperCase();

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  async function loadData() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setUserId("");
      setUserEmail("");
      setProfile(null);
      setNotifications([]);
      setUnreadNotifications(0);
      setUnreadMessages(0);
      return;
    }

    setUserId(user.id);
    setUserEmail(user.email || "");

    const { data: profileData } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url")
      .eq("id", user.id)
      .maybeSingle();

    setProfile((profileData as Profile) || null);

    const { count } = await supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .eq("receiver_id", user.id)
      .is("read_at", null);

    setUnreadMessages(count || 0);

    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(15);

    if (error) {
      console.error("NAVBAR NOTIFICATIONS ERROR:", error);
      setNotifications([]);
      setUnreadNotifications(0);
      return;
    }

    const list = (data || []) as Notification[];

    setNotifications(list);
    setUnreadNotifications(list.filter((n) => !n.is_read).length);
  }

  async function handleLogout() {
    try {
      setLoggingOut(true);

      await supabase.auth.signOut();

      setOpen(false);
      setAccountOpen(false);
      setMobileOpen(false);

      router.push("/auth");
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
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
    const type = (notification.type || "").toLowerCase();
    const title = (notification.title || "").toLowerCase();
    const text = `${notification.body || ""} ${
      notification.message || ""
    }`.toLowerCase();
    const savedLink = notification.link || "";

    // Owner-side inquiry notification must ALWAYS go to received inquiries.
    if (
      title.includes("new housing inquiry") ||
      title.includes("new inquiry") ||
      text.includes("student sent an inquiry") ||
      text.includes("sent an inquiry for your listing") ||
      text.includes("someone sent an inquiry") ||
      type === "new_inquiry" ||
      type === "housing_inquiry" ||
      type === "inquiry_received"
    ) {
      return "/inquiries/received";
    }

    // Student-side inquiry notifications.
    if (
      type === "inquiry_sent" ||
      type === "inquiry_accepted" ||
      type === "address_unlocked" ||
      type === "inquiry_declined"
    ) {
      return "/inquiries/sent";
    }

    // Viewing notifications.
    if (
      type === "viewing_requested" ||
      type === "viewing_confirmed" ||
      type === "viewing_accepted" ||
      type === "viewing_declined" ||
      type === "viewing_cancelled" ||
      type === "viewing_completed"
    ) {
      return "/viewings";
    }

    if (type === "saved_search_alert") return "/saved-searches";

    if (
      type === "identity_approved" ||
      type === "identity_verification_approved"
    ) {
      return "/profile";
    }

    if (
      type === "identity_rejected" ||
      type === "identity_verification_rejected"
    ) {
      return "/verify-identity";
    }

    if (type === "new_message" && notification.inquiry_id) {
      return `/messages/${notification.inquiry_id}`;
    }

    if (
      savedLink &&
      savedLink !== "/dashboard" &&
      savedLink !== "/inquiries" &&
      savedLink !== "/inquiries/sent"
    ) {
      return savedLink;
    }

    return "/notifications";
  }

  async function openNotification(notification: Notification) {
    const href = getNotificationLink(notification);

    if (!notification.is_read) {
      await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", notification.id);
    }

    setOpen(false);
    await loadData();

    router.push(href);
  }

  function getNotificationText(notification: Notification) {
    return notification.body || notification.message || "You have a new update.";
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

    const profileChannel = supabase
      .channel("navbar-profile")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        loadData
      )
      .subscribe();

    return () => {
      supabase.removeChannel(notificationChannel);
      supabase.removeChannel(messageChannel);
      supabase.removeChannel(profileChannel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function closeDropdowns(e: MouseEvent) {
      const target = e.target as Node;

      if (notificationRef.current && !notificationRef.current.contains(target)) {
        setOpen(false);
      }

      if (accountRef.current && !accountRef.current.contains(target)) {
        setAccountOpen(false);
      }
    }

    document.addEventListener("mousedown", closeDropdowns);

    return () => {
      document.removeEventListener("mousedown", closeDropdowns);
    };
  }, []);

  return (
    <header className="sticky top-0 z-[9999] border-b border-white/10 bg-[#050505]/95 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-5">
          <Logo />

          <nav className="hidden items-center rounded-2xl border border-white/10 bg-white/[0.035] p-1 text-sm text-zinc-400 xl:flex">
            {navLinks.map((link) => {
              const active = isActive(link.href);

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`relative inline-flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2 transition ${
                    active
                      ? "bg-white text-black shadow-lg"
                      : "text-zinc-400 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <span>{link.label}</span>

                  {link.label === "Messages" && unreadMessages > 0 && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        active ? "bg-black text-white" : "bg-red-500 text-white"
                      }`}
                    >
                      {unreadMessages}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          <nav className="hidden items-center gap-1 text-sm text-zinc-400 lg:flex xl:hidden">
            {navLinks.slice(0, 5).map((link) => {
              const active = isActive(link.href);

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`whitespace-nowrap rounded-xl px-3 py-2 transition ${
                    active
                      ? "bg-white text-black"
                      : "hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <div
            className="relative"
            ref={notificationRef}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => {
                setOpen((current) => !current);
                setAccountOpen(false);
                loadData();
              }}
              className="relative flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white shadow-lg transition hover:bg-white/10"
            >
              🔔

              {unreadNotifications > 0 && (
                <span className="absolute -right-1.5 -top-1.5 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-black text-white">
                  {unreadNotifications}
                </span>
              )}
            </button>

            {open && (
              <div className="absolute right-0 z-[10000] mt-3 w-[380px] overflow-hidden rounded-3xl border border-white/10 bg-[#090909] shadow-2xl">
                <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                  <div>
                    <p className="text-sm font-bold text-white">
                      Notifications
                    </p>

                    <p className="mt-1 text-xs text-zinc-500">
                      {unreadNotifications} unread notification
                      {unreadNotifications === 1 ? "" : "s"}
                    </p>
                  </div>

                  {unreadNotifications > 0 && (
                    <button
                      type="button"
                      onClick={markAllRead}
                      className="text-xs font-semibold text-sky-400 hover:text-sky-300"
                    >
                      Mark all read
                    </button>
                  )}
                </div>

                <div className="max-h-[420px] overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="p-8 text-center text-sm text-zinc-500">
                      No notifications yet
                    </div>
                  ) : (
                    notifications.map((notification) => (
                      <button
                        key={notification.id}
                        type="button"
                        onClick={() => openNotification(notification)}
                        className={`block w-full border-b border-white/5 px-5 py-4 text-left transition hover:bg-white/[0.06] ${
                          !notification.is_read ? "bg-white/[0.035]" : ""
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-white">
                              {notification.title || "Notification"}
                            </p>

                            <p className="mt-1 line-clamp-2 text-sm text-zinc-400">
                              {getNotificationText(notification)}
                            </p>
                          </div>

                          {!notification.is_read && (
                            <div className="mt-1 h-2.5 w-2.5 rounded-full bg-sky-400" />
                          )}
                        </div>

                        <p className="mt-3 text-xs text-zinc-600">
                          {formatNotificationTime(notification.created_at)}
                        </p>
                      </button>
                    ))
                  )}
                </div>

                <div className="border-t border-white/10 p-3">
                  <Link
                    href="/notifications"
                    onClick={() => setOpen(false)}
                    className="flex w-full items-center justify-center rounded-2xl bg-white/5 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10"
                  >
                    View all notifications
                  </Link>
                </div>
              </div>
            )}
          </div>

          <div
            className="relative hidden md:block"
            ref={accountRef}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => {
                setAccountOpen((current) => !current);
                setOpen(false);
              }}
              className="flex h-12 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-3 text-sm font-semibold text-white shadow-lg transition hover:bg-white/10"
            >
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={displayName}
                  className="h-8 w-8 rounded-full object-cover"
                />
              ) : (
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-sm font-black text-black">
                  {avatarLetter}
                </span>
              )}

              <div className="hidden max-w-[170px] text-left xl:block">
                <p className="truncate text-sm font-bold text-white">
                  {displayName}
                </p>

                <p className="truncate text-xs text-zinc-500">{userEmail}</p>
              </div>

              <span className="text-zinc-500">⌄</span>
            </button>

            {accountOpen && (
              <div className="absolute right-0 z-[10000] mt-3 w-80 overflow-hidden rounded-3xl border border-white/10 bg-[#090909] shadow-2xl">
                <div className="border-b border-white/10 px-5 py-5">
                  <div className="flex items-center gap-4">
                    {profile?.avatar_url ? (
                      <img
                        src={profile.avatar_url}
                        alt={displayName}
                        className="h-14 w-14 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-xl font-black text-black">
                        {avatarLetter}
                      </div>
                    )}

                    <div className="min-w-0">
                      <p className="truncate text-lg font-bold text-white">
                        {displayName}
                      </p>

                      <p className="mt-1 truncate text-sm text-zinc-500">
                        {userEmail}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-1 p-2">
                  {accountLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setAccountOpen(false)}
                      className={`rounded-2xl px-4 py-3 text-sm font-medium transition ${
                        isActive(link.href)
                          ? "bg-white text-black"
                          : "text-zinc-300 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      {link.label}
                    </Link>
                  ))}

                  <button
                    type="button"
                    onClick={handleLogout}
                    disabled={loggingOut}
                    className="mt-2 w-full rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-left text-sm font-bold text-red-300 hover:bg-red-500/20 disabled:opacity-50"
                  >
                    {loggingOut ? "Logging out..." : "Log out"}
                  </button>
                </div>
              </div>
            )}
          </div>

          <Link
            href="/post"
            className="hidden h-12 items-center rounded-2xl bg-white px-5 text-sm font-black text-black shadow-lg transition hover:bg-zinc-200 md:flex"
          >
            Post Listing
          </Link>

          <button
            type="button"
            onClick={() => setMobileOpen((current) => !current)}
            className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-xl text-white hover:bg-white/10 lg:hidden"
          >
            {mobileOpen ? "×" : "☰"}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-white/10 bg-[#050505] px-4 py-4 lg:hidden">
          <div className="mx-auto max-w-7xl rounded-3xl border border-white/10 bg-white/[0.04] p-3 shadow-2xl">
            <div className="mb-3 rounded-2xl border border-white/10 bg-black/40 p-4">
              <p className="font-semibold text-white">{displayName}</p>

              <p className="mt-1 truncate text-xs text-zinc-500">
                {userEmail}
              </p>
            </div>

            <div className="grid gap-2">
              {navLinks.map((link) => {
                const active = isActive(link.href);

                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                      active
                        ? "bg-white text-black"
                        : "text-zinc-300 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <span>{link.label}</span>

                    {link.label === "Messages" && unreadMessages > 0 && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          active
                            ? "bg-black text-white"
                            : "bg-red-500 text-white"
                        }`}
                      >
                        {unreadMessages}
                      </span>
                    )}
                  </Link>
                );
              })}

              <Link
                href="/verify-identity"
                onClick={() => setMobileOpen(false)}
                className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                  isActive("/verify-identity")
                    ? "bg-white text-black"
                    : "text-zinc-300 hover:bg-white/10 hover:text-white"
                }`}
              >
                Verify Identity
              </Link>

              <Link
                href="/post"
                onClick={() => setMobileOpen(false)}
                className="mt-2 rounded-2xl bg-white px-4 py-3 text-center text-sm font-black text-black hover:bg-zinc-200"
              >
                Post Listing
              </Link>

              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-center text-sm font-bold text-red-300 hover:bg-red-500/20 disabled:opacity-50"
              >
                {loggingOut ? "Logging out..." : "Log out"}
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}