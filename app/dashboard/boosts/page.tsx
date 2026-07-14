import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getCurrentUserSubscription,
  getPlanEntitlements,
} from "@/lib/subscriptions/server";
import { PURCHASED_BOOST_OPTIONS } from "@/lib/boosts/config";
import BoostCenterClient, {
  type BoostCenterListing,
  type BoostCenterSummary,
} from "@/components/boosts/BoostCenterClient";

type ListingRow = {
  id: string;
  title: string | null;
  city: string | null;
  location: string | null;
  status: string | null;
  boost_until: string | null;
  created_at: string | null;
  listing_images?: Array<{
    image_url: string | null;
    is_cover: boolean | null;
    sort_order: number | null;
  }> | null;
};

type BoostRow = {
  id: string;
  listing_id: string;
  source: string | null;
  duration_days: number | null;
  started_at: string | null;
  expires_at: string | null;
  status: string | null;
};

function isActiveBoost(boostUntil?: string | null) {
  return Boolean(boostUntil && new Date(boostUntil).getTime() > Date.now());
}

function coverImage(listing: ListingRow) {
  const images = listing.listing_images || [];
  const sorted = [...images].sort(
    (a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999)
  );

  return (
    images.find((image) => image.is_cover)?.image_url ||
    sorted[0]?.image_url ||
    null
  );
}

export default async function BoostCenterPage() {
  const supabase = await createClient();
  const { user, subscription, plan } = await getCurrentUserSubscription();

  if (!user) {
    redirect("/auth");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_admin")
    .eq("id", user.id)
    .maybeSingle();

  const role = String(profile?.role || "").toLowerCase();
  const isOwner =
    profile?.is_admin ||
    role === "owner" ||
    role === "landlord" ||
    role === "host" ||
    role === "admin";

  if (!isOwner || role === "student") {
    redirect("/search");
  }

  const entitlements = getPlanEntitlements(plan);
  const used = Math.max(
    0,
    Number(
      subscription?.included_monthly_boosts_used ??
        subscription?.monthly_boosts_used ??
        0
    )
  );
  const includedTotal = entitlements.monthlyBoosts;
  const includedAvailable = Math.max(0, includedTotal - used);
  const purchasedAvailable = Math.max(
    0,
    Number(subscription?.purchased_boost_credits || 0)
  );

  const { data: listingRows } = await supabase
    .from("listings")
    .select(
      `
      id,
      title,
      city,
      location,
      status,
      boost_until,
      created_at,
      listing_images (
        image_url,
        is_cover,
        sort_order
      )
    `
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const listings = ((listingRows || []) as ListingRow[]) || [];
  const listingIds = listings.map((listing) => listing.id);

  const [{ data: boostRows }, { data: views }, { data: inquiries }] =
    listingIds.length > 0
      ? await Promise.all([
          supabase
            .from("listing_boosts")
            .select("id, listing_id, source, duration_days, started_at, expires_at, status")
            .eq("owner_id", user.id)
            .order("created_at", { ascending: false }),
          supabase.from("listing_views").select("listing_id").in("listing_id", listingIds),
          supabase.from("inquiries").select("listing_id").in("listing_id", listingIds),
        ])
      : [{ data: [] }, { data: [] }, { data: [] }];

  const activeBoosts = ((boostRows || []) as BoostRow[]).filter(
    (boost) => boost.status === "active" && Boolean(boost.expires_at)
  );
  const activeBoostByListing = new Map(
    activeBoosts.map((boost) => [boost.listing_id, boost])
  );
  const viewCounts = new Map<string, number>();
  const inquiryCounts = new Map<string, number>();

  for (const view of (views || []) as Array<{ listing_id: string | null }>) {
    if (!view.listing_id) continue;
    viewCounts.set(view.listing_id, (viewCounts.get(view.listing_id) || 0) + 1);
  }

  for (const inquiry of (inquiries || []) as Array<{ listing_id: string | null }>) {
    if (!inquiry.listing_id) continue;
    inquiryCounts.set(
      inquiry.listing_id,
      (inquiryCounts.get(inquiry.listing_id) || 0) + 1
    );
  }

  const clientListings: BoostCenterListing[] = listings.map((listing) => {
    const activeBoost = activeBoostByListing.get(listing.id);
    const activeBoostIsCurrent = activeBoost
      ? isActiveBoost(activeBoost.expires_at)
      : false;
    const listingBoostActive =
      activeBoostIsCurrent || isActiveBoost(listing.boost_until)
        ? {
            id: activeBoost?.id || null,
            source: activeBoost?.source || "legacy",
            durationDays: activeBoost?.duration_days || null,
            startedAt: activeBoost?.started_at || null,
            expiresAt: activeBoost?.expires_at || listing.boost_until,
          }
        : null;
    const status = listing.status || "available";
    const active = status === "available" || status === "pending";

    return {
      id: listing.id,
      title: listing.title || "Untitled listing",
      location: listing.city || listing.location || "Location not shown",
      status,
      imageUrl: coverImage(listing),
      views: viewCounts.get(listing.id) || 0,
      inquiries: inquiryCounts.get(listing.id) || 0,
      isEligible: active && !listingBoostActive,
      ineligibleReason: !active
        ? status === "draft"
          ? "Publish this listing before boosting"
          : "This listing is not active"
        : listingBoostActive
          ? "Boost active"
          : null,
      activeBoost: listingBoostActive,
    };
  });

  const summary: BoostCenterSummary = {
    includedAvailable,
    includedUsed: used,
    includedTotal,
    purchasedAvailable,
    nextResetDate: subscription?.current_period_end || null,
    plan,
  };

  return (
    <main className="min-h-screen bg-black px-4 py-10 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-pink-300">
              Landlord tools
            </p>
            <h1 className="mt-3 text-4xl font-black">Boost Center</h1>
            <p className="mt-2 max-w-2xl text-slate-400">
              Promote your listings, increase visibility and reach more students.
            </p>
          </div>

          <Link
            href="/billing"
            className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold text-white hover:bg-white/10"
          >
            View plans
          </Link>
        </div>

        <BoostCenterClient
          summary={summary}
          listings={clientListings}
          purchaseOptions={Object.values(PURCHASED_BOOST_OPTIONS)}
        />
      </div>
    </main>
  );
}
