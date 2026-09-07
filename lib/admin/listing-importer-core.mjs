import { createHash } from "node:crypto";

export const LANDLORD_IMPORT_HEADERS = [
  "Property",
  "Rooms",
  "Up/Down?",
  "Rent",
  "Group/Individual?",
  "Female/Male",
  "Utilities",
  "Internet",
  "Lease?",
  "Total rooms",
  "Baths",
];

const HEADER_ALIASES = new Map(
  LANDLORD_IMPORT_HEADERS.map((header) => [normalizeHeader(header), header])
);

function clean(value) {
  if (value == null) return "";
  return String(value).replace(/\s+/g, " ").trim();
}

function normalizeHeader(value) {
  return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function normalizeText(value) {
  return clean(value).toLowerCase().replace(/&/g, "and");
}

function compactKey(value) {
  return normalizeText(value).replace(/[^a-z0-9]+/g, "");
}

export function parseCurrency(value) {
  const raw = clean(value);
  if (!raw || /^n\/?a$/i.test(raw)) return null;
  const numeric = Number(raw.replace(/[^0-9.]/g, ""));
  return Number.isFinite(numeric) ? Math.round(numeric) : null;
}

export function parseCount(value) {
  const raw = clean(value);
  if (!raw || /^n\/?a$/i.test(raw)) return null;
  const match = raw.match(/\d+(?:\.\d+)?/);
  if (!match) return null;
  const numeric = Number(match[0]);
  return Number.isFinite(numeric) ? numeric : null;
}

export function parseBoolean(value) {
  const raw = normalizeText(value);
  if (!raw || raw === "n/a" || raw === "na") return null;
  if (["yes", "y", "true", "included"].includes(raw)) return true;
  if (["no", "n", "false", "not included"].includes(raw)) return false;
  return null;
}

export function normalizeNullableText(value) {
  const raw = clean(value);
  if (!raw || /^n\/?a$/i.test(raw)) return null;
  return raw;
}

function normalizeUnit(value) {
  const raw = normalizeNullableText(value);
  if (!raw) return null;
  const normalized = normalizeText(raw);
  if (normalized.includes("basement")) return "Basement";
  if (normalized.includes("upper")) return "Upper";
  if (normalized.includes("main")) return "Main";
  if (normalized.includes("lower")) return "Lower";
  return raw;
}

function normalizeArrangement(value) {
  const raw = normalizeNullableText(value);
  if (!raw) return null;
  const normalized = normalizeText(raw);
  if (normalized.includes("individual")) return "Individual";
  if (normalized.includes("group") || normalized.includes("family")) return "Group/Family";
  return raw;
}

function normalizeGenderPreference(value) {
  const raw = normalizeNullableText(value);
  if (!raw) return null;
  const normalized = normalizeText(raw);
  if (normalized.includes("female")) return "Female";
  if (normalized.includes("male")) return "Male";
  return raw;
}

function rowFromArray(values, rowNumber) {
  const row = {};
  LANDLORD_IMPORT_HEADERS.forEach((header, index) => {
    row[header] = values[index] ?? "";
  });
  return { row, rowNumber };
}

function rowFromObject(object, rowNumber) {
  const row = {};
  for (const [key, value] of Object.entries(object || {})) {
    const mapped = HEADER_ALIASES.get(normalizeHeader(key));
    if (mapped) row[mapped] = value;
  }
  return { row, rowNumber };
}

export function rowsFromSheetJson(sheetRows, { useTemplateOrder = false } = {}) {
  if (!Array.isArray(sheetRows)) return [];

  return sheetRows
    .map((row, index) =>
      useTemplateOrder || Array.isArray(row)
        ? rowFromArray(Array.isArray(row) ? row : Object.values(row || {}), index + 1)
        : rowFromObject(row, index + 2)
    )
    .filter(({ row }) =>
      LANDLORD_IMPORT_HEADERS.some((header) => clean(row[header]).length > 0)
    );
}

export function normalizeImportRow(input) {
  const row = input.row || input;
  const rowNumber = input.rowNumber || null;
  const property = normalizeNullableText(row.Property);
  const roomsAvailable = parseCount(row.Rooms);
  const unit = normalizeUnit(row["Up/Down?"]);
  const rent = parseCurrency(row.Rent);
  const arrangement = normalizeArrangement(row["Group/Individual?"]);
  const genderPreference = normalizeGenderPreference(row["Female/Male"]);
  const utilitiesIncluded = parseBoolean(row.Utilities);
  const internetIncluded = parseBoolean(row.Internet);
  const availability = normalizeNullableText(row["Lease?"]);
  const totalRooms = parseCount(row["Total rooms"]);
  const bathrooms = parseCount(row.Baths);

  const normalized = {
    rowNumber,
    property,
    roomsAvailable,
    unit,
    rent,
    arrangement,
    genderPreference,
    utilitiesIncluded,
    internetIncluded,
    availability,
    totalRooms,
    bathrooms,
  };

  return {
    ...normalized,
    completenessScore: rowCompletenessScore(normalized),
    fingerprint: fingerprintImportRow(normalized),
    warnings: validateNormalizedRow(normalized),
  };
}

function rowCompletenessScore(row) {
  return [
    row.property,
    row.roomsAvailable,
    row.unit,
    row.rent,
    row.arrangement,
    row.utilitiesIncluded,
    row.internetIncluded,
    row.availability,
    row.totalRooms,
    row.bathrooms,
  ].filter((value) => value !== null && value !== undefined && value !== "").length;
}

export function fingerprintImportRow(row) {
  const parts = [
    compactKey(row.property),
    compactKey(row.unit),
    row.rent ?? "",
    row.roomsAvailable ?? "",
    row.totalRooms ?? "",
    row.bathrooms ?? "",
  ];

  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 24);
}

