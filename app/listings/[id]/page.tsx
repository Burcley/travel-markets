"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ReportButton from "@/components/ReportButton";
import SaveListingButton from "@/components/SaveListingButton";
import SimilarListings from "@/components/SimilarListings";
import OwnerTrustCard from "@/components/OwnerTrustCard";
import ListingImageGallery from "@/components/listings/listing-image-gallery";

type Profile = {
  id: string;
  full_name: string | null;
  role: string | null;
  bio: string | null;
  phone: string | null;
  avatar_url: string | null;
  is_verified: boolean | null;
};

type Listing = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  price: number | null;
  city: string | null;
  campus: string | null;
  address: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  guests: number | null;
  roommates: number | null;
  amenities: string[] | null;
  status: "available" | "pending" | "rented" | null;
};

type ListingImage = {
  id: string;
  listing_id: string;
  image_url: string;
  image_path: string | null;
  storage_path?: string | null;
  sort_order: number | null;
  is_cover: boolean | null;
  created_at?: string | null;
};

type Review = {
  id: string;
  listing_id: string;
  owner_id: string;
  reviewer_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
};

export default function ListingDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const supabase = useMemo(() => createClient(), []);

  const [listing, setListing] = useState<Listing | null>(null);
  const [owner, setOwner] = useState<Profile | null>(null);
  const [images, setImages] = useState<ListingImage[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewers, setReviewers] = useState<Profile[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [addressUnlocked, setAddressUnlocked] = useState(false);
  const [hasAcceptedInquiry, setHasAcceptedInquiry] = useState(false);
  const [hasAcceptedViewing, setHasAcceptedViewing] = useState(false);

  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [pageError, setPageError] = useState("");

  const isOwner = currentUserId && listing?.user_id === currentUserId;
  const status = listing?.status || "available";

  const averageRating = useMemo(() => {
    if (reviews.length === 0) return "0.0";

    const total = reviews.reduce((sum, review) => {
      const safeRating = Number.isFinite(review.rating) ? review.rating : 0;
      return sum + safeRating;
    }, 0);

    return (total / reviews.length).toFixed(1);
  }, [reviews]);

  const galleryImages = useMemo(() => {
    return images.map((image) => ({
      id: image.id,
      listing_id: image.listing_id,
      image_url: image.image_url,
      storage_path: image.storage_path || image.image_path || null,
      sort_order: image.sort_order,
      is_cover: image.is_cover,
      created_at: image.created_at || null,
    }));
  }, [images]);

  useEffect(() => {
    loadListing();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function trackRecentlyViewed(listingId: string) {
    try {
      await fetch("/api/recently-viewed", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ listingId }),
      });
    } catch (error) {
      console.error("TRACK RECENTLY VIEWED ERROR:", error);
    }
  }

  async function loadListing() {
    try {
      setLoading(true);
      setPageError("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      setCurrentUserId(user?.id || null);

      const { data: listingData, error: listingError } = await supabase
        .from("listings")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (listingError) {
        console.error("LISTING FETCH ERROR:", listingError);
        setPageError(listingError.message);
        setListing(null);
        return;
      }

      if (!listingData) {
        setPageError("Listing not found.");
        setListing(null);
        return;
      }

      const safeListing = listingData as Listing;
      setListing(safeListing);

      if (user?.id && user.id !== safeListing.user_id) {
        trackRecentlyViewed(safeListing.id);
      }

      let canSeeAddress = false;
      let acceptedInquiryExists = false;
      let acceptedViewingExists = false;

      if (user?.id === safeListing.user_id) {
        canSeeAddress = true;
      }

      if (user && user.id !== safeListing.user_id) {
        const { data: acceptedInquiry, error: inquiryError } = await supabase
          .from("inquiries")
          .select("id")
          .eq("listing_id", safeListing.id)
          .eq("requester_id", user.id)
          .eq("status", "accepted")
          .maybeSingle();

        if (inquiryError) {
          console.error("ACCEPTED INQUIRY CHECK ERROR:", inquiryError);
        }

        if (acceptedInquiry) {
          acceptedInquiryExists = true;
        }

        const { data: acceptedViewing, error: viewingError } = await supabase
          .from("viewings")
          .select("id")
          .eq("listing_id", safeListing.id)
          .eq("requester_id", user.id)
          .eq("status", "accepted")
          .maybeSingle();

        if (viewingError) {
          console.error("ACCEPTED VIEWING CHECK ERROR:", viewingError);
        }

        if (acceptedViewing) {
          acceptedViewingExists = true;
          canSeeAddress = true;
        }
      }

      setHasAcceptedInquiry(acceptedInquiryExists);
      setHasAcceptedViewing(acceptedViewingExists);
      setAddressUnlocked(canSeeAddress);

      const { data: ownerData, error: ownerError } = await supabase
        .from("profiles")
        .select("id, full_name, role, bio, phone, avatar_url, is_verified, identity_verified, identity_verification_status, trust_score, trust_level, phone_verified, student_email_verified")
        .eq("id", safeListing.user_id)
        .maybeSingle();

      if (ownerError) {
        console.error("OWNER FETCH ERROR:", ownerError);
      }

      setOwner((ownerData as Profile) || null);

      const { data: imageData, error: imageError } = await supabase
        .from("listing_images")
        .select("*")
        .eq("listing_id", id)
        .order("sort_order", { ascending: true });

      if (imageError) {
        console.error("IMAGE FETCH ERROR:", imageError);
      }

      const sortedImages = ((imageData || []) as ListingImage[]).sort(
        (a, b) => {
          if (a.is_cover && !b.is_cover) return -1;
          if (!a.is_cover && b.is_cover) return 1;
          return (a.sort_order || 0) - (b.sort_order || 0);
        }
      );

      setImages(sortedImages);

      const { data: reviewData, error: reviewError } = await supabase
        .from("reviews")
        .select(
          "id, listing_id, owner_id, reviewer_id, rating, comment, created_at"
        )
        .eq("listing_id", id)
        .order("created_at", { ascending: false });

      if (reviewError) {
        console.error("REVIEW FETCH ERROR:", reviewError);
      }

      const listingReviews = (reviewData || []) as Review[];
      setReviews(listingReviews);

      const reviewerIds = Array.from(
        new Set(
          listingReviews.map((review) => review.reviewer_id).filter(Boolean)
        )
      );

      if (reviewerIds.length > 0) {
        const { data: reviewerData, error: reviewerError } = await supabase
          .from("profiles")
          .select("id, full_name, role, bio, phone, avatar_url, is_verified, identity_verified, identity_verification_status, trust_score, trust_level, phone_verified, student_email_verified")
          .in("id", reviewerIds);

        if (reviewerError) {
          console.error("REVIEWER FETCH ERROR:", reviewerError);
        }

        setReviewers((reviewerData || []) as Profile[]);
      } else {
        setReviewers([]);
      }
    } catch (error: any) {
      console.error("LISTING PAGE CRASH:", error);
      setPageError(error?.message || "Listing page crashed. Check console.");
      setListing(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleContactOwner() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/auth");
      return;
    }

    if (!listing) return;

    if (listing.status === "rented") {
      alert("This listing is already rented.");
      return;
    }

    if (user.id === listing.user_id) {
      alert("You cannot contact yourself for your own listing.");
      return;
    }

    router.push(`/listings/${listing.id}/contact`);
  }

  async function handleDeleteListing() {
    if (!listing) return;
    if (!confirm("Are you sure you want to delete this listing?")) return;

    try {
      setDeleting(true);

      const imagePaths = images
        .map((image) => image.image_path || image.storage_path)
        .filter(Boolean) as string[];

      if (imagePaths.length > 0) {
        await supabase.storage.from("listing-images").remove(imagePaths);
      }

      await supabase
        .from("listing_images")
        .delete()
        .eq("listing_id", listing.id);

      const { error } = await supabase
        .from("listings")
        .delete()
        .eq("id", listing.id)
        .eq("user_id", currentUserId);

      if (error) throw error;

      router.push("/my-listings");
      router.refresh();
    } catch (error: any) {
      console.error("DELETE LISTING ERROR:", error);
      alert(error?.message || "Something went wrong while deleting this listing.");
    } finally {
      setDeleting(false);
    }
  }

  function getPublicLocationText() {
    if (!listing) return "Location not added";

    const parts = [listing.city, listing.campus].filter(
      (item) => item && item.trim() !== ""
    );

    return parts.length > 0 ? parts.join(" • ") : "Location not added";
  }

  function getPrivateAddressText() {
    return listing?.address && listing.address.trim() !== ""
      ? listing.address
      : "Exact address not added";
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

  function StatusBadge() {
    if (status === "rented") {
      return (
        <span className="rounded-full bg-red-500/20 px-3 py-1 text-xs font-semibold text-red-300">
          Rented
        </span>
      );
    }

    if (status === "pending") {
      return (
        <span className="rounded-full bg-yellow-500/20 px-3 py-1 text-xs font-semibold text-yellow-300">
          Pending
        </span>
      );
    }

    return (
      <span className="rounded-full bg-green-500/20 px-3 py-1 text-xs font-semibold text-green-300">
        Available
      </span>
    );
  }

  function Stars({ rating }: { rating: number }) {
    const safeRating = Math.max(0, Math.min(5, Number(rating) || 0));
    const filled = Math.round(safeRating);
    const empty = Math.max(0, 5 - filled);

    return (
      <p className="mt-2 text-yellow-400">
        {Array.from({ length: filled }).map((_, i) => (
          <span key={`filled-${i}`}>★</span>
        ))}
        <span className="text-gray-700">
          {Array.from({ length: empty }).map((_, i) => (
            <span key={`empty-${i}`}>★</span>
          ))}
        </span>
      </p>
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black px-6 py-10 text-white">
        Loading listing...
      </main>
    );
  }

  if (!listing) {
    return (
      <main className="min-h-screen bg-black px-6 py-10 text-white">
        <p>{pageError || "Error loading listing."}</p>

        <button
          onClick={() => router.push("/my-listings")}
          className="mt-4 rounded-xl bg-white px-5 py-3 font-semibold text-black"
        >
          Back to My Listings
        </button>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-4 py-8 text-white">
      <div className="mx-auto max-w-7xl space-y-8">
        <button
          onClick={() => router.push("/search")}
          className="text-sm text-gray-300 hover:text-white"
        >
          ← Back to Listings
        </button>

        <section>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-4xl font-bold">{listing.title}</h1>
            <StatusBadge />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3 text-gray-300">
            <span className="rounded-full border border-gray-800 bg-white/5 px-3 py-1 text-sm">
              📍 {getPublicLocationText()}
            </span>

            {addressUnlocked ? (
              <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-sm text-emerald-300">
                🔓 Address unlocked for accepted viewing
              </span>
            ) : (
              <span className="rounded-full border border-gray-800 bg-white/5 px-3 py-1 text-sm text-gray-400">
                🔒 Exact address hidden until owner accepts viewing
              </span>
            )}

            <span className="rounded-full border border-yellow-500/20 bg-yellow-500/10 px-3 py-1 text-sm text-yellow-400">
              ⭐ {averageRating} ({reviews.length} review
              {reviews.length === 1 ? "" : "s"})
            </span>
          </div>
        </section>

        <ListingImageGallery images={galleryImages} />

        <section className="grid gap-8 lg:grid-cols-[1fr_420px]">
          <div className="space-y-8">
            <div className="rounded-3xl border border-gray-800 bg-[#070707] p-6">
              <h2 className="text-2xl font-bold">About this place</h2>

              <p className="mt-4 leading-7 text-gray-300">
                {listing.description || "No description provided."}
              </p>
            </div>

            <div className="rounded-3xl border border-gray-800 bg-[#070707] p-6">
              <h2 className="text-2xl font-bold">Property details</h2>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <Detail label="Bedrooms" value={listing.bedrooms} />
                <Detail label="Bathrooms" value={listing.bathrooms} />
                <Detail label="Guests" value={listing.guests} />
                <Detail label="Roommates" value={listing.roommates} />
              </div>
            </div>

            <div className="rounded-3xl border border-gray-800 bg-[#070707] p-6">
              <h2 className="text-2xl font-bold">Location</h2>

              <div className="mt-5 grid gap-4 md:grid-cols-3">
                <LocationBox label="City" value={listing.city} />
                <LocationBox label="Campus / Area" value={listing.campus} />
                <LocationBox
                  label="Exact Address"
                  value={addressUnlocked ? getPrivateAddressText() : "Locked"}
                  locked={!addressUnlocked}
                />
              </div>

              {!addressUnlocked && !isOwner && (
                <div className="mt-5 rounded-2xl border border-gray-800 bg-black p-5">
                  <p className="font-semibold text-white">
                    🔒 Exact address is protected
                  </p>

                  <p className="mt-2 text-sm leading-6 text-gray-400">
                    To protect owners and students, the full address is only
                    shown after the owner accepts your viewing request.
                  </p>

                  <Link
                    href={`/listings/${listing.id}/book-viewing`}
                    className="mt-4 inline-flex rounded-xl bg-white px-5 py-3 font-semibold text-black hover:bg-gray-200"
                  >
                    Book Viewing to Unlock Address
                  </Link>
                </div>
              )}

              {addressUnlocked && !isOwner && hasAcceptedViewing && (
                <div className="mt-5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5">
                  <p className="font-semibold text-emerald-300">
                    🔓 Address unlocked
                  </p>

                  <p className="mt-2 text-sm leading-6 text-emerald-100/80">
                    Your viewing request has been accepted. You can now see the
                    exact address for the viewing.
                  </p>
                </div>
              )}
            </div>

            <div className="rounded-3xl border border-gray-800 bg-[#070707] p-6">
              <h2 className="text-2xl font-bold">Features / Amenities</h2>

              {listing.amenities && listing.amenities.length > 0 ? (
                <div className="mt-5 flex flex-wrap gap-3">
                  {listing.amenities.map((amenity) => (
                    <span
                      key={amenity}
                      className="rounded-full border border-gray-700 px-4 py-2 text-sm text-gray-200"
                    >
                      {amenity}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-gray-400">No amenities listed.</p>
              )}
            </div>

            <div className="rounded-3xl border border-gray-800 bg-[#070707] p-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-2xl font-bold">Reviews</h2>

                  <p className="mt-1 text-sm text-gray-400">
                    ⭐ {averageRating} average from {reviews.length} review
                    {reviews.length === 1 ? "" : "s"}
                  </p>
                </div>

                {!isOwner && (
                  <Link
                    href={`/listings/${listing.id}/review`}
                    className="rounded-xl border border-gray-700 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                  >
                    Leave Review
                  </Link>
                )}
              </div>

              {reviews.length === 0 ? (
                <div className="mt-6 rounded-2xl border border-dashed border-gray-700 p-6 text-center text-gray-400">
                  No reviews yet.
                </div>
              ) : (
                <div className="mt-6 space-y-4">
                  {reviews.map((review) => {
                    const reviewer = getReviewer(review.reviewer_id);
                    const reviewerName =
                      reviewer?.full_name || "Anonymous user";

                    return (
                      <div
                        key={review.id}
                        className="rounded-2xl border border-gray-800 bg-black p-5"
                      >
                        <div className="flex gap-4">
                          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full bg-gray-800">
                            {reviewer?.avatar_url ? (
                              <img
                                src={reviewer.avatar_url}
                                alt={reviewerName}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center font-bold">
                                {reviewerName.charAt(0).toUpperCase()}
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

                              <span className="text-xs text-gray-500">
                                {formatDate(review.created_at)}
                              </span>
                            </div>

                            <Stars rating={review.rating} />

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
            </div>
          </div>

          <aside className="h-fit space-y-5">
            <div className="rounded-3xl border border-gray-800 bg-[#070707] p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-3xl font-bold">${listing.price || 0}</h2>
                  <p className="mt-1 text-gray-400">per month</p>
                </div>

                <StatusBadge />
              </div>

              <div className="my-6 border-t border-gray-800" />

              {!isOwner && (
                <div className="space-y-3">
                  {status === "rented" ? (
                    <button
                      disabled
                      className="w-full rounded-xl bg-gray-700 px-5 py-4 font-semibold text-gray-400"
                    >
                      Listing Unavailable
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={handleContactOwner}
                        className="w-full rounded-xl bg-white px-5 py-4 font-semibold text-black hover:bg-gray-200"
                      >
                        Contact Owner
                      </button>

                      <Link
                        href={`/listings/${listing.id}/book-viewing`}
                        className="flex w-full items-center justify-center rounded-xl border border-blue-500/30 bg-blue-500/10 px-5 py-4 font-semibold text-blue-300 transition hover:bg-blue-500/20"
                      >
                        Book Viewing
                      </Link>
                    </>
                  )}

                  <Link
                    href={`/listings/${listing.id}/review`}
                    className="flex w-full items-center justify-center rounded-xl border border-gray-700 bg-white/5 px-5 py-4 font-semibold text-white transition hover:bg-white/10"
                  >
                    Leave Review
                  </Link>

                  <SaveListingButton listingId={listing.id} />

                  <ReportButton targetType="listing" targetId={listing.id} />
                </div>
              )}

              {isOwner && (
                <>
                  <button
                    onClick={() => router.push("/inquiries/received")}
                    className="w-full rounded-xl bg-white px-5 py-4 font-semibold text-black hover:bg-gray-200"
                  >
                    View Received Inquiries
                  </button>

                  <button
                    onClick={() => router.push("/availability/calendar")}
                    className="mt-3 w-full rounded-xl border border-blue-500/30 bg-blue-500/10 px-5 py-4 font-semibold text-blue-300 hover:bg-blue-500/20"
                  >
                    Manage Calendar
                  </button>

                  <button
                    onClick={() => router.push("/viewings")}
                    className="mt-3 w-full rounded-xl border border-gray-700 bg-white/5 px-5 py-4 font-semibold text-white hover:bg-white/10"
                  >
                    Manage Viewings
                  </button>

                  <div className="my-6 border-t border-gray-800" />

                  <p className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-400">
                    Owner Actions
                  </p>

                  <div className="space-y-3">
                    <button
                      onClick={() => router.push(`/listings/${listing.id}/edit`)}
                      className="w-full rounded-xl bg-blue-600 px-5 py-4 font-semibold text-white"
                    >
                      Edit Listing
                    </button>
                    <button
                      onClick={() => router.push(`/listings/${listing.id}/boost`)}
                      className="w-full rounded-xl bg-yellow-400 px-5 py-4 font-black text-black hover:bg-yellow-300"
                    >
                      Boost Listing
                    </button>

                    <button
                      onClick={handleDeleteListing}
                      disabled={deleting}
                      className="w-full rounded-xl bg-red-600 px-5 py-4 font-semibold text-white disabled:bg-gray-600"
                    >
                      {deleting ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </>
              )}
            </div>

            <OwnerTrustCard owner={owner} />
          </aside>
        </section>

        <SimilarListings
          currentListingId={listing.id}
          city={listing.city}
          campus={listing.campus}
          price={listing.price}
        />
      </div>
    </main>
  );
}

function Detail({
  label,
  value,
}: {
  label: string;
  value: number | null | undefined;
}) {
  return (
    <div className="rounded-2xl border border-gray-800 bg-black p-5">
      <p className="text-sm uppercase tracking-wide text-gray-400">{label}</p>
      <p className="mt-2 text-xl font-semibold">{value ?? "—"}</p>
    </div>
  );
}

function LocationBox({
  label,
  value,
  locked = false,
}: {
  label: string;
  value: string | null | undefined;
  locked?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-gray-800 bg-black p-5">
      <p className="text-sm uppercase tracking-wide text-gray-400">{label}</p>
      <p
        className={`mt-2 text-base font-semibold ${
          locked ? "text-gray-500" : "text-white"
        }`}
      >
        {locked
          ? "🔒 Locked"
          : value && value.trim() !== ""
          ? value
          : "Not added"}
      </p>
    </div>
  );
}