"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ChangeEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  ImagePlus,
  Loader2,
  MapPin,
  Save,
  Search,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { geocodeListingAddressWithMapbox } from "@/lib/listing-address-geocode";
import { generatePublicCoordinate } from "@/lib/location-privacy";
import {
  amenityItems,
  calculateDistanceKm,
  campusOptions,
  estimateTravelTimes,
  leaseTypeOptions,
  type AmenitiesDetails,
  type LeaseConditions,
  type UtilitiesDetails,
} from "@/lib/listing-transparency";

const STORAGE_KEY = "travel-markets-post-listing-wizard-v2";
const PLAN_LIMITS: Record<string, number> = {
  free: 1,
  premium: 5,
  elite: Infinity,
  legacy_premium: Infinity,
  founding_free: Infinity,
};

const propertyTypes = [
  "Apartment",
  "House",
  "Basement suite",
  "Room rental",
  "Townhouse",
  "Studio",
  "Student residence",
  "Other",
];

const commonCities = Array.from(
  new Set([
    "Toronto",
    "Oshawa",
    "Whitby",
    "Welland",
    "Hamilton",
    "Waterloo",
    "Kitchener",
    "London",
    "Ottawa",
    "Kingston",
    "Peterborough",
    "St. Catharines",
    "Windsor",
    "Guelph",
    "Brampton",
    "Mississauga",
    "Oakville",
    "Sudbury",
    "North Bay",
    "Thunder Bay",
    ...campusOptions.map((campus) => campus.city),
  ])
).sort((a, b) => a.localeCompare(b));

type StepId =
  | "basics"
  | "location"
  | "photos"
  | "details"
  | "amenities"
  | "rental"
  | "review";

type AddressSuggestion = {
  id: string;
  label: string;
  addressLine: string;
  city: string;
  province: string;
  postalCode: string;
  latitude: number | null;
  longitude: number | null;
};

type PhotoPreview = {
  id: string;
  file: File;
  url: string;
  isCover: boolean;
};

type DraftState = {
  listingId: string | null;
  creationIdempotencyKey: string;
  activeStep: number;
  title: string;
  propertyType: string;
  price: string;
  bedrooms: string;
  bathrooms: string;
  roommates: string;
  addressLine: string;
  unit: string;
  city: string;
  province: string;
  postalCode: string;
  latitude: number | null;
  longitude: number | null;
  campusId: string;
  campus: string;
  nearestCampusName: string;
  nearestCampusAddress: string;
  campusLatitude: string;
  campusLongitude: string;
  description: string;
  furnished: string;
  parkingDetails: string;
  laundryDetails: string;
  utilitiesIncluded: string;
  internetDetails: string;
  petDetails: string;
  selectedAmenities: string[];
  ownerOccupiesProperty: string;
  sharedKitchenOrBathroom: string;
  moveInDate: string;
  leaseType: string;
};

const defaultDraftState = (): DraftState => ({
  listingId: null,
  creationIdempotencyKey: crypto.randomUUID(),
  activeStep: 0,
  title: "",
  propertyType: "",
  price: "",
  bedrooms: "",
  bathrooms: "",
  roommates: "",
  addressLine: "",
  unit: "",
  city: "",
  province: "Ontario",
  postalCode: "",
  latitude: null,
  longitude: null,
  campusId: "",
  campus: "",
  nearestCampusName: "",
  nearestCampusAddress: "",
  campusLatitude: "",
  campusLongitude: "",
  description: "",
  furnished: "",
  parkingDetails: "",
  laundryDetails: "",
  utilitiesIncluded: "",
  internetDetails: "",
  petDetails: "",
  selectedAmenities: [],
  ownerOccupiesProperty: "",
  sharedKitchenOrBathroom: "",
  moveInDate: "",
  leaseType: "",
});

const steps: Array<{ id: StepId; title: string; eyebrow: string }> = [
  { id: "basics", title: "Property basics", eyebrow: "Start simple" },
  { id: "location", title: "Location", eyebrow: "Private and secure" },
  { id: "photos", title: "Photos", eyebrow: "Add the first impression" },
  { id: "details", title: "Property details", eyebrow: "Useful context" },
  { id: "amenities", title: "Amenities", eyebrow: "Optional" },
  { id: "rental", title: "Additional rental details", eyebrow: "Optional" },
  { id: "review", title: "Review & publish", eyebrow: "Final check" },
];

function loadStoredDraft() {
  if (typeof window === "undefined") return defaultDraftState();

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return defaultDraftState();

    return {
      ...defaultDraftState(),
      ...(JSON.parse(stored) as Partial<DraftState>),
    };
  } catch {
    return defaultDraftState();
  }
}

function clean(value: string) {
  return value.trim();
}

function toNumberOrNull(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && value.trim() ? parsed : null;
}

