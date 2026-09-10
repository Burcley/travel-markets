import {
  getOntarioRouteReadyCampuses,
  type RouteReadyCampusOption,
} from "@/lib/data/canadian-institutions";

export type CampusDiscoveryOption = {
  id: string;
  institutionId: string;
  institutionName: string;
  campusName: string;
  displayName: string;
  city: string;
  province: string;
  destination: string;
  dedicatedPage: boolean;
};

function campusSearchUrl(campus: RouteReadyCampusOption) {
  const params = new URLSearchParams({
    city: campus.city,
    campus: campus.name,
    sort: "newest",
  });

  return `/search?${params.toString()}`;
}

export function destinationForCampus(campus: RouteReadyCampusOption) {
  if (campus.institutionId === "brock-university") return "/brock";
  return campusSearchUrl(campus);
}

export function getCampusDiscoveryOptions() {
  return getOntarioRouteReadyCampuses({ includeColleges: true }).map((campus) => ({
    id: campus.id,
    institutionId: campus.institutionId,
    institutionName: campus.institutionName,
    campusName: campus.name.replace(`${campus.institutionName} — `, ""),
    displayName: campus.name,
    city: campus.city,
    province: campus.province,
    destination: destinationForCampus(campus),
    dedicatedPage: campus.institutionId === "brock-university",
  }));
}

export function getProminentCampusCards() {
  const campuses = getCampusDiscoveryOptions();
  const preferredIds = [
    "brock-st-catharines",
    "ontario-tech-north-oshawa",
    "trent-durham-gta",
    "durham-oshawa",
  ];

  return preferredIds
    .map((id) => campuses.find((campus) => campus.id === id))
    .filter((campus): campus is CampusDiscoveryOption => Boolean(campus));
}
