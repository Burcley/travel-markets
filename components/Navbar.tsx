"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
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
  role?: string | null;
};

type NavLink = {
  href: string;
  label: string;
};

const studentNavLinks: NavLink[] = [
  { href: "/", label: "home" },
  { href: "/search", label: "search" },
  { href: "/landlords", label: "forLandlords" },
  { href: "/about", label: "about" },
  { href: "/help", label: "help" },
  { href: "/saved-listings", label: "saved" },
  { href: "/messages", label: "messages" },
];

const hostNavLinks: NavLink[] = [
  { href: "/", label: "home" },
  { href: "/search", label: "search" },
  { href: "/landlords", label: "forLandlords" },
  { href: "/dashboard", label: "dashboard" },
  { href: "/help", label: "help" },
  { href: "/my-listings", label: "myListings" },
  { href: "/messages", label: "messages" },
  { href: "/billing", label: "billing" },
];

const adminNavLinks: NavLink[] = [
  { href: "/", label: "home" },
  { href: "/search", label: "search" },
  { href: "/dashboard", label: "dashboard" },
  { href: "/help", label: "help" },
  { href: "/admin", label: "admin" },
  { href: "/messages", label: "messages" },
];

const publicNavLinks: NavLink[] = [
  { href: "/", label: "home" },
  { href: "/search", label: "search" },
  { href: "/landlords", label: "forLandlords" },
  { href: "/about", label: "about" },
  { href: "/help", label: "help" },
  { href: "/faq", label: "faq" },
];

const studentAccountLinks: NavLink[] = [
  { href: "/profile", label: "profile" },
  { href: "/saved-listings", label: "savedListings" },
  { href: "/saved-searches", label: "savedSearches" },
  { href: "/recently-viewed", label: "recentlyViewed" },
  { href: "/inquiries/sent", label: "sentInquiries" },
  { href: "/verify-identity", label: "verifyIdentity" },
];

const hostAccountLinks: NavLink[] = [
  { href: "/profile", label: "profile" },
  { href: "/dashboard", label: "hostDashboard" },
  { href: "/my-listings", label: "myListings" },
  { href: "/inquiries/received", label: "receivedInquiries" },
  { href: "/billing", label: "billing" },
  { href: "/verify-identity", label: "verifyIdentity" },
];

const adminAccountLinks: NavLink[] = [
  { href: "/profile", label: "profile" },
  { href: "/dashboard", label: "dashboard" },
  { href: "/admin", label: "adminPanel" },
  { href: "/my-listings", label: "myListings" },
  { href: "/billing", label: "billing" },
  { href: "/verify-identity", label: "verifyIdentity" },
];

function normalizeRole(role?: string | null) {
  const value = (role || "").toLowerCase();

  if (value === "admin") return "admin";

  if (
    value === "owner" ||
    value === "host" ||
    value === "landlord" ||
    value === "property_owner"
  ) {
    return "host";
  }

  return "student";
}

