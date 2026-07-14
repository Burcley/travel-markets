"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import ReportButton from "@/components/ReportButton";
import SaveListingButton from "@/components/SaveListingButton";
import SimilarListings from "@/components/SimilarListings";
import OwnerTrustCard from "@/components/OwnerTrustCard";
import ListingImageGallery from "@/components/listings/listing-image-gallery";
import CampusRouteMap from "@/components/listings/CampusRouteMap";
import Money from "@/components/Money";
import {
  FairHousingNotice,
  OntarioOccupancyNotice,
  UnverifiedListingNotice,
  VerificationDisclaimer,
} from "@/components/trust/TrustDisclaimers";
import TrustVerificationPrompt from "@/components/trust/TrustVerificationPrompt";
import { getDocumentTypeLabel } from "@/lib/trust/document-types";
import {
  getAmenityLabel,
  getLeaseTypeLabel,
  getTransparencyLabel,
  getUtilityStatusLabel,
  utilityItems,
  type AmenitiesDetails,
  type LeaseConditions,
  type UtilitiesDetails,
} from "@/lib/listing-transparency";

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
  status: "draft" | "available" | "pending" | "rented" | null;
  owner_occupies_property?: boolean | null;
  owner_family_occupies_property?: boolean | null;
  shared_kitchen_with_owner?: boolean | null;
  shared_bathroom_with_owner?: boolean | null;
  private_bedroom?: boolean | null;
  self_contained_unit?: boolean | null;
  other_occupants_present?: boolean | null;
  estimated_other_occupant_count?: number | null;
  occupancy_notes?: string | null;
  nearest_campus_name?: string | null;
  nearest_campus_address?: string | null;
  distance_to_campus_km?: number | null;
  walking_time_minutes?: number | null;
  cycling_time_minutes?: number | null;
  driving_time_minutes?: number | null;
  transit_time_minutes?: number | null;
  utilities_details?: UtilitiesDetails | null;
  amenities_details?: AmenitiesDetails | null;
  lease_conditions?: LeaseConditions | null;
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

type ListingVerificationStatus = {
  listing_id: string;
  status: string;
  relationship_type: string | null;
  reviewed_at: string | null;
  expires_at: string | null;
  owner_visible_reason: string | null;
};

type ListingDocumentRequirement = {
  id: string;
  document_type: string;
  display_name: string;
  description: string | null;
  requirement_level: string;
  applies_when: string;
  alternative_documents: string[] | null;
};

