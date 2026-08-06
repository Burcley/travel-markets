"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
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
  BadgeCheck,
  Gift,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Stats = {
  listings: number;
  inquiries: number;
  chats: number;
  viewings: number;
  savedHomes: number;
  recentlyViewed: number;
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

type ProfileCompletion = {
  full_name: string | null;
  role: string | null;
  phone: string | null;
  bio: string | null;
  avatar_url: string | null;
  identity_verified: boolean | null;
};

type FoundingLandlordStatus = {
  profile: {
    is_founding_landlord: boolean | null;
    founding_landlord_number: number | null;
    founding_status:
      | "not_eligible"
      | "reserved"
      | "pending_verification"
      | "pending_listing"
      | "confirmed"
      | "disqualified"
      | null;
    founding_reservation_expires_at: string | null;
    founding_confirmed_at: string | null;
    founding_free_fee_period_ends_at: string | null;
    founding_discount_percentage: number | null;
    founding_referral_code: string | null;
    founding_benefits_disabled: boolean | null;
  } | null;
  progress: {
    hasLandlordVerification: boolean;
    hasApprovedPublishedListing: boolean;
    activeListings: number;
    verifiedListings: number;
    monthlyBoostsUsed: number;
    referralRewards: number;
  };
  stats: {
    maxPositions: number;
    confirmedCount: number;
    reservedCount: number;
    availablePositions: number;
  };
  benefits: {
    platformCommissionWaivedMonths: number;
    lifetimeDiscountPercentage: number;
    monthlyFreeBoosts: number;
    referralReward: string;
  };
};

const PLAN_LIMITS: Record<string, number> = {
  free: 1,
  premium: 5,
  elite: Infinity,
  legacy_premium: Infinity,
};

const BOOST_LIMITS: Record<string, number> = {
  free: 0,
  premium: 2,
  elite: 10,
  legacy_premium: 10,
};

function formatDate(date: string | null, notAvailableLabel: string) {
  if (!date) return notAvailableLabel;

  return new Intl.DateTimeFormat("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
}

function getFirstName(value: string, fallback: string) {
  const clean = value.trim();

  if (!clean) return fallback;

  if (clean.includes("@")) {
    return clean.split("@")[0].split(".")[0].split("_")[0] || fallback;
  }

  return clean.split(" ")[0] || fallback;
}

export default function DashboardPage() {
  const t = useTranslations("dashboard");
  const supabase = useMemo(() => createClient(), []);

  const [stats, setStats] = useState<Stats>({
    listings: 0,
    inquiries: 0,
    chats: 0,
    viewings: 0,
    savedHomes: 0,
    recentlyViewed: 0,
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
  const [profileCompletion, setProfileCompletion] =
    useState<ProfileCompletion | null>(null);
  const [foundingLandlord, setFoundingLandlord] =
    useState<FoundingLandlordStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const displayName = getFirstName(name, t("fallbackUser"));
  const normalizedRole = role === "owner" || role === "landlord" || role === "host" ? "owner" : role;
  const isStudent = normalizedRole !== "owner" && normalizedRole !== "admin";

  const plan = subscription.plan || "free";
  const foundingProfile = foundingLandlord?.profile;
  const foundingFreePeriodActive =
    foundingProfile?.founding_status === "confirmed" &&
    foundingProfile?.is_founding_landlord === true &&
    foundingProfile?.founding_benefits_disabled !== true &&
    Boolean(foundingProfile?.founding_free_fee_period_ends_at) &&
    new Date(foundingProfile.founding_free_fee_period_ends_at || "").getTime() >
      Date.now();
  const listingLimit = foundingFreePeriodActive
    ? Infinity
    : PLAN_LIMITS[plan] || 1;
  const foundingMonthlyBoostTotal = foundingFreePeriodActive
    ? foundingLandlord?.benefits.monthlyFreeBoosts || 2
    : 0;
  const boostLimit = foundingFreePeriodActive
    ? foundingMonthlyBoostTotal
    : BOOST_LIMITS[plan] || 0;
  const boostsUsed = foundingFreePeriodActive
    ? foundingLandlord?.progress.monthlyBoostsUsed || 0
    : subscription.monthly_boosts_used || 0;
  const listingLimitLabel =
    listingLimit === Infinity ? "Unlimited" : String(listingLimit);
  const listingUsageLabel = foundingFreePeriodActive
    ? "Unlimited"
    : `${stats.listings}/${listingLimitLabel}`;
  const boostUsageLabel = foundingFreePeriodActive
    ? `${Math.max(0, boostLimit - boostsUsed)} remaining this month`
    : `${boostsUsed}/${boostLimit}`;

  const listingUsagePercent =
    listingLimit === Infinity
      ? 0
      : Math.min((stats.listings / listingLimit) * 100, 100);
  const boostUsagePercent =
    boostLimit > 0 ? Math.min((boostsUsed / boostLimit) * 100, 100) : 0;

  const totalViews = analytics.reduce((sum, item) => sum + item.views, 0);
  const totalSaves = analytics.reduce((sum, item) => sum + item.saves, 0);
  const totalViewingRequests = analytics.reduce((sum, item) => sum + item.viewings, 0);
  const completionItems = [
    Boolean(profileCompletion?.full_name),
    Boolean(profileCompletion?.role),
    Boolean(profileCompletion?.phone),
    Boolean(profileCompletion?.bio),
    Boolean(profileCompletion?.avatar_url),
    Boolean(profileCompletion?.identity_verified),
  ];
  const completionPercent = Math.round(
    (completionItems.filter(Boolean).length / completionItems.length) * 100
  );

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
      .select("full_name, role, phone, bio, avatar_url, identity_verified")
      .eq("id", user.id)
      .maybeSingle();

    setName(profile?.full_name || user.email || t("fallbackUser"));
    setRole(profile?.role || "student");
    setProfileCompletion((profile || null) as ProfileCompletion | null);

    if (profile?.role === "owner" || profile?.role === "landlord" || profile?.role === "host") {
      const foundingResponse = await fetch("/api/founding-landlords/status", {
        cache: "no-store",
      });
      const foundingData = await foundingResponse.json().catch(() => null);
      if (foundingResponse.ok) {
        setFoundingLandlord(foundingData as FoundingLandlordStatus);
      }
    }

    const { data: ownerSubscription } = await supabase
      .from("owner_subscriptions")
      .select(
        "plan, status, current_period_end, cancel_at_period_end, included_monthly_boosts_used, monthly_boosts_used"
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
            "plan, status, current_period_end, cancel_at_period_end, included_monthly_boosts_used, monthly_boosts_used"
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
        monthly_boosts_used:
          freshSubscription.included_monthly_boosts_used ??
          freshSubscription.monthly_boosts_used ??
          0,
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

    const { count: savedHomes } = await supabase
      .from("saved_listings")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);

    const { count: recentlyViewed } = await supabase
      .from("recently_viewed")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);

    setStats({
      listings: listings || 0,
      inquiries: inquiries || 0,
      chats: chats || 0,
      viewings: viewings || 0,
      savedHomes: savedHomes || 0,
      recentlyViewed: recentlyViewed || 0,
    });

    if (listingIds.length > 0) {
      const [{ data: views }, { data: saves }, { data: viewingRows }] =
        await Promise.all([
          supabase.from("listing_views").select("listing_id").in("listing_id", listingIds),
          supabase.from("saved_listings").select("listing_id").in("listing_id", listingIds),
          supabase.from("viewings").select("listing_id").in("listing_id", listingIds),
        ]);

      const countByListing = (
        rows: { listing_id?: string | null }[] | null | undefined
      ) => {
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
            title: listing.title || t("untitledListing"),
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
        <p className="text-zinc-400">{t("loading")}</p>
      </main>
    );
  }

  if (isStudent) {
    return (
      <main className="min-h-screen overflow-x-hidden bg-black px-4 py-5 text-white sm:px-6 md:px-8 md:py-8">
        <div className="mx-auto max-w-7xl space-y-6 md:space-y-8">
          <section className="rounded-[1.6rem] border border-white/10 bg-gradient-to-br from-zinc-900 via-black to-zinc-950 p-5 shadow-2xl sm:rounded-[2rem] md:p-8">
            <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-pink-300 sm:text-sm sm:normal-case sm:tracking-normal">
                  {t("student.center")}
                </p>

                <h1 className="mt-3 max-w-full text-[2rem] font-black leading-[1.06] tracking-tight sm:text-5xl md:text-6xl">
                  {t("welcomeBack")}
                  <span className="block max-w-full truncate text-white/90 sm:inline sm:pl-2">
                    {displayName}
                  </span>
                </h1>

                <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-400 sm:text-base">
                  {t("student.intro")}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:w-[360px] lg:grid-cols-1">
                <DashboardButton href="/search" variant="white" icon={<Home size={18} />}>
                  {t("student.findHousing")}
                </DashboardButton>

                <DashboardButton href="/profile" variant="dark" icon={<User size={18} />}>
                  {t("editProfile")}
                </DashboardButton>
              </div>
            </div>
          </section>

          <section className="rounded-[1.6rem] border border-pink-500/20 bg-pink-500/10 p-5 shadow-2xl sm:rounded-[2rem] md:p-6">
            <div className="grid gap-5 md:grid-cols-[1fr_auto] md:items-center">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-pink-200">
                  {t("profileCompletion.eyebrow")}
                </p>
                <h2 className="mt-1 text-2xl font-black">
                  {t("profileCompletion.title")}
                </h2>
                <p className="mt-2 text-sm text-pink-100/75">
                  {t("profileCompletion.text", { percent: completionPercent })}
                </p>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-black/40">
                  <div
                    className="h-full rounded-full bg-white"
                    style={{ width: `${completionPercent}%` }}
                  />
                </div>
              </div>

              <Link
                href="/profile"
                className="inline-flex items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-bold text-black"
              >
                {t("profileCompletion.action")}
              </Link>
            </div>
          </section>

          <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-5">
            <StatCard title={t("student.savedHomes")} value={stats.savedHomes} icon={<Heart size={20} />} href="/saved-listings" />
            <StatCard title={t("student.sentInquiries")} value={stats.inquiries} icon={<MessageCircle size={20} />} href="/inquiries/sent" />
            <StatCard title={t("student.messages")} value={stats.chats} icon={<MessageCircle size={20} />} href="/messages" />
            <StatCard title={t("student.viewingRequests")} value={stats.viewings} icon={<CalendarDays size={20} />} href="/viewings" />
            <StatCard title={t("student.recentlyViewed")} value={stats.recentlyViewed} icon={<Eye size={20} />} href="/recently-viewed" />
          </section>

          <section className="rounded-[1.6rem] border border-white/10 bg-[#080808] p-5 shadow-2xl sm:rounded-[2rem] md:p-6">
            <h2 className="text-xl font-bold sm:text-2xl">{t("quickActions.title")}</h2>

            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
              <ActionCard href="/search" title={t("student.searchTitle")} description={t("student.searchText")} icon={<Home size={20} />} />
              <ActionCard href="/saved-listings" title={t("student.savedTitle")} description={t("student.savedText")} icon={<Heart size={20} />} />
              <ActionCard href="/inquiries/sent" title={t("student.inquiriesTitle")} description={t("student.inquiriesText")} icon={<MessageCircle size={20} />} />
              <ActionCard href="/viewings" title={t("student.viewingsTitle")} description={t("student.viewingsText")} icon={<CalendarDays size={20} />} />
              <ActionCard href="/recently-viewed" title={t("student.recentTitle")} description={t("student.recentText")} icon={<Eye size={20} />} />
              <ActionCard href="/dashboard/verification" title="Verification Center" description="Complete trust checks for email, phone, identity, and student status." icon={<ShieldCheck size={20} />} />
              <ActionCard href="/settings" title={t("student.settingsTitle")} description={t("student.settingsText")} icon={<User size={20} />} />
            </div>
          </section>
        </div>
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
                {t("controlCenter")}
              </p>

              <h1 className="mt-3 max-w-full text-[2rem] font-black leading-[1.06] tracking-tight sm:text-5xl md:text-6xl">
                {t("welcomeBack")}
                <span className="block max-w-full truncate text-white/90 sm:inline sm:pl-2">
                  {displayName}
                </span>
              </h1>

              <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-400 sm:text-base">
                {t("intro")}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:w-[440px] lg:grid-cols-1">
              <DashboardButton href="/post" variant="white" icon={<PlusCircle size={18} />}>
                {t("postListing")}
              </DashboardButton>

              <DashboardButton href="/billing" variant="purple" icon={<Crown size={18} />}>
                {t("billing")}
              </DashboardButton>

              <DashboardButton href="/profile" variant="dark" icon={<User size={18} />}>
                {t("editProfile")}
              </DashboardButton>
            </div>
          </div>
        </section>

        <section className="rounded-[1.6rem] border border-pink-500/20 bg-pink-500/10 p-5 shadow-2xl sm:rounded-[2rem] md:p-6">
          <div className="grid gap-5 md:grid-cols-[1fr_auto] md:items-center">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-pink-200">
                {t("profileCompletion.eyebrow")}
              </p>
              <h2 className="mt-1 text-2xl font-black">
                {t("profileCompletion.title")}
              </h2>
              <p className="mt-2 text-sm text-pink-100/75">
                {t("profileCompletion.text", { percent: completionPercent })}
              </p>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-black/40">
                <div
                  className="h-full rounded-full bg-white"
                  style={{ width: `${completionPercent}%` }}
                />
              </div>
            </div>

            <Link
              href="/profile"
              className="inline-flex items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-bold text-black"
            >
              {t("profileCompletion.action")}
            </Link>
          </div>
        </section>

        <section className="rounded-[1.6rem] border border-purple-500/20 bg-gradient-to-br from-purple-500/15 via-black to-yellow-500/10 p-5 shadow-2xl sm:rounded-[2rem] md:p-6">
          <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="flex min-w-0 items-start gap-4">
              <div className="shrink-0 rounded-2xl border border-purple-400/30 bg-purple-500/20 p-3 text-purple-200">
                <Crown size={24} />
              </div>

              <div className="min-w-0">
                <p className="text-sm font-semibold text-purple-200">{t("ownerSubscription")}</p>
                <h2 className="mt-1 truncate text-3xl font-black capitalize">
                  {t("planTitle", { plan })}
                </h2>

                <p className="mt-2 text-sm leading-6 text-zinc-300">
                  {t("listingSlotsUsed", {
                    used: stats.listings,
                    limit: listingLimitLabel,
                  })}
                  {subscription.current_period_end &&
                    ` ${t("renewsOn", {
                      date: formatDate(
                        subscription.current_period_end,
                        t("notAvailable")
                      ),
                    })}`}
                </p>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <UsageBar
                    label={t("listingSlots")}
                    value={listingUsageLabel}
                    percent={listingUsagePercent}
                  />
                  <UsageBar
                    label={t("monthlyFeaturedBoosts")}
                    value={boostUsageLabel}
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
              {t("manageSubscription")}
            </Link>
          </div>
        </section>

        {foundingLandlord && (
          <FoundingLandlordPanel foundingLandlord={foundingLandlord} />
        )}

        <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          <StatCard title={t("stats.listings")} value={stats.listings} icon={<Home size={20} />} href="/my-listings" />
          <StatCard title={t("stats.views")} value={totalViews} icon={<Eye size={20} />} href="/my-listings" />
          <StatCard title={t("stats.saves")} value={totalSaves} icon={<Heart size={20} />} href="/saved-listings" />
          <StatCard title={t("stats.viewings")} value={totalViewingRequests} icon={<CalendarDays size={20} />} href="/viewings" />
        </section>

        <section className="rounded-[1.6rem] border border-white/10 bg-[#080808] p-5 shadow-2xl sm:rounded-[2rem] md:p-6">
          <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <h2 className="flex items-center gap-2 text-xl font-bold sm:text-2xl">
                <BarChart3 className="shrink-0 text-blue-300" />
                {t("analytics.title")}
              </h2>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                {t("analytics.subtitle")}
              </p>
            </div>

            {plan === "free" && (
              <Link
                href="/billing"
                className="rounded-2xl border border-yellow-400/30 bg-yellow-500/20 px-5 py-3 text-center text-sm font-bold text-yellow-100"
              >
                {t("analytics.upgrade")}
              </Link>
            )}
          </div>

          {analytics.length === 0 ? (
            <div className="rounded-3xl border border-white/10 bg-black p-8 text-center">
              <p className="font-semibold">{t("analytics.emptyTitle")}</p>
              <p className="mt-2 text-sm text-zinc-400">
                {t("analytics.emptyText")}
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
                          {t("analytics.featured")}
                        </span>
                      )}

                      <span className="rounded-full bg-white/10 px-3 py-1 text-xs capitalize text-zinc-300">
                        {item.status}
                      </span>
                    </div>

                    <p className="mt-1 text-sm text-zinc-400">
                      {item.price ? `$${item.price}/mo` : t("analytics.noPrice")}
                    </p>
                  </div>

                  <Metric label={t("stats.views")} value={item.views} icon={<Eye size={16} />} />
                  <Metric label={t("stats.saves")} value={item.saves} icon={<Heart size={16} />} />
                  <Metric label={t("stats.viewings")} value={item.viewings} icon={<CalendarDays size={16} />} />
                  <Metric label={t("analytics.conversion")} value={`${item.conversionRate}%`} icon={<TrendingUp size={16} />} />
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
          <div className="rounded-[1.6rem] border border-white/10 bg-[#080808] p-5 shadow-2xl sm:rounded-[2rem] md:p-6">
            <h2 className="text-xl font-bold sm:text-2xl">{t("quickActions.title")}</h2>

            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
              <ActionCard href="/post" title={t("quickActions.createListingTitle")} description={t("quickActions.createListingText")} icon={<PlusCircle size={20} />} />
              <ActionCard href="/billing" title={t("quickActions.ownerSubscriptionTitle")} description={t("quickActions.ownerSubscriptionText")} icon={<Crown size={20} />} />
              <ActionCard href="/my-listings" title={t("quickActions.myListingsTitle")} description={t("quickActions.myListingsText")} icon={<Home size={20} />} />
              <ActionCard href="/viewings" title={t("quickActions.manageViewingsTitle")} description={t("quickActions.manageViewingsText")} icon={<CalendarDays size={20} />} />
              <ActionCard href="/messages" title={t("quickActions.messagesTitle")} description={t("quickActions.messagesText")} icon={<MessageCircle size={20} />} />
              <ActionCard href="/dashboard/verification" title="Verification Center" description="Review identity and property relationship verification status." icon={<ShieldCheck size={20} />} />
              <ActionCard href="/billing" title={t("quickActions.visibilityBoostsTitle")} description={t("quickActions.visibilityBoostsText")} icon={<Zap size={20} />} />
            </div>
          </div>

          <aside className="space-y-6">
            <div className="rounded-[1.6rem] border border-white/10 bg-[#080808] p-5 shadow-2xl sm:rounded-[2rem] md:p-6">
              <h2 className="text-xl font-bold sm:text-2xl">{t("accountStatus.title")}</h2>

              <div className="mt-5 space-y-4">
                <InfoBox label={t("accountStatus.role")} value={role} />
                <InfoBox label={t("accountStatus.ownerPlan")} value={plan} />
                <InfoBox label={t("accountStatus.planStatus")} value={subscription.status || "inactive"} />
                <InfoBox label={t("listingSlots")} value={listingUsageLabel} />
                <InfoBox label={t("accountStatus.boostsUsed")} value={boostUsageLabel} />
                <InfoBox label={t("accountStatus.nextBillingDate")} value={formatDate(subscription.current_period_end, t("notAvailable"))} />
              </div>
            </div>

            <div className="rounded-[1.6rem] border border-emerald-500/20 bg-emerald-500/10 p-5 sm:rounded-[2rem] md:p-6">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-1 shrink-0 text-emerald-300" size={24} />
                <div className="min-w-0">
                  <h3 className="font-bold text-emerald-300">{t("secureFlowTitle")}</h3>
                  <p className="mt-2 text-sm leading-6 text-emerald-100/80">
                    {t("secureFlowText")}
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

function FoundingLandlordPanel({
  foundingLandlord,
}: {
  foundingLandlord: FoundingLandlordStatus;
}) {
  const [message, setMessage] = useState("");
  const [feedback, setFeedback] = useState("");
  const [working, setWorking] = useState<"assistance" | "feedback" | null>(
    null
  );
  const profile = foundingLandlord.profile;
  const status = profile?.founding_status || "not_eligible";
  const number = profile?.founding_landlord_number;
  const confirmed = status === "confirmed" && profile?.is_founding_landlord;
  const expirationLabel = profile?.founding_reservation_expires_at
    ? formatDate(profile.founding_reservation_expires_at, "Not available")
    : "Not reserved";

  const checklist = [
    {
      label: "Landlord or owner account",
      done: status !== "not_eligible" && status !== "disqualified",
    },
    {
      label: "Identity or landlord verification approved",
      done: foundingLandlord.progress.hasLandlordVerification,
    },
    {
      label: "At least one verified active listing",
      done: foundingLandlord.progress.hasApprovedPublishedListing,
    },
  ];

  async function submitAssistance() {
    setWorking("assistance");
    await fetch("/api/founding-landlords/assistance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    setMessage("");
    setWorking(null);
  }

  async function submitFeedback() {
    if (!feedback.trim()) return;
    setWorking("feedback");
    await fetch("/api/founding-landlords/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: feedback }),
    });
    setFeedback("");
    setWorking(null);
  }

  return (
    <section className="rounded-[1.6rem] border border-pink-400/25 bg-gradient-to-br from-pink-500/15 via-[#070707] to-yellow-500/10 p-5 shadow-2xl sm:rounded-[2rem] md:p-6">
      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-2xl border border-pink-300/30 bg-pink-500/20 p-3 text-pink-100">
              <BadgeCheck size={24} />
            </div>
            <div>
              <p className="text-sm font-semibold text-pink-200">
                Founding Landlord Program
              </p>
              <h2 className="text-2xl font-black sm:text-3xl">
                {confirmed && number
                  ? `Founding Landlord #${number} of ${foundingLandlord.stats.maxPositions}`
                  : "Reserve one of the first 30 founder spots"}
              </h2>
            </div>
          </div>

          <p className="mt-4 max-w-3xl text-sm leading-6 text-zinc-300">
            Founding Landlords get a permanent founder badge, 12 months of zero
            Travel Markets platform commission, a lifetime discount afterward,
            two free 7-day boosts each month, and priority review/support.
          </p>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <InfoPill label="Status" value={status.replaceAll("_", " ")} />
            <InfoPill
              label="Reserved until"
              value={confirmed ? "Confirmed" : expirationLabel}
            />
            <InfoPill
              label="Spots left"
              value={`${foundingLandlord.stats.availablePositions}/${foundingLandlord.stats.maxPositions}`}
            />
          </div>

          <div className="mt-5 grid gap-3">
            {checklist.map((item) => (
              <div
                key={item.label}
                className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/40 p-4"
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black ${
                    item.done ? "bg-emerald-400 text-black" : "bg-white/10 text-zinc-400"
                  }`}
                >
                  {item.done ? "OK" : "-"}
                </span>
                <span className="text-sm font-semibold text-zinc-100">
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-3xl border border-white/10 bg-black p-5">
            <div className="flex items-center gap-3">
              <Gift className="text-yellow-200" size={20} />
              <h3 className="font-bold">Founder benefits</h3>
            </div>
            <div className="mt-4 space-y-3 text-sm leading-6 text-zinc-300">
              <p>0% Travel Markets platform commission for 12 months.</p>
              <p>
                {profile?.founding_discount_percentage ||
                  foundingLandlord.benefits.lifetimeDiscountPercentage}
                % lifetime platform discount after the free period.
              </p>
              <p>
                {foundingLandlord.benefits.monthlyFreeBoosts} free 7-day boosts
                per calendar month. No rollover.
              </p>
              <p>
                Qualified landlord referrals can unlock extra reward boosts.
                Referral tracking is managed securely by Travel Markets.
              </p>
            </div>
          </div>

          {confirmed && (
            <div className="rounded-3xl border border-white/10 bg-black p-5">
              <label className="text-sm font-semibold text-zinc-200">
                Request listing setup assistance
              </label>
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                className="mt-3 min-h-20 w-full rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-white outline-none transition focus:border-pink-300"
                placeholder="Tell us what you need help with."
              />
              <button
                type="button"
                onClick={submitAssistance}
                disabled={working === "assistance"}
                className="mt-3 rounded-2xl bg-white px-4 py-2 text-sm font-bold text-black disabled:opacity-60"
              >
                {working === "assistance" ? "Sending..." : "Request help"}
              </button>

              <label className="mt-5 block text-sm font-semibold text-zinc-200">
                Early access feedback
              </label>
              <textarea
                value={feedback}
                onChange={(event) => setFeedback(event.target.value)}
                className="mt-3 min-h-20 w-full rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-white outline-none transition focus:border-pink-300"
                placeholder="Share an idea or report friction."
              />
              <button
                type="button"
                onClick={submitFeedback}
                disabled={working === "feedback" || !feedback.trim()}
                className="mt-3 rounded-2xl border border-pink-300/40 bg-pink-500/20 px-4 py-2 text-sm font-bold text-pink-100 disabled:opacity-60"
              >
                {working === "feedback" ? "Sending..." : "Send feedback"}
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
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

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
      <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">{label}</p>
      <p className="mt-2 truncate text-sm font-bold capitalize text-white">{value}</p>
    </div>
  );
}
