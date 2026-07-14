"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import {
  BadgeCheck,
  Crown,
  Home,
  LockKeyhole,
  MessageCircle,
  ShieldCheck,
  Star,
  Zap,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import ReportButton from "@/components/ReportButton";

type Profile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  bio: string | null;
  role: string | null;
  avatar_url: string | null;
  is_verified?: boolean | null;
  identity_verification_status?: string | null;
  identity_verified_at?: string | null;
  student_verification_status?: string | null;
  phone_verified_at?: string | null;
  profile_completion_percentage?: number | null;
  created_at?: string | null;
};

type Listing = {
  id: string;
  user_id: string | null;
  title: string;
  price: number | null;
  city: string | null;
  campus?: string | null;
  address: string | null;
  status?: string | null;
  is_featured?: boolean | null;
  featured_until?: string | null;
  created_at: string;
};

type ListingImage = {
  listing_id: string;
  image_url: string;
  sort_order: number | null;
  is_cover: boolean | null;
};

type Review = {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  reviewer_id: string;
};

export default function PublicUserProfilePage() {
  const t = useTranslations("finalBatchD.publicProfile");
  const params = useParams();
  const supabase = createClient();
  const userId = params.id as string;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [images, setImages] = useState<ListingImage[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewers, setReviewers] = useState<Profile[]>([]);
  const [hasVerifiedPropertyRelationship, setHasVerifiedPropertyRelationship] =
    useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [ownerPlan, setOwnerPlan] = useState("free");
  const [loading, setLoading] = useState(true);

  const isElite = ownerPlan === "elite" || ownerPlan === "legacy_premium";
  const isPremium = ownerPlan === "premium";

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function loadData() {
    try {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      setCurrentUserId(user?.id || null);

      const subRes = await fetch(`/api/owner-subscription?userId=${userId}`);

      if (subRes.ok) {
        const data = await subRes.json();
        setOwnerPlan(data.plan || "free");
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("id, full_name, phone, bio, role, avatar_url, is_verified, identity_verification_status, identity_verified_at, student_verification_status, phone_verified_at, profile_completion_percentage, created_at")
        .eq("id", userId)
        .maybeSingle();

      if (!profileData) {
        setProfile(null);
        return;
      }

      setProfile(profileData as Profile);

      const { data: listingsData } = await supabase
        .from("listings")
        .select(
          "id, user_id, title, price, city, campus, address, status, is_featured, featured_until, created_at"
        )
        .eq("user_id", userId)
        .neq("status", "rented")
        .order("created_at", { ascending: false });

      const ownerListings = (listingsData || []) as Listing[];
      setListings(ownerListings);

      if (ownerListings.length > 0) {
        const { data: verificationData } = await supabase
          .from("public_listing_verification_status")
          .select("listing_id, status")
          .in(
            "listing_id",
            ownerListings.map((listing) => listing.id)
          )
          .eq("status", "verified")
          .limit(1);

        setHasVerifiedPropertyRelationship(Boolean(verificationData?.length));
      } else {
        setHasVerifiedPropertyRelationship(false);
      }

      if (ownerListings.length > 0) {
        const listingIds = ownerListings.map((listing) => listing.id);

        const { data: imageData } = await supabase
          .from("listing_images")
          .select("listing_id, image_url, sort_order, is_cover")
          .in("listing_id", listingIds);

        setImages((imageData || []) as ListingImage[]);
      } else {
        setImages([]);
      }

      const { data: reviewData } = await supabase
        .from("reviews")
        .select("id, rating, comment, created_at, reviewer_id")
        .eq("owner_id", userId)
        .order("created_at", { ascending: false });

      const ownerReviews = (reviewData || []) as Review[];
      setReviews(ownerReviews);

      const reviewerIds = Array.from(
        new Set(ownerReviews.map((review) => review.reviewer_id).filter(Boolean))
      );

      if (reviewerIds.length > 0) {
        const { data: reviewerData } = await supabase
          .from("profiles")
          .select("id, full_name, phone, bio, role, avatar_url, is_verified")
          .in("id", reviewerIds);

        setReviewers((reviewerData || []) as Profile[]);
      } else {
        setReviewers([]);
      }
    } finally {
      setLoading(false);
    }
  }

  const averageRating = useMemo(() => {
    if (reviews.length === 0) return "0.0";
    const total = reviews.reduce((sum, review) => sum + (review.rating || 0), 0);
    return (total / reviews.length).toFixed(1);
  }, [reviews]);

  const featuredListings = useMemo(() => {
    return listings
      .filter((listing) => isFeaturedActive(listing.featured_until, listing.is_featured))
      .slice(0, 3);
  }, [listings]);

  const otherListings = useMemo(() => {
    const featuredIds = new Set(featuredListings.map((listing) => listing.id));
    return listings.filter((listing) => !featuredIds.has(listing.id));
  }, [featuredListings, listings]);

  const isOwnProfile = currentUserId === userId;

  function getDisplayName() {
    return profile?.full_name || t("propertyOwner");
  }

  function getListingImage(listingId: string) {
    const listingImages = images.filter((image) => image.listing_id === listingId);

    const cover = listingImages.find((image) => image.is_cover && image.image_url);

    if (cover?.image_url) return cover.image_url;

    const sorted = [...listingImages].sort(
      (a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999)
    );

    return sorted[0]?.image_url || null;
  }

  function getReviewer(reviewerId: string) {
    return reviewers.find((reviewer) => reviewer.id === reviewerId);
  }

  function formatDate(date: string) {
    return new Date(date).toLocaleDateString("en-CA", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black px-6 py-10 text-white">
        {t("loading")}
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="min-h-screen bg-black px-6 py-10 text-white">
        {t("notFound")}
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-4 py-8 text-white">
      <div className="mx-auto max-w-7xl space-y-10">
        <section
          className={`overflow-hidden rounded-[2rem] border p-8 shadow-2xl ${
            isElite
              ? "border-purple-400/40 bg-gradient-to-br from-purple-500/15 via-[#070707] to-black"
              : isPremium
              ? "border-yellow-400/40 bg-gradient-to-br from-yellow-500/15 via-[#070707] to-black"
              : "border-gray-800 bg-[#070707]"
          }`}
        >
          <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex flex-col gap-6 md:flex-row md:items-center">
              <div
                className={`h-28 w-28 overflow-hidden rounded-full ${
                  isElite
                    ? "bg-purple-500/20 ring-2 ring-purple-400/50"
                    : isPremium
                    ? "bg-yellow-400/20 ring-2 ring-yellow-400/50"
                    : "bg-gray-800"
                }`}
              >
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={getDisplayName()}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-5xl font-black">
                    {getDisplayName().charAt(0)}
                  </div>
                )}
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-4xl font-black tracking-tight md:text-5xl">
                    {getDisplayName()}
                  </h1>

                  {(isPremium || isElite) && (
                    <span className="inline-flex items-center gap-2 rounded-full bg-yellow-400 px-4 py-2 text-sm font-black text-black">
                      <Crown size={16} />
                      {isElite ? "Elite Property Manager" : "Premium Landlord"}
                    </span>
                  )}

                  {profile.is_verified && (
                    <span className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-sm font-bold text-blue-300">
                      <BadgeCheck size={16} />
                      {t("verified")}
                    </span>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  <span className="rounded-full border border-gray-700 bg-black/40 px-4 py-2 text-sm capitalize text-gray-300">
                    {profile.role || t("ownerRole")}
                  </span>

                  <span className="rounded-full border border-yellow-500/30 bg-yellow-500/10 px-4 py-2 text-sm text-yellow-300">
                    {t("ratingSummary", {
                      rating: averageRating,
                      count: reviews.length,
                    })}
                  </span>

                  <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300">
                    {t("addressProtection")}
                  </span>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <TrustIndicator
                    label="Identity verified"
                    active={
                      Boolean(profile.is_verified) ||
                      profile.identity_verification_status === "approved"
                    }
                  />
                  <TrustIndicator label="Email verified" active />
                  <TrustIndicator
                    label="Phone verified"
                    active={Boolean(profile.phone_verified_at)}
                  />
                  <TrustIndicator
                    label="Student status verified"
                    active={profile.student_verification_status === "approved"}
                  />
                  <TrustIndicator
                    label="Property relationship verified"
                    active={hasVerifiedPropertyRelationship}
                  />
                  <TrustIndicator
                    label="Profile completeness"
                    active={(profile.profile_completion_percentage || 0) >= 70}
                    value={
                      profile.profile_completion_percentage == null
                        ? "Not calculated"
                        : `${profile.profile_completion_percentage}%`
                    }
                  />
                  <TrustIndicator
                    label="Member since"
                    active={Boolean(profile.created_at)}
                    value={
                      profile.created_at
                        ? new Date(profile.created_at).toLocaleDateString("en-CA", {
                            year: "numeric",
                            month: "short",
                          })
                        : "Not available"
                    }
                  />
                </div>

                <p className="mt-5 max-w-2xl leading-7 text-gray-300">
                  {profile.bio ||
                    t("defaultBio")}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2">
                <ProfileStat label={t("listings")} value={listings.length} />
                <ProfileStat label={t("rating")} value={averageRating} />
                <ProfileStat label={t("reviews")} value={reviews.length} />
                <ProfileStat
                  label={t("verifiedStat")}
                  value={profile.is_verified ? t("yes") : t("no")}
                />
              </div>

              {!isOwnProfile && (
                <div className="pt-2">
                  <ReportButton targetType="user" targetId={userId} />
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_380px]">
          <div className="rounded-[2rem] border border-gray-800 bg-[#070707] p-8">
            <h2 className="text-2xl font-bold">{t("aboutHost")}</h2>
            <p className="mt-4 leading-7 text-gray-300">
              {profile.bio ||
                t("aboutHostFallback")}
            </p>
          </div>

          <div className="rounded-[2rem] border border-gray-800 bg-[#070707] p-8">
            <div className="mb-6 flex items-center gap-2">
              <ShieldCheck className="text-emerald-300" size={22} />
              <h2 className="text-2xl font-bold">{t("hostHighlights")}</h2>
            </div>

            <div className="space-y-4">
              {(isPremium || isElite) && (
                <Highlight
                  icon={<Crown size={16} />}
                  label={isElite ? "Elite Property Manager" : "Premium Landlord"}
                  text={t("premiumOwnerText")}
                  color="text-yellow-300"
                />
              )}

              {profile.is_verified && (
                <Highlight
                  icon={<BadgeCheck size={16} />}
                  label={t("verifiedProfile")}
                  text={t("verifiedProfileText")}
                  color="text-blue-300"
                />
              )}

              <Highlight
                icon={<Home size={16} />}
                label={t("activeListings", { count: listings.length })}
                text={t("activeListingsText")}
                color="text-white"
              />

              <Highlight
                icon={<Star size={16} />}
                label={t("averageRating", { rating: averageRating })}
                text={t("averageRatingText")}
                color="text-yellow-300"
              />

              <Highlight
                icon={<MessageCircle size={16} />}
                label={t("fastResponseHost")}
                text={t("fastResponseHostText")}
                color="text-emerald-300"
              />

              <Highlight
                icon={<LockKeyhole size={16} />}
                label={t("addressProtectionShort")}
                text={t("addressProtectionText")}
                color="text-emerald-300"
              />

              <Highlight
                icon={<Zap size={16} />}
                label={t("trustedHost")}
                text={t("trustedHostText")}
                color="text-sky-300"
              />
            </div>
          </div>
        </section>

        {featuredListings.length > 0 && (
          <section>
            <div className="mb-5 flex items-end justify-between">
              <div>
                <h2 className="text-3xl font-bold">{t("featuredListings")}</h2>
                <p className="mt-2 text-sm text-gray-400">
                  {t("featuredListingsText")}
                </p>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {featuredListings.map((listing) => (
                <OwnerListingCard
                  key={listing.id}
                  listing={listing}
                  image={getListingImage(listing.id)}
                  ownerPlan={ownerPlan}
                  featured
                />
              ))}
            </div>
          </section>
        )}

        <section>
          <div className="mb-5">
            <h2 className="text-3xl font-bold">{t("currentListings")}</h2>
            <p className="mt-2 text-sm text-gray-400">
              {t("currentListingsText", { name: getDisplayName() })}
            </p>
          </div>

          {listings.length === 0 ? (
            <div className="rounded-3xl border border-gray-800 bg-[#070707] p-8 text-gray-400">
              {t("noListings")}
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-3">
              {(featuredListings.length > 0 ? otherListings : listings).map(
                (listing) => (
                  <OwnerListingCard
                    key={listing.id}
                    listing={listing}
                    image={getListingImage(listing.id)}
                    ownerPlan={ownerPlan}
                    featured={isFeaturedActive(
                      listing.featured_until,
                      listing.is_featured
                    )}
                  />
                )
              )}
            </div>
          )}
        </section>

        <section>
          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-3xl font-bold">{t("recentReviews")}</h2>
              <p className="mt-2 text-sm text-gray-400">
                {t("recentReviewsText")}
              </p>
            </div>

            <span className="rounded-full border border-yellow-500/30 bg-yellow-500/10 px-4 py-2 text-sm text-yellow-300">
              {t("averageBadge", { rating: averageRating })}
            </span>
          </div>

          {reviews.length === 0 ? (
            <div className="rounded-3xl border border-gray-800 bg-[#070707] p-8 text-gray-400">
              {t("noReviews")}
            </div>
          ) : (
            <div className="grid gap-5 md:grid-cols-2">
              {reviews.map((review) => {
                const reviewer = getReviewer(review.reviewer_id);
                const reviewerName = reviewer?.full_name || t("anonymousUser");

                return (
                  <div
                    key={review.id}
                    className="rounded-3xl border border-gray-800 bg-[#070707] p-6"
                  >
                    <div className="flex items-start gap-4">
                      <div className="h-12 w-12 overflow-hidden rounded-full bg-gray-800">
                        {reviewer?.avatar_url ? (
                          <img
                            src={reviewer.avatar_url}
                            alt={reviewerName}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center font-bold">
                            {reviewerName.charAt(0)}
                          </div>
                        )}
                      </div>

                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold">{reviewerName}</p>

                          {reviewer?.is_verified && (
                            <span className="rounded-full bg-blue-500/10 px-2 py-1 text-xs font-semibold text-blue-300">
                              {t("verifiedCheck")}
                            </span>
                          )}

                          <span className="text-sm text-gray-500">
                            {formatDate(review.created_at)}
                          </span>
                        </div>

                        <p className="mt-2 text-yellow-400">
                          {"★".repeat(Math.max(0, Math.min(5, review.rating)))}
                          <span className="text-gray-700">
                            {"★".repeat(
                              Math.max(0, 5 - Math.max(0, Math.min(5, review.rating)))
                            )}
                          </span>
                        </p>

                        <p className="mt-3 leading-7 text-gray-300">
                          {review.comment || t("noComment")}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function isFeaturedActive(
  featuredUntil?: string | null,
  isFeatured?: boolean | null
) {
  if (!isFeatured) return false;
  if (!featuredUntil) return true;
  return new Date(featuredUntil).getTime() > Date.now();
}

function ProfileStat({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-2xl border border-gray-800 bg-black/70 px-5 py-4 text-center">
      <p className="text-2xl font-black text-white">{value}</p>
      <p className="mt-1 text-xs text-gray-500">{label}</p>
    </div>
  );
}

function Highlight({
  icon,
  label,
  text,
  color,
}: {
  icon: ReactNode;
  label: string;
  text: string;
  color: string;
}) {
  return (
    <div className="flex gap-3">
      <div className={`mt-0.5 ${color}`}>{icon}</div>
      <div>
        <p className="text-sm font-semibold text-white">{label}</p>
        <p className="mt-0.5 text-xs leading-5 text-gray-400">{text}</p>
      </div>
    </div>
  );
}

function TrustIndicator({
  label,
  active,
  value,
}: {
  label: string;
  active: boolean;
  value?: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-800 bg-black/50 p-4">
      <p
        className={`text-xs font-bold uppercase tracking-wide ${
          active ? "text-emerald-300" : "text-gray-500"
        }`}
      >
        {active ? "✓" : "•"} {label}
      </p>
      {value && <p className="mt-2 text-sm text-gray-300">{value}</p>}
    </div>
  );
}

function OwnerListingCard({
  listing,
  image,
  ownerPlan,
  featured,
}: {
  listing: Listing;
  image: string | null;
  ownerPlan: string;
  featured?: boolean;
}) {
  const t = useTranslations("finalBatchD.publicProfile");
  const isPremium =
    ownerPlan === "premium" ||
    ownerPlan === "elite" ||
    ownerPlan === "legacy_premium";

  return (
    <Link
      href={`/listings/${listing.id}`}
      className={`overflow-hidden rounded-3xl border bg-[#070707] transition hover:-translate-y-1 ${
        featured
          ? "border-yellow-400/50"
          : ownerPlan === "elite" || ownerPlan === "legacy_premium"
          ? "border-purple-400/30"
          : isPremium
          ? "border-yellow-400/30"
          : "border-gray-800 hover:border-gray-600"
      }`}
    >
      <div className="relative h-56 bg-gray-900">
        {image ? (
          <img
            src={image}
            alt={listing.title}
            className="h-full w-full object-cover transition duration-500 hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-gray-500">
            {t("noImage")}
          </div>
        )}

        <div className="absolute left-3 top-3 flex flex-wrap gap-2">
          {featured && (
            <span className="rounded-full bg-yellow-400 px-3 py-1 text-xs font-black text-black">
              {t("featuredBadge")}
            </span>
          )}

          {isPremium && (
            <span className="rounded-full bg-yellow-400 px-3 py-1 text-xs font-black text-black">
              {t("premiumBadge")}
            </span>
          )}
          {(ownerPlan === "elite" || ownerPlan === "legacy_premium") && (
            <span className="rounded-full bg-purple-500 px-3 py-1 text-xs font-black text-white">
              Elite
            </span>
          )}
        </div>

        <div className="absolute bottom-3 left-3 rounded-full bg-white px-3 py-1 text-sm font-black text-black">
          ${listing.price || 0}{t("perMonthCompact")}
        </div>
      </div>

      <div className="p-5">
        <h3 className="line-clamp-1 text-xl font-bold">{listing.title}</h3>

        <p className="mt-2 line-clamp-1 text-sm text-gray-400">
          {[listing.city, listing.campus].filter(Boolean).join(" • ") ||
            t("locationNotProvided")}
        </p>

        <p className="mt-4 text-xs text-gray-500">
          {t("addressUnlockNote")}
        </p>
      </div>
    </Link>
  );
}
