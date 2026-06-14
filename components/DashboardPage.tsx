"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Home,
  MessageCircle,
  CalendarDays,
  PlusCircle,
  User,
  ShieldCheck,
  ArrowRight,
  Crown,
  CreditCard,
  BarChart3,
  Zap,
  Eye,
  Heart,
  TrendingUp,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Stats = {
  listings: number;
  inquiries: number;
  chats: number;
  viewings: number;
};

type Subscription = {
  plan: string;
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
  monthly_boosts_used?: number | null;
};

type ListingAnalytics = {
  id: string;
  title: string;
  status: string;
  price: number | null;
  is_featured: boolean | null;
  views: number;
  saves: number;
  viewings: number;
  conversionRate: number;
};

const PLAN_LIMITS: Record<string, number> = {
  free: 1,
  pro: 5,
  premium: 25,
};

const BOOST_LIMITS: Record<string, number> = {
  free: 0,
  pro: 2,
  premium: 10,
};

function formatDate(date: string | null) {
  if (!date) return "Not available";

  return new Intl.DateTimeFormat("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
}

function getFirstName(value: string) {
  const clean = value.trim();

  if (!clean) return "User";

  if (clean.includes("@")) {
    return clean.split("@")[0].split(".")[0].split("_")[0] || "User";
  }

  return clean.split(" ")[0] || "User";
}

export default function DashboardPage() {
  const supabase = useMemo(() => createClient(), []);

  const [stats, setStats] = useState<Stats>({
    listings: 0,
    inquiries: 0,
    chats: 0,
    viewings: 0,
  });

  const [name, setName] = useState("User");
  const [role, setRole] = useState("student");

  const [subscription, setSubscription] = useState<Subscription>({
    plan: "free",
    status: "inactive",
    current_period_end: null,
    cancel_at_period_end: false,
    monthly_boosts_used: 0,
  });

  const [analytics, setAnalytics] = useState<ListingAnalytics[]>([]);
  const [loading, setLoading] = useState(true);

  const displayName = getFirstName(name);

  const plan = subscription.plan || "free";
  const listingLimit = PLAN_LIMITS[plan] || 1;
  const boostLimit = BOOST_LIMITS[plan] || 0;
  const boostsUsed = subscription.monthly_boosts_used || 0;

  const listingUsagePercent = Math.min((stats.listings / listingLimit) * 100, 100);
  const boostUsagePercent =
    boostLimit > 0 ? Math.min((boostsUsed / boostLimit) * 100, 100) : 0;

  const totalViews = analytics.reduce((sum, item) => sum + item.views, 0);
  const totalSaves = analytics.reduce((sum, item) => sum + item.saves, 0);
  const totalViewingRequests = analytics.reduce((sum, item) => sum + item.viewings, 0);

  useEffect(() => {
    loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadDashboard() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/auth";
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, role")
      .eq("id", user.id)
      .maybeSingle();

    setName(profile?.full_name || user.email || "User");
    setRole(profile?.role || "student");

    const { data: ownerSubscription } = await supabase
      .from("owner_subscriptions")
      .select(
        "plan, status, current_period_end, cancel_at_period_end, monthly_boosts_used"
      )
      .eq("user_id", user.id)
      .maybeSingle();

    if (ownerSubscription) {
      let freshSubscription = ownerSubscription;

      const isActive =
        ownerSubscription.status === "active" ||
        ownerSubscription.status === "trialing";

      if (isActive && !ownerSubscription.current_period_end) {
        await fetch("/api/subscriptions/sync", {
          method: "POST",
        });

        const { data: syncedSub } = await supabase
          .from("owner_subscriptions")
          .select(
            "plan, status, current_period_end, cancel_at_period_end, monthly_boosts_used"
          )
          .eq("user_id", user.id)
          .maybeSingle();

        if (syncedSub) freshSubscription = syncedSub;
      }

      const activePlan =
        freshSubscription.status === "active" ||
        freshSubscription.status === "trialing"
          ? freshSubscription.plan || "free"
          : "free";

      setSubscription({
        plan: activePlan,
        status: freshSubscription.status || "inactive",
        current_period_end: freshSubscription.current_period_end,
        cancel_at_period_end: freshSubscription.cancel_at_period_end,
        monthly_boosts_used: freshSubscription.monthly_boosts_used || 0,
      });
    }

    const { data: ownerListings, count: listings } = await supabase
      .from("listings")
      .select("id, title, status, price, is_featured", {
        count: "exact",
      })
      .eq("user_id", user.id)
      .neq("status", "rented");

    const listingIds = (ownerListings || []).map((item) => item.id);

    const { count: inquiries } = await supabase
      .from("inquiries")
      .select("*", { count: "exact", head: true })
      .or(`owner_id.eq.${user.id},requester_id.eq.${user.id}`);

    const { count: chats } = await supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`);

    const { count: viewings } = await supabase
      .from("viewings")
      .select("*", { count: "exact", head: true })
      .or(`owner_id.eq.${user.id},requester_id.eq.${user.id}`);

    setStats({
      listings: listings || 0,
      inquiries: inquiries || 0,
      chats: chats || 0,
      viewings: viewings || 0,
    });

    if (listingIds.length > 0) {
      const [{ data: views }, { data: saves }, { data: viewingRows }] =
        await Promise.all([
          supabase.from("listing_views").select("listing_id").in("listing_id", listingIds),
          supabase.from("saved_listings").select("listing_id").in("listing_id", listingIds),
          supabase.from("viewings").select("listing_id").in("listing_id", listingIds),
        ]);

      const countByListing = (rows: any[] | null | undefined) => {
        const map = new Map<string, number>();

        (rows || []).forEach((row) => {
          if (!row.listing_id) return;
          map.set(row.listing_id, (map.get(row.listing_id) || 0) + 1);
        });

        return map;
      };

      const viewMap = countByListing(views);
      const saveMap = countByListing(saves);
      const viewingMap = countByListing(viewingRows);

      const analyticsRows = (ownerListings || [])
        .map((listing) => {
          const viewsCount = viewMap.get(listing.id) || 0;
          const viewingsCount = viewingMap.get(listing.id) || 0;

          return {
            id: listing.id,
            title: listing.title || "Untitled listing",
            status: listing.status || "available",
            price: listing.price,
            is_featured: listing.is_featured,
            views: viewsCount,
            saves: saveMap.get(listing.id) || 0,
            viewings: viewingsCount,
            conversionRate:
              viewsCount > 0
                ? Number(((viewingsCount / viewsCount) * 100).toFixed(1))
                : 0,
          };
        })
        .sort((a, b) => b.views - a.views);

      setAnalytics(analyticsRows);
    }

    setLoading(false);
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black text-white">
        <p className="text-zinc-400">Loading dashboard...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-black px-4 py-5 text-white sm:px-6 md:px-8 md:py-8">
      <div className="mx-auto max-w-7xl space-y-6 md:space-y-8">
        <section className="rounded-[1.6rem] border border-white/10 bg-gradient-to-br from-zinc-900 via-black to-zinc-950 p-5 shadow-2xl sm:rounded-[2rem] md:p-8">
          <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-400 sm:text-sm sm:normal-case sm:tracking-normal">
                Travel Markets Control Center
              </p>

              <h1 className="mt-3 max-w-full text-[2rem] font-black leading-[1.06] tracking-tight sm:text-5xl md:text-6xl">
                Welcome back,
                <span className="block max-w-full truncate text-white/90 sm:inline sm:pl-2">
                  {displayName}
                </span>
              </h1>

              <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-400 sm:text-base">
                Manage listings, subscriptions, analytics, messages, and viewing requests.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:w-[440px] lg:grid-cols-1">
              <DashboardButton href="/post" variant="white" icon={<PlusCircle size={18} />}>
                Post Listing
              </DashboardButton>

              <DashboardButton href="/billing" variant="purple" icon={<Crown size={18} />}>
                Billing
              </DashboardButton>

              <DashboardButton href="/profile" variant="dark" icon={<User size={18} />}>
                Edit Profile
              </DashboardButton>
            </div>
          </div>
        </section>

        <section className="rounded-[1.6rem] border border-purple-500/20 bg-gradient-to-br from-purple-500/15 via-black to-yellow-500/10 p-5 shadow-2xl sm:rounded-[2rem] md:p-6">
          <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="flex min-w-0 items-start gap-4">
              <div className="shrink-0 rounded-2xl border border-purple-400/30 bg-purple-500/20 p-3 text-purple-200">
                <Crown size={24} />
              </div>

              <div className="min-w-0">
                <p className="text-sm font-semibold text-purple-200">Owner Subscription</p>
                <h2 className="mt-1 truncate text-3xl font-black capitalize">{plan} Plan</h2>

                <p className="mt-2 text-sm leading-6 text-zinc-300">
                  {stats.listings}/{listingLimit} active listing slots used.
                  {subscription.current_period_end &&
                    ` Renews on ${formatDate(subscription.current_period_end)}.`}
                </p>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <UsageBar
                    label="Listing Slots"
                    value={`${stats.listings}/${listingLimit}`}
                    percent={listingUsagePercent}
                  />
                  <UsageBar
                    label="Monthly Featured Boosts"
                    value={`${boostsUsed}/${boostLimit}`}
                    percent={boostUsagePercent}
                  />
                </div>
              </div>
            </div>

            <Link
              href="/billing"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-bold text-black"
            >
              <CreditCard size={18} />
              Manage Subscription
            </Link>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          <StatCard title="Listings" value={stats.listings} icon={<Home size={20} />} href="/my-listings" />
          <StatCard title="Views" value={totalViews} icon={<Eye size={20} />} href="/my-listings" />
          <StatCard title="Saves" value={totalSaves} icon={<Heart size={20} />} href="/saved-listings" />
          <StatCard title="Viewings" value={totalViewingRequests} icon={<CalendarDays size={20} />} href="/viewings" />
        </section>

        <section className="rounded-[1.6rem] border border-white/10 bg-[#080808] p-5 shadow-2xl sm:rounded-[2rem] md:p-6">
          <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <h2 className="flex items-center gap-2 text-xl font-bold sm:text-2xl">
                <BarChart3 className="shrink-0 text-blue-300" />
                Owner Analytics
              </h2>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                Track views, saves, viewing requests, and conversion rate per listing.
              </p>
            </div>

            {plan === "free" && (
              <Link
                href="/billing"
                className="rounded-2xl border border-yellow-400/30 bg-yellow-500/20 px-5 py-3 text-center text-sm font-bold text-yellow-100"
              >
                Upgrade analytics
              </Link>
            )}
          </div>

          {analytics.length === 0 ? (
            <div className="rounded-3xl border border-white/10 bg-black p-8 text-center">
              <p className="font-semibold">No analytics yet</p>
              <p className="mt-2 text-sm text-zinc-400">
                Post a listing and analytics will appear here.
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {analytics.map((item) => (
                <div
                  key={item.id}
                  className="grid gap-4 rounded-3xl border border-white/10 bg-black p-4 md:grid-cols-[1fr_repeat(4,120px)] md:items-center md:p-5"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="min-w-0 truncate font-bold">{item.title}</h3>

                      {item.is_featured && (
                        <span className="rounded-full bg-yellow-400 px-3 py-1 text-xs font-bold text-black">
                          Featured
                        </span>
                      )}

                      <span className="rounded-full bg-white/10 px-3 py-1 text-xs capitalize text-zinc-300">
                        {item.status}
                      </span>
                    </div>

                    <p className="mt-1 text-sm text-zinc-400">
                      {item.price ? `$${item.price}/mo` : "No price"}
                    </p>
                  </div>

                  <Metric label="Views" value={item.views} icon={<Eye size={16} />} />
                  <Metric label="Saves" value={item.saves} icon={<Heart size={16} />} />
                  <Metric label="Viewings" value={item.viewings} icon={<CalendarDays size={16} />} />
                  <Metric label="Conv." value={`${item.conversionRate}%`} icon={<TrendingUp size={16} />} />
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
          <div className="rounded-[1.6rem] border border-white/10 bg-[#080808] p-5 shadow-2xl sm:rounded-[2rem] md:p-6">
            <h2 className="text-xl font-bold sm:text-2xl">Quick Actions</h2>

            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
              <ActionCard href="/post" title="Create Listing" description="Post a new room, apartment, or student housing space." icon={<PlusCircle size={20} />} />
              <ActionCard href="/billing" title="Owner Subscription" description="Upgrade, downgrade, cancel, or manage billing." icon={<Crown size={20} />} />
              <ActionCard href="/my-listings" title="My Listings" description="Edit, delete, and manage posted listings." icon={<Home size={20} />} />
              <ActionCard href="/viewings" title="Manage Viewings" description="Approve viewing requests and unlock addresses." icon={<CalendarDays size={20} />} />
              <ActionCard href="/messages" title="Messages" description="Open chats and continue conversations." icon={<MessageCircle size={20} />} />
              <ActionCard href="/billing" title="Visibility Boosts" description="Use subscription boosts to improve exposure." icon={<Zap size={20} />} />
            </div>
          </div>

          <aside className="space-y-6">
            <div className="rounded-[1.6rem] border border-white/10 bg-[#080808] p-5 shadow-2xl sm:rounded-[2rem] md:p-6">
              <h2 className="text-xl font-bold sm:text-2xl">Account Status</h2>

              <div className="mt-5 space-y-4">
                <InfoBox label="Role" value={role} />
                <InfoBox label="Owner Plan" value={plan} />
                <InfoBox label="Plan Status" value={subscription.status || "inactive"} />
                <InfoBox label="Listing Slots" value={`${stats.listings}/${listingLimit}`} />
                <InfoBox label="Boosts Used" value={`${boostsUsed}/${boostLimit}`} />
                <InfoBox label="Next Billing Date" value={formatDate(subscription.current_period_end)} />
              </div>
            </div>

            <div className="rounded-[1.6rem] border border-emerald-500/20 bg-emerald-500/10 p-5 sm:rounded-[2rem] md:p-6">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-1 shrink-0 text-emerald-300" size={24} />
                <div className="min-w-0">
                  <h3 className="font-bold text-emerald-300">Secure address flow active</h3>
                  <p className="mt-2 text-sm leading-6 text-emerald-100/80">
                    Exact addresses stay protected until a viewing request is accepted.
                  </p>
                </div>
              </div>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

function DashboardButton({
  href,
  children,
  icon,
  variant,
}: {
  href: string;
  children: React.ReactNode;
  icon: React.ReactNode;
  variant: "white" | "purple" | "dark";
}) {
  const styles =
    variant === "white"
      ? "bg-white text-black"
      : variant === "purple"
      ? "border border-purple-400/30 bg-purple-500/20 text-purple-100"
      : "border border-white/10 bg-white/5 text-white";

  return (
    <Link
      href={href}
      className={`inline-flex min-w-0 items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold ${styles}`}
    >
      {icon}
      <span className="truncate">{children}</span>
    </Link>
  );
}

function UsageBar({ label, value, percent }: { label: string; value: string; percent: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="min-w-0 truncate text-zinc-400">{label}</span>
        <span className="shrink-0 font-bold text-white">{value}</span>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-white" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, href }: { title: string; value: number; icon: React.ReactNode; href: string }) {
  return (
    <Link href={href} className="group rounded-[1.4rem] border border-white/10 bg-[#080808] p-4 shadow-xl transition hover:-translate-y-1 hover:border-blue-500/60 hover:bg-white/[0.03] sm:rounded-[1.75rem] sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-blue-300">{icon}</div>
        <ArrowRight size={17} className="text-zinc-600 transition group-hover:text-white" />
      </div>

      <p className="mt-5 truncate text-xs text-zinc-400 sm:text-sm">{title}</p>
      <p className="mt-1 text-3xl font-black sm:text-4xl">{value}</p>
    </Link>
  );
}

function Metric({ label, value, icon }: { label: string; value: number | string; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center gap-2 text-zinc-400">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
}

function ActionCard({ href, title, description, icon }: { href: string; title: string; description: string; icon: React.ReactNode }) {
  return (
    <Link href={href} className="group rounded-3xl border border-white/10 bg-black p-5 transition hover:-translate-y-1 hover:border-blue-500/70 hover:bg-white/[0.03]">
      <div className="mb-5 flex items-center justify-between">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-blue-300">{icon}</div>
        <ArrowRight size={18} className="text-zinc-600 transition group-hover:text-white" />
      </div>

      <h3 className="truncate text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-zinc-400">{description}</p>
    </Link>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black p-5">
      <p className="text-sm text-zinc-400">{label}</p>
      <p className="mt-2 truncate text-lg font-semibold capitalize sm:text-xl">{value}</p>
    </div>
  );
}