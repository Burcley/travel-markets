"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
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

type ExistingImage = {
  id: string;
  listing_id: string;
  image_url: string;
  image_path: string | null;
  storage_path: string | null;
  sort_order: number | null;
  is_cover: boolean | null;
};

type NewImage = {
  localId: string;
  file: File;
  previewUrl: string;
};

type RequirementEditorItem = {
  id: string;
  document_type: string;
  display_name: string;
  description: string;
  requirement_level: string;
  applies_when: string;
  alternative_documents: string;
  sort_order: number;
  active: boolean;
};

type RequirementRow = {
  id?: string | null;
  document_type?: string | null;
  display_name?: string | null;
  description?: string | null;
  requirement_level?: string | null;
  applies_when?: string | null;
  alternative_documents?: string[] | null;
  sort_order?: number | null;
  active?: boolean | null;
};

const yesNoOptions = [
  ["", "Not answered"],
  ["true", "Yes"],
  ["false", "No"],
];

function toNullableBoolean(value: string) {
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

function fromNullableBoolean(value: boolean | null | undefined) {
  if (value === true) return "true";
  if (value === false) return "false";
  return "";
}

function toNumberOrNull(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

type SupabaseLikeError = {
  message?: string;
  details?: string;
  hint?: string;
  code?: string;
};

function logListingEditError(
  label: string,
  error: SupabaseLikeError | null | undefined,
  context?: Record<string, unknown>
) {
  console.error(label, {
    message: error?.message,
    details: error?.details,
    hint: error?.hint,
    code: error?.code,
    ...context,
  });
}

function clientSaveMessage(message: string, error?: SupabaseLikeError | null) {
  if (process.env.NODE_ENV === "development" && error?.code) {
    return `${message} (${error.code})`;
  }

  return message;
}

export default function EditListingPage() {
  const t = useTranslations("listingManagement.edit");
  const router = useRouter();
  const params = useParams();
  const listingId = params.id as string;
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [repairingLocation, setRepairingLocation] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [locationRepairMessage, setLocationRepairMessage] = useState("");

  const [title, setTitle] = useState("");
  const [city, setCity] = useState("");
  const [campus, setCampus] = useState("");
  const [nearestCampusName, setNearestCampusName] = useState("");
  const [nearestCampusAddress, setNearestCampusAddress] = useState("");
  const [campusLatitude, setCampusLatitude] = useState("");
  const [campusLongitude, setCampusLongitude] = useState("");
  const [address, setAddress] = useState("");
  const [addressLine, setAddressLine] = useState("");
  const [unit, setUnit] = useState("");
  const [province, setProvince] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [safetyInstructions, setSafetyInstructions] = useState("");

  const [price, setPrice] = useState("");
  const [bedrooms, setBedrooms] = useState("");
  const [bathrooms, setBathrooms] = useState("");
  const [guests, setGuests] = useState("");
  const [roommates, setRoommates] = useState("");
  const [status, setStatus] = useState<"draft" | "available" | "pending" | "rented">(
    "available"
  );
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

  const [existingImages, setExistingImages] = useState<ExistingImage[]>([]);
  const [removedImages, setRemovedImages] = useState<ExistingImage[]>([]);
  const [newImages, setNewImages] = useState<NewImage[]>([]);

  const [coverType, setCoverType] = useState<"existing" | "new" | null>(null);
  const [coverId, setCoverId] = useState<string | null>(null);
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
  const [fairHousingAcknowledged, setFairHousingAcknowledged] = useState(false);
  const [requirements, setRequirements] = useState<RequirementEditorItem[]>([]);
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
  const readyToPublish = livingArrangementCompleted && fairHousingAcknowledged;
  const progressItems = [
    { label: "Living arrangement completed", complete: livingArrangementCompleted },
    {
      label: "Fair-housing acknowledgement accepted",
      complete: fairHousingAcknowledged,
    },
    { label: "Ready to publish", complete: readyToPublish },
  ];

  useEffect(() => {
    loadListing();
  }, [listingId]);

  async function loadListing() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/auth");
      return;
    }

    const { data: listing, error: listingError } = await supabase
      .from("listings")
      .select("*")
      .eq("id", listingId)
      .single();

    if (listingError || !listing) {
      alert(t("notFound"));
      router.push("/my-listings");
      return;
    }

    if (listing.user_id !== user.id) {
      alert(t("notAllowed"));
      router.push("/my-listings");
      return;
    }

    setTitle(listing.title || "");
    setCity(listing.city || "");
    setCampus(listing.campus || "");
    setAddress(listing.address || "");
    setAddressLine(listing.address_line || "");
    setUnit(listing.unit || "");
    setProvince(listing.province || "");
    setPostalCode(listing.postal_code || "");
    setSafetyInstructions(listing.safety_instructions || "");

    setPrice(listing.price?.toString() || "");
    setBedrooms(listing.bedrooms?.toString() || "");
    setBathrooms(listing.bathrooms?.toString() || "");
    setGuests(listing.guests?.toString() || "");
    setRoommates(listing.roommates?.toString() || "");
    setStatus(listing.status || "available");
    setDescription(listing.description || "");
    setAmenities(
      Array.isArray(listing.amenities) ? listing.amenities.join(", ") : ""
    );
    setNearestCampusName(listing.nearest_campus_name || "");
    setNearestCampusAddress(listing.nearest_campus_address || "");
    setCampusLatitude(listing.campus_latitude?.toString() || "");
    setCampusLongitude(listing.campus_longitude?.toString() || "");
    const utilitiesDetails = (listing.utilities_details || {}) as UtilitiesDetails;
    const amenitiesDetails = (listing.amenities_details || {}) as AmenitiesDetails;
    const leaseConditions = (listing.lease_conditions || {}) as LeaseConditions;
    setUtilityStatuses(utilitiesDetails.statuses || {});
    setUtilityPartialExplanations(utilitiesDetails.partialExplanations || {});
    setEstimatedUtilitiesMin(
      utilitiesDetails.estimatedMonthlyMin?.toString() || ""
    );
    setEstimatedUtilitiesMax(
      utilitiesDetails.estimatedMonthlyMax?.toString() || ""
    );
    setUtilitiesNotes(utilitiesDetails.notes || "");
    setSelectedAmenities(amenitiesDetails.selected || []);
    setParkingDetails(amenitiesDetails.parking || "");
    setLaundryDetails(amenitiesDetails.laundry || "");
    setFurnishingDetails(amenitiesDetails.furnishing || "");
    setInternetDetails(amenitiesDetails.internetDetails || "");
    setAccessibilityNotes(amenitiesDetails.accessibilityNotes || "");
    setPetDetails(amenitiesDetails.petDetails || "");
    setLeaseType(leaseConditions.leaseType || "");
    setLeaseStartDate(leaseConditions.leaseStartDate || "");
    setLeaseEndDate(leaseConditions.leaseEndDate || "");
    setMinimumLeaseMonths(leaseConditions.minimumLeaseMonths?.toString() || "");
    setMaximumLeaseMonths(leaseConditions.maximumLeaseMonths?.toString() || "");
    setMoveInDate(leaseConditions.moveInDate || "");
    setMoveOutDate(leaseConditions.moveOutDate || "");
    setRenewalAvailable(fromNullableBoolean(leaseConditions.renewalAvailable));
    setEarlyTerminationAllowed(
      fromNullableBoolean(leaseConditions.earlyTerminationAllowed)
    );
    setEarlyTerminationTerms(leaseConditions.earlyTerminationTerms || "");
    setSublettingAllowed(fromNullableBoolean(leaseConditions.sublettingAllowed));
    setAssignmentAllowed(fromNullableBoolean(leaseConditions.assignmentAllowed));
    setGuarantorRequired(fromNullableBoolean(leaseConditions.guarantorRequired));
    setGuarantorDetails(leaseConditions.guarantorDetails || "");
    setStudentStatusRequired(
      fromNullableBoolean(leaseConditions.studentStatusRequired)
    );
    setProofOfEnrolmentRequired(
      fromNullableBoolean(leaseConditions.proofOfEnrolmentRequired)
    );
    setInternationalStudentsAccepted(
      fromNullableBoolean(leaseConditions.internationalStudentsAccepted)
    );
    setCoSignerAccepted(fromNullableBoolean(leaseConditions.coSignerAccepted));
    setOccupantsAllowed(leaseConditions.occupantsAllowed?.toString() || "");
    setOvernightGuestPolicy(leaseConditions.overnightGuestPolicy || "");
    setSmokingPolicy(leaseConditions.smokingPolicy || "");
    setPetPolicy(leaseConditions.petPolicy || "");
    setTenantInsuranceRequired(
      fromNullableBoolean(leaseConditions.tenantInsuranceRequired)
    );
    setKeyDepositAmount(leaseConditions.keyDepositAmount?.toString() || "");
    setSecurityDepositAmount(
      leaseConditions.securityDepositAmount?.toString() || ""
    );
    setLastMonthRentRequired(
      fromNullableBoolean(leaseConditions.lastMonthRentRequired)
    );
    setApplicationFeeAmount(
      leaseConditions.applicationFeeAmount?.toString() || ""
    );
    setAdditionalFees(leaseConditions.additionalFees || "");
    setLeaseConditionsNotes(leaseConditions.notes || "");
    setOwnerOccupiesProperty(fromNullableBoolean(listing.owner_occupies_property));
    setOwnerFamilyOccupiesProperty(
      fromNullableBoolean(listing.owner_family_occupies_property)
    );
    setSharedKitchenWithOwner(fromNullableBoolean(listing.shared_kitchen_with_owner));
    setSharedBathroomWithOwner(
      fromNullableBoolean(listing.shared_bathroom_with_owner)
    );
    setPrivateBedroom(fromNullableBoolean(listing.private_bedroom));
    setSelfContainedUnit(fromNullableBoolean(listing.self_contained_unit));
    setOtherOccupantsPresent(fromNullableBoolean(listing.other_occupants_present));
    setEstimatedOtherOccupantCount(
      listing.estimated_other_occupant_count?.toString() || ""
    );
    setOccupancyNotes(listing.occupancy_notes || "");
    setFairHousingAcknowledged(Boolean(listing.fair_housing_acknowledged));

    const { data: images } = await supabase
      .from("listing_images")
      .select("*")
      .eq("listing_id", listingId)
      .order("sort_order", { ascending: true });

    const sortedImages = ((images || []) as ExistingImage[]).sort((a, b) => {
      if (a.is_cover && !b.is_cover) return -1;
      if (!a.is_cover && b.is_cover) return 1;
      return (a.sort_order || 0) - (b.sort_order || 0);
    });

    setExistingImages(sortedImages);

    const { data: requirementData } = await supabase
      .from("listing_document_requirements")
      .select(
        "id, document_type, display_name, description, requirement_level, applies_when, alternative_documents, sort_order, active"
      )
      .eq("listing_id", listingId)
      .order("sort_order", { ascending: true });

    setRequirements(
      ((requirementData || []) as RequirementRow[]).map((item, index) => ({
        id: item.id || crypto.randomUUID(),
        document_type: item.document_type || "proof_of_enrolment",
        display_name: item.display_name || "",
        description: item.description || "",
        requirement_level: item.requirement_level || "optional",
        applies_when: item.applies_when || "all_applicants",
        alternative_documents: Array.isArray(item.alternative_documents)
          ? item.alternative_documents.join(", ")
          : "",
        sort_order: item.sort_order ?? index,
        active: item.active !== false,
      }))
    );

    const coverImage = sortedImages.find((img) => img.is_cover);

    if (coverImage) {
      setCoverType("existing");
      setCoverId(coverImage.id);
    } else if (sortedImages.length > 0) {
      setCoverType("existing");
      setCoverId(sortedImages[0].id);
    }

    setLoading(false);
  }

  function addNewImages(files: FileList | null) {
    if (!files) return;

    const mapped = Array.from(files).map((file) => ({
      localId: crypto.randomUUID(),
      file,
      previewUrl: URL.createObjectURL(file),
    }));

    setNewImages((prev) => [...prev, ...mapped]);

    if (!coverId && mapped.length > 0) {
      setCoverType("new");
      setCoverId(mapped[0].localId);
    }
  }

  function deleteExistingImage(image: ExistingImage) {
    setExistingImages((prev) => prev.filter((img) => img.id !== image.id));
    setRemovedImages((prev) => [...prev, image]);

    if (coverType === "existing" && coverId === image.id) {
      setCoverType(null);
      setCoverId(null);
    }
  }

  function deleteNewImage(image: NewImage) {
    URL.revokeObjectURL(image.previewUrl);
    setNewImages((prev) => prev.filter((img) => img.localId !== image.localId));

    if (coverType === "new" && coverId === image.localId) {
      setCoverType(null);
      setCoverId(null);
    }
  }

  function moveExisting(index: number, direction: "up" | "down") {
    setExistingImages((prev) => {
      const copy = [...prev];
      const target = direction === "up" ? index - 1 : index + 1;
      if (target < 0 || target >= copy.length) return copy;
      [copy[index], copy[target]] = [copy[target], copy[index]];
      return copy;
    });
  }

  function moveNew(index: number, direction: "up" | "down") {
    setNewImages((prev) => {
      const copy = [...prev];
      const target = direction === "up" ? index - 1 : index + 1;
      if (target < 0 || target >= copy.length) return copy;
      [copy[index], copy[target]] = [copy[target], copy[index]];
      return copy;
    });
  }

  async function uploadNewImage(file: File, sortOrder: number, isCover: boolean) {
    const fileExt = file.name.split(".").pop() || "jpg";
    const fileName = `${crypto.randomUUID()}.${fileExt}`;
    const storagePath = `listings/${listingId}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("listing-images")
      .upload(storagePath, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) throw uploadError;

    const { data: publicUrlData } = supabase.storage
      .from("listing-images")
      .getPublicUrl(storagePath);

    const { error: insertError } = await supabase.from("listing_images").insert({
      listing_id: listingId,
      image_url: publicUrlData.publicUrl,
      image_path: storagePath,
      storage_path: storagePath,
      sort_order: sortOrder,
      is_cover: isCover,
    });

    if (insertError) throw insertError;
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

  async function repairMapLocation() {
    if (!listingId) return;

    try {
      setRepairingLocation(true);
      setLocationRepairMessage("");
      setSaveError("");

      const response = await fetch(`/api/listings/${listingId}/repair-location`, {
        method: "POST",
      });
      const result = await response.json();

      if (!response.ok) {
        setSaveError(result.error || "We could not recalculate the map location.");
        return;
      }

      setLocationRepairMessage(
        `Map location recalculated. Previous coordinate difference: ${
          result.oldVsGeocodedDifferenceMeters ?? "unknown"
        }m.`
      );
      await loadListing();
    } catch (error) {
      console.error("LOCATION REPAIR ERROR:", error);
      setSaveError("We could not recalculate the map location.");
    } finally {
      setRepairingLocation(false);
    }
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

  async function saveChanges(e: React.FormEvent) {
    e.preventDefault();
    setSaveError("");

    if (!title.trim()) {
      alert(t("titleRequired"));
      return;
    }

    if (!city.trim()) {
      alert(t("cityRequired"));
      return;
    }

    if (!price) {
      alert(t("priceRequired"));
      return;
    }

    if (existingImages.length + newImages.length === 0) {
      alert(t("imageRequired"));
      return;
    }

    setSaving(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/auth");
        return;
      }

      let finalCoverType = coverType;
      let finalCoverId = coverId;

      if (!finalCoverId) {
        if (existingImages.length > 0) {
          finalCoverType = "existing";
          finalCoverId = existingImages[0].id;
        } else if (newImages.length > 0) {
          finalCoverType = "new";
          finalCoverId = newImages[0].localId;
        }
      }

      const amenitiesArray = amenities
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      const otherOccupantCount =
        otherOccupantsPresent === "true" && estimatedOtherOccupantCount
          ? Math.trunc(Number(estimatedOtherOccupantCount))
          : null;

      const { data: previousListing } = await supabase
        .from("listings")
        .select(
          "status, city, address, address_line, unit, province, postal_code, latitude, longitude, public_latitude, public_longitude"
        )
        .eq("id", listingId)
        .maybeSingle();

      const shouldPublishDraft =
        previousListing?.status === "draft" && status === "available";
      const nextListingStatus = shouldPublishDraft ? "draft" : status;
      const activatingListing =
        ["draft", "rented"].includes(String(previousListing?.status || "")) &&
        ["available", "pending"].includes(nextListingStatus);

      if (activatingListing) {
        const limitResponse = await fetch("/api/listings/status", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            listingId,
            status: nextListingStatus,
            dryRun: true,
          }),
        });
        const limitData = await limitResponse.json().catch(() => null);

        if (!limitResponse.ok) {
          throw new Error(
            limitData?.error ||
              "Your current plan cannot activate another listing. Visit Billing to upgrade."
          );
        }
      }
      const campusLat = toNumberOrNull(campusLatitude);
      const campusLng = toNumberOrNull(campusLongitude);
      const addressChanged =
        Boolean(previousListing) &&
        ((previousListing?.city || "") !== city.trim() ||
          (previousListing?.address || "") !== address.trim() ||
          (previousListing?.address_line || "") !== addressLine.trim() ||
          (previousListing?.unit || "") !== unit.trim() ||
          (previousListing?.province || "") !== province.trim() ||
          (previousListing?.postal_code || "") !== postalCode.trim());
      const shouldRefreshCoordinates =
        addressChanged ||
        typeof previousListing?.latitude !== "number" ||
        typeof previousListing?.longitude !== "number";
      let propertyLat =
        typeof previousListing?.latitude === "number"
          ? previousListing.latitude
          : null;
      let propertyLng =
        typeof previousListing?.longitude === "number"
          ? previousListing.longitude
          : null;
      let coordinateUpdate: Record<string, unknown> = {};

      if (shouldRefreshCoordinates) {
        const geocode = await geocodeListingAddressWithMapbox({
          token: process.env.NEXT_PUBLIC_MAPBOX_TOKEN,
          address: {
            address: address.trim(),
            addressLine: addressLine.trim(),
            unit: unit.trim(),
            city: city.trim(),
            province: province.trim(),
            postalCode: postalCode.trim(),
            country: "Canada",
          },
          previousLatitude: propertyLat,
          previousLongitude: propertyLng,
        });

        if (!geocode.ok) {
          throw new Error(geocode.message);
        }

        propertyLat = geocode.latitude;
        propertyLng = geocode.longitude;

        const publicCoordinate = generatePublicCoordinate({
          latitude: geocode.latitude,
          longitude: geocode.longitude,
          seed: listingId,
        });

        coordinateUpdate = {
          latitude: geocode.latitude,
          longitude: geocode.longitude,
          public_latitude: publicCoordinate.latitude,
          public_longitude: publicCoordinate.longitude,
          location_privacy_radius_meters: publicCoordinate.radiusMeters,
          public_location_generated_at: new Date().toISOString(),
        };
      }
      const distanceToCampusKm = calculateDistanceKm(
        propertyLat,
        propertyLng,
        campusLat,
        campusLng
      );
      const travelTimes = estimateTravelTimes(distanceToCampusKm);
      const listingUpdate = {
        title: title.trim(),
        city: city.trim(),
        location: city.trim(),
        campus: campus.trim(),

        address: address.trim(),
        address_line: addressLine.trim(),
        unit: unit.trim(),
        province: province.trim(),
        postal_code: postalCode.trim(),
        country: "Canada",
        safety_instructions: safetyInstructions.trim(),

        price: Number(price),
        bedrooms: bedrooms ? Number(bedrooms) : null,
        bathrooms: bathrooms ? Number(bathrooms) : null,
        guests: guests ? Number(guests) : null,
        roommates: roommates ? Number(roommates) : null,
        status: nextListingStatus,
        description: description.trim(),
        amenities: amenitiesArray,
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
        fair_housing_acknowledged: fairHousingAcknowledged,
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
        ...coordinateUpdate,
      };

      const { error: updateError } = await supabase
        .from("listings")
        .update(listingUpdate)
        .eq("id", listingId);

      if (updateError) {
        logListingEditError("Listing edit main listing update failed", updateError, {
          listingId,
          columnKeys: Object.keys(listingUpdate),
        });
        throw new Error(
          clientSaveMessage("We could not save your listing changes.", updateError)
        );
      }

      if (shouldRefreshCoordinates) {
        const { error: routeCacheDeleteError } = await supabase
          .from("listing_campus_routes")
          .delete()
          .eq("listing_id", listingId);

        if (routeCacheDeleteError) {
          console.error("LISTING ROUTE CACHE DELETE ERROR:", routeCacheDeleteError);
        }
      }

      if (previousListing && addressChanged) {
        await supabase.from("listing_verification_audit_events").insert({
          listing_id: listingId,
          verification_id: null,
          actor_id: user.id,
          event_type: "listing_address_updated_by_verified_landlord",
          metadata: {
            changed_by_owner: true,
            account_level_landlord_flow: true,
          },
        });
      }

      const { error: deleteRequirementsError } = await supabase
        .from("listing_document_requirements")
        .delete()
        .eq("listing_id", listingId);

      if (deleteRequirementsError) {
        console.error(
          "LISTING DOCUMENT REQUIREMENTS DELETE ERROR:",
          deleteRequirementsError
        );
        throw new Error(
          clientSaveMessage(
            "Your listing was saved, but the application document requirements could not be updated.",
            deleteRequirementsError
          )
        );
      }

      const requirementRows = requirements
        .filter((requirement) => requirement.document_type)
        .map((requirement, index) => ({
          listing_id: listingId,
          owner_id: user.id,
          document_type: requirement.document_type,
          display_name:
            requirement.display_name ||
            documentTypes.find((item) => item.value === requirement.document_type)
              ?.label ||
            "Application document",
          description: requirement.description || null,
          requirement_level: requirement.requirement_level,
          applies_when: requirement.applies_when,
          alternative_documents: requirement.alternative_documents
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
          sort_order: index,
          active: requirement.active,
        }));

      if (requirementRows.length > 0) {
        const { error: requirementError } = await supabase
          .from("listing_document_requirements")
          .insert(requirementRows);

        if (requirementError) {
          logListingEditError(
            "Listing edit document requirements insert failed",
            requirementError,
            { listingId }
          );
          throw new Error(
            clientSaveMessage(
              "Your listing was saved, but the application document requirements could not be updated.",
              requirementError
            )
          );
        }
      }

      if (shouldPublishDraft) {
        const response = await fetch("/api/listings/publish", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ listingId }),
        });
        const data = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(data?.error || "Could not publish listing.");
        }
      }

      if (removedImages.length > 0) {
        const paths = removedImages
          .map((img) => img.image_path || img.storage_path)
          .filter(Boolean) as string[];

        if (paths.length > 0) {
          await supabase.storage.from("listing-images").remove(paths);
        }

        const ids = removedImages.map((img) => img.id);

        const { error: deleteError } = await supabase
          .from("listing_images")
          .delete()
          .in("id", ids);

        if (deleteError) throw deleteError;
      }

      let sortOrder = 0;

      for (const image of existingImages) {
        const isCover =
          finalCoverType === "existing" && finalCoverId === image.id;

        const { error } = await supabase
          .from("listing_images")
          .update({
            sort_order: sortOrder,
            is_cover: isCover,
          })
          .eq("id", image.id);

        if (error) throw error;

        sortOrder++;
      }

      for (const image of newImages) {
        const isCover =
          finalCoverType === "new" && finalCoverId === image.localId;

        await uploadNewImage(image.file, sortOrder, isCover);
        sortOrder++;
      }

      alert(t("updated"));
      router.push(`/listings/${listingId}`);
      router.refresh();
    } catch (error: unknown) {
      console.error(error);
      setSaveError(error instanceof Error ? error.message : t("saveError"));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black px-6 py-10 text-white">
        {t("loading")}
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-4 py-10 text-white">
      <form
        onSubmit={saveChanges}
        className="mx-auto max-w-5xl space-y-8 rounded-3xl border border-zinc-800 bg-[#070707] p-6"
      >
        <button
          type="button"
          onClick={() => router.push("/my-listings")}
          className="text-sm text-zinc-300 hover:text-white"
        >
          {t("backToMyListings")}
        </button>

        <div>
          <h1 className="text-3xl font-bold">{t("title")}</h1>
          <p className="mt-2 text-zinc-400">
            {t("subtitle")}
          </p>
        </div>

        {saveError && (
          <div
            role="alert"
            aria-live="assertive"
            className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm font-semibold text-red-200"
          >
            {saveError}
          </div>
        )}

        <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
          <div className="space-y-8">
            <div className="lg:hidden">
              <ListingCompletionProgress items={progressItems} />
            </div>

        <section className="grid gap-5 md:grid-cols-2">
          <Input label={t("listingTitle")} value={title} setValue={setTitle} />
          <Input label={t("city")} value={city} setValue={setCity} />
          <Input label={t("campus")} value={campus} setValue={setCampus} />

          <Input
            label={t("publicArea")}
            value={address}
            setValue={setAddress}
          />

          <Input label={t("price")} value={price} setValue={setPrice} type="number" />

          <div>
            <label className="mb-2 block text-sm font-medium">
              {t("availabilityStatus")}
            </label>
            <select
              value={status}
              onChange={(e) =>
                setStatus(
                  e.target.value as "draft" | "available" | "pending" | "rented"
                )
              }
              className="w-full rounded-xl border border-zinc-700 bg-black px-4 py-3 text-white"
            >
              <option value="draft">Draft</option>
              <option value="available">{t("status.available")}</option>
              <option value="pending">{t("status.pending")}</option>
              <option value="rented">{t("status.rented")}</option>
            </select>
          </div>

          <Input
            label={t("bedrooms")}
            value={bedrooms}
            setValue={setBedrooms}
            type="number"
          />

          <Input
            label={t("bathrooms")}
            value={bathrooms}
            setValue={setBathrooms}
            type="number"
          />

          <Input
            label={t("guests")}
            value={guests}
            setValue={setGuests}
            type="number"
          />

          <Input
            label={t("roommates")}
            value={roommates}
            setValue={setRoommates}
            type="number"
          />

          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-medium">
              {t("description")}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              className="w-full rounded-xl border border-zinc-700 bg-black px-4 py-3 text-white"
            />
          </div>

          <Input
            label={t("amenities")}
            value={amenities}
            setValue={setAmenities}
            className="md:col-span-2"
          />
        </section>

        <section className="rounded-3xl border border-emerald-500/20 bg-emerald-500/5 p-6">
          <h2 className="text-2xl font-bold text-emerald-300">
            {t("secureAddressTitle")}
          </h2>

          <p className="mt-2 text-sm text-zinc-400">
            {t("secureAddressText")}
          </p>

          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <Input
              label={t("streetAddress")}
              value={addressLine}
              setValue={setAddressLine}
            />

            <Input label={t("unit")} value={unit} setValue={setUnit} />

            <Input label={t("province")} value={province} setValue={setProvince} />

            <Input
              label={t("postalCode")}
              value={postalCode}
              setValue={setPostalCode}
            />

            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium">
                {t("safetyInstructions")}
              </label>
              <textarea
                value={safetyInstructions}
                onChange={(e) => setSafetyInstructions(e.target.value)}
                rows={4}
                placeholder={t("safetyInstructionsPlaceholder")}
                className="w-full rounded-xl border border-zinc-700 bg-black px-4 py-3 text-white"
              />
            </div>
          </div>
        </section>

        <section className="space-y-5 rounded-3xl border border-cyan-500/20 bg-cyan-500/5 p-6">
          <div>
            <h2 className="text-2xl font-bold text-cyan-200">
              Listing transparency
            </h2>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              Keep campus distance, utilities, amenities and lease terms clear
              so students can compare listings confidently.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <SelectField
              label="Nearest campus"
              value={nearestCampusName}
              setValue={applyCampusSelection}
              options={[
                ["", "Select nearest campus"],
                ...campusOptions.map((item) => [item.name, item.name]),
              ]}
            />
            <Input
              label="Campus address"
              value={nearestCampusAddress}
              setValue={setNearestCampusAddress}
            />
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-bold text-white">Map location</h3>
                <p className="mt-1 text-sm text-zinc-400">
                  Recalculate the private map location from the saved address,
                  refresh the protected public marker, and clear route cache.
                </p>
              </div>
              <button
                type="button"
                onClick={repairMapLocation}
                disabled={repairingLocation || saving}
                className="shrink-0 rounded-xl border border-pink-500/30 bg-pink-500/10 px-5 py-3 text-sm font-semibold text-pink-200 disabled:opacity-50"
              >
                {repairingLocation ? "Recalculating..." : "Recalculate map location"}
              </button>
            </div>
            {locationRepairMessage && (
              <p className="mt-3 text-sm font-semibold text-emerald-300">
                {locationRepairMessage}
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
            <h3 className="font-bold text-white">Rent and utilities</h3>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {utilityItems.map(([key, label]) => (
                <div key={key}>
                  <SelectField
                    label={label}
                    value={utilityStatuses[key] || "ask_landlord"}
                    setValue={(value) =>
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
                      className="mt-2 w-full rounded-xl border border-zinc-700 bg-black px-4 py-3 text-sm text-white"
                    />
                  )}
                </div>
              ))}
              <Input label="Estimated utilities minimum" value={estimatedUtilitiesMin} setValue={setEstimatedUtilitiesMin} type="number" />
              <Input label="Estimated utilities maximum" value={estimatedUtilitiesMax} setValue={setEstimatedUtilitiesMax} type="number" />
            </div>
            <textarea
              value={utilitiesNotes}
              onChange={(event) => setUtilitiesNotes(event.target.value)}
              placeholder="Utility notes students should know"
              rows={3}
              className="mt-4 w-full rounded-xl border border-zinc-700 bg-black px-4 py-3 text-white"
            />
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
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
              <Input label="Parking details" value={parkingDetails} setValue={setParkingDetails} />
              <Input label="Laundry details" value={laundryDetails} setValue={setLaundryDetails} />
              <Input label="Furnishing details" value={furnishingDetails} setValue={setFurnishingDetails} />
              <Input label="Internet details" value={internetDetails} setValue={setInternetDetails} />
            </div>
            <textarea value={accessibilityNotes} onChange={(event) => setAccessibilityNotes(event.target.value)} placeholder="Accessibility notes" rows={3} className="mt-4 w-full rounded-xl border border-zinc-700 bg-black px-4 py-3 text-white" />
            <textarea value={petDetails} onChange={(event) => setPetDetails(event.target.value)} placeholder="Pet policy details" rows={3} className="mt-4 w-full rounded-xl border border-zinc-700 bg-black px-4 py-3 text-white" />
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
            <h3 className="font-bold text-white">Lease conditions</h3>
            <p className="mt-2 text-sm text-zinc-400">
              These are landlord-provided details. Students should review the
              final lease directly before signing.
            </p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <SelectField label="Lease type" value={leaseType} setValue={setLeaseType} options={leaseTypeOptions.map((item) => [item[0], item[1]])} />
              <Input label="Move-in date" value={moveInDate} setValue={setMoveInDate} type="date" />
              <Input label="Lease start date" value={leaseStartDate} setValue={setLeaseStartDate} type="date" />
              <Input label="Lease end date" value={leaseEndDate} setValue={setLeaseEndDate} type="date" />
              <Input label="Minimum lease months" value={minimumLeaseMonths} setValue={setMinimumLeaseMonths} type="number" />
              <Input label="Maximum lease months" value={maximumLeaseMonths} setValue={setMaximumLeaseMonths} type="number" />
              <SelectField label="Renewal available" value={renewalAvailable} setValue={setRenewalAvailable} options={yesNoOptions} />
              <SelectField label="Subletting allowed" value={sublettingAllowed} setValue={setSublettingAllowed} options={yesNoOptions} />
              <SelectField label="Guarantor required" value={guarantorRequired} setValue={setGuarantorRequired} options={yesNoOptions} />
              <SelectField label="International students accepted" value={internationalStudentsAccepted} setValue={setInternationalStudentsAccepted} options={yesNoOptions} />
              <Input label="Occupants allowed" value={occupantsAllowed} setValue={setOccupantsAllowed} type="number" />
              <SelectField label="Tenant insurance required" value={tenantInsuranceRequired} setValue={setTenantInsuranceRequired} options={yesNoOptions} />
              <Input label="Key deposit amount" value={keyDepositAmount} setValue={setKeyDepositAmount} type="number" />
              <Input label="Security deposit amount" value={securityDepositAmount} setValue={setSecurityDepositAmount} type="number" />
              <SelectField label="Last month rent required" value={lastMonthRentRequired} setValue={setLastMonthRentRequired} options={yesNoOptions} />
              <Input label="Application fee amount" value={applicationFeeAmount} setValue={setApplicationFeeAmount} type="number" />
            </div>
            <textarea value={guarantorDetails} onChange={(event) => setGuarantorDetails(event.target.value)} placeholder="Guarantor or co-signer details" rows={3} className="mt-4 w-full rounded-xl border border-zinc-700 bg-black px-4 py-3 text-white" />
            <textarea value={overnightGuestPolicy} onChange={(event) => setOvernightGuestPolicy(event.target.value)} placeholder="Overnight guest policy" rows={3} className="mt-4 w-full rounded-xl border border-zinc-700 bg-black px-4 py-3 text-white" />
            <textarea value={additionalFees} onChange={(event) => setAdditionalFees(event.target.value)} placeholder="Additional fees" rows={3} className="mt-4 w-full rounded-xl border border-zinc-700 bg-black px-4 py-3 text-white" />
            <textarea value={leaseConditionsNotes} onChange={(event) => setLeaseConditionsNotes(event.target.value)} placeholder="Additional lease notes" rows={3} className="mt-4 w-full rounded-xl border border-zinc-700 bg-black px-4 py-3 text-white" />
          </div>
        </section>

        <section className="space-y-5 rounded-3xl border border-blue-500/20 bg-blue-500/5 p-6">
          <h2 className="text-2xl font-bold text-blue-200">
            Living arrangement
          </h2>
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
          <div className="grid gap-5 md:grid-cols-2">
            <HelpField help="Select Yes when the property owner will normally live in the same house, apartment or building area included in this rental arrangement.">
              <SelectField label="Owner lives at property *" value={ownerOccupiesProperty} setValue={setOwnerOccupiesProperty} options={yesNoOptions} />
            </HelpField>
            <HelpField help="Select Yes when the owner’s spouse, child, parent or another immediate family member will live in the same property.">
              <SelectField label="Owner family lives at property *" value={ownerFamilyOccupiesProperty} setValue={setOwnerFamilyOccupiesProperty} options={yesNoOptions} />
            </HelpField>
            <HelpField help="Select Yes when the tenant must regularly use the same kitchen as the owner or the owner’s immediate family.">
              <SelectField label="Shared kitchen with owner/family *" value={sharedKitchenWithOwner} setValue={setSharedKitchenWithOwner} options={yesNoOptions} />
            </HelpField>
            <HelpField help="Select Yes when the tenant must regularly use the same bathroom as the owner or the owner’s immediate family.">
              <SelectField label="Shared bathroom with owner/family *" value={sharedBathroomWithOwner} setValue={setSharedBathroomWithOwner} options={yesNoOptions} />
            </HelpField>
            <HelpField help="Select Yes only when the tenant has a bedroom intended for their exclusive use.">
              <SelectField label="Private bedroom *" value={privateBedroom} setValue={setPrivateBedroom} options={yesNoOptions} />
            </HelpField>
            <HelpField help="Select Yes when the rental has its own living area, kitchen and bathroom that are not shared with the owner or other unrelated occupants.">
              <SelectField label="Self-contained unit *" value={selfContainedUnit} setValue={setSelfContainedUnit} options={yesNoOptions} />
            </HelpField>
            <HelpField help="Select Yes when roommates, other tenants or additional residents will also live at the property.">
              <SelectField label="Other occupants present *" value={otherOccupantsPresent} setValue={setOtherOccupantsPresent} options={yesNoOptions} />
            </HelpField>
            {otherOccupantsPresent === "true" && (
              <HelpField help="Enter the approximate number of other people expected to live at the property, excluding the applicant.">
                <Input label="Estimated other occupants" value={estimatedOtherOccupantCount} setValue={setEstimatedOtherOccupantCount} type="number" />
              </HelpField>
            )}
          </div>
          <textarea
            value={occupancyNotes}
            onChange={(event) => setOccupancyNotes(event.target.value)}
            rows={4}
            placeholder="Additional living-arrangement details"
            className="w-full rounded-xl border border-zinc-700 bg-black px-4 py-3 text-white"
          />
          {sharedWithOwner && <OntarioOccupancyNotice />}
        </section>

        <section className="space-y-5 rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold">Application documents</h2>
              <p className="mt-2 text-sm text-zinc-400">
                Add, edit, disable, remove, and reorder document requirements.
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                setRequirements((current) => [
                  ...current,
                  {
                    id: crypto.randomUUID(),
                    document_type: "proof_of_enrolment",
                    display_name: "Proof of enrolment",
                    description: "",
                    requirement_level: "optional",
                    applies_when: "all_applicants",
                    alternative_documents: "",
                    sort_order: current.length,
                    active: true,
                  },
                ])
              }
              className="rounded-xl bg-white px-5 py-3 font-bold text-black"
            >
              Add requirement
            </button>
          </div>
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
          <FairHousingNotice />
          <label className="flex items-start gap-3 text-sm leading-6 text-zinc-300">
            <input
              type="checkbox"
              checked={fairHousingAcknowledged}
              onChange={(event) => setFairHousingAcknowledged(event.target.checked)}
              className="mt-1 h-4 w-4 accent-pink-500"
            />
            <span>
              <span className="font-semibold text-pink-200">
                Required to publish.{" "}
              </span>
              I acknowledge the fair-housing document notice.
            </span>
          </label>
          <div className="space-y-4">
            {requirements.map((requirement, index) => (
              <RequirementEditor
                key={requirement.id}
                requirement={requirement}
                onChange={(next) =>
                  setRequirements((current) =>
                    current.map((item) =>
                      item.id === requirement.id ? next : item
                    )
                  )
                }
                onRemove={() =>
                  setRequirements((current) =>
                    current.filter((item) => item.id !== requirement.id)
                  )
                }
                onMove={(direction) =>
                  setRequirements((current) => {
                    const copy = [...current];
                    const target = direction === "up" ? index - 1 : index + 1;
                    if (target < 0 || target >= copy.length) return copy;
                    [copy[index], copy[target]] = [copy[target], copy[index]];
                    return copy;
                  })
                }
              />
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-800 p-5">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold">{t("images")}</h2>
              <p className="text-sm text-zinc-400">
                {t("imageCounts", {
                  existingImages: existingImages.length,
                  newImages: newImages.length,
                })}
              </p>
            </div>

            <label className="cursor-pointer rounded-xl bg-white px-5 py-3 font-semibold text-black">
              {t("addImages")}
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => addNewImages(e.target.files)}
                className="hidden"
              />
            </label>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            {existingImages.map((image, index) => (
              <div
                key={image.id}
                className="overflow-hidden rounded-2xl border border-zinc-700 bg-black"
              >
                <img
                  src={image.image_url}
                  alt={t("listingImageAlt")}
                  className="h-64 w-full object-cover"
                />

                <div className="space-y-3 p-4">
                  <button
                    type="button"
                    onClick={() => {
                      setCoverType("existing");
                      setCoverId(image.id);
                    }}
                    className={`w-full rounded-xl px-4 py-3 font-semibold ${
                      coverType === "existing" && coverId === image.id
                        ? "bg-green-600"
                        : "bg-zinc-800"
                    }`}
                  >
                    {coverType === "existing" && coverId === image.id
                      ? t("coverImage")
                      : t("setAsCover")}
                  </button>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => moveExisting(index, "up")}
                      className="rounded-xl bg-zinc-800 px-4 py-3"
                    >
                      {t("moveUp")}
                    </button>

                    <button
                      type="button"
                      onClick={() => moveExisting(index, "down")}
                      className="rounded-xl bg-zinc-800 px-4 py-3"
                    >
                      {t("moveDown")}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => deleteExistingImage(image)}
                    className="w-full rounded-xl bg-red-600 px-4 py-3 font-semibold"
                  >
                    {t("deleteImage")}
                  </button>
                </div>
              </div>
            ))}

            {newImages.map((image, index) => (
              <div
                key={image.localId}
                className="overflow-hidden rounded-2xl border border-blue-700 bg-blue-950"
              >
                <img
                  src={image.previewUrl}
                  alt={t("newImageAlt")}
                  className="h-64 w-full object-cover"
                />

                <div className="space-y-3 p-4">
                  <button
                    type="button"
                    onClick={() => {
                      setCoverType("new");
                      setCoverId(image.localId);
                    }}
                    className={`w-full rounded-xl px-4 py-3 font-semibold ${
                      coverType === "new" && coverId === image.localId
                        ? "bg-green-600"
                        : "bg-blue-800"
                    }`}
                  >
                    {coverType === "new" && coverId === image.localId
                      ? t("coverImage")
                      : t("setAsCover")}
                  </button>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => moveNew(index, "up")}
                      className="rounded-xl bg-blue-800 px-4 py-3"
                    >
                      {t("moveUp")}
                    </button>

                    <button
                      type="button"
                      onClick={() => moveNew(index, "down")}
                      className="rounded-xl bg-blue-800 px-4 py-3"
                    >
                      {t("moveDown")}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => deleteNewImage(image)}
                    className="w-full rounded-xl bg-red-600 px-4 py-3 font-semibold"
                  >
                    {t("removeNewImage")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="flex gap-3 border-t border-zinc-800 pt-6">
          <button
            type="button"
            onClick={() => router.push(`/listings/${listingId}`)}
            className="rounded-xl border border-zinc-700 px-6 py-3"
          >
            {t("cancel")}
          </button>

          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-blue-600 px-6 py-3 font-semibold disabled:bg-zinc-600"
          >
            {saving ? t("saving") : t("saveChanges")}
          </button>
        </div>
          </div>

          <aside className="hidden lg:block">
            <div className="sticky top-28">
              <ListingCompletionProgress items={progressItems} />
            </div>
          </aside>
        </div>
      </form>
    </main>
  );
}

function Input({
  label,
  value,
  setValue,
  type = "text",
  className = "",
}: {
  label: string;
  value: string;
  setValue: (value: string) => void;
  type?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="mb-2 block text-sm font-medium">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        min={type === "number" ? 0 : undefined}
        className="w-full rounded-xl border border-zinc-700 bg-black px-4 py-3 text-white"
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  setValue,
  options,
}: {
  label: string;
  value: string;
  setValue: (value: string) => void;
  options: string[][];
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium">{label}</label>
      <select
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-full rounded-xl border border-zinc-700 bg-black px-4 py-3 text-white"
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

function ListingCompletionProgress({
  items,
}: {
  items: Array<{ label: string; complete: boolean }>;
}) {
  const completeCount = items.filter((item) => item.complete).length;
  const percent = Math.round((completeCount / items.length) * 100);

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-white">Listing completion</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Keep the essentials ready before publishing.
          </p>
        </div>
        <p className="text-sm font-black text-pink-200">{percent}%</p>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-pink-400 transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="mt-4 space-y-2">
        {items.map((item) => (
          <div key={item.label} className="flex items-center justify-between gap-3 text-sm">
            <span className="text-zinc-300">{item.label}</span>
            <span className={item.complete ? "text-emerald-300" : "text-zinc-500"}>
              {item.complete ? "Done" : "Needed"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RequirementEditor({
  requirement,
  onChange,
  onRemove,
  onMove,
}: {
  requirement: RequirementEditorItem;
  onChange: (requirement: RequirementEditorItem) => void;
  onRemove: () => void;
  onMove: (direction: "up" | "down") => void;
}) {
  function update(field: keyof RequirementEditorItem, value: string | boolean) {
    const next = { ...requirement, [field]: value };

    if (field === "document_type" && typeof value === "string") {
      next.display_name =
        documentTypes.find((item) => item.value === value)?.label ||
        next.display_name;
    }

    onChange(next);
  }

  return (
    <div className="rounded-2xl border border-zinc-800 bg-black p-5">
      <div className="grid gap-4 md:grid-cols-2">
        <HelpField help="Choose the document category that best matches what you may request from applicants.">
          <SelectField
            label="Document type"
            value={requirement.document_type}
            setValue={(value) => update("document_type", value)}
            options={documentTypes.map((item) => [item.value, item.label])}
          />
        </HelpField>
        <HelpField help="This is the student-facing name shown for the document request.">
          <Input
            label="Display name"
            value={requirement.display_name}
            setValue={(value) => update("display_name", value)}
          />
        </HelpField>
        <HelpField
          help={
            requirementLevelGuidance[requirement.requirement_level] ||
            "Choose how strongly this document applies to applicants."
          }
        >
          <SelectField
            label="Requirement level"
            value={requirement.requirement_level}
            setValue={(value) => update("requirement_level", value)}
            options={requirementLevels.map((item) => [item.value, item.label])}
          />
        </HelpField>
        <HelpField help="Use this to clarify whether the request applies to everyone or only to a specific applicant situation.">
          <SelectField
            label="Applies when"
            value={requirement.applies_when}
            setValue={(value) => update("applies_when", value)}
            options={appliesWhenOptions.map((item) => [item.value, item.label])}
          />
        </HelpField>
        <div className="md:col-span-2">
          <HelpField help="List reasonable alternatives, separated by commas, especially for students or newcomers without Canadian records.">
            <Input
              label="Accepted alternatives"
              value={requirement.alternative_documents}
              setValue={(value) => update("alternative_documents", value)}
            />
          </HelpField>
        </div>
        <div className="md:col-span-2">
          <HelpField help="Briefly explain why this document is being requested so students understand the rental application context.">
            <label className="mb-2 block text-sm font-medium">
              Purpose and description
            </label>
            <textarea
              value={requirement.description}
              onChange={(event) => update("description", event.target.value)}
              rows={3}
              className="w-full rounded-xl border border-zinc-700 bg-black px-4 py-3 text-white"
            />
          </HelpField>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-zinc-300">
          <input
            type="checkbox"
            checked={requirement.active}
            onChange={(event) => update("active", event.target.checked)}
            className="h-4 w-4 accent-pink-500"
          />
          Active
        </label>
        <button
          type="button"
          onClick={() => onMove("up")}
          className="rounded-xl border border-white/10 px-4 py-2 text-sm hover:bg-white/10"
        >
          Move up
        </button>
        <button
          type="button"
          onClick={() => onMove("down")}
          className="rounded-xl border border-white/10 px-4 py-2 text-sm hover:bg-white/10"
        >
          Move down
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm text-red-200 hover:bg-red-500/20"
        >
          Remove
        </button>
      </div>
    </div>
  );
}