function validateNormalizedRow(row) {
  const warnings = [];
  if (!row.property) warnings.push("Missing property/address.");
  if (row.rent == null) warnings.push("Missing or invalid rent.");
  if (row.roomsAvailable == null) warnings.push("Missing rooms available.");
  if (row.totalRooms == null) warnings.push("Missing total rooms.");
  if (row.bathrooms == null) warnings.push("Missing bathroom count.");
  if (row.property && !/\b(on|ontario|canada)\b/i.test(row.property)) {
    warnings.push("Address likely incomplete; confirm city/province before publishing.");
  }
  return warnings;
}

export function normalizeImportRows(rows) {
  return rows.map((row) => normalizeImportRow(row));
}

function duplicateKey(row) {
  return [
    compactKey(row.property),
    compactKey(row.unit),
    row.rent ?? "",
    row.roomsAvailable ?? "",
    row.totalRooms ?? "",
    row.bathrooms ?? "",
  ].join("|");
}

function loosePropertyUnitKey(row) {
  return [compactKey(row.property), compactKey(row.unit)].join("|");
}

function loosePropertyKey(row) {
  return compactKey(row.property);
}

function hasCoreImportGaps(row) {
  return row.rent == null || row.totalRooms == null || row.bathrooms == null;
}

export function dedupeImportRows(rows) {
  const normalizedRows = normalizeImportRows(rows);
  const bestByExact = new Map();

  for (const row of normalizedRows) {
    const key = duplicateKey(row);
    const current = bestByExact.get(key);
    if (!current || row.completenessScore > current.completenessScore) {
      bestByExact.set(key, row);
    }
  }

  const exactUnique = Array.from(bestByExact.values());
  const exactDuplicateFingerprints = new Set();
  for (const row of normalizedRows) {
    const kept = bestByExact.get(duplicateKey(row));
    if (kept && kept !== row) exactDuplicateFingerprints.add(row.fingerprint);
  }

  const bestByPropertyUnit = new Map();
  for (const row of exactUnique) {
    const key = loosePropertyUnitKey(row);
    const current = bestByPropertyUnit.get(key);
    if (!current || row.completenessScore > current.completenessScore) {
      bestByPropertyUnit.set(key, row);
    }
  }

  const bestByProperty = new Map();
  for (const row of exactUnique) {
    const key = loosePropertyKey(row);
    const current = bestByProperty.get(key);
    if (!current || row.completenessScore > current.completenessScore) {
      bestByProperty.set(key, row);
    }
  }

  const unique = [];
  const skipped = [];
  for (const row of normalizedRows) {
    const exactKept = bestByExact.get(duplicateKey(row));
    const looseKept = bestByPropertyUnit.get(loosePropertyUnitKey(row));
    const propertyKept = bestByProperty.get(loosePropertyKey(row));

    if (exactKept !== row) {
      skipped.push({ row, reason: "Duplicate row skipped." });
      continue;
    }

    if (looseKept !== row && row.completenessScore < looseKept.completenessScore) {
      skipped.push({ row, reason: "Incomplete duplicate skipped in favor of a more complete row." });
      continue;
    }

    if (
      propertyKept !== row &&
      hasCoreImportGaps(row) &&
      row.completenessScore < propertyKept.completenessScore
    ) {
      skipped.push({ row, reason: "Incomplete duplicate skipped in favor of a more complete row." });
      continue;
    }

    if (!unique.some((item) => item.fingerprint === row.fingerprint)) {
      unique.push(row);
    } else if (exactDuplicateFingerprints.has(row.fingerprint)) {
      skipped.push({ row, reason: "Duplicate row skipped." });
    }
  }

  return { unique, skipped };
}

