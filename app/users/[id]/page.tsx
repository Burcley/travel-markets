"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import {
  BadgeCheck,
  BriefcaseBusiness,
  CalendarDays,
  Crown,
  GraduationCap,
  Home,
  LockKeyhole,
  MessageCircle,
  ShieldCheck,
  Star,
  Zap,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import ReportButton from "@/components/ReportButton";
import {
  calculateProfileCompletion,
  calculateTrustScore,
  isHostRole,
  normalizeVerificationStatus,
  type VerificationStatus,
  trustScoreLabel,
  trustStars,
  verificationLabel,
} from "@/lib/verification-center";
import {
  getPublicProfileTrustCards,
  isPublicProfileFullyVerified,
} from "@/lib/public-profile-verification-core.mjs";
import FoundingLandlordBadge from "@/components/founding/FoundingLandlordBadge";

const PUBLIC_LISTING_STATUS = "available";

type Profile = {
  id: string;
  full_name: string | null;
  bio: string | null;
  role: string | null;
  avatar_url: string | null;
  is_verified?: boolean | null;
  identity_verified?: boolean | null;
  identity_verification_status?: string | null;
  identity_verified_at?: string | null;
  email_verified_at?: string | null;
  student_verification_status?: string | null;
  student_email_verified?: boolean | null;
  phone_verified_at?: string | null;
  phone_verified?: boolean | null;
  phone_verification_status?: string | null;
  trust_score?: number | null;
  trust_level?: string | null;
  profile_completion_percentage?: number | null;
  created_at?: string | null;
  country?: string | null;
  school?: string | null;
  institution_name?: string | null;
  campus_name?: string | null;
  program?: string | null;
  program_name?: string | null;
  host_type?: string | null;
  property_management_company?: string | null;
  is_founding_landlord?: boolean | null;
  founding_landlord_number?: number | null;
  founding_status?: string | null;
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
  const [propertyRelationshipStatus, setPropertyRelationshipStatus] =
    useState<VerificationStatus>("not_started");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [ownerPlan, setOwnerPlan] = useState("free");
  const [loading, setLoading] = useState(true);

  const isElite = ownerPlan === "elite" || ownerPlan === "legacy_premium";
  const isPremium = ownerPlan === "premium";
  const isHost = isHostRole(profile?.role);
  const identityStatus = normalizeVerificationStatus(
    profile?.identity_verification_status,
    Boolean(profile?.identity_verified || profile?.is_verified)
  );
  const emailStatus = normalizeVerificationStatus(
    profile?.email_verified_at ? "verified" : null,
    Boolean(profile?.email_verified_at)
  );
  const phoneStatus = normalizeVerificationStatus(
    profile?.phone_verification_status,
    Boolean(profile?.phone_verified || profile?.phone_verified_at)
  );
  const studentStatus = normalizeVerificationStatus(
    profile?.student_verification_status,
    Boolean(profile?.student_email_verified)
  );
  const profileCompletion = profile
    ? calculateProfileCompletion({
        profile,
        emailVerified: emailStatus === "verified",
        propertyVerification: isHost
          ? { status: propertyRelationshipStatus }
          : null,
      })
    : 0;
  const publicProfileVerified = isPublicProfileFullyVerified({
    role: profile?.role,
    identityStatus,
    emailStatus,
    phoneStatus,
    studentStatus,
    propertyRelationshipStatus,
  });
  const memberSinceLabel = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString("en-CA", {
        year: "numeric",
        month: "short",
      })
    : null;
  const trustCards = getPublicProfileTrustCards({
    role: profile?.role,
    identityStatus,
    emailStatus,
    phoneStatus,
    studentStatus,
    propertyRelationshipStatus,
    profileCompletion,
    memberSince: memberSinceLabel,
  });
  const trustScore =
    profile?.trust_score ??
    (profile
      ? calculateTrustScore({
          profile,
          emailVerified: emailStatus === "verified",
          propertyVerification: isHost
            ? { status: propertyRelationshipStatus }
            : null,
          reviewCount: reviews.length,
          responseRate: reviews.length ? 75 : 0,
          listingQuality: listings.length ? 75 : 0,
        })
      : 0);
  const foundingNumber =
    profile?.is_founding_landlord && profile.founding_status === "confirmed"
      ? profile.founding_landlord_number || null
      : null;

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
        .select("id, full_name, bio, role, avatar_url, is_verified, identity_verified, identity_verification_status, identity_verified_at, email_verified_at, student_verification_status, student_email_verified, phone_verified, phone_verified_at, phone_verification_status, profile_completion_percentage, created_at, country, school, institution_name, campus_name, program, program_name, host_type, property_management_company, trust_score, trust_level, is_founding_landlord, founding_landlord_number, founding_status")
        .eq("id", userId)
        .maybeSingle();

      if (!profileData) {
        setProfile(null);
        return;
      }

      setProfile(profileData as Profile);
      const publicProfileRole = (profileData as Profile).role;

      if (isHostRole(publicProfileRole)) {
        const verificationRes = await fetch(
          `/api/users/${userId}/public-verification`
        );

        if (verificationRes.ok) {
          const verificationData = await verificationRes.json();
          setPropertyRelationshipStatus(
            normalizeVerificationStatus(
              verificationData.propertyRelationshipStatus
            )
          );
        } else {
          setPropertyRelationshipStatus("not_started");
        }
      } else {
        setPropertyRelationshipStatus("not_started");
      }

      const eligibilityResponse = await fetch("/api/listings/public-eligible-ids", {
        cache: "no-store",
      });
      const eligibilityData = await eligibilityResponse.json().catch(() => null);
      const verifiedListingIds =
        eligibilityResponse.ok && Array.isArray(eligibilityData?.listingIds)
          ? eligibilityData.listingIds.filter(Boolean)
          : [];

      const { data: listingsData } = verifiedListingIds.length
        ? await supabase
            .from("listings")
            .select(
              "id, user_id, title, price, city, campus, address, status, is_featured, featured_until, created_at"
            )
            .eq("user_id", userId)
            .eq("status", PUBLIC_LISTING_STATUS)
            .in("id", verifiedListingIds)
            .order("created_at", { ascending: false })
        : { data: [] };

      const ownerListings = (listingsData || []) as Listing[];
      setListings(ownerListings);

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
          .select("id, full_name, bio, role, avatar_url, is_verified")
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
      <div className="mx-auto max-w-7xl space-y-8">
        <section
          className={`overflow-hidden rounded-[2rem] border p-6 shadow-2xl sm:p-8 ${
            isElite
              ? "border-purple-400/40 bg-[radial-gradient(circle_at_top_left,rgba(168,85,247,0.24),transparent_32%),linear-gradient(135deg,#070707,#020202)]"
              : isPremium
                ? "border-yellow-400/40 bg-[radial-gradient(circle_at_top_left,rgba(250,204,21,0.16),transparent_32%),linear-gradient(135deg,#070707,#020202)]"
                : "border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(255,46,114,0.16),transparent_30%),linear-gradient(135deg,#09090b,#020202)]"
          }`}
        >
          <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex flex-col gap-6 md:flex-row md:items-center">
              <div
                className={`h-28 w-28 overflow-hidden rounded-[2rem] border border-white/10 shadow-2xl ${
                  isElite
                    ? "bg-purple-500/20 ring-2 ring-purple-400/50"
                    : isPremium
                      ? "bg-yellow-400/20 ring-2 ring-yellow-400/50"
                      : "bg-[#FF2E72]/20 ring-2 ring-pink-400/40"
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

                  {publicProfileVerified && (
                    <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-bold text-emerald-200">
                      <BadgeCheck size={16} />
                      Verified by Travel Markets
                    </span>
                  )}

                  <FoundingLandlordBadge number={foundingNumber} compact />
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  <span className="rounded-full border border-white/10 bg-black/40 px-4 py-2 text-sm capitalize text-zinc-300">
                    {isHost ? "Host" : profile.role || "Student"}
                  </span>

                  <span className="rounded-full border border-yellow-500/30 bg-yellow-500/10 px-4 py-2 text-sm text-yellow-200">
                    {t("ratingSummary", {
                      rating: averageRating,
                      count: reviews.length,
                    })}
                  </span>

                  {profile.created_at && (
                    <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-4 py-2 text-sm text-zinc-300">
                      <CalendarDays size={15} />
                      Member since{" "}
                      {new Date(profile.created_at).toLocaleDateString("en-CA", {
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  )}
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {trustCards.map((card) => (
                    <TrustIndicator
                      key={card.key}
                      label={card.label}
                      active={card.active}
                      value={
                        card.value ||
                        (card.status ? verificationLabel(card.status) : undefined)
                      }
                    />
                  ))}
                </div>

                <p className="mt-5 max-w-2xl leading-7 text-gray-300">
                  {profile.bio ||
                    t("defaultBio")}
                </p>

                <div className="mt-5 flex flex-wrap gap-3">
                  {profile.country && (
                    <ProfilePill icon={<ShieldCheck size={15} />} label={profile.country} />
                  )}
                  {!isHost && (profile.institution_name || profile.school) && (
                    <ProfilePill
                      icon={<GraduationCap size={15} />}
                      label={profile.institution_name || profile.school || ""}
                    />
                  )}
                  {!isHost && (profile.program_name || profile.program) && (
                    <ProfilePill
                      icon={<GraduationCap size={15} />}
                      label={profile.program_name || profile.program || ""}
                    />
                  )}
                  {isHost && profile.host_type && (
                    <ProfilePill icon={<Home size={15} />} label={profile.host_type} />
                  )}
                  {isHost && profile.property_management_company && (
                    <ProfilePill
                      icon={<BriefcaseBusiness size={15} />}
                      label={profile.property_management_company}
                    />
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2">
                <ProfileStat label={t("listings")} value={listings.length} />
                <ProfileStat label={t("rating")} value={averageRating} />
                <ProfileStat label={t("reviews")} value={reviews.length} />
                <ProfileStat
                  label={t("verifiedStat")}
                  value={publicProfileVerified ? t("yes") : t("no")}
                />
              </div>

              <div className="rounded-3xl border border-white/10 bg-black/45 p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-white">Trust score</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      Verification, completion, reviews, and listing quality.
                    </p>
                  </div>
                  <p className="text-3xl font-black text-white">{trustScore}/100</p>
                </div>
                <p className="mt-3 text-sm font-bold text-pink-100">
                  {trustStars(trustScore)} {trustScoreLabel(trustScore)}
                </p>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-[#FF2E72]"
                    style={{ width: `${Math.min(trustScore, 100)}%` }}
                  />
                </div>
              </div>

              {isOwnProfile && (
                <div className="grid gap-3">
                  <Link
                    href="/settings"
                    className="rounded-2xl bg-white px-5 py-3 text-center text-sm font-black text-black transition hover:bg-zinc-200"
                  >
                    Edit profile
                  </Link>
                  <Link
                    href="/dashboard/verification"
                    className="rounded-2xl border border-pink-400/30 bg-pink-500/10 px-5 py-3 text-center text-sm font-black text-pink-100 transition hover:bg-pink-500/20"
                  >
                    Complete verification
                  </Link>
                </div>
              )}

              {!isOwnProfile && (
                <div className="pt-2">
                  <ReportButton targetType="user" targetId={userId} />
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_380px]">
          <div className="rounded-[2rem] border border-white/10 bg-[#070707] p-8 shadow-xl">
            <h2 className="text-2xl font-bold">
              {isHost ? "About this host" : "About this student"}
            </h2>
            <p className="mt-4 leading-7 text-gray-300">
              {profile.bio ||
                (isHost ? t("aboutHostFallback") : t("defaultBio"))}
            </p>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-[#070707] p-8 shadow-xl">
            <div className="mb-6 flex items-center gap-2">
              <ShieldCheck className="text-emerald-300" size={22} />
              <h2 className="text-2xl font-bold">
                {isHost ? t("hostHighlights") : "Profile highlights"}
              </h2>
            </div>

            <div className="space-y-4">
              {isHost && (isPremium || isElite) && (
                <Highlight
                  icon={<Crown size={16} />}
                  label={isElite ? "Elite Property Manager" : "Premium Landlord"}
                  text={t("premiumOwnerText")}
                  color="text-yellow-300"
                />
              )}

              {publicProfileVerified && (
                <Highlight
                  icon={<BadgeCheck size={16} />}
                  label={t("verifiedProfile")}
                  text={t("verifiedProfileText")}
                  color="text-blue-300"
                />
              )}

              {isHost && (
                <Highlight
                  icon={<Home size={16} />}
                  label={t("activeListings", { count: listings.length })}
                  text={t("activeListingsText")}
                  color="text-white"
                />
              )}

              <Highlight
                icon={<Star size={16} />}
                label={t("averageRating", { rating: averageRating })}
                text={t("averageRatingText")}
                color="text-yellow-300"
              />

              {reviews.length > 0 && (
                <Highlight
                  icon={<MessageCircle size={16} />}
                  label={t("fastResponseHost")}
                  text={t("fastResponseHostText")}
                  color="text-emerald-300"
                />
              )}

              {isHost ? (
                <Highlight
                  icon={<LockKeyhole size={16} />}
                  label={t("addressProtectionShort")}
                  text={t("addressProtectionText")}
                  color="text-emerald-300"
                />
              ) : (
                <Highlight
                  icon={<GraduationCap size={16} />}
                  label={
                    profile.institution_name ||
                    profile.school ||
                    "Student profile"
                  }
                  text="Student verification and profile details help hosts recognize trusted renters."
                  color="text-sky-300"
                />
              )}

              {isHost && propertyRelationshipStatus === "verified" && (
                <Highlight
                  icon={<Zap size={16} />}
                  label={t("trustedHost")}
                  text={t("trustedHostText")}
                  color="text-sky-300"
                />
              )}
            </div>
          </div>
        </section>

        {isHost && featuredListings.length > 0 && (
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

        {isHost && (
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
        )}

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

function ProfilePill({ icon, label }: { icon: ReactNode; label: string }) {
  if (!label) return null;

  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-zinc-300">
      <span className="text-pink-200">{icon}</span>
      {label}
    </span>
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