function toNullableBoolean(value: string) {
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

function addressContextValue(feature: Record<string, unknown>, prefix: string) {
  const context = Array.isArray(feature.context) ? feature.context : [];
  const match = context.find((item) => {
    if (!item || typeof item !== "object" || !("id" in item)) return false;
    return String(item.id).startsWith(prefix);
  }) as { text?: string; short_code?: string } | undefined;

  return match?.text || "";
}

function parseAddressSuggestion(feature: Record<string, unknown>): AddressSuggestion {
  const center = Array.isArray(feature.center) ? feature.center : [];
  const placeName = typeof feature.place_name === "string" ? feature.place_name : "";
  const address =
    [feature.address, feature.text].filter(Boolean).join(" ") ||
    placeName.split(",")[0] ||
    "";

  return {
    id: String(feature.id || placeName),
    label: placeName || address,
    addressLine: address,
    city: addressContextValue(feature, "place") || addressContextValue(feature, "locality"),
    province: addressContextValue(feature, "region") || "Ontario",
    postalCode: addressContextValue(feature, "postcode"),
    longitude: typeof center[0] === "number" ? center[0] : null,
    latitude: typeof center[1] === "number" ? center[1] : null,
  };
}

export default function PostListingPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [draft, setDraft] = useState<DraftState>(() => defaultDraftState());
  const [hydrated, setHydrated] = useState(false);
  const [photoPreviews, setPhotoPreviews] = useState<PhotoPreview[]>([]);
  const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([]);
  const [addressSearchOpen, setAddressSearchOpen] = useState(false);
  const [campusQuery, setCampusQuery] = useState("");
  const [cityQuery, setCityQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");
  const [formError, setFormError] = useState("");
  const [publishedId, setPublishedId] = useState<string | null>(null);
  const [plan, setPlan] = useState("free");
  const [activeListings, setActiveListings] = useState(0);
  const [checkingLimit, setCheckingLimit] = useState(true);

  const activeStep = steps[draft.activeStep] || steps[0];
  const listingLimit = PLAN_LIMITS[plan] || 1;
  const listingLimitLabel = listingLimit === Infinity ? "Unlimited" : String(listingLimit);
  const matchingCampuses = useMemo(() => {
    const query = campusQuery.trim().toLowerCase();
    if (!query) return campusOptions.slice(0, 10);

    return campusOptions
      .filter((campus) => {
        const haystack = [
          campus.name,
          campus.officialName,
          campus.institutionName,
          campus.city,
          ...(campus.aliases || []),
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(query);
      })
      .slice(0, 12);
  }, [campusQuery]);
  const matchingCities = useMemo(() => {
    const query = cityQuery.trim().toLowerCase();
    if (!query) return commonCities.slice(0, 8);
    return commonCities
      .filter((city) => city.toLowerCase().includes(query))
      .slice(0, 8);
  }, [cityQuery]);

  useEffect(() => {
    setDraft(loadStoredDraft());
    setHydrated(true);
  }, []);

  useEffect(() => {
    loadSubscriptionLimit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const { activeStep, ...stored } = draft;
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...stored, activeStep })
    );
  }, [draft, hydrated]);

  useEffect(() => {
    const query = draft.addressLine.trim();
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

    if (!token || query.length < 4) {
      setAddressSuggestions([]);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      const url = new URL(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
          query
        )}.json`
      );
      url.searchParams.set("access_token", token);
      url.searchParams.set("country", "ca");
      url.searchParams.set("types", "address");
      url.searchParams.set("autocomplete", "true");
      url.searchParams.set("limit", "5");

      try {
        const response = await fetch(url, {
          cache: "no-store",
          signal: controller.signal,
        });
        const data = await response.json();
        const features = Array.isArray(data.features) ? data.features : [];
        setAddressSuggestions(features.map(parseAddressSuggestion));
      } catch {
        if (!controller.signal.aborted) setAddressSuggestions([]);
      }
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [draft.addressLine]);

  function patchDraft(update: Partial<DraftState>) {
    setDraft((current) => ({ ...current, ...update }));
  }

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

  function selectAddressSuggestion(suggestion: AddressSuggestion) {
    patchDraft({
      addressLine: suggestion.addressLine,
      city: suggestion.city || draft.city,
      province: suggestion.province || draft.province,
      postalCode: suggestion.postalCode || draft.postalCode,
      latitude: suggestion.latitude,
      longitude: suggestion.longitude,
    });
    setCityQuery(suggestion.city || draft.city);
    setAddressSearchOpen(false);
  }

  function selectCampus(campus: (typeof campusOptions)[number]) {
    patchDraft({
      campusId: campus.id,
      campus: campus.officialName,
      nearestCampusName: campus.officialName,
      nearestCampusAddress: campus.address,
      campusLatitude: String(campus.latitude),
      campusLongitude: String(campus.longitude),
    });
    setCampusQuery(campus.officialName);
  }

  function handlePhotoSelection(event: ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(event.target.files || []);
    if (selectedFiles.length === 0) return;

    setPhotoPreviews((current) => {
      const next = [
        ...current,
        ...selectedFiles.map((file, index) => ({
          id: crypto.randomUUID(),
          file,
          url: URL.createObjectURL(file),
          isCover: current.length === 0 && index === 0,
        })),
      ];

      if (!next.some((photo) => photo.isCover) && next[0]) {
        next[0].isCover = true;
      }

      return next;
    });
    event.target.value = "";
  }

  function removePhoto(id: string) {
    setPhotoPreviews((current) => {
      const removed = current.find((photo) => photo.id === id);
      if (removed) URL.revokeObjectURL(removed.url);
      const next = current.filter((photo) => photo.id !== id);
      if (!next.some((photo) => photo.isCover) && next[0]) {
        next[0] = { ...next[0], isCover: true };
      }
      return next;
    });
  }

  function setCoverPhoto(id: string) {
    setPhotoPreviews((current) =>
      current.map((photo) => ({ ...photo, isCover: photo.id === id }))
    );
  }

  function toggleAmenity(value: string) {
    patchDraft({
      selectedAmenities: draft.selectedAmenities.includes(value)
        ? draft.selectedAmenities.filter((item) => item !== value)
        : [...draft.selectedAmenities, value],
    });
  }

  function validateStep(step = draft.activeStep) {
    if (step === 0) {
      if (!clean(draft.title)) return "Add a listing title.";
      if (!clean(draft.price)) return "Add the monthly rent.";
    }

    if (step === 1) {
      if (!clean(draft.addressLine)) return "Choose or enter the street address.";
      if (!clean(draft.city)) return "Choose the city.";
      if (!clean(draft.province)) return "Add the province.";
      if (!clean(draft.nearestCampusName)) return "Choose the nearest campus.";
    }

    if (step === 3 && !clean(draft.description)) {
      return "Add a short description.";
    }

    return "";
  }

  function goToStep(index: number) {
    patchDraft({ activeStep: Math.max(0, Math.min(index, steps.length - 1)) });
    setFormError("");
  }

  function goNext() {
    const error = validateStep();
    if (error) {
      setFormError(error);
      return;
    }
    goToStep(draft.activeStep + 1);
  }

  function buildUtilitiesDetails(): UtilitiesDetails {
    const included = draft.utilitiesIncluded === "included";
    return {
      statuses: {
        electricity: included ? "included" : "ask_landlord",
        water: included ? "included" : "ask_landlord",
        heating: included ? "included" : "ask_landlord",
        internet: draft.internetDetails ? "included" : "ask_landlord",
      },
      notes:
        draft.utilitiesIncluded === "included"
          ? "Utilities marked as included by landlord."
          : "",
    };
  }

  function buildAmenitiesDetails(): AmenitiesDetails {
    return {
      selected: draft.selectedAmenities,
      parking: draft.parkingDetails,
      laundry: draft.laundryDetails,
      furnishing: draft.furnished,
      internetDetails: draft.internetDetails,
      petDetails: draft.petDetails,
    };
  }

  function buildLeaseConditions(): LeaseConditions {
    return {
      leaseType: draft.leaseType,
      moveInDate: draft.moveInDate,
      petPolicy: draft.petDetails,
      notes: "",
    };
  }

  async function geocodeAddressForSave(mode: "draft" | "publish") {
    if (draft.latitude != null && draft.longitude != null) {
      return {
        ok: true as const,
        latitude: draft.latitude,
        longitude: draft.longitude,
        fullAddress: [
          draft.addressLine,
          draft.unit,
          draft.city,
          draft.province,
          draft.postalCode,
          "Canada",
        ]
          .filter(Boolean)
          .join(", "),
      };
    }

    if (mode === "draft" && (!clean(draft.addressLine) || !clean(draft.city))) {
      return {
        ok: true as const,
        latitude: null,
        longitude: null,
        fullAddress: "",
      };
    }

    return geocodeListingAddressWithMapbox({
      token: process.env.NEXT_PUBLIC_MAPBOX_TOKEN,
      address: {
        addressLine: draft.addressLine,
        unit: draft.unit,
        city: draft.city,
        province: draft.province,
        postalCode: draft.postalCode,
        country: "Canada",
      },
    });
  }

  async function uploadPhotos(listingId: string) {
    if (photoPreviews.length === 0) return;

    const imageRows = [];

    for (let index = 0; index < photoPreviews.length; index += 1) {
      const photo = photoPreviews[index];
      const ext = photo.file.name.split(".").pop() || "jpg";
      const fileName = `${crypto.randomUUID()}.${ext}`;
      const path = `listings/${listingId}/${fileName}`;
      const { error } = await supabase.storage
        .from("listing-images")
        .upload(path, photo.file);

      if (error) continue;

      const { data } = supabase.storage.from("listing-images").getPublicUrl(path);
      imageRows.push({
        listing_id: listingId,
        image_url: data.publicUrl,
        image_path: path,
        sort_order: index,
        is_cover: photo.isCover || index === 0,
      });
    }

    if (imageRows.length > 0) {
      await supabase.from("listing_images").insert(imageRows);
      setPhotoPreviews([]);
    }
  }

  async function saveListing(mode: "draft" | "publish") {
    setFormError("");
    setSaveStatus("");

    if (mode === "publish") {
      for (let index = 0; index <= 3; index += 1) {
        const error = validateStep(index);
        if (error) {
          patchDraft({ activeStep: index });
          setFormError(error);
          return;
        }
      }
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

      if (!user.email_confirmed_at) {
        router.push("/verify-email");
        return;
      }

      const geocode = await geocodeAddressForSave(mode);
      if (!geocode.ok) {
        setFormError(geocode.message);
        setSaving(false);
        return;
      }

      const hasExactCoordinates =
        typeof geocode.latitude === "number" &&
        typeof geocode.longitude === "number";
      const publicCoordinate = hasExactCoordinates
        ? generatePublicCoordinate({
            latitude: geocode.latitude,
            longitude: geocode.longitude,
            seed: geocode.fullAddress,
          })
        : null;
      const campusLat = toNumberOrNull(draft.campusLatitude);
      const campusLng = toNumberOrNull(draft.campusLongitude);
      const distanceToCampusKm = hasExactCoordinates
        ? calculateDistanceKm(geocode.latitude, geocode.longitude, campusLat, campusLng)
        : null;
      const travelTimes = estimateTravelTimes(distanceToCampusKm);
      const sharedWithOwner = toNullableBoolean(draft.sharedKitchenOrBathroom);
      const ownerOccupies = toNullableBoolean(draft.ownerOccupiesProperty);
      const amenitiesText = [
        draft.propertyType,
        draft.furnished,
        ...draft.selectedAmenities,
      ].filter(Boolean);
      const payload = {
        user_id: user.id,
        title: clean(draft.title) || "Untitled draft",
        city: clean(draft.city),
        location: clean(draft.city),
        campus: clean(draft.campus),
        address_line: clean(draft.addressLine),
        unit: clean(draft.unit),
        province: clean(draft.province) || "Ontario",
        postal_code: clean(draft.postalCode),
        country: "Canada",
        price: Number(draft.price) || 0,
        bedrooms: toNumberOrNull(draft.bedrooms),
        bathrooms: toNumberOrNull(draft.bathrooms),
        roommates: toNumberOrNull(draft.roommates),
        guests: toNumberOrNull(draft.roommates),
        description: clean(draft.description),
        amenities: amenitiesText,
        status: "draft",
        latitude: geocode.latitude,
        longitude: geocode.longitude,
        public_latitude: publicCoordinate?.latitude ?? null,
        public_longitude: publicCoordinate?.longitude ?? null,
        location_privacy_radius_meters: publicCoordinate?.radiusMeters ?? null,
        public_location_generated_at: publicCoordinate ? new Date().toISOString() : null,
        nearest_campus_name: clean(draft.nearestCampusName) || null,
        nearest_campus_address: clean(draft.nearestCampusAddress) || null,
        campus_id: draft.campusId || null,
        campus_destination_label: clean(draft.nearestCampusName) || null,
        campus_coordinate_source: draft.campusId ? "curated_campus_record" : null,
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
        fair_housing_acknowledged: true,
        owner_occupies_property: ownerOccupies,
        owner_family_occupies_property: null,
        shared_kitchen_with_owner: sharedWithOwner,
        shared_bathroom_with_owner: sharedWithOwner,
        private_bedroom: draft.propertyType === "Room rental" ? true : null,
        self_contained_unit:
          draft.propertyType && draft.propertyType !== "Room rental" ? true : null,
        other_occupants_present: null,
        estimated_other_occupant_count: null,
        occupancy_notes: "",
        safety_instructions: "",
      };

      let listingId = draft.listingId;

      if (listingId) {
        const { error } = await supabase
          .from("listings")
          .update(payload)
          .eq("id", listingId)
          .eq("user_id", user.id);

        if (error) throw error;
      } else {
        const idempotencyKey = `${user.id}:${draft.creationIdempotencyKey}`;
        const { data, error } = await supabase
          .from("listings")
          .insert({
            ...payload,
            creation_idempotency_key: idempotencyKey,
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

          listingId = existingListing?.id || null;
        } else if (error) {
          throw error;
        } else {
          listingId = data?.id || null;
        }

        if (!listingId) throw new Error("Unable to create draft listing.");
        patchDraft({ listingId });
      }

      await uploadPhotos(listingId);

      if (mode === "publish") {
        const response = await fetch("/api/listings/publish", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ listingId }),
        });
        const data = await response.json().catch(() => null);

        if (!response.ok) {
          setFormError(
            data?.verificationUrl
              ? "Complete landlord verification to publish."
              : data?.error || "The listing was saved as a draft, but could not be published."
          );
          return;
        }

        setPublishedId(listingId);
        window.localStorage.removeItem(STORAGE_KEY);
      } else {
        setSaveStatus("Draft saved.");
        router.push("/my-listings");
      }
    } catch (error) {
      console.error("LISTING WIZARD SAVE ERROR:", error);
      setFormError("We could not save the listing. Please review the details and try again.");
    } finally {
      setSaving(false);
    }
  }

  function startAnotherProperty() {
    window.localStorage.removeItem(STORAGE_KEY);
    photoPreviews.forEach((photo) => URL.revokeObjectURL(photo.url));
    setPhotoPreviews([]);
    setPublishedId(null);
    setDraft(defaultDraftState());
    setCampusQuery("");
    setCityQuery("");
    setFormError("");
    setSaveStatus("");
  }

  if (checkingLimit) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black text-white">
        <p className="text-zinc-400">Preparing your listing workspace...</p>
      </main>
    );
  }

  if (publishedId) {
    return (
      <main className="min-h-screen bg-black px-4 py-10 text-white">
        <div className="mx-auto flex min-h-[70vh] max-w-3xl items-center justify-center">
          <div className="w-full rounded-[2rem] border border-emerald-400/20 bg-emerald-500/10 p-8 text-center shadow-2xl">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-400 text-black">
              <Check size={30} />
            </div>
            <p className="mt-6 text-sm font-bold uppercase tracking-[0.22em] text-emerald-200">
              Your listing is live
            </p>
            <h1 className="mt-3 text-4xl font-black">Ready for students to discover</h1>
            <p className="mt-3 text-zinc-300">
              You can view it, post another property, or return to your dashboard.
            </p>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <Link href={`/listings/${publishedId}`} className="rounded-2xl bg-white px-5 py-3 font-bold text-black">
                View listing
              </Link>
              <button type="button" onClick={startAnotherProperty} className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-bold text-white">
                Post another property
              </button>
              <Link href="/dashboard" className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-bold text-white">
                Go to dashboard
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-4 py-8 text-white">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/[0.03] p-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <Sparkles className="text-pink-300" />
            <div>
              <p className="font-bold capitalize">{plan.replaceAll("_", " ")} plan</p>
              <p className="text-sm text-zinc-400">
                {activeListings} active of {listingLimitLabel} listings. Drafts are autosaved in this wizard.
              </p>
            </div>
          </div>
          <Link href="/billing" className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-bold text-zinc-200 hover:bg-white/10">
            Manage subscription
          </Link>
        </div>

        <div className="overflow-hidden rounded-[2rem] border border-zinc-800 bg-zinc-950 shadow-2xl">
          <div className="border-b border-white/10 p-6">
            <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.22em] text-pink-300">
                  Post a property
                </p>
                <h1 className="mt-2 text-4xl font-black">Create a student-ready listing</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
                  One focused step at a time. Save and exit whenever you need.
                </p>
              </div>
              <button
                type="button"
                onClick={() => saveListing("draft")}
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white hover:bg-white/10 disabled:opacity-50"
              >
                <Save size={16} />
                Save & Exit
              </button>
            </div>
            <div className="mt-6 grid gap-2 md:grid-cols-7">
              {steps.map((step, index) => (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => goToStep(index)}
                  className={`rounded-2xl border p-3 text-left transition ${
                    index === draft.activeStep
                      ? "border-pink-400/40 bg-pink-500/15"
                      : index < draft.activeStep
                        ? "border-emerald-400/20 bg-emerald-500/10"
                        : "border-white/10 bg-black/30"
                  }`}
                >
                  <p className="text-xs font-black text-white">{index + 1}</p>
                  <p className="mt-1 line-clamp-1 text-xs text-zinc-400">{step.title}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="p-6 md:p-8">
            {formError && (
              <div role="alert" className="mb-5 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm font-semibold text-red-200">
                {formError}
              </div>
            )}
            {saveStatus && (
              <div className="mb-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm font-semibold text-emerald-200">
                {saveStatus}
              </div>
            )}

            <section>
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-pink-300">
                {activeStep.eyebrow}
              </p>
              <h2 className="mt-2 text-3xl font-black">{activeStep.title}</h2>
              <div className="mt-8">
                {activeStep.id === "basics" && (
                  <BasicsStep draft={draft} patchDraft={patchDraft} />
                )}
                {activeStep.id === "location" && (
                  <LocationStep
                    draft={draft}
                    patchDraft={patchDraft}
                    addressSuggestions={addressSuggestions}
                    addressSearchOpen={addressSearchOpen}
                    setAddressSearchOpen={setAddressSearchOpen}
                    selectAddressSuggestion={selectAddressSuggestion}
                    cityQuery={cityQuery}
                    setCityQuery={setCityQuery}
                    matchingCities={matchingCities}
                    campusQuery={campusQuery}
                    setCampusQuery={setCampusQuery}
                    matchingCampuses={matchingCampuses}
                    selectCampus={selectCampus}
                  />
                )}
                {activeStep.id === "photos" && (
                  <PhotosStep
                    photos={photoPreviews}
                    handlePhotoSelection={handlePhotoSelection}
                    removePhoto={removePhoto}
                    setCoverPhoto={setCoverPhoto}
                  />
                )}
                {activeStep.id === "details" && (
                  <DetailsStep draft={draft} patchDraft={patchDraft} />
                )}
                {activeStep.id === "amenities" && (
                  <AmenitiesStep draft={draft} toggleAmenity={toggleAmenity} />
                )}
                {activeStep.id === "rental" && (
                  <RentalStep draft={draft} patchDraft={patchDraft} />
                )}
                {activeStep.id === "review" && (
                  <ReviewStep
                    draft={draft}
                    photos={photoPreviews}
                    goToStep={goToStep}
                  />
                )}
              </div>
            </section>

            <div className="mt-10 flex flex-col-reverse gap-3 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={() => goToStep(draft.activeStep - 1)}
                disabled={draft.activeStep === 0 || saving}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-bold text-white hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ArrowLeft size={18} />
                Back
              </button>

              {activeStep.id === "review" ? (
                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => saveListing("draft")}
                    disabled={saving}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-bold text-white hover:bg-white/10 disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                    Save draft
                  </button>
                  <button
                    type="button"
                    onClick={() => saveListing("publish")}
                    disabled={saving}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-6 py-3 font-black text-black hover:bg-zinc-200 disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="animate-spin" size={18} /> : <Upload size={18} />}
                    Publish Listing
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={goNext}
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-6 py-3 font-black text-black hover:bg-zinc-200 disabled:opacity-50"
                >
                  Continue
                  <ArrowRight size={18} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function BasicsStep({
  draft,
  patchDraft,
}: {
  draft: DraftState;
  patchDraft: (update: Partial<DraftState>) => void;
}) {
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <Input label="Listing title" value={draft.title} set={(title) => patchDraft({ title })} />
      <SelectField label="Property type" value={draft.propertyType} set={(propertyType) => patchDraft({ propertyType })} options={[["", "Choose type"], ...propertyTypes.map((item) => [item, item])]} />
      <Input label="Monthly rent" value={draft.price} set={(price) => patchDraft({ price })} type="number" />
      <Input label="Bedrooms" value={draft.bedrooms} set={(bedrooms) => patchDraft({ bedrooms })} type="number" required={false} />
      <Input label="Bathrooms" value={draft.bathrooms} set={(bathrooms) => patchDraft({ bathrooms })} type="number" required={false} />
      <Input label="Rooms / rentable rooms" value={draft.roommates} set={(roommates) => patchDraft({ roommates })} type="number" required={false} />
    </div>
  );
}

function LocationStep({
  draft,
  patchDraft,
  addressSuggestions,
  addressSearchOpen,
  setAddressSearchOpen,
  selectAddressSuggestion,
  cityQuery,
  setCityQuery,
  matchingCities,
  campusQuery,
  setCampusQuery,
  matchingCampuses,
  selectCampus,
}: {
  draft: DraftState;
  patchDraft: (update: Partial<DraftState>) => void;
  addressSuggestions: AddressSuggestion[];
  addressSearchOpen: boolean;
  setAddressSearchOpen: (value: boolean) => void;
  selectAddressSuggestion: (suggestion: AddressSuggestion) => void;
  cityQuery: string;
  setCityQuery: (value: string) => void;
  matchingCities: string[];
  campusQuery: string;
  setCampusQuery: (value: string) => void;
  matchingCampuses: typeof campusOptions;
  selectCampus: (campus: (typeof campusOptions)[number]) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="relative">
        <Input
          label="Street address"
          value={draft.addressLine}
          set={(addressLine) => {
            patchDraft({ addressLine, latitude: null, longitude: null });
            setAddressSearchOpen(true);
          }}
          icon={<MapPin size={18} />}
        />
        {addressSearchOpen && addressSuggestions.length > 0 && (
          <SuggestionPanel>
            {addressSuggestions.map((suggestion) => (
              <button
                key={suggestion.id}
                type="button"
                onClick={() => selectAddressSuggestion(suggestion)}
                className="w-full rounded-2xl px-4 py-3 text-left text-sm text-zinc-200 hover:bg-white/10"
              >
                {suggestion.label}
              </button>
            ))}
          </SuggestionPanel>
        )}
      </div>
      <div className="grid gap-5 md:grid-cols-3">
        <Input label="Unit / apartment" value={draft.unit} set={(unit) => patchDraft({ unit })} required={false} />
        <div className="relative">
          <Input
            label="City"
            value={draft.city}
            set={(city) => {
              patchDraft({ city });
              setCityQuery(city);
            }}
            icon={<Search size={18} />}
          />
          {cityQuery && matchingCities.length > 0 && (
            <SuggestionPanel>
              {matchingCities.map((city) => (
                <button
                  key={city}
                  type="button"
                  onClick={() => {
                    patchDraft({ city });
                    setCityQuery("");
                  }}
                  className="w-full rounded-2xl px-4 py-3 text-left text-sm text-zinc-200 hover:bg-white/10"
                >
                  {city}
                </button>
              ))}
            </SuggestionPanel>
          )}
        </div>
        <Input label="Postal code" value={draft.postalCode} set={(postalCode) => patchDraft({ postalCode })} required={false} />
      </div>
      <Input label="Province" value={draft.province} set={(province) => patchDraft({ province })} />
      <div className="relative">
        <Input
          label="Nearest campus"
          value={campusQuery || draft.nearestCampusName}
          set={(value) => {
            setCampusQuery(value);
            patchDraft({ nearestCampusName: value, campus: value, campusId: "" });
          }}
          icon={<Building2 size={18} />}
        />
        {matchingCampuses.length > 0 && (
          <SuggestionPanel>
            {matchingCampuses.map((campus) => (
              <button
                key={campus.id}
                type="button"
                onClick={() => selectCampus(campus)}
                className="w-full rounded-2xl px-4 py-3 text-left hover:bg-white/10"
              >
                <span className="block text-sm font-bold text-white">{campus.officialName}</span>
                <span className="text-xs text-zinc-400">{campus.city} • {campus.address}</span>
              </button>
            ))}
          </SuggestionPanel>
        )}
      </div>
    </div>
  );
}

function PhotosStep({
  photos,
  handlePhotoSelection,
  removePhoto,
  setCoverPhoto,
}: {
  photos: PhotoPreview[];
  handlePhotoSelection: (event: ChangeEvent<HTMLInputElement>) => void;
  removePhoto: (id: string) => void;
  setCoverPhoto: (id: string) => void;
}) {
  return (
    <div className="space-y-5">
      <label className="flex min-h-48 cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed border-zinc-700 bg-black/40 p-8 text-center hover:border-pink-300">
        <ImagePlus className="text-pink-300" size={34} />
        <span className="mt-3 text-lg font-bold text-white">Upload listing photos</span>
        <span className="mt-1 text-sm text-zinc-400">Add multiple images. The first image is the cover unless you choose another.</span>
        <input type="file" multiple accept="image/*" onChange={handlePhotoSelection} className="sr-only" />
      </label>
      {photos.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {photos.map((photo) => (
            <div key={photo.id} className="overflow-hidden rounded-3xl border border-white/10 bg-black">
              <img src={photo.url} alt="" className="h-48 w-full object-cover" />
              <div className="flex items-center justify-between gap-2 p-3">
                <button type="button" onClick={() => setCoverPhoto(photo.id)} className="rounded-xl border border-white/10 px-3 py-2 text-xs font-bold text-white">
                  {photo.isCover ? "Cover photo" : "Make cover"}
                </button>
                <button type="button" onClick={() => removePhoto(photo.id)} className="rounded-xl border border-red-400/20 bg-red-500/10 p-2 text-red-200">
                  <X size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DetailsStep({
  draft,
  patchDraft,
}: {
  draft: DraftState;
  patchDraft: (update: Partial<DraftState>) => void;
}) {
  return (
    <div className="space-y-5">
      <textarea
        value={draft.description}
        onChange={(event) => patchDraft({ description: event.target.value })}
        placeholder="Describe the space, layout, transit access, and who it is best for."
        rows={6}
        className="w-full rounded-2xl border border-zinc-800 bg-black p-4 outline-none focus:border-white"
      />
      <div className="grid gap-5 md:grid-cols-2">
        <SelectField label="Furnished" value={draft.furnished} set={(furnished) => patchDraft({ furnished })} options={[["", "Choose"], ["furnished", "Furnished"], ["unfurnished", "Unfurnished"], ["partially_furnished", "Partially furnished"]]} />
        <SelectField label="Utilities included" value={draft.utilitiesIncluded} set={(utilitiesIncluded) => patchDraft({ utilitiesIncluded })} options={[["", "Ask landlord"], ["included", "Included"], ["partial", "Partially included"], ["not_included", "Not included"]]} />
        <Input label="Parking availability" value={draft.parkingDetails} set={(parkingDetails) => patchDraft({ parkingDetails })} required={false} />
        <Input label="Laundry" value={draft.laundryDetails} set={(laundryDetails) => patchDraft({ laundryDetails })} required={false} />
        <Input label="Internet / Wi-Fi" value={draft.internetDetails} set={(internetDetails) => patchDraft({ internetDetails })} required={false} />
        <Input label="Pet policy" value={draft.petDetails} set={(petDetails) => patchDraft({ petDetails })} required={false} />
      </div>
    </div>
  );
}

function AmenitiesStep({
  draft,
  toggleAmenity,
}: {
  draft: DraftState;
  toggleAmenity: (value: string) => void;
}) {
  return (
    <div>
      <p className="mb-5 text-sm text-zinc-400">Optional. Choose what helps students quickly understand the space.</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {amenityItems.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => toggleAmenity(key)}
            className={`rounded-2xl border p-4 text-left text-sm font-semibold transition ${
              draft.selectedAmenities.includes(key)
                ? "border-pink-400/40 bg-pink-500/15 text-pink-100"
                : "border-white/10 bg-black/40 text-zinc-300 hover:bg-white/10"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

function RentalStep({
  draft,
  patchDraft,
}: {
  draft: DraftState;
  patchDraft: (update: Partial<DraftState>) => void;
}) {
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <SelectField label="Does the owner live at the property?" value={draft.ownerOccupiesProperty} set={(ownerOccupiesProperty) => patchDraft({ ownerOccupiesProperty })} options={[["", "Prefer not to say"], ["true", "Yes"], ["false", "No"]]} />
      <SelectField label="Tenant shares kitchen or bathroom with owner?" value={draft.sharedKitchenOrBathroom} set={(sharedKitchenOrBathroom) => patchDraft({ sharedKitchenOrBathroom })} options={[["", "Prefer not to say"], ["true", "Yes"], ["false", "No"]]} />
      <Input label="Available / move-in date" value={draft.moveInDate} set={(moveInDate) => patchDraft({ moveInDate })} type="date" required={false} />
      <SelectField label="Lease length" value={draft.leaseType} set={(leaseType) => patchDraft({ leaseType })} options={leaseTypeOptions.map((item) => [item[0], item[1]])} />
    </div>
  );
}

function ReviewStep({
  draft,
  photos,
  goToStep,
}: {
  draft: DraftState;
  photos: PhotoPreview[];
  goToStep: (index: number) => void;
}) {
  const cards = [
    ["Basic information", `${draft.title || "Untitled"} • $${draft.price || "0"}`, 0],
    ["Location", [draft.city, draft.nearestCampusName].filter(Boolean).join(" • ") || "Not complete", 1],
    ["Photos", `${photos.length} new photo${photos.length === 1 ? "" : "s"}`, 2],
    ["Property details", draft.description || "No description yet", 3],
    ["Amenities", `${draft.selectedAmenities.length} selected`, 4],
    ["Optional rental details", draft.leaseType || draft.moveInDate || "Skipped for now", 5],
  ] as const;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {cards.map(([title, value, step]) => (
        <div key={title} className="rounded-3xl border border-white/10 bg-black/40 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-bold text-white">{title}</p>
              <p className="mt-2 line-clamp-3 text-sm leading-6 text-zinc-400">{value}</p>
            </div>
            <button type="button" onClick={() => goToStep(step)} className="rounded-xl border border-white/10 px-3 py-2 text-xs font-bold text-zinc-200 hover:bg-white/10">
              Edit
            </button>
          </div>
        </div>
      ))}
      <div className="rounded-3xl border border-pink-400/20 bg-pink-500/10 p-5 md:col-span-2">
        <p className="font-bold text-pink-100">Publishing uses account-level landlord verification.</p>
        <p className="mt-2 text-sm leading-6 text-pink-50/80">
          If your landlord account is verified, this listing can publish without property-specific document upload. If not, you can save a draft and complete landlord verification from the Verification Center.
        </p>
      </div>
    </div>
  );
}

function SuggestionPanel({ children }: { children: ReactNode }) {
  return (
    <div className="absolute z-20 mt-2 max-h-72 w-full overflow-auto rounded-2xl border border-white/10 bg-zinc-950 p-2 shadow-2xl">
      {children}
    </div>
  );
}

function Input({
  label,
  value,
  set,
  type = "text",
  required = true,
  icon,
}: {
  label: string;
  value: string;
  set: (value: string) => void;
  type?: string;
  required?: boolean;
  icon?: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-zinc-300">{label}</span>
      <span className="relative block">
        {icon && <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500">{icon}</span>}
        <input
          required={required}
          type={type}
          value={value}
          onChange={(event) => set(event.target.value)}
          className={`w-full rounded-2xl border border-zinc-800 bg-black p-4 outline-none focus:border-white ${icon ? "pl-11" : ""}`}
        />
      </span>
    </label>
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
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-zinc-300">{label}</span>
      <select
        value={value}
        onChange={(event) => set(event.target.value)}
        className="w-full rounded-2xl border border-zinc-800 bg-black p-4 text-white outline-none focus:border-white"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}