export function generateListingTitle(row) {
  const roomText =
    row.roomsAvailable === 1
      ? "Room for Rent"
      : row.roomsAvailable
        ? `${row.roomsAvailable}-Room Rental`
        : "Rental";
  const unitText = row.unit ? `${row.unit} ` : "";
  return `${roomText} - ${unitText}${row.property || "Imported property"}`;
}

export function generateListingDescription(row) {
  const sentences = [];
  const location = row.property || "this property";
  const unit = row.unit ? ` in the ${row.unit.toLowerCase()} unit` : "";

  if (row.arrangement === "Individual" && row.roomsAvailable === 1) {
    sentences.push(`Private room available${unit} at ${location}.`);
  } else if (row.roomsAvailable) {
    sentences.push(`${row.roomsAvailable} rooms available${unit} at ${location}.`);
  } else {
    sentences.push(`Rental available${unit} at ${location}.`);
  }

  const propertyFacts = [];
  if (row.totalRooms) {
    propertyFacts.push(`${row.totalRooms} total ${row.totalRooms === 1 ? "room" : "rooms"}`);
  }
  if (row.bathrooms) {
    propertyFacts.push(`${row.bathrooms} ${row.bathrooms === 1 ? "bathroom" : "bathrooms"}`);
  }
  if (propertyFacts.length) {
    sentences.push(`The property has ${propertyFacts.join(" and ")}.`);
  }

  if (row.arrangement === "Group/Family") {
    sentences.push("Suitable for a group or family.");
  }

  if (row.genderPreference) {
    sentences.push(`${row.genderPreference} preference noted by the landlord.`);
  }

  if (row.utilitiesIncluded === true) sentences.push("Utilities are included.");
  if (row.utilitiesIncluded === false) sentences.push("Utilities are not included.");
  if (row.internetIncluded === true) sentences.push("Internet is included.");
  if (row.internetIncluded === false) sentences.push("Internet is not included.");
  if (row.availability) sentences.push(`Available ${row.availability}.`);

  return sentences.join(" ");
}

export function suggestImageMatches(rows, imageNames = []) {
  const normalizedImages = imageNames.map((name) => ({
    name,
    key: compactKey(name.replace(/\.[a-z0-9]+$/i, "")),
  }));

  return Object.fromEntries(
    rows.map((row) => {
      const propertyKey = compactKey(row.property);
      const matches = normalizedImages
        .filter((image) => propertyKey && image.key.includes(propertyKey))
        .map((image) => image.name);
      return [row.fingerprint, matches];
    })
  );
}

export function buildDraftListingPayload({ ownerId, row, city = "", province = "Ontario" }) {
  const now = new Date().toISOString();
  const utilitiesStatuses = {};
  ["electricity", "water", "heating"].forEach((key) => {
    utilitiesStatuses[key] = row.utilitiesIncluded === true ? "included" : "ask_landlord";
  });
  utilitiesStatuses.internet = row.internetIncluded === true ? "included" : "ask_landlord";

  return {
    user_id: ownerId,
    title: generateListingTitle(row),
    city: clean(city),
    location: clean(city),
    campus: "",
    address_line: row.property || "",
    unit: row.unit || "",
    province: clean(province) || "Ontario",
    postal_code: "",
    country: "Canada",
    price: row.rent || 0,
    bedrooms: row.totalRooms ?? row.roomsAvailable ?? null,
    bathrooms: row.bathrooms ?? null,
    roommates: row.roomsAvailable ?? null,
    guests: row.roomsAvailable ?? null,
    description: generateListingDescription(row),
    amenities: [],
    status: "draft",
    latitude: null,
    longitude: null,
    public_latitude: null,
    public_longitude: null,
    location_privacy_radius_meters: null,
    public_location_generated_at: null,
    nearest_campus_name: null,
    nearest_campus_address: null,
    campus_id: null,
    campus_destination_label: null,
    campus_coordinate_source: null,
    campus_latitude: null,
    campus_longitude: null,
    distance_to_campus_km: null,
    walking_time_minutes: null,
    cycling_time_minutes: null,
    driving_time_minutes: null,
    transit_time_minutes: null,
    distance_last_calculated_at: null,
    utilities_details: {
      statuses: utilitiesStatuses,
      notes:
        row.utilitiesIncluded === true
          ? "Utilities marked as included by landlord spreadsheet."
          : "",
    },
    amenities_details: {
      selected: [],
      internetDetails:
        row.internetIncluded === true
          ? "Internet included"
          : row.internetIncluded === false
            ? "Internet not included"
            : "",
      furnishing: "",
      parking: "",
      laundry: "",
      petDetails: "",
    },
    lease_conditions: {
      leaseType: "",
      moveInDate: "",
      notes: row.availability ? `Availability: ${row.availability}` : "",
      occupantsAllowed: row.roomsAvailable ?? null,
    },
    verification_disclaimer_acknowledged: true,
    fair_housing_acknowledged: true,
    owner_occupies_property: null,
    owner_family_occupies_property: null,
    shared_kitchen_with_owner: null,
    shared_bathroom_with_owner: null,
    private_bedroom: row.arrangement === "Individual" ? true : null,
    self_contained_unit: row.arrangement === "Group/Family" ? true : null,
    other_occupants_present: null,
    estimated_other_occupant_count:
      row.totalRooms && row.roomsAvailable != null
        ? Math.max(0, row.totalRooms - row.roomsAvailable)
        : null,
    occupancy_notes: [
      row.arrangement ? `Arrangement: ${row.arrangement}` : "",
      row.genderPreference ? `Preference: ${row.genderPreference}` : "",
      row.roomsAvailable != null ? `Rooms available: ${row.roomsAvailable}` : "",
      row.totalRooms != null ? `Total rooms: ${row.totalRooms}` : "",
    ]
      .filter(Boolean)
      .join("; "),
    safety_instructions: "",
    creation_idempotency_key: `admin-bulk-import:${row.fingerprint}`,
    updated_at: now,
  };
}

export function summarizePreview({ sourceRows, uniqueRows, skippedRows }) {
  return {
    rowsDetected: sourceRows.length,
    uniqueRows: uniqueRows.length,
    skippedRows: skippedRows.length,
    duplicateRows: skippedRows.filter((item) => item.reason.includes("Duplicate")).length,
    incompleteDuplicateRows: skippedRows.filter((item) =>
      item.reason.includes("Incomplete")
    ).length,
    warningRows: uniqueRows.filter((row) => row.warnings.length > 0).length,
  };
}
