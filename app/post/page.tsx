"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { AlertCircle, Crown, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  appliesWhenOptions,
  documentTypes,
  requirementLevelGuidance,
  requirementLevels,
} from "@/lib/trust/document-types";
import {
  FairHousingNotice,
  OntarioOccupancyNotice,
} from "@/components/trust/TrustDisclaimers";
import ContextHelpBox from "@/components/trust/ContextHelpBox";
import { geocodeListingAddressWithMapbox } from "@/lib/listing-address-geocode";
import {
  amenityItems,
  calculateDistanceKm,
  campusOptions,
  estimateTravelTimes,
  leaseTypeOptions,
  utilityItems,
  utilityStatusOptions,
  type AmenitiesDetails,
  type LeaseConditions,
  type UtilitiesDetails,
  type UtilityStatus,
} from "@/lib/listing-transparency";
import { generatePublicCoordinate } from "@/lib/location-privacy";

const PLAN_LIMITS: Record<string, number> = {
  free: 1,
  premium: 5,
  elite: Infinity,
  legacy_premium: Infinity,
  founding_free: Infinity,
};

const yesNoOptions = [
  ["", "Select an answer"],
  ["true", "Yes"],
  ["false", "No"],
];

function toNullableBoolean(value: string) {
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

function toNumberOrNull(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export default function PostListingPage() {
  const t = useTranslations("listingManagement.post");
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [title, setTitle] = useState("");
  const [city, setCity] = useState("");
  const [campus, setCampus] = useState("");
  const [nearestCampusName, setNearestCampusName] = useState("");
  const [nearestCampusAddress, setNearestCampusAddress] = useState("");
  const [campusLatitude, setCampusLatitude] = useState("");
  const [campusLongitude, setCampusLongitude] = useState("");

  const [addressLine, setAddressLine] = useState("");
  const [unit, setUnit] = useState("");
  const [province, setProvince] = useState("");
  const [postalCode, setPostalCode] = useState("");

  const [price, setPrice] = useState("");
  const [bedrooms, setBedrooms] = useState("");
  const [bathrooms, setBathrooms] = useState("");
  const [roommates, setRoommates] = useState("");

  const [description, setDescription] = useState("");
  const [amenities, setAmenities] = useState("");
  const [utilityStatuses, setUtilityStatuses] = useState<Record<string, UtilityStatus>>({});
  const [utilityPartialExplanations, setUtilityPartialExplanations] = useState<Record<string, string>>({});
  const [estimatedUtilitiesMin, setEstimatedUtilitiesMin] = useState("");
  const [estimatedUtilitiesMax, setEstimatedUtilitiesMax] = useState("");
  const [utilitiesNotes, setUtilitiesNotes] = useState("");
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  const [parkingDetails, setParkingDetails] = useState("");
  const [laundryDetails, setLaundryDetails] = useState("");
  const [furnishingDetails, setFurnishingDetails] = useState("");
  const [internetDetails, setInternetDetails] = useState("");
  const [accessibilityNotes, setAccessibilityNotes] = useState("");
  const [petDetails, setPetDetails] = useState("");
  const [safetyInstructions, setSafetyInstructions] = useState("");
  const [files, setFiles] = useState<FileList | null>(null);
  const [ownerOccupiesProperty, setOwnerOccupiesProperty] = useState("");
  const [ownerFamilyOccupiesProperty, setOwnerFamilyOccupiesProperty] =
    useState("");
  const [sharedKitchenWithOwner, setSharedKitchenWithOwner] = useState("");
  const [sharedBathroomWithOwner, setSharedBathroomWithOwner] = useState("");
  const [privateBedroom, setPrivateBedroom] = useState("");
  const [selfContainedUnit, setSelfContainedUnit] = useState("");
  const [otherOccupantsPresent, setOtherOccupantsPresent] = useState("");
  const [estimatedOtherOccupantCount, setEstimatedOtherOccupantCount] =
    useState("");
  const [occupancyNotes, setOccupancyNotes] = useState("");
  const [documentRequirementType, setDocumentRequirementType] = useState("");
  const [documentRequirementLevel, setDocumentRequirementLevel] =
    useState("optional");
  const [documentRequirementAppliesWhen, setDocumentRequirementAppliesWhen] =
    useState("all_applicants");
  const [documentRequirementDescription, setDocumentRequirementDescription] =
    useState("");
  const [documentRequirementAlternatives, setDocumentRequirementAlternatives] =
    useState("");
  const [documentRequirementAcknowledged, setDocumentRequirementAcknowledged] =
    useState(false);
  const [leaseType, setLeaseType] = useState("");
  const [leaseStartDate, setLeaseStartDate] = useState("");
  const [leaseEndDate, setLeaseEndDate] = useState("");
  const [minimumLeaseMonths, setMinimumLeaseMonths] = useState("");
  const [maximumLeaseMonths, setMaximumLeaseMonths] = useState("");
  const [moveInDate, setMoveInDate] = useState("");
  const [moveOutDate, setMoveOutDate] = useState("");
  const [renewalAvailable, setRenewalAvailable] = useState("");
  const [earlyTerminationAllowed, setEarlyTerminationAllowed] = useState("");
  const [earlyTerminationTerms, setEarlyTerminationTerms] = useState("");
  const [sublettingAllowed, setSublettingAllowed] = useState("");
  const [assignmentAllowed, setAssignmentAllowed] = useState("");
  const [guarantorRequired, setGuarantorRequired] = useState("");
  const [guarantorDetails, setGuarantorDetails] = useState("");
  const [studentStatusRequired, setStudentStatusRequired] = useState("");
  const [proofOfEnrolmentRequired, setProofOfEnrolmentRequired] = useState("");
  const [internationalStudentsAccepted, setInternationalStudentsAccepted] =
    useState("");
  const [coSignerAccepted, setCoSignerAccepted] = useState("");
  const [occupantsAllowed, setOccupantsAllowed] = useState("");
  const [overnightGuestPolicy, setOvernightGuestPolicy] = useState("");
  const [smokingPolicy, setSmokingPolicy] = useState("");
  const [petPolicy, setPetPolicy] = useState("");
  const [tenantInsuranceRequired, setTenantInsuranceRequired] = useState("");
  const [keyDepositAmount, setKeyDepositAmount] = useState("");
  const [securityDepositAmount, setSecurityDepositAmount] = useState("");
  const [lastMonthRentRequired, setLastMonthRentRequired] = useState("");
  const [applicationFeeAmount, setApplicationFeeAmount] = useState("");
  const [additionalFees, setAdditionalFees] = useState("");
  const [leaseConditionsNotes, setLeaseConditionsNotes] = useState("");

  const [plan, setPlan] = useState("free");
  const [activeListings, setActiveListings] = useState(0);
  const [checkingLimit, setCheckingLimit] = useState(true);
  const [loading, setLoading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const [formError, setFormError] = useState("");
  const [creationIdempotencyKey] = useState(() => crypto.randomUUID());

  const listingLimit = PLAN_LIMITS[plan] || 1;
  const listingLimitLabel =
    listingLimit === Infinity ? "Unlimited" : String(listingLimit);
  const limitReached = false;
  const sharedWithOwner =
    sharedKitchenWithOwner === "true" || sharedBathroomWithOwner === "true";
  const livingArrangementCompleted = [
    ownerOccupiesProperty,
    ownerFamilyOccupiesProperty,
    sharedKitchenWithOwner,
    sharedBathroomWithOwner,
    privateBedroom,
    selfContainedUnit,
    otherOccupantsPresent,
  ].every((value) => value !== "");
  const fairHousingAcknowledged = documentRequirementAcknowledged;
  const readyToPublish = livingArrangementCompleted && fairHousingAcknowledged;
  const completionItems = [
    Boolean(title.trim()),
    Boolean(city.trim()),
    Boolean(addressLine.trim()),
    Boolean(price.trim()),
    Boolean(description.trim()),
    livingArrangementCompleted,
    fairHousingAcknowledged,
  ];
  const completionPercent = Math.round(
    (completionItems.filter(Boolean).length / completionItems.length) * 100
  );

  useEffect(() => {
    loadSubscriptionLimit();
  }, []);

  async function loadSubscriptionLimit() {
    setCheckingLimit(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/auth");
      return;
    }

    if (!user.email_confirmed_at) {
      router.push("/verify-email");
      return;
    }

    const { data: subscription } = await supabase
      .from("owner_subscriptions")
      .select("plan, status")
      .eq("user_id", user.id)
      .maybeSingle();

    const safePlan =
      subscription?.status === "active" || subscription?.status === "trialing"
        ? subscription?.plan || "free"
        : "free";

    const foundingResponse = await fetch("/api/founding-landlords/status", {
      cache: "no-store",
    }).catch(() => null);
    const foundingData = foundingResponse?.ok
      ? await foundingResponse.json().catch(() => null)
      : null;
    const freePeriodEndsAt =
      foundingData?.profile?.founding_free_fee_period_ends_at || null;
    const foundingFreeActive =
      foundingData?.profile?.founding_status === "confirmed" &&
      foundingData?.profile?.is_founding_landlord === true &&
      foundingData?.profile?.founding_benefits_disabled !== true &&
      freePeriodEndsAt &&
      new Date(freePeriodEndsAt).getTime() > Date.now();

    setPlan(foundingFreeActive ? "founding_free" : safePlan);

    const { count } = await supabase
      .from("listings")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .neq("status", "rented")
      .neq("status", "draft");

    setActiveListings(count || 0);
    setCheckingLimit(false);
  }

  function getPublishValidationError() {
    if (!livingArrangementCompleted) {
      return "Complete all required living-arrangement questions before publishing.";
    }

    if (!documentRequirementAcknowledged) {
      return "Acknowledge the fair-housing document notice before publishing.";
    }

    return "";
  }

  function applyCampusSelection(value: string) {
    setNearestCampusName(value);
    const selected = campusOptions.find((item) => item.name === value);

    if (!selected) {
      setNearestCampusAddress("");
      setCampusLatitude("");
      setCampusLongitude("");
      return;
    }

    setNearestCampusAddress(selected.address);
    setCampusLatitude(String(selected.latitude));
    setCampusLongitude(String(selected.longitude));
  }

  function toggleStructuredAmenity(value: string) {
    setSelectedAmenities((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value]
    );
  }

  function buildUtilitiesDetails(): UtilitiesDetails {
    const statuses = Object.fromEntries(
      Object.entries(utilityStatuses).filter(([, value]) => Boolean(value))
    ) as Record<string, UtilityStatus>;
    const partialExplanations = Object.fromEntries(
      Object.entries(utilityPartialExplanations)
        .map(([key, value]) => [key, value.trim()])
        .filter(([, value]) => Boolean(value))
    ) as Record<string, string>;

    return {
      statuses,
      partialExplanations,
      estimatedMonthlyMin: toNumberOrNull(estimatedUtilitiesMin),
      estimatedMonthlyMax: toNumberOrNull(estimatedUtilitiesMax),
      notes: utilitiesNotes.trim() || null,
    };
  }

  function buildAmenitiesDetails(): AmenitiesDetails {
    return {
      selected: selectedAmenities,
      parking: parkingDetails.trim(),
      laundry: laundryDetails.trim(),
      furnishing: furnishingDetails.trim(),
      internetDetails: internetDetails.trim(),
      accessibilityNotes: accessibilityNotes.trim(),
      petDetails: petDetails.trim(),
    };
  }

  function buildLeaseConditions(): LeaseConditions {
    return {
      leaseType,
      leaseStartDate,
      leaseEndDate,
      minimumLeaseMonths: toNumberOrNull(minimumLeaseMonths),
      maximumLeaseMonths: toNumberOrNull(maximumLeaseMonths),
      moveInDate,
      moveOutDate,
      renewalAvailable: toNullableBoolean(renewalAvailable),
      earlyTerminationAllowed: toNullableBoolean(earlyTerminationAllowed),
      earlyTerminationTerms: earlyTerminationTerms.trim(),
      sublettingAllowed: toNullableBoolean(sublettingAllowed),
      assignmentAllowed: toNullableBoolean(assignmentAllowed),
      guarantorRequired: toNullableBoolean(guarantorRequired),
      guarantorDetails: guarantorDetails.trim(),
      studentStatusRequired: toNullableBoolean(studentStatusRequired),
      proofOfEnrolmentRequired: toNullableBoolean(proofOfEnrolmentRequired),
      internationalStudentsAccepted: toNullableBoolean(
        internationalStudentsAccepted
      ),
      coSignerAccepted: toNullableBoolean(coSignerAccepted),
      occupantsAllowed: toNumberOrNull(occupantsAllowed),
      overnightGuestPolicy: overnightGuestPolicy.trim(),
      smokingPolicy: smokingPolicy.trim(),
      petPolicy: petPolicy.trim(),
      tenantInsuranceRequired: toNullableBoolean(tenantInsuranceRequired),
      keyDepositAmount: toNumberOrNull(keyDepositAmount),
      securityDepositAmount: toNumberOrNull(securityDepositAmount),
      lastMonthRentRequired: toNullableBoolean(lastMonthRentRequired),
      applicationFeeAmount: toNumberOrNull(applicationFeeAmount),
      additionalFees: additionalFees.trim(),
      notes: leaseConditionsNotes.trim(),
    };
  }

  async function handleSubmit(
    e: React.FormEvent | null,
    mode: "draft" | "publish"
  ) {
    e?.preventDefault();
    setFormError("");
    setUploadStatus("");

    if (limitReached) {
      alert(t("limitAlert", { plan, listingLimit }));
      router.push("/billing");
      return;
    }

    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/auth");
        return;
      }

      if (!user.email_confirmed_at) {
        alert(t("verifyEmailAlert"));
        router.push("/verify-email");
        return;
      }

      const documentRequirementSelected = Boolean(documentRequirementType);

      if (mode === "publish") {
        const publishValidationError = getPublishValidationError();

        if (publishValidationError) {
          setFormError(publishValidationError);
          setLoading(false);
          return;
        }
      }

      if (documentRequirementSelected && !documentRequirementAcknowledged) {
        setFormError("Acknowledge the application document fairness notice before saving document requirements.");
        setLoading(false);
        return;
      }

      const geocode = await geocodeListingAddressWithMapbox({
        token: process.env.NEXT_PUBLIC_MAPBOX_TOKEN,
        address: {
          addressLine,
          unit,
          city,
          province,
          postalCode,
          country: "Canada",
        },
      });

      if (!geocode.ok) {
        setFormError(geocode.message);
        setLoading(false);
        return;
      }

      const { latitude, longitude } = geocode;
      const publicCoordinate = generatePublicCoordinate({
        latitude,
        longitude,
        seed: geocode.fullAddress,
      });
      const otherOccupantCount =
        otherOccupantsPresent === "true" && estimatedOtherOccupantCount
          ? Math.trunc(Number(estimatedOtherOccupantCount))
          : null;
      const campusLat = toNumberOrNull(campusLatitude);
      const campusLng = toNumberOrNull(campusLongitude);
      const distanceToCampusKm = calculateDistanceKm(
        latitude,
        longitude,
        campusLat,
        campusLng
      );
      const travelTimes = estimateTravelTimes(distanceToCampusKm);
      const idempotencyKey = `${user.id}:${creationIdempotencyKey}`;

      const { data: listing, error } = await supabase
        .from("listings")
        .insert({
          creation_idempotency_key: idempotencyKey,
          user_id: user.id,
          title: title.trim(),
          city: city.trim(),
          location: city.trim(),
          campus: campus.trim(),
          address_line: addressLine.trim(),
          unit: unit.trim(),
          province: province.trim(),
          postal_code: postalCode.trim(),
          country: "Canada",
          safety_instructions: safetyInstructions.trim(),
          price: Number(price),
          bedrooms: bedrooms ? Number(bedrooms) : null,
          bathrooms: bathrooms ? Number(bathrooms) : null,
          roommates: roommates ? Number(roommates) : null,
          description: description.trim(),
          amenities: amenities
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
          status: "draft",
          latitude,
          longitude,
          public_latitude: publicCoordinate.latitude,
          public_longitude: publicCoordinate.longitude,
          location_privacy_radius_meters: publicCoordinate.radiusMeters,
          public_location_generated_at: new Date().toISOString(),
          nearest_campus_name: nearestCampusName.trim() || null,
          nearest_campus_address: nearestCampusAddress.trim() || null,
          campus_latitude: campusLat,
          campus_longitude: campusLng,
          distance_to_campus_km: distanceToCampusKm,
          walking_time_minutes: travelTimes.walking,
          cycling_time_minutes: travelTimes.cycling,
          driving_time_minutes: travelTimes.driving,
          transit_time_minutes: travelTimes.transit,
          distance_last_calculated_at: distanceToCampusKm
            ? new Date().toISOString()
            : null,
          utilities_details: buildUtilitiesDetails(),
          amenities_details: buildAmenitiesDetails(),
          lease_conditions: buildLeaseConditions(),
          verification_disclaimer_acknowledged: true,
          fair_housing_acknowledged: documentRequirementAcknowledged,
          owner_occupies_property: toNullableBoolean(ownerOccupiesProperty),
          owner_family_occupies_property: toNullableBoolean(
            ownerFamilyOccupiesProperty
          ),
          shared_kitchen_with_owner: toNullableBoolean(sharedKitchenWithOwner),
          shared_bathroom_with_owner: toNullableBoolean(sharedBathroomWithOwner),
          private_bedroom: toNullableBoolean(privateBedroom),
          self_contained_unit: toNullableBoolean(selfContainedUnit),
          other_occupants_present: toNullableBoolean(otherOccupantsPresent),
          estimated_other_occupant_count: otherOccupantCount,
          occupancy_notes: occupancyNotes.trim() || null,
        })
        .select("id")
        .single();

      if (error?.code === "23505") {
        const { data: existingListing } = await supabase
          .from("listings")
          .select("id")
          .eq("creation_idempotency_key", idempotencyKey)
          .eq("user_id", user.id)
          .maybeSingle();

        if (existingListing?.id) {
          router.push("/my-listings");
          router.refresh();
          return;
        }
      }

      if (error || !listing) {
        console.error("LISTING CREATE ERROR:", error);
        setFormError(t("createFailed"));
        return;
      }

      if (files && files.length > 0) {
        const imageRows = [];

        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const ext = file.name.split(".").pop();
          const fileName = `${crypto.randomUUID()}.${ext}`;
          const path = `listings/${listing.id}/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from("listing-images")
            .upload(path, file);

          if (uploadError) continue;

          const { data } = supabase.storage
            .from("listing-images")
            .getPublicUrl(path);

          imageRows.push({
            listing_id: listing.id,
            image_url: data.publicUrl,
            image_path: path,
            sort_order: i,
            is_cover: i === 0,
          });
        }

        if (imageRows.length > 0) {
          await supabase.from("listing_images").insert(imageRows);
        }
      }

      if (documentRequirementSelected) {
        const { error: requirementError } = await supabase.from("listing_document_requirements").insert({
          listing_id: listing.id,
          owner_id: user.id,
          document_type: documentRequirementType,
          display_name:
            documentTypes.find((item) => item.value === documentRequirementType)
              ?.label || "Application document",
          description: documentRequirementDescription.trim() || null,
          requirement_level: documentRequirementLevel,
          applies_when: documentRequirementAppliesWhen,
          alternative_documents: documentRequirementAlternatives
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
          sort_order: 0,
          active: true,
        });

        if (requirementError) {
          console.error("LISTING DOCUMENT REQUIREMENT ERROR:", requirementError);
          setFormError("We could not save your application document details. Please try again.");
          setLoading(false);
          return;
        }
      }

      if (mode === "publish") {
        setUploadStatus("Submitting listing for publication...");
        const publishResponse = await fetch("/api/listings/publish", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ listingId: listing.id }),
        });
        const publishData = await publishResponse.json().catch(() => null);

        if (!publishResponse.ok) {
          setFormError(
            publishData?.error ||
              "The listing was saved as a draft, but could not be published."
          );
          setLoading(false);
          return;
        }
      }

      router.push("/my-listings");
      router.refresh();
    } catch (error) {
      console.error(error);
      setFormError(t("genericError"));
    } finally {
      setLoading(false);
    }
  }

  if (checkingLimit) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black text-white">
        <p className="text-zinc-400">{t("checkingPlan")}</p>
      </main>
    );
  }

  if (limitReached) {
    return (
      <main className="min-h-screen bg-black px-6 py-10 text-white">
        <div className="mx-auto max-w-3xl rounded-3xl border border-yellow-500/30 bg-yellow-500/10 p-8">
          <div className="flex items-start gap-4">
            <AlertCircle className="mt-1 text-yellow-300" />
            <div>
              <h1 className="text-3xl font-bold">{t("limitReachedTitle")}</h1>
              <p className="mt-3 text-zinc-300">
                {t.rich("limitReachedText", {
                  plan,
                  listingLimit: listingLimitLabel,
                  activeListings,
                  strong: (chunks) => (
                    <span className="font-bold text-white">{chunks}</span>
                  ),
                  planStrong: (chunks) => (
                    <span className="font-bold capitalize text-white">
                      {chunks}
                    </span>
                  ),
                })}
              </p>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/billing"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 font-bold text-black"
                >
                  <Crown size={18} />
                  {t("upgradePlan")}
                </Link>

                <Link
                  href="/my-listings"
                  className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-bold text-white"
                >
                  {t("manageListings")}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-6 py-10 text-white">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 rounded-3xl border border-purple-500/20 bg-purple-500/10 p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <Sparkles className="text-purple-300" />
              <div>
                <p className="font-bold capitalize">
                  {t("ownerPlan", { plan })}
                </p>
                <p className="text-sm text-zinc-400">
                  {t("activeListingsUsed", {
                    activeListings,
                    listingLimit: listingLimitLabel,
                  })}
                </p>
              </div>
            </div>

            <Link
              href="/billing"
              className="rounded-2xl border border-purple-400/30 bg-purple-500/20 px-5 py-3 text-sm font-bold text-purple-100 hover:bg-purple-500/30"
            >
              {t("manageSubscription")}
            </Link>
          </div>
        </div>

        <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-8">
          <h1 className="text-4xl font-bold">{t("title")}</h1>

          <p className="mt-2 text-zinc-400">
            {t("subtitle")}
          </p>

          <form
            onSubmit={(event) => handleSubmit(event, "publish")}
            className="mt-8 space-y-8"
          >
            <div className="space-y-8">
              {formError && (
                <div
                  role="alert"
                  aria-live="assertive"
                  className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm font-semibold text-red-200"
                >
                  {formError}
                </div>
              )}

              {uploadStatus && (
                <div
                  aria-live="polite"
                  className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm font-semibold text-emerald-200"
                >
                  {uploadStatus}
                </div>
              )}
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-bold text-white">
                      Listing completion
                    </p>
                    <p className="text-xs text-zinc-500">
                      Step-by-step details saved into one professional listing.
                    </p>
                  </div>
                  <p className="text-sm font-black text-pink-200">
                    {completionPercent}%
                  </p>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-pink-400 transition-all"
                    style={{ width: `${completionPercent}%` }}
                  />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Input label={t("listingTitle")} value={title} set={setTitle} />
                <Input label={t("campus")} value={campus} set={setCampus} />
              </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Input label={t("city")} value={city} set={setCity} />
              <Input label={t("price")} value={price} set={setPrice} type="number" />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <Input label={t("bedrooms")} value={bedrooms} set={setBedrooms} type="number" />
              <Input label={t("bathrooms")} value={bathrooms} set={setBathrooms} type="number" />
              <Input label={t("roommates")} value={roommates} set={setRoommates} type="number" />
            </div>

            <textarea
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("descriptionPlaceholder")}
              className="w-full rounded-2xl border border-zinc-800 bg-black p-4 outline-none focus:border-white"
              rows={6}
            />

            <Input label={t("amenities")} value={amenities} set={setAmenities} />

            <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/5 p-6">
              <h2 className="text-2xl font-semibold text-emerald-300">
                {t("secureAddressTitle")}
              </h2>

              <p className="mt-2 text-sm text-zinc-400">
                {t("secureAddressText")}
              </p>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <Input label={t("streetAddress")} value={addressLine} set={setAddressLine} />
                <Input label={t("unit")} value={unit} set={setUnit} />
                <Input label={t("province")} value={province} set={setProvince} />
                <Input label={t("postalCode")} value={postalCode} set={setPostalCode} />
              </div>

              <textarea
                value={safetyInstructions}
                onChange={(e) => setSafetyInstructions(e.target.value)}
                placeholder={t("safetyInstructionsPlaceholder")}
                rows={4}
                className="mt-4 w-full rounded-2xl border border-zinc-800 bg-black p-4 outline-none focus:border-emerald-400"
              />
            </div>

            <div className="rounded-3xl border border-cyan-500/20 bg-cyan-500/5 p-6">
              <h2 className="text-2xl font-semibold text-cyan-200">
                Listing transparency
              </h2>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                Help students understand campus distance, included utilities,
                amenities and lease conditions before they inquire.
              </p>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <SelectField
                  label="Nearest campus"
                  value={nearestCampusName}
                  set={applyCampusSelection}
                  options={[
                    ["", "Select nearest campus"],
                    ...campusOptions.map((item) => [item.name, item.name]),
                  ]}
                />
                <Input
                  label="Campus address"
                  value={nearestCampusAddress}
                  set={setNearestCampusAddress}
                  required={false}
                />
              </div>

              <div className="mt-6 rounded-2xl border border-white/10 bg-black/40 p-4">
                <h3 className="font-bold text-white">Rent and utilities</h3>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  {utilityItems.map(([key, label]) => (
                    <div key={key}>
                      <SelectField
                        label={label}
                        value={utilityStatuses[key] || "ask_landlord"}
                        set={(value) =>
                          setUtilityStatuses((current) => ({
                            ...current,
                            [key]: value as UtilityStatus,
                          }))
                        }
                        options={utilityStatusOptions.map((item) => [
                          item[0],
                          item[1],
                        ])}
                      />
                      {utilityStatuses[key] === "partial" && (
                        <input
                          value={utilityPartialExplanations[key] || ""}
                          onChange={(event) =>
                            setUtilityPartialExplanations((current) => ({
                              ...current,
                              [key]: event.target.value,
                            }))
                          }
                          placeholder="Explain what is included"
                          className="mt-2 w-full rounded-2xl border border-zinc-800 bg-black p-3 text-sm outline-none focus:border-cyan-300"
                        />
                      )}
                    </div>
                  ))}
                  <Input
                    label="Estimated utilities minimum"
                    value={estimatedUtilitiesMin}
                    set={setEstimatedUtilitiesMin}
                    type="number"
                    required={false}
                  />
                  <Input
                    label="Estimated utilities maximum"
                    value={estimatedUtilitiesMax}
                    set={setEstimatedUtilitiesMax}
                    type="number"
                    required={false}
                  />
                </div>
                <textarea
                  value={utilitiesNotes}
                  onChange={(event) => setUtilitiesNotes(event.target.value)}
                  placeholder="Utility notes students should know"
                  rows={3}
                  className="mt-4 w-full rounded-2xl border border-zinc-800 bg-black p-4 outline-none focus:border-cyan-300"
                />
              </div>

              <div className="mt-6 rounded-2xl border border-white/10 bg-black/40 p-4">
                <h3 className="font-bold text-white">Amenities</h3>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {amenityItems.map(([key, label]) => (
                    <label
                      key={key}
                      className="flex items-center gap-3 rounded-2xl border border-zinc-800 bg-black p-3 text-sm text-zinc-300"
                    >
                      <input
                        type="checkbox"
                        checked={selectedAmenities.includes(key)}
                        onChange={() => toggleStructuredAmenity(key)}
                        className="h-4 w-4 accent-pink-500"
                      />
                      {label}
                    </label>
                  ))}
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <Input label="Parking details" value={parkingDetails} set={setParkingDetails} required={false} />
                  <Input label="Laundry details" value={laundryDetails} set={setLaundryDetails} required={false} />
                  <Input label="Furnishing details" value={furnishingDetails} set={setFurnishingDetails} required={false} />
                  <Input label="Internet details" value={internetDetails} set={setInternetDetails} required={false} />
                </div>
                <textarea
                  value={accessibilityNotes}
                  onChange={(event) => setAccessibilityNotes(event.target.value)}
                  placeholder="Accessibility notes"
                  rows={3}
                  className="mt-4 w-full rounded-2xl border border-zinc-800 bg-black p-4 outline-none focus:border-cyan-300"
                />
                <textarea
                  value={petDetails}
                  onChange={(event) => setPetDetails(event.target.value)}
                  placeholder="Pet policy details"
                  rows={3}
                  className="mt-4 w-full rounded-2xl border border-zinc-800 bg-black p-4 outline-none focus:border-cyan-300"
                />
              </div>

              <div className="mt-6 rounded-2xl border border-white/10 bg-black/40 p-4">
                <h3 className="font-bold text-white">Lease conditions</h3>
                <p className="mt-2 text-sm text-zinc-400">
                  These are landlord-provided details. Students should review
                  the final lease directly before signing.
                </p>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <SelectField label="Lease type" value={leaseType} set={setLeaseType} options={leaseTypeOptions.map((item) => [item[0], item[1]])} />
                  <Input label="Move-in date" value={moveInDate} set={setMoveInDate} type="date" required={false} />
                  <Input label="Move-out date" value={moveOutDate} set={setMoveOutDate} type="date" required={false} />
                  <Input label="Lease start date" value={leaseStartDate} set={setLeaseStartDate} type="date" required={false} />
                  <Input label="Lease end date" value={leaseEndDate} set={setLeaseEndDate} type="date" required={false} />
                  <Input label="Minimum lease months" value={minimumLeaseMonths} set={setMinimumLeaseMonths} type="number" required={false} />
                  <Input label="Maximum lease months" value={maximumLeaseMonths} set={setMaximumLeaseMonths} type="number" required={false} />
                  <SelectField label="Renewal available" value={renewalAvailable} set={setRenewalAvailable} options={yesNoOptions} />
                  <SelectField label="Early termination allowed" value={earlyTerminationAllowed} set={setEarlyTerminationAllowed} options={yesNoOptions} />
                  <SelectField label="Subletting allowed" value={sublettingAllowed} set={setSublettingAllowed} options={yesNoOptions} />
                  <SelectField label="Assignment allowed" value={assignmentAllowed} set={setAssignmentAllowed} options={yesNoOptions} />
                  <SelectField label="Guarantor required" value={guarantorRequired} set={setGuarantorRequired} options={yesNoOptions} />
                  <SelectField label="Student status required" value={studentStatusRequired} set={setStudentStatusRequired} options={yesNoOptions} />
                  <SelectField label="Proof of enrolment required" value={proofOfEnrolmentRequired} set={setProofOfEnrolmentRequired} options={yesNoOptions} />
                  <SelectField label="International students accepted" value={internationalStudentsAccepted} set={setInternationalStudentsAccepted} options={yesNoOptions} />
                  <SelectField label="Co-signer accepted" value={coSignerAccepted} set={setCoSignerAccepted} options={yesNoOptions} />
                  <Input label="Occupants allowed" value={occupantsAllowed} set={setOccupantsAllowed} type="number" required={false} />
                  <SelectField label="Tenant insurance required" value={tenantInsuranceRequired} set={setTenantInsuranceRequired} options={yesNoOptions} />
                  <Input label="Key deposit amount" value={keyDepositAmount} set={setKeyDepositAmount} type="number" required={false} />
                  <Input label="Security deposit amount" value={securityDepositAmount} set={setSecurityDepositAmount} type="number" required={false} />
                  <SelectField label="Last month rent required" value={lastMonthRentRequired} set={setLastMonthRentRequired} options={yesNoOptions} />
                  <Input label="Application fee amount" value={applicationFeeAmount} set={setApplicationFeeAmount} type="number" required={false} />
                </div>
                <textarea value={guarantorDetails} onChange={(event) => setGuarantorDetails(event.target.value)} placeholder="Guarantor or co-signer details" rows={3} className="mt-4 w-full rounded-2xl border border-zinc-800 bg-black p-4 outline-none focus:border-cyan-300" />
                <textarea value={earlyTerminationTerms} onChange={(event) => setEarlyTerminationTerms(event.target.value)} placeholder="Early termination terms" rows={3} className="mt-4 w-full rounded-2xl border border-zinc-800 bg-black p-4 outline-none focus:border-cyan-300" />
                <textarea value={overnightGuestPolicy} onChange={(event) => setOvernightGuestPolicy(event.target.value)} placeholder="Overnight guest policy" rows={3} className="mt-4 w-full rounded-2xl border border-zinc-800 bg-black p-4 outline-none focus:border-cyan-300" />
                <textarea value={smokingPolicy} onChange={(event) => setSmokingPolicy(event.target.value)} placeholder="Smoking policy" rows={3} className="mt-4 w-full rounded-2xl border border-zinc-800 bg-black p-4 outline-none focus:border-cyan-300" />
                <textarea value={petPolicy} onChange={(event) => setPetPolicy(event.target.value)} placeholder="Pet policy" rows={3} className="mt-4 w-full rounded-2xl border border-zinc-800 bg-black p-4 outline-none focus:border-cyan-300" />
                <textarea value={additionalFees} onChange={(event) => setAdditionalFees(event.target.value)} placeholder="Additional fees" rows={3} className="mt-4 w-full rounded-2xl border border-zinc-800 bg-black p-4 outline-none focus:border-cyan-300" />
                <textarea value={leaseConditionsNotes} onChange={(event) => setLeaseConditionsNotes(event.target.value)} placeholder="Additional lease notes" rows={3} className="mt-4 w-full rounded-2xl border border-zinc-800 bg-black p-4 outline-none focus:border-cyan-300" />
              </div>
            </div>

            <div className="rounded-3xl border border-blue-500/20 bg-blue-500/5 p-6">
              <h2 className="text-2xl font-semibold text-blue-200">
                Living arrangement
              </h2>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                Make owner-sharing and other occupancy details clear before
                students inquire.
              </p>
              <div className="mt-5">
                <ContextHelpBox
                  title="Why these questions matter"
                  description="These answers help students understand exactly who they may share the property with before they apply."
                  bullets={[
                    "Answer based on the actual expected living arrangement.",
                    "Do not select an answer only to make the listing appear more attractive.",
                    "Update these answers if the arrangement changes.",
                    "Sharing a kitchen or bathroom with the owner or the owner’s immediate family may affect which Ontario tenancy rules apply.",
                  ]}
                />
              </div>
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <HelpField help="Select Yes when the property owner will normally live in the same house, apartment or building area included in this rental arrangement.">
                  <SelectField label="Will you, the property owner, live at this property? *" value={ownerOccupiesProperty} set={setOwnerOccupiesProperty} options={yesNoOptions} />
                </HelpField>
                <HelpField help="Select Yes when the owner’s spouse, child, parent or another immediate family member will live in the same property.">
                  <SelectField label="Will an immediate family member of the owner live at this property? *" value={ownerFamilyOccupiesProperty} set={setOwnerFamilyOccupiesProperty} options={yesNoOptions} />
                </HelpField>
                <HelpField help="Select Yes when the tenant must regularly use the same kitchen as the owner or the owner’s immediate family.">
                  <SelectField label="Will the tenant share a kitchen with the owner or owner family? *" value={sharedKitchenWithOwner} set={setSharedKitchenWithOwner} options={yesNoOptions} />
                </HelpField>
                <HelpField help="Select Yes when the tenant must regularly use the same bathroom as the owner or the owner’s immediate family.">
                  <SelectField label="Will the tenant share a bathroom with the owner or owner family? *" value={sharedBathroomWithOwner} set={setSharedBathroomWithOwner} options={yesNoOptions} />
                </HelpField>
                <HelpField help="Select Yes only when the tenant has a bedroom intended for their exclusive use.">
                  <SelectField label="Will the tenant have a private bedroom? *" value={privateBedroom} set={setPrivateBedroom} options={yesNoOptions} />
                </HelpField>
                <HelpField help="Select Yes when the rental has its own living area, kitchen and bathroom that are not shared with the owner or other unrelated occupants.">
                  <SelectField label="Is the rental unit fully self-contained? *" value={selfContainedUnit} set={setSelfContainedUnit} options={yesNoOptions} />
                </HelpField>
                <HelpField help="Select Yes when roommates, other tenants or additional residents will also live at the property.">
                  <SelectField label="Will other tenants or roommates live at the property? *" value={otherOccupantsPresent} set={setOtherOccupantsPresent} options={yesNoOptions} />
                </HelpField>
                {otherOccupantsPresent === "true" && (
                  <HelpField help="Enter the approximate number of other people expected to live at the property, excluding the applicant.">
                    <Input label="Approximately how many other occupants?" value={estimatedOtherOccupantCount} set={setEstimatedOtherOccupantCount} type="number" required={false} />
                  </HelpField>
                )}
              </div>
              <textarea
                value={occupancyNotes}
                onChange={(event) => setOccupancyNotes(event.target.value)}
                placeholder="Additional living-arrangement details"
                rows={4}
                className="mt-4 w-full rounded-2xl border border-zinc-800 bg-black p-4 outline-none focus:border-blue-400"
              />
              {sharedWithOwner && (
                <div className="mt-5">
                  <OntarioOccupancyNotice />
                </div>
              )}
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
              <h2 className="text-2xl font-semibold text-white">
                Application documents
              </h2>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                Add one common document request that may apply to this listing.
                You can request additional documents securely in messages after
                an inquiry is accepted.
              </p>
              <div className="mt-5">
                <ContextHelpBox
                  title="What this section controls"
                  description="This section tells students which application documents you may request after they show serious rental interest."
                  bullets={[
                    "Only request documents that are reasonably connected to evaluating the rental application.",
                    "Apply document expectations consistently.",
                    "Give students alternatives when they do not have Canadian rental or credit history.",
                    "Do not request unnecessary sensitive information.",
                  ]}
                />
              </div>
              <div className="mt-5">
                <FairHousingNotice />
              </div>
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <HelpField help="Choose the single document type you may request for this listing, or leave it blank if you do not need a preset requirement.">
                  <SelectField
                    label="Document type"
                    value={documentRequirementType}
                    set={setDocumentRequirementType}
                    options={[
                      ["", "No document requirement"],
                      ...documentTypes.map((item) => [item.value, item.label]),
                    ]}
                  />
                </HelpField>
                <HelpField
                  help={
                    requirementLevelGuidance[documentRequirementLevel] ||
                    "Choose how strongly this document applies to applicants."
                  }
                >
                  <SelectField
                    label="Requirement level"
                    value={documentRequirementLevel}
                    set={setDocumentRequirementLevel}
                    options={requirementLevels.map((item) => [
                      item.value,
                      item.label,
                    ])}
                  />
                </HelpField>
                <HelpField help="Use this to clarify whether the request applies to everyone or only to a specific applicant situation.">
                  <SelectField
                    label="Applies when"
                    value={documentRequirementAppliesWhen}
                    set={setDocumentRequirementAppliesWhen}
                    options={appliesWhenOptions.map((item) => [
                      item.value,
                      item.label,
                    ])}
                  />
                </HelpField>
                <HelpField help="List reasonable alternatives, separated by commas, especially for students or newcomers without Canadian records.">
                  <Input
                    label="Accepted alternatives"
                    value={documentRequirementAlternatives}
                    set={setDocumentRequirementAlternatives}
                    required={false}
                  />
                </HelpField>
              </div>
              <HelpField help="Briefly explain why this document is being requested so students understand the rental application context.">
                <textarea
                  value={documentRequirementDescription}
                  onChange={(event) =>
                    setDocumentRequirementDescription(event.target.value)
                  }
                  placeholder="Purpose or context for this document request"
                  rows={4}
                  className="mt-4 w-full rounded-2xl border border-zinc-800 bg-black p-4 outline-none focus:border-white"
                />
              </HelpField>
              <label className="mt-4 flex items-start gap-3 text-sm leading-6 text-zinc-300">
                <input
                  type="checkbox"
                  checked={documentRequirementAcknowledged}
                  onChange={(event) =>
                    setDocumentRequirementAcknowledged(event.target.checked)
                  }
                  className="mt-1 h-4 w-4 accent-pink-500"
                />
                <span>
                  <span className="font-semibold text-pink-200">
                    Required to publish.{" "}
                  </span>
                  I understand document requirements must be reasonably
                  connected to evaluating the rental application, applied
                  consistently, and must not discriminate based on protected
                  characteristics. I will consider reasonable alternatives where
                  an applicant does not have Canadian rental or credit history.
                </span>
              </label>
            </div>

            <div>
              <label className="mb-2 block text-sm text-zinc-400">
                {t("listingImages")}
              </label>

              <input
                type="file"
                multiple
                accept="image/*"
                onChange={(e) => setFiles(e.target.files)}
                className="w-full rounded-2xl border border-zinc-800 bg-black p-4"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => handleSubmit(null, "draft")}
                disabled={loading}
                className="w-full rounded-2xl border border-white/10 bg-white/5 py-4 font-bold text-white transition hover:bg-white/10 disabled:opacity-50"
              >
                {loading ? "Saving..." : "Save as Draft"}
              </button>

              <button
                type="submit"
                disabled={loading || !readyToPublish}
                className="w-full rounded-2xl bg-white py-4 font-bold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? t("publishing") : "Publish Listing"}
              </button>
            </div>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}

function Input({
  label,
  value,
  set,
  type = "text",
  required = true,
}: {
  label: string;
  value: string;
  set: (value: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm text-zinc-400">{label}</label>

      <input
        required={required}
        type={type}
        value={value}
        onChange={(e) => set(e.target.value)}
        className="w-full rounded-2xl border border-zinc-800 bg-black p-4 outline-none focus:border-white"
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  set,
  options,
}: {
  label: string;
  value: string;
  set: (value: string) => void;
  options: string[][];
}) {
  return (
    <div>
      <label className="mb-2 block text-sm text-zinc-400">{label}</label>

      <select
        value={value}
        onChange={(e) => set(e.target.value)}
        className="w-full rounded-2xl border border-zinc-800 bg-black p-4 text-white outline-none focus:border-white"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </div>
  );
}

function HelpField({
  children,
  help,
}: {
  children: ReactNode;
  help: string;
}) {
  return (
    <div>
      {children}
      <p className="mt-2 rounded-2xl border border-white/10 bg-black/30 p-3 text-xs leading-5 text-zinc-400">
        {help}
      </p>
    </div>
  );
}
