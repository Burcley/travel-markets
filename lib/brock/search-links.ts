export const BROCK_SEARCH_FILTERS = {
  city: "St. Catharines",
  campus: "Brock",
  sort: "newest",
} as const;

export type BrockSearchFormValues = {
  budget?: string | null;
  moveIn?: string | null;
  roomType?: string | null;
  commute?: string | null;
};

function appendIfPresent(params: URLSearchParams, key: string, value?: string | null) {
  const cleanValue = value?.trim();
  if (cleanValue) params.set(key, cleanValue);
}

export function buildBrockSearchUrl(values: BrockSearchFormValues = {}) {
  const params = new URLSearchParams({
    city: BROCK_SEARCH_FILTERS.city,
    campus: BROCK_SEARCH_FILTERS.campus,
    sort: BROCK_SEARCH_FILTERS.sort,
  });

  appendIfPresent(params, "maxPrice", values.budget);
  appendIfPresent(params, "bedrooms", values.roomType);

  return `/search?${params.toString()}`;
}

export function buildBrockMapUrl() {
  const params = new URLSearchParams({
    city: BROCK_SEARCH_FILTERS.city,
    campus: BROCK_SEARCH_FILTERS.campus,
    view: "map",
    sort: BROCK_SEARCH_FILTERS.sort,
  });

  return `/search?${params.toString()}`;
}