export default function ListingDetailsPage() {
  const t = useTranslations("listingDetail");
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const supabase = useMemo(() => createClient(), []);

  const [listing, setListing] = useState<Listing | null>(null);
  const [owner, setOwner] = useState<Profile | null>(null);
  const [images, setImages] = useState<ListingImage[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewers, setReviewers] = useState<Profile[]>([]);
  const [verificationStatus, setVerificationStatus] =
    useState<ListingVerificationStatus | null>(null);
  const [documentRequirements, setDocumentRequirements] = useState<
    ListingDocumentRequirement[]
  >([]);
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
        .select(
          "id, user_id, title, description, price, city, campus, address, bedrooms, bathrooms, guests, roommates, amenities, status, owner_occupies_property, owner_family_occupies_property, shared_kitchen_with_owner, shared_bathroom_with_owner, private_bedroom, self_contained_unit, other_occupants_present, estimated_other_occupant_count, occupancy_notes, nearest_campus_name, nearest_campus_address, distance_to_campus_km, walking_time_minutes, cycling_time_minutes, driving_time_minutes, transit_time_minutes, utilities_details, amenities_details, lease_conditions"
        )
        .eq("id", id)
        .maybeSingle();

      if (listingError) {
        console.error("LISTING FETCH ERROR:", listingError);
        setPageError(listingError.message);
        setListing(null);
        return;
      }

      if (!listingData) {
        setPageError(t("errors.notFound"));
        setListing(null);
        return;
      }

      const safeListing = listingData as Listing;

      if (safeListing.status === "draft" && user?.id !== safeListing.user_id) {
        setPageError(t("errors.notFound"));
        setListing(null);
        return;
      }

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
          .select("id, viewing_type")
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

      const { data: verificationData, error: verificationError } =
        await supabase
          .from("public_listing_verification_status")
          .select(
            "listing_id, status, relationship_type, reviewed_at, expires_at, owner_visible_reason"
          )
          .eq("listing_id", safeListing.id)
          .maybeSingle();

      if (verificationError) {
        console.error("VERIFICATION STATUS FETCH ERROR:", verificationError);
      }

      setVerificationStatus(
        (verificationData as ListingVerificationStatus) || null
      );

      const { data: requirementData, error: requirementError } = await supabase
        .from("listing_document_requirements")
        .select(
          "id, document_type, display_name, description, requirement_level, applies_when, alternative_documents"
        )
        .eq("listing_id", safeListing.id)
        .eq("active", true)
        .order("sort_order", { ascending: true });

      if (requirementError) {
        console.error("DOCUMENT REQUIREMENTS FETCH ERROR:", requirementError);
      }

      setDocumentRequirements(
        (requirementData || []) as ListingDocumentRequirement[]
      );

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
    } catch (error: unknown) {
      console.error("LISTING PAGE CRASH:", error);
      setPageError(error instanceof Error ? error.message : t("errors.crashed"));
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
      alert(t("alerts.alreadyRented"));
      return;
    }

    if (user.id === listing.user_id) {
      alert(t("alerts.cannotContactSelf"));
      return;
    }

    router.push(`/listings/${listing.id}/contact`);
  }

  async function handleDeleteListing() {
    if (!listing) return;
    if (!confirm(t("confirmDelete"))) return;

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
    } catch (error: unknown) {
      console.error("DELETE LISTING ERROR:", error);
      alert(error instanceof Error ? error.message : t("alerts.deleteFailed"));
    } finally {
      setDeleting(false);
    }
  }

  function getPublicLocationText() {
    if (!listing) return t("locationNotAdded");

    const parts = [listing.city, listing.campus].filter(
      (item) => item && item.trim() !== ""
    );

    return parts.length > 0 ? parts.join(" • ") : t("locationNotAdded");
  }

  function getPrivateAddressText() {
    return listing?.address && listing.address.trim() !== ""
      ? listing.address
      : t("exactAddressNotAdded");
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
          {t("status.rented")}
        </span>
      );
    }

    if (status === "draft") {
      return (
        <span className="rounded-full bg-zinc-500/20 px-3 py-1 text-xs font-semibold text-zinc-300">
          Draft
        </span>
      );
    }

    if (status === "pending") {
      return (
        <span className="rounded-full bg-yellow-500/20 px-3 py-1 text-xs font-semibold text-yellow-300">
          {t("status.pending")}
        </span>
      );
    }

    return (
      <span className="rounded-full bg-green-500/20 px-3 py-1 text-xs font-semibold text-green-300">
        {t("status.available")}
      </span>
    );
  }

  function getVerificationLabel() {
    if (verificationStatus?.status === "verified") {
      return "Verified property relationship";
    }

    if (verificationStatus?.status === "pending") {
      return "Verification pending";
    }

    if (verificationStatus?.status === "more_information_required") {
      return "More information required";
    }

    if (verificationStatus?.status === "declined") {
      return "Verification declined";
    }

    if (verificationStatus?.status === "expired") {
      return "Verification expired";
    }

    return "Not verified";
  }

  function getVerificationClassName() {
    if (verificationStatus?.status === "verified") {
      return "border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
    }

    if (verificationStatus?.status === "pending") {
      return "border-amber-500/20 bg-amber-500/10 text-amber-300";
    }

    return "border-gray-800 bg-white/5 text-gray-300";
  }

  function formatBoolean(value: boolean | null | undefined) {
    if (value === true) return "Yes";
    if (value === false) return "No";
    return "Not answered";
  }

  const hasOwnerSharedKitchenOrBathroom =
    listing?.shared_kitchen_with_owner || listing?.shared_bathroom_with_owner;
  const utilitiesDetails = listing?.utilities_details || {};
  const amenitiesDetails = listing?.amenities_details || {};
  const leaseConditions = listing?.lease_conditions || {};
  const structuredAmenityLabels = (amenitiesDetails.selected || []).map(
    getAmenityLabel
  );
  const includedUtilityLabels = utilityItems
    .filter(([key]) => utilitiesDetails.statuses?.[key] === "included")
    .map(([, label]) => label);
  const transparencyLabel = listing
    ? getTransparencyLabel({
        nearestCampusName: listing.nearest_campus_name,
        utilitiesDetails,
        amenitiesDetails,
        leaseConditions,
      })
    : "";
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
        {t("loading")}
      </main>
    );
  }

  if (!listing) {
    return (
      <main className="min-h-screen bg-black px-6 py-10 text-white">
        <p>{pageError || t("errors.loading")}</p>

        <button
          onClick={() => router.push("/my-listings")}
          className="mt-4 rounded-xl bg-white px-5 py-3 font-semibold text-black"
        >
          {t("backToMyListings")}
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
          {t("backToListings")}
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
                🔓 {t("addressUnlockedBadge")}
              </span>
            ) : (
              <span className="rounded-full border border-gray-800 bg-white/5 px-3 py-1 text-sm text-gray-400">
                🔒 {t("addressHiddenBadge")}
              </span>
            )}

            <span className="rounded-full border border-yellow-500/20 bg-yellow-500/10 px-3 py-1 text-sm text-yellow-400">
              ⭐ {averageRating} ({t("reviewCount", { count: reviews.length })})
            </span>

            <span
              className={`rounded-full border px-3 py-1 text-sm font-semibold ${getVerificationClassName()}`}
            >
              {getVerificationLabel()}
            </span>

            <span className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-sm font-semibold text-cyan-200">
              {transparencyLabel}
            </span>
          </div>
        </section>

        <ListingImageGallery images={galleryImages} />

        <section className="grid gap-8 lg:grid-cols-[1fr_420px]">
          <div className="space-y-8">
            {isOwner && verificationStatus?.status !== "verified" && (
              <TrustVerificationPrompt
                kind="listing_relationship"
                storageKey={`listing-relationship-${listing.id}`}
              />
            )}

            <div className="rounded-3xl border border-gray-800 bg-[#070707] p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-bold uppercase tracking-[0.18em] text-pink-300">
                    Property verification
                  </p>
                  <h2 className="mt-2 text-2xl font-bold">
                    {getVerificationLabel()}
                  </h2>
                </div>
                <span
                  className={`rounded-full border px-3 py-1 text-sm font-semibold ${getVerificationClassName()}`}
                >
                  {getVerificationLabel()}
                </span>
              </div>

              <div className="mt-5">
                {verificationStatus?.status === "verified" ? (
                  <VerificationDisclaimer />
                ) : (
                  <UnverifiedListingNotice />
                )}
              </div>

              {verificationStatus?.owner_visible_reason && (
                <p className="mt-4 rounded-2xl border border-white/10 bg-black p-4 text-sm leading-6 text-zinc-300">
                  {verificationStatus.owner_visible_reason}
                </p>
              )}
            </div>

            <div className="rounded-3xl border border-gray-800 bg-[#070707] p-6">
              <h2 className="text-2xl font-bold">{t("aboutTitle")}</h2>

              <p className="mt-4 leading-7 text-gray-300">
                {listing.description || t("noDescription")}
              </p>
            </div>

            <div className="rounded-3xl border border-gray-800 bg-[#070707] p-6">
              <h2 className="text-2xl font-bold">Living arrangement</h2>
              <p className="mt-2 text-sm leading-6 text-gray-400">
                Owner-sharing and occupancy details are shown separately so
                applicants can review the arrangement before applying.
              </p>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <DisclosureRow
                  label="Owner lives at property"
                  value={formatBoolean(listing.owner_occupies_property)}
                />
                <DisclosureRow
                  label="Owner family lives at property"
                  value={formatBoolean(listing.owner_family_occupies_property)}
                />
                <DisclosureRow
                  label="Shared kitchen with owner/family"
                  value={formatBoolean(listing.shared_kitchen_with_owner)}
                />
                <DisclosureRow
                  label="Shared bathroom with owner/family"
                  value={formatBoolean(listing.shared_bathroom_with_owner)}
                />
                <DisclosureRow
                  label="Private bedroom"
                  value={formatBoolean(listing.private_bedroom)}
                />
                <DisclosureRow
                  label="Self-contained unit"
                  value={formatBoolean(listing.self_contained_unit)}
                />
                <DisclosureRow
                  label="Other occupants present"
                  value={formatBoolean(listing.other_occupants_present)}
                />
                <DisclosureRow
                  label="Estimated other occupants"
                  value={
                    listing.estimated_other_occupant_count == null
                      ? "Not answered"
                      : String(listing.estimated_other_occupant_count)
                  }
                />
              </div>

              {listing.occupancy_notes && (
                <p className="mt-5 rounded-2xl border border-white/10 bg-black p-4 text-sm leading-6 text-zinc-300">
                  {listing.occupancy_notes}
                </p>
              )}

              {hasOwnerSharedKitchenOrBathroom && (
                <div className="mt-5">
                  <OntarioOccupancyNotice />
                </div>
              )}
            </div>

            <div className="rounded-3xl border border-gray-800 bg-[#070707] p-6">
              <h2 className="text-2xl font-bold">
                Application documents that may be requested
              </h2>
              <p className="mt-2 text-sm leading-6 text-gray-400">
                These are landlord-stated application documents. Do not send
                sensitive documents until you understand who is requesting them
                and why.
              </p>

              {documentRequirements.length === 0 ? (
                <div className="mt-5 rounded-2xl border border-dashed border-gray-700 p-6 text-center text-gray-400">
                  No application document requirements have been added for this listing.
                </div>
              ) : (
                <div className="mt-5 grid gap-4">
                  {documentRequirements.map((requirement) => (
                    <div
                      key={requirement.id}
                      className="rounded-2xl border border-gray-800 bg-black p-5"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-bold uppercase text-zinc-300">
                          {requirement.requirement_level.replaceAll("_", " ")}
                        </span>
                        <span className="rounded-full border border-pink-400/20 bg-pink-500/10 px-3 py-1 text-xs font-bold uppercase text-pink-200">
                          {requirement.applies_when.replaceAll("_", " ")}
                        </span>
                      </div>
                      <p className="mt-3 text-lg font-bold text-white">
                        {requirement.display_name ||
                          getDocumentTypeLabel(requirement.document_type)}
                      </p>
                      {requirement.description && (
                        <p className="mt-2 text-sm leading-6 text-zinc-400">
                          {requirement.description}
                        </p>
                      )}
                      {requirement.alternative_documents?.length ? (
                        <p className="mt-3 text-sm text-zinc-500">
                          Accepted alternatives:{" "}
                          {requirement.alternative_documents.join(", ")}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-5">
                <FairHousingNotice />
              </div>
            </div>

            <div className="rounded-3xl border border-gray-800 bg-[#070707] p-6">
              <h2 className="text-2xl font-bold">{t("propertyDetailsTitle")}</h2>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <Detail label={t("details.bedrooms")} value={listing.bedrooms} />
                <Detail label={t("details.bathrooms")} value={listing.bathrooms} />
                <Detail label={t("details.guests")} value={listing.guests} />
                <Detail label={t("details.roommates")} value={listing.roommates} />
              </div>
            </div>

            <div className="rounded-3xl border border-gray-800 bg-[#070707] p-6">
              <h2 className="text-2xl font-bold">{t("locationTitle")}</h2>

              <div className="mt-5 grid gap-4 md:grid-cols-3">
                <LocationBox label={t("location.city")} value={listing.city} notAddedLabel={t("notAdded")} lockedLabel={t("locked")} />
                <LocationBox label={t("location.campusArea")} value={listing.campus} notAddedLabel={t("notAdded")} lockedLabel={t("locked")} />
                <LocationBox
                  label={t("location.exactAddress")}
                  value={addressUnlocked ? getPrivateAddressText() : t("locked")}
                  locked={!addressUnlocked}
                  notAddedLabel={t("notAdded")}
                  lockedLabel={t("locked")}
                />
              </div>

              {!addressUnlocked && !isOwner && (
                <div className="mt-5 rounded-2xl border border-gray-800 bg-black p-5">
                  <p className="font-semibold text-white">
                    🔒 {t("addressProtectedTitle")}
                  </p>

                  <p className="mt-2 text-sm leading-6 text-gray-400">
                    {t("addressProtectedText")}
                  </p>

                  <Link
                    href={`/listings/${listing.id}/book-viewing`}
                    className="mt-4 inline-flex rounded-xl bg-white px-5 py-3 font-semibold text-black hover:bg-gray-200"
                  >
                    {t("bookViewingUnlock")}
                  </Link>
                </div>
              )}

              {addressUnlocked && !isOwner && hasAcceptedViewing && (
                <div className="mt-5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5">
                  <p className="font-semibold text-emerald-300">
                    🔓 {t("addressUnlockedTitle")}
                  </p>

                  <p className="mt-2 text-sm leading-6 text-emerald-100/80">
                    {t("addressUnlockedText")}
                  </p>
                </div>
              )}
            </div>

            <CampusRouteMap
              listingId={listing.id}
              propertyArea={getPublicLocationText()}
              campusName={listing.nearest_campus_name}
              hasCampusCoordinates={Boolean(listing.nearest_campus_name)}
            />

            <div className="rounded-3xl border border-gray-800 bg-[#070707] p-6">
              <h2 className="text-2xl font-bold">Rent and utilities</h2>
              {includedUtilityLabels.length > 0 && (
                <p className="mt-3 text-sm leading-6 text-emerald-200">
                  Included in rent: {includedUtilityLabels.join(", ")}
                </p>
              )}
              {(utilitiesDetails.estimatedMonthlyMin != null ||
                utilitiesDetails.estimatedMonthlyMax != null) && (
                <p className="mt-3 text-sm leading-6 text-gray-300">
                  Estimated extra utilities:{" "}
                  {utilitiesDetails.estimatedMonthlyMin != null && (
                    <Money amountCAD={utilitiesDetails.estimatedMonthlyMin} />
                  )}
                  {utilitiesDetails.estimatedMonthlyMin != null &&
                    utilitiesDetails.estimatedMonthlyMax != null &&
                    " - "}
                  {utilitiesDetails.estimatedMonthlyMax != null && (
                    <Money amountCAD={utilitiesDetails.estimatedMonthlyMax} />
                  )}
                  /mo
                </p>
              )}
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {utilityItems.map(([key, label]) => (
                  <DisclosureRow
                    key={key}
                    label={label}
                    value={getUtilityStatusLabel(utilitiesDetails.statuses?.[key])}
                  />
                ))}
              </div>
              {utilitiesDetails.notes && (
                <p className="mt-5 rounded-2xl border border-white/10 bg-black p-4 text-sm leading-6 text-zinc-300">
                  {utilitiesDetails.notes}
                </p>
              )}
            </div>

            <div className="rounded-3xl border border-gray-800 bg-[#070707] p-6">
              <h2 className="text-2xl font-bold">{t("amenitiesTitle")}</h2>

              {structuredAmenityLabels.length > 0 && (
                <div className="mt-5 flex flex-wrap gap-3">
                  {structuredAmenityLabels.map((amenity) => (
                    <span
                      key={amenity}
                      className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-4 py-2 text-sm text-cyan-100"
                    >
                      {amenity}
                    </span>
                  ))}
                </div>
              )}

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
                structuredAmenityLabels.length === 0 && (
                  <p className="mt-4 text-gray-400">{t("noAmenities")}</p>
                )
              )}
              {(amenitiesDetails.parking ||
                amenitiesDetails.laundry ||
                amenitiesDetails.furnishing ||
                amenitiesDetails.internetDetails ||
                amenitiesDetails.accessibilityNotes ||
                amenitiesDetails.petDetails) && (
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  {amenitiesDetails.parking && (
                    <DisclosureRow label="Parking" value={amenitiesDetails.parking} />
                  )}
                  {amenitiesDetails.laundry && (
                    <DisclosureRow label="Laundry" value={amenitiesDetails.laundry} />
                  )}
                  {amenitiesDetails.furnishing && (
                    <DisclosureRow label="Furnishing" value={amenitiesDetails.furnishing} />
                  )}
                  {amenitiesDetails.internetDetails && (
                    <DisclosureRow label="Internet" value={amenitiesDetails.internetDetails} />
                  )}
                  {amenitiesDetails.accessibilityNotes && (
                    <DisclosureRow label="Accessibility" value={amenitiesDetails.accessibilityNotes} />
                  )}
                  {amenitiesDetails.petDetails && (
                    <DisclosureRow label="Pets" value={amenitiesDetails.petDetails} />
                  )}
                </div>
              )}
            </div>

            <div className="rounded-3xl border border-gray-800 bg-[#070707] p-6">
              <h2 className="text-2xl font-bold">Lease conditions</h2>
              <p className="mt-2 text-sm leading-6 text-gray-400">
                Landlord-stated lease details. Review the final lease directly
                before signing.
              </p>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <DisclosureRow
                  label="Lease type"
                  value={getLeaseTypeLabel(leaseConditions.leaseType) || "Ask landlord"}
                />
                <DisclosureRow
                  label="Move-in date"
                  value={leaseConditions.moveInDate || "Ask landlord"}
                />
                <DisclosureRow
                  label="Minimum lease"
                  value={
                    leaseConditions.minimumLeaseMonths
                      ? `${leaseConditions.minimumLeaseMonths} months`
                      : "Ask landlord"
                  }
                />
                <DisclosureRow
                  label="International students"
                  value={formatBoolean(
                    leaseConditions.internationalStudentsAccepted
                  )}
                />
                <DisclosureRow
                  label="Guarantor required"
                  value={formatBoolean(leaseConditions.guarantorRequired)}
                />
                <DisclosureRow
                  label="Last month rent"
                  value={formatBoolean(leaseConditions.lastMonthRentRequired)}
                />
                <DisclosureRow
                  label="Key deposit"
                  value={
                    leaseConditions.keyDepositAmount == null
                      ? "Not answered"
                      : `$${leaseConditions.keyDepositAmount}`
                  }
                />
                <DisclosureRow
                  label="Tenant insurance"
                  value={formatBoolean(leaseConditions.tenantInsuranceRequired)}
                />
              </div>
              {(leaseConditions.guarantorDetails ||
                leaseConditions.overnightGuestPolicy ||
                leaseConditions.additionalFees ||
                leaseConditions.notes) && (
                <details className="mt-5 rounded-2xl border border-white/10 bg-black p-4">
                  <summary className="cursor-pointer font-semibold text-white">
                    More lease details
                  </summary>
                  <div className="mt-4 space-y-3 text-sm leading-6 text-zinc-300">
                    {leaseConditions.guarantorDetails && (
                      <p>{leaseConditions.guarantorDetails}</p>
                    )}
                    {leaseConditions.overnightGuestPolicy && (
                      <p>{leaseConditions.overnightGuestPolicy}</p>
                    )}
                    {leaseConditions.additionalFees && (
                      <p>{leaseConditions.additionalFees}</p>
                    )}
                    {leaseConditions.notes && <p>{leaseConditions.notes}</p>}
                  </div>
                </details>
              )}
            </div>

            <div className="rounded-3xl border border-gray-800 bg-[#070707] p-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-2xl font-bold">{t("reviewsTitle")}</h2>

                  <p className="mt-1 text-sm text-gray-400">
                    ⭐ {t("reviewsAverage", {
                      rating: averageRating,
                      count: reviews.length,
                    })}
                  </p>
                </div>

                {!isOwner && (
                  <Link
                    href={`/listings/${listing.id}/review`}
                    className="rounded-xl border border-gray-700 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                  >
                    {t("leaveReview")}
                  </Link>
                )}
              </div>

              {reviews.length === 0 ? (
                <div className="mt-6 rounded-2xl border border-dashed border-gray-700 p-6 text-center text-gray-400">
                  {t("noReviews")}
                </div>
              ) : (
                <div className="mt-6 space-y-4">
                  {reviews.map((review) => {
                    const reviewer = getReviewer(review.reviewer_id);
                    const reviewerName =
                      reviewer?.full_name || t("anonymousUser");

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
                                  ✓ {t("verified")}
                                </span>
                              )}

                              <span className="text-xs text-gray-500">
                                {formatDate(review.created_at)}
                              </span>
                            </div>

                            <Stars rating={review.rating} />

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
            </div>
          </div>

          <aside className="h-fit space-y-5">
            <div className="rounded-3xl border border-gray-800 bg-[#070707] p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-3xl font-bold">
                    {listing.price == null ? t("ask") : <Money amountCAD={listing.price} />}
                  </h2>
                  <p className="mt-1 text-gray-400">{t("perMonth")}</p>
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
                      {t("listingUnavailable")}
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={handleContactOwner}
                        className="w-full rounded-xl bg-white px-5 py-4 font-semibold text-black hover:bg-gray-200"
                      >
                        {t("contactOwner")}
                      </button>

                      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                        <p className="text-sm font-bold text-emerald-200">
                          {t("nextSteps.title")}
                        </p>
                        <ol className="mt-3 space-y-2 text-sm leading-6 text-emerald-50/80">
                          <li>{t("nextSteps.sendInquiry")}</li>
                          <li>{t("nextSteps.landlordReviews")}</li>
                          <li>{t("nextSteps.acceptedChat")}</li>
                          <li>{t("nextSteps.bookViewing")}</li>
                        </ol>
                      </div>

                      <Link
                        href={`/listings/${listing.id}/book-viewing`}
                        className="flex w-full items-center justify-center rounded-xl border border-blue-500/30 bg-blue-500/10 px-5 py-4 font-semibold text-blue-300 transition hover:bg-blue-500/20"
                      >
                        {t("bookViewing")}
                      </Link>
                    </>
                  )}

                  <Link
                    href={`/listings/${listing.id}/review`}
                    className="flex w-full items-center justify-center rounded-xl border border-gray-700 bg-white/5 px-5 py-4 font-semibold text-white transition hover:bg-white/10"
                  >
                    {t("leaveReview")}
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
                    {t("viewReceivedInquiries")}
                  </button>

                  <button
                    onClick={() => router.push("/availability/calendar")}
                    className="mt-3 w-full rounded-xl border border-blue-500/30 bg-blue-500/10 px-5 py-4 font-semibold text-blue-300 hover:bg-blue-500/20"
                  >
                    {t("manageCalendar")}
                  </button>

                  <button
                    onClick={() => router.push("/viewings")}
                    className="mt-3 w-full rounded-xl border border-gray-700 bg-white/5 px-5 py-4 font-semibold text-white hover:bg-white/10"
                  >
                    {t("manageViewings")}
                  </button>

                  <div className="my-6 border-t border-gray-800" />

                  <p className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-400">
                    {t("ownerActions")}
                  </p>

                  <div className="space-y-3">
                    <button
                      onClick={() => router.push(`/listings/${listing.id}/edit`)}
                      className="w-full rounded-xl bg-blue-600 px-5 py-4 font-semibold text-white"
                    >
                      {t("editListing")}
                    </button>
                    <button
                      onClick={() => router.push(`/listings/${listing.id}/boost`)}
                      className="w-full rounded-xl bg-yellow-400 px-5 py-4 font-black text-black hover:bg-yellow-300"
                    >
                      {t("boostListing")}
                    </button>

                    <button
                      onClick={handleDeleteListing}
                      disabled={deleting}
                      className="w-full rounded-xl bg-red-600 px-5 py-4 font-semibold text-white disabled:bg-gray-600"
                    >
                      {deleting ? t("deleting") : t("delete")}
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

function DisclosureRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-gray-800 bg-black p-5">
      <p className="text-sm uppercase tracking-wide text-gray-400">{label}</p>
      <p className="mt-2 text-base font-semibold text-white">{value}</p>
    </div>
  );
}

function LocationBox({
  label,
  value,
  locked = false,
  notAddedLabel,
  lockedLabel,
}: {
  label: string;
  value: string | null | undefined;
  locked?: boolean;
  notAddedLabel: string;
  lockedLabel: string;
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
          ? `🔒 ${lockedLabel}`
          : value && value.trim() !== ""
          ? value
          : notAddedLabel}
      </p>
    </div>
  );
}
