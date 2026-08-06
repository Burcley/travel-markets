import { getOntarioRouteReadyCampuses } from "@/lib/data/canadian-institutions";

export type UtilityStatus =
  | "included"
  | "partial"
  | "tenant_pays"
  | "not_available"
  | "ask_landlord";

export type UtilitiesDetails = {
  statuses?: Record<string, UtilityStatus>;
  partialExplanations?: Record<string, string>;
  estimatedMonthlyMin?: number | null;
  estimatedMonthlyMax?: number | null;
  notes?: string | null;
};

export type AmenitiesDetails = {
  selected?: string[];
  parking?: string;
  laundry?: string;
  furnishing?: string;
  internetDetails?: string;
  accessibilityNotes?: string;
  petDetails?: string;
};

export type LeaseConditions = {
  leaseType?: string;
  leaseStartDate?: string;
  leaseEndDate?: string;
  minimumLeaseMonths?: number | null;
  maximumLeaseMonths?: number | null;
  moveInDate?: string;
  moveOutDate?: string;
  renewalAvailable?: boolean | null;
  earlyTerminationAllowed?: boolean | null;
  earlyTerminationTerms?: string;
  sublettingAllowed?: boolean | null;
  assignmentAllowed?: boolean | null;
  guarantorRequired?: boolean | null;
  guarantorDetails?: string;
  studentStatusRequired?: boolean | null;
  proofOfEnrolmentRequired?: boolean | null;
  internationalStudentsAccepted?: boolean | null;
  coSignerAccepted?: boolean | null;
  occupantsAllowed?: number | null;
  overnightGuestPolicy?: string;
  smokingPolicy?: string;
  petPolicy?: string;
  tenantInsuranceRequired?: boolean | null;
  keyDepositAmount?: number | null;
  securityDepositAmount?: number | null;
  lastMonthRentRequired?: boolean | null;
  applicationFeeAmount?: number | null;
  additionalFees?: string;
  notes?: string;
};

export const campusOptions = getOntarioRouteReadyCampuses();

export const utilityItems = [
  ["electricity", "Electricity"],
  ["water", "Water"],
  ["heating", "Heating"],
  ["gas", "Gas"],
  ["air_conditioning", "Air conditioning"],
  ["internet", "Internet/Wi-Fi"],
  ["hot_water", "Hot water"],
] as const;

export const utilityStatusOptions = [
  ["ask_landlord", "Ask landlord"],
  ["included", "Included in rent"],
  ["partial", "Partially included"],
  ["tenant_pays", "Tenant pays separately"],
  ["not_available", "Not available"],
] as const;

export const amenityItems = [
  ["in_unit_laundry", "In-unit laundry"],
  ["shared_laundry", "Shared laundry"],
  ["dishwasher", "Dishwasher"],
  ["refrigerator", "Refrigerator"],
  ["stove_oven", "Stove/oven"],
  ["microwave", "Microwave"],
  ["furnished", "Furnished"],
  ["bed_included", "Bed included"],
  ["desk_included", "Desk included"],
  ["closet_storage", "Closet/storage"],
  ["private_bathroom", "Private bathroom"],
  ["shared_bathroom", "Shared bathroom"],
  ["balcony", "Balcony"],
  ["parking", "Parking"],
  ["bicycle_storage", "Bicycle storage"],
  ["gym", "Gym"],
  ["study_room", "Study room"],
  ["security_cameras", "Security cameras"],
  ["controlled_access", "Controlled building access"],
  ["elevator", "Elevator"],
  ["wheelchair_accessible", "Wheelchair accessible"],
  ["pet_friendly", "Pet friendly"],
  ["smoke_free", "Smoke-free property"],
  ["air_conditioning", "Air conditioning"],
  ["outdoor_space", "Backyard/outdoor space"],
] as const;

export const leaseTypeOptions = [
  ["", "Not sure yet"],
  ["fixed_term", "Fixed-term lease"],
  ["month_to_month", "Month-to-month"],
  ["sublet", "Sublet"],
  ["lease_assignment", "Lease assignment"],
  ["room_rental", "Room rental agreement"],
  ["homestay", "Homestay"],
  ["other", "Other"],
] as const;

export function calculateDistanceKm(
  propertyLatitude: number | null,
  propertyLongitude: number | null,
  campusLatitude: number | null,
  campusLongitude: number | null
) {
  if (
    propertyLatitude == null ||
    propertyLongitude == null ||
    campusLatitude == null ||
    campusLongitude == null
  ) {
    return null;
  }

  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const radiusKm = 6371;
  const dLat = toRadians(campusLatitude - propertyLatitude);
  const dLon = toRadians(campusLongitude - propertyLongitude);
  const lat1 = toRadians(propertyLatitude);
  const lat2 = toRadians(campusLatitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  return Number((radiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(1));
}

export function estimateTravelTimes(distanceKm: number | null) {
  if (distanceKm == null) {
    return {
      walking: null,
      cycling: null,
      driving: null,
      transit: null,
    };
  }

  return {
    walking: Math.max(1, Math.round((distanceKm / 4.8) * 60)),
    cycling: Math.max(1, Math.round((distanceKm / 15) * 60)),
    driving: Math.max(3, Math.round((distanceKm / 32) * 60 + 4)),
    transit: Math.max(6, Math.round((distanceKm / 22) * 60 + 8)),
  };
}

export function getUtilityStatusLabel(status?: string | null) {
  return (
    utilityStatusOptions.find((item) => item[0] === status)?.[1] ||
    "Ask landlord"
  );
}

export function getLeaseTypeLabel(value?: string | null) {
  return leaseTypeOptions.find((item) => item[0] === value)?.[1] || "";
}

export function getAmenityLabel(value: string) {
  return amenityItems.find((item) => item[0] === value)?.[1] || value;
}

export function getTransparencyLabel({
  nearestCampusName,
  utilitiesDetails,
  amenitiesDetails,
  leaseConditions,
}: {
  nearestCampusName?: string | null;
  utilitiesDetails?: UtilitiesDetails | null;
  amenitiesDetails?: AmenitiesDetails | null;
  leaseConditions?: LeaseConditions | null;
}) {
  let score = 0;

  if (nearestCampusName) score++;
  if (Object.keys(utilitiesDetails?.statuses || {}).length >= 3) score++;
  if ((amenitiesDetails?.selected || []).length >= 4) score++;
  if (leaseConditions?.leaseType || leaseConditions?.moveInDate) score++;
  if (
    leaseConditions?.lastMonthRentRequired != null ||
    leaseConditions?.keyDepositAmount != null ||
    leaseConditions?.securityDepositAmount != null ||
    leaseConditions?.applicationFeeAmount != null
  ) {
    score++;
  }

  if (score >= 4) return "Highly detailed";
  if (score >= 2) return "Good detail";
  return "Basic details";
}