export default function Navbar() {
  const t = useTranslations("navbar");
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

  const isSignedIn = Boolean(userId);
  const role = normalizeRole(profile?.role);

  const navLinks = useMemo(() => {
    if (!isSignedIn) return publicNavLinks;
    if (role === "admin") return adminNavLinks;
    if (role === "host") return hostNavLinks;
    return studentNavLinks;
  }, [isSignedIn, role]);

  const accountLinks = useMemo(() => {
    if (role === "admin") return adminAccountLinks;
    if (role === "host") return hostAccountLinks;
    return studentAccountLinks;
  }, [role]);

  const displayName =
    profile?.full_name?.trim() || userEmail?.split("@")[0] || t("account.account");

  const avatarLetter = displayName.charAt(0).toUpperCase();

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
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
      .select("id, full_name, avatar_url, role")
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

      setUserId("");
      setUserEmail("");
      setProfile(null);
      setNotifications([]);
      setUnreadNotifications(0);
      setUnreadMessages(0);

      setOpen(false);
      setAccountOpen(false);
      setMobileOpen(false);

      router.push("/auth");
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
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

    if (
      type === "inquiry_sent" ||
      type === "inquiry_accepted" ||
      type === "address_unlocked" ||
      type === "inquiry_declined"
    ) {
      return "/inquiries/sent";
    }

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
    return notification.body || notification.message || t("notifications.newUpdate");
  }

  function formatNotificationTime(date: string) {
    return new Date(date).toLocaleDateString("en-CA", {
      month: "short",
      day: "numeric",
    });
  }

  useEffect(() => {
    loadData();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadData();
    });

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
      subscription.unsubscribe();
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
                  <span>{t(`links.${link.label}`)}</span>

                  {link.label === "messages" && unreadMessages > 0 && (
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
                  {t(`links.${link.label}`)}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          {isSignedIn && (
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
                        {t("notifications.title")}
                      </p>

                      <p className="mt-1 text-xs text-zinc-500">
                        {t("notifications.unread", { count: unreadNotifications })}
                      </p>
                    </div>

                    {unreadNotifications > 0 && (
                      <button
                        type="button"
                        onClick={markAllRead}
                        className="text-xs font-semibold text-sky-400 hover:text-sky-300"
                      >
                        {t("notifications.markAllRead")}
                      </button>
                    )}
                  </div>

                  <div className="max-h-[420px] overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-8 text-center text-sm text-zinc-500">
                        {t("notifications.empty")}
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
                                {notification.title || t("notifications.fallbackTitle")}
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
                      {t("notifications.viewAll")}
                    </Link>
                  </div>
                </div>
              )}
            </div>
          )}

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
              {isSignedIn && profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={displayName}
                  className="h-8 w-8 rounded-full object-cover"
                />
              ) : (
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-sm font-black text-black">
                  {isSignedIn ? avatarLetter : "U"}
                </span>
              )}

              <div className="hidden max-w-[170px] text-left xl:block">
                <p className="truncate text-sm font-bold text-white">
                  {isSignedIn ? displayName : t("account.account")}
                </p>

                <p className="truncate text-xs text-zinc-500">
                  {isSignedIn
                    ? role === "host"
                      ? t("account.hostAccount")
                      : role === "admin"
                      ? t("account.adminAccount")
                      : userEmail
                    : t("account.loginOrCreate")}
                </p>
              </div>

              <span className="text-zinc-500">⌄</span>
            </button>

            {accountOpen && (
              <div className="absolute right-0 z-[10000] mt-3 w-80 overflow-hidden rounded-3xl border border-white/10 bg-[#090909] shadow-2xl">
                {isSignedIn ? (
                  <>
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

                          <p className="mt-2 inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-bold capitalize text-zinc-300">
                            {role === "host"
                              ? t("roles.host")
                              : role === "admin"
                              ? t("roles.admin")
                              : t("roles.student")}
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
                          {t(`links.${link.label}`)}
                        </Link>
                      ))}

                      {role !== "host" && role !== "admin" && (
                        <Link
                          href="/post"
                          onClick={() => setAccountOpen(false)}
                          className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-300 hover:bg-emerald-500/20"
                        >
                          {t("actions.becomeHost")}
                        </Link>
                      )}

                      <button
                        type="button"
                        onClick={handleLogout}
                        disabled={loggingOut}
                        className="mt-2 w-full rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-left text-sm font-bold text-red-300 hover:bg-red-500/20 disabled:opacity-50"
                      >
                        {loggingOut ? t("actions.loggingOut") : t("actions.logout")}
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="border-b border-white/10 px-5 py-5">
                      <div className="flex items-center gap-4">
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-xl font-black text-black">
                          U
                        </div>

                        <div className="min-w-0">
                          <p className="truncate text-lg font-bold text-white">
                            {t("account.welcome")}
                          </p>

                          <p className="mt-1 truncate text-sm text-zinc-500">
                            {t("account.signInPrompt")}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-2 p-3">
                      <Link
                        href="/auth"
                        onClick={() => setAccountOpen(false)}
                        className="rounded-2xl bg-white px-4 py-3 text-center text-sm font-black text-black transition hover:bg-zinc-200"
                      >
                        {t("actions.login")}
                      </Link>

                      <Link
                        href="/auth?mode=signup"
                        onClick={() => setAccountOpen(false)}
                        className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-center text-sm font-bold text-white transition hover:bg-white/10"
                      >
                        {t("actions.signup")}
                      </Link>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          <Link
            href={isSignedIn ? "/post" : "/auth"}
            className="hidden h-12 items-center rounded-2xl bg-white px-5 text-sm font-black text-black shadow-lg transition hover:bg-zinc-200 md:flex"
          >
            {isSignedIn
              ? role === "host" || role === "admin"
                ? t("actions.postListing")
                : t("actions.becomeHost")
              : t("actions.signIn")}
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
              <p className="font-semibold text-white">
                {isSignedIn ? displayName : t("account.welcome")}
              </p>

              <p className="mt-1 truncate text-xs text-zinc-500">
                {isSignedIn
                  ? role === "host"
                    ? t("account.hostAccount")
                    : role === "admin"
                    ? t("account.adminAccount")
                    : userEmail
                  : t("account.loginOrCreateYour")}
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
                    <span>{t(`links.${link.label}`)}</span>

                    {link.label === "messages" && unreadMessages > 0 && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          active ? "bg-black text-white" : "bg-red-500 text-white"
                        }`}
                      >
                        {unreadMessages}
                      </span>
                    )}
                  </Link>
                );
              })}

              {isSignedIn ? (
                <>
                  <Link
                    href="/verify-identity"
                    onClick={() => setMobileOpen(false)}
                    className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                      isActive("/verify-identity")
                        ? "bg-white text-black"
                        : "text-zinc-300 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    {t("links.verifyIdentity")}
                  </Link>

                  <Link
                    href="/post"
                    onClick={() => setMobileOpen(false)}
                    className="mt-2 rounded-2xl bg-white px-4 py-3 text-center text-sm font-black text-black hover:bg-zinc-200"
                  >
                    {role === "host" || role === "admin"
                      ? t("actions.postListing")
                      : t("actions.becomeHost")}
                  </Link>

                  <button
                    type="button"
                    onClick={handleLogout}
                    disabled={loggingOut}
                    className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-center text-sm font-bold text-red-300 hover:bg-red-500/20 disabled:opacity-50"
                  >
                    {loggingOut ? t("actions.loggingOut") : t("actions.logout")}
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/auth"
                    onClick={() => setMobileOpen(false)}
                    className="rounded-2xl bg-white px-4 py-3 text-center text-sm font-black text-black hover:bg-zinc-200"
                  >
                    {t("actions.login")}
                  </Link>

                  <Link
                    href="/auth?mode=signup"
                    onClick={() => setMobileOpen(false)}
                    className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-center text-sm font-bold text-white hover:bg-white/10"
                  >
                    {t("actions.signup")}
                  </Link>

                  <Link
                    href="/landlords"
                    onClick={() => setMobileOpen(false)}
                    className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-center text-sm font-bold text-white hover:bg-white/10"
                  >
                    {t("links.forLandlords")}
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
