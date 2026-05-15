"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
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
};

type Listing = {
  id: string;
  user_id: string | null;
  title: string;
  price: number | null;
  city: string | null;
  address: string | null;
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
  const params = useParams();
  const supabase = createClient();
  const userId = params.id as string;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [images, setImages] = useState<ListingImage[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewers, setReviewers] = useState<Profile[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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

      const { data: profileData } = await supabase
        .from("profiles")
        .select("id, full_name, phone, bio, role, avatar_url, is_verified")
        .eq("id", userId)
        .maybeSingle();

      if (!profileData) {
        setProfile(null);
        return;
      }

      setProfile(profileData as Profile);

      const { data: listingsData } = await supabase
        .from("listings")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

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
        new Set(ownerReviews.map((review) => review.reviewer_id))
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
    const total = reviews.reduce((sum, review) => sum + review.rating, 0);
    return (total / reviews.length).toFixed(1);
  }, [reviews]);

  const isOwnProfile = currentUserId === userId;

  function getDisplayName() {
    return profile?.full_name || "Property Owner";
  }

  function getListingImage(listingId: string) {
    const listingImages = images.filter(
      (image) => image.listing_id === listingId
    );

    const cover = listingImages.find(
      (image) => image.is_cover && image.image_url
    );

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
        Loading profile...
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="min-h-screen bg-black px-6 py-10 text-white">
        Profile not found.
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-4 py-8 text-white">
      <div className="mx-auto max-w-6xl space-y-10">
        <section className="rounded-3xl border border-gray-800 bg-[#070707] p-8">
          <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-5">
              <div className="h-24 w-24 overflow-hidden rounded-full bg-gray-800">
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={getDisplayName()}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-4xl font-bold">
                    {getDisplayName().charAt(0)}
                  </div>
                )}
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-4xl font-bold">{getDisplayName()}</h1>

                  {profile.is_verified && (
                    <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-sm font-semibold text-blue-300">
                      ✓ Verified
                    </span>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap gap-3">
                  <span className="rounded-full border border-gray-700 px-4 py-2 text-sm capitalize text-gray-300">
                    {profile.role || "owner"}
                  </span>

                  {profile.phone && (
                    <span className="rounded-full border border-gray-700 px-4 py-2 text-sm text-gray-300">
                      {profile.phone}
                    </span>
                  )}

                  <span className="rounded-full border border-yellow-500/30 bg-yellow-500/10 px-4 py-2 text-sm text-yellow-300">
                    ⭐ {averageRating} ({reviews.length} review
                    {reviews.length === 1 ? "" : "s"})
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="rounded-2xl border border-gray-800 bg-black px-8 py-5 text-center">
                <p className="text-4xl font-bold">{listings.length}</p>
                <p className="text-sm text-gray-400">Listings</p>
              </div>

              {!isOwnProfile && (
                <ReportButton targetType="user" targetId={userId} />
              )}
            </div>
          </div>

          <div className="mt-8 rounded-2xl border border-gray-800 bg-black p-6">
            <h2 className="text-2xl font-bold">About</h2>
            <p className="mt-4 leading-7 text-gray-300">
              {profile.bio || "No bio available."}
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-3xl font-bold">Reviews</h2>

          {reviews.length === 0 ? (
            <div className="mt-5 rounded-3xl border border-gray-800 bg-[#070707] p-8 text-gray-400">
              No reviews yet.
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              {reviews.map((review) => {
                const reviewer = getReviewer(review.reviewer_id);
                const reviewerName = reviewer?.full_name || "Anonymous user";

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
                              ✓ Verified
                            </span>
                          )}

                          <span className="text-sm text-gray-500">
                            {formatDate(review.created_at)}
                          </span>
                        </div>

                        <p className="mt-2 text-yellow-400">
                          {"★".repeat(review.rating)}
                          <span className="text-gray-700">
                            {"★".repeat(5 - review.rating)}
                          </span>
                        </p>

                        <p className="mt-3 leading-7 text-gray-300">
                          {review.comment || "No comment provided."}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section>
          <h2 className="text-3xl font-bold">Listings</h2>

          {listings.length === 0 ? (
            <div className="mt-5 rounded-3xl border border-gray-800 bg-[#070707] p-8 text-gray-400">
              No listings.
            </div>
          ) : (
            <div className="mt-5 grid gap-6 md:grid-cols-3">
              {listings.map((listing) => {
                const image = getListingImage(listing.id);

                return (
                  <Link
                    key={listing.id}
                    href={`/listings/${listing.id}`}
                    className="overflow-hidden rounded-3xl border border-gray-800 bg-[#070707] transition hover:border-gray-600"
                  >
                    <div className="h-56 bg-gray-900">
                      {image ? (
                        <img
                          src={image}
                          alt={listing.title}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-gray-500">
                          No image
                        </div>
                      )}
                    </div>

                    <div className="p-5">
                      <h3 className="line-clamp-1 text-xl font-bold">
                        {listing.title}
                      </h3>

                      <p className="mt-2 line-clamp-1 text-sm text-gray-400">
                        {[listing.city, listing.address]
                          .filter(Boolean)
                          .join(", ") || "Location not provided"}
                      </p>

                      <p className="mt-4 text-2xl font-bold">
                        ${listing.price || 0}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}