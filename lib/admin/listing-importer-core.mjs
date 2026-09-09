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

export const ENRICHED_IMPORT_HEADERS = [
  "Property",
  "Street Address",
  "City",
  "Province",
  "Postal Code",
  "Rooms Available",
  "Unit",
  "Rent CAD",
  "Arrangement",
  "Gender",
  "Utilities",
  "Internet",
  "Available",
  "Total Rooms",
  "Baths",
  "Listing Title",
  "Description",
  "Source / Verification Notes",
  "Source URL",
];

const REQUIRED_ENRICHED_IMPORT_HEADERS = [
  "Property",
  "Street Address",
  "City",
  "Province",
  "Postal Code",
  "Rooms Available",
  "Rent CAD",
  "Total Rooms",
  "Baths",
  "Listing Title",
  "Description",
];

const HEADER_ALIASES = new Map(
  [
    ...LANDLORD_IMPORT_HEADERS.map((header) => [normalizeHeader(header), header]),
    ["streetaddress", "Street Address"],
    ["city", "City"],
    ["province", "Province"],
    ["state", "Province"],
    ["postalcode", "Postal Code"],
    ["zip", "Postal Code"],
    ["zipcode", "Postal Code"],
    ["roomsavailable", "Rooms Available"],
    ["roomavailable", "Rooms Available"],
    ["unit", "Unit"],
    ["floor", "Unit"],
    ["rentcad", "Rent CAD"],
    ["rent", "Rent"],
    ["arrangement", "Arrangement"],
    ["gender", "Gender"],
    ["available", "Available"],
    ["availability", "Available"],
    ["totalrooms", "Total Rooms"],
    ["totalroom", "Total Rooms"],
    ["baths", "Baths"],
    ["bathrooms", "Baths"],
    ["listingtitle", "Listing Title"],
    ["title", "Listing Title"],
    ["description", "Description"],
    ["sourceverificationnotes", "Source / Verification Notes"],
    ["sourcenotes", "Source / Verification Notes"],
    ["verificationnotes", "Source / Verification Notes"],
    ["sourceurl", "Source URL"],
    ["url", "Source URL"],
  ]
);

function clean(value) {
  if (value == null) return "";
  return String(value)
    .replace(/^\uFEFF/, "")
    .replace(/[\u200B-\u200D\u2060]/g, "")
    .replace(/\u00A0/g, " ")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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

function rowFromArrayHeaders(headers, values, rowNumber) {
  const row = {};
  headers.forEach((header, index) => {
    if (header) row[header] = values[index] ?? "";
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

function canonicalHeader(value) {
  return HEADER_ALIASES.get(normalizeHeader(value)) || null;
}

function canonicalHeadersFromArray(row) {
  return Array.isArray(row) ? row.map((value) => canonicalHeader(value)) : [];
}

function headerSetFromArrayRow(row) {
  const headerSet = new Set();
  if (!Array.isArray(row)) return headerSet;
  row.forEach((value) => {
    const normalized = normalizeHeader(value);
    if (normalized) headerSet.add(normalized);
  });
  return headerSet;
}

function headerSetFromObjectRows(sheetRows) {
  const headerSet = new Set();
  for (const row of sheetRows) {
    if (!row || Array.isArray(row) || typeof row !== "object") continue;
    Object.keys(row).forEach((key) => headerSet.add(normalizeHeader(key)));
  }
  return headerSet;
}

function firstNonEmptyArrayRow(sheetRows) {
  if (!Array.isArray(sheetRows)) return null;
  return (
    sheetRows.find(
      (row) => Array.isArray(row) && row.some((value) => clean(value).length > 0)
    ) || null
  );
}

function headerSetFromRows(sheetRows) {
  const firstArrayRow = firstNonEmptyArrayRow(sheetRows);
  if (firstArrayRow) return headerSetFromArrayRow(firstArrayRow);
  return headerSetFromObjectRows(sheetRows);
}

function recognizedHeaderCount(headers) {
  const canonicalHeaders = new Set(
    [...LANDLORD_IMPORT_HEADERS, ...ENRICHED_IMPORT_HEADERS].map((header) =>
      normalizeHeader(header)
    )
  );

  return Array.from(headers).filter((header) => canonicalHeaders.has(header)).length;
}

function hasHeaderLikeFirstRow(sheetRows) {
  const firstArrayRow = firstNonEmptyArrayRow(sheetRows);
  if (!firstArrayRow) return headerSetFromObjectRows(sheetRows).size > 0;
  const headers = headerSetFromArrayRow(firstArrayRow);
  return headers.has("property") || recognizedHeaderCount(headers) >= 3;
}

export function detectImportFormat(sheetRows, { useTemplateOrder = false } = {}) {
  const headers = headerSetFromRows(sheetRows);
  const enrichedMatches = ENRICHED_IMPORT_HEADERS.filter((header) =>
    headers.has(normalizeHeader(header))
  );
  const enrichedSignals = [
    "streetaddress",
    "roomsavailable",
    "rentcad",
    "listingtitle",
    "postalcode",
    "sourceverificationnotes",
    "sourceurl",
  ];

  if (
    enrichedSignals.some((header) => headers.has(header)) ||
    enrichedMatches.length >= 8
  ) {
    return "enriched";
  }

  if (useTemplateOrder) return "legacy-template";

  const legacyMatches = LANDLORD_IMPORT_HEADERS.filter((header) =>
    headers.has(normalizeHeader(header))
  );
  if (legacyMatches.length >= 6) return "legacy-header";

  if (hasHeaderLikeFirstRow(sheetRows)) return "unknown-header";

  return "legacy-template";
}

export function validateEnrichedHeaders(sheetRows) {
  const headers = headerSetFromRows(sheetRows);
  const missingHeaders = REQUIRED_ENRICHED_IMPORT_HEADERS.filter(
    (header) => !headers.has(normalizeHeader(header))
  );

  return {
    valid: missingHeaders.length === 0,
    missingHeaders,
  };
}

export function rowsFromSheetJson(
  sheetRows,
  { useTemplateOrder = false, importFormat: providedImportFormat } = {}
) {
  if (!Array.isArray(sheetRows)) return [];

  const importFormat =
    providedImportFormat || detectImportFormat(sheetRows, { useTemplateOrder });

  if (importFormat === "unknown-header") return [];

  const firstArrayRow = firstNonEmptyArrayRow(sheetRows);
  const firstArrayRowIndex = firstArrayRow ? sheetRows.indexOf(firstArrayRow) : -1;
  const mappedHeaders =
    (importFormat === "enriched" || importFormat === "legacy-header") && firstArrayRow
      ? canonicalHeadersFromArray(firstArrayRow)
      : [];

  return sheetRows
    .map((row, index) => {
      if (
        (importFormat === "enriched" || importFormat === "legacy-header") &&
        index === firstArrayRowIndex
      ) {
        return null;
      }

      if (
        Array.isArray(row) &&
        (importFormat === "enriched" || importFormat === "legacy-header") &&
        mappedHeaders.length > 0
      ) {
        return rowFromArrayHeaders(mappedHeaders, row, index + 1);
      }

      if (useTemplateOrder || Array.isArray(row) || importFormat === "legacy-template") {
        return rowFromArray(Array.isArray(row) ? row : Object.values(row || {}), index + 1);
      }

      return rowFromObject(row, index + 2);
    })
    .filter(Boolean)
    .map((result) => ({
      ...result,
      importFormat,
    }))
    .filter(({ row }) =>
      [...LANDLORD_IMPORT_HEADERS, ...ENRICHED_IMPORT_HEADERS].some(
        (header) => clean(row[header]).length > 0
      )
    );
}

export async function parseSpreadsheetBuffer({
  buffer,
  fileName = "spreadsheet.xlsx",
  useTemplateOrder = false,
}) {
  const extension = clean(fileName).split(".").pop()?.toLowerCase() || "";

  if (!["xlsx", "xls", "csv"].includes(extension)) {
    throw new Error("Upload an XLSX, XLS, or CSV spreadsheet.");
  }

  if (!buffer || buffer.length <= 0) {
    throw new Error("The spreadsheet is empty.");
  }

  if (buffer.length > 5 * 1024 * 1024) {
    throw new Error("Spreadsheet is too large. Keep imports under 5 MB.");
  }

  const XLSX = await import("xlsx");
  const workbook = XLSX.read(buffer, {
    type: "buffer",
    cellDates: false,
    dense: false,
  });

  const firstSheetName = workbook.SheetNames[0];
  const sheet = firstSheetName ? workbook.Sheets[firstSheetName] : null;

  if (!sheet) {
    throw new Error("The spreadsheet does not contain a readable sheet.");
  }

  const sheetRows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    blankrows: false,
  });
  const importFormat = detectImportFormat(sheetRows, { useTemplateOrder });

  if (importFormat === "unknown-header") {
    throw new Error(
      "Spreadsheet headers were detected, but they do not match the enriched Travel Markets format or the supported legacy template. Check the column names and try again."
    );
  }

  if (importFormat === "enriched") {
    const headerValidation = validateEnrichedHeaders(sheetRows);

    if (!headerValidation.valid) {
      throw new Error(
        `The enriched spreadsheet is missing required columns: ${headerValidation.missingHeaders.join(", ")}.`
      );
    }
  }

  const sourceRows = rowsFromSheetJson(sheetRows, { importFormat, useTemplateOrder });
  const { unique, skipped } = dedupeImportRows(sourceRows);

  return {
    sourceRows,
    uniqueRows: unique,
    skippedRows: skipped,
    importFormat,
    summary: summarizePreview({
      sourceRows,
      uniqueRows: unique,
      skippedRows: skipped,
    }),
  };
}

export function normalizeImportRow(input) {
  const row = input.row || input;
  const rowNumber = input.rowNumber || null;
  const importFormat = input.importFormat || "legacy-header";
  const property = normalizeNullableText(row.Property);
  const streetAddress = normalizeNullableText(row["Street Address"]);
  const city = normalizeNullableText(row.City);
  const province = normalizeNullableText(row.Province);
  const postalCode = normalizeNullableText(row["Postal Code"]);
  const roomsAvailable = parseCount(row["Rooms Available"] ?? row.Rooms);
  const unit = normalizeUnit(row.Unit ?? row["Up/Down?"]);
  const rent = parseCurrency(row["Rent CAD"] ?? row.Rent);
  const arrangement = normalizeArrangement(row.Arrangement ?? row["Group/Individual?"]);
  const genderPreference = normalizeGenderPreference(row.Gender ?? row["Female/Male"]);
  const utilitiesIncluded = parseBoolean(row.Utilities);
  const internetIncluded = parseBoolean(row.Internet);
  const availability = normalizeNullableText(row.Available ?? row["Lease?"]);
  const totalRooms = parseCount(row["Total Rooms"] ?? row["Total rooms"]);
  const bathrooms = parseCount(row.Baths);
  const listingTitle = normalizeNullableText(row["Listing Title"]);
  const description = normalizeNullableText(row.Description);
  const sourceVerificationNotes = normalizeNullableText(
    row["Source / Verification Notes"]
  );
  const sourceUrl = normalizeNullableText(row["Source URL"]);

  const normalized = {
    rowNumber,
    importFormat,
    property,
    streetAddress,
    city,
    province,
    postalCode,
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
    listingTitle,
    description,
    sourceVerificationNotes,
    sourceUrl,
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
    row.streetAddress,
    row.city,
    row.province,
    row.postalCode,
    row.roomsAvailable,
    row.unit,
    row.rent,
    row.arrangement,
    row.utilitiesIncluded,
    row.internetIncluded,
    row.availability,
    row.totalRooms,
    row.bathrooms,
    row.listingTitle,
    row.description,
  ].filter((value) => value !== null && value !== undefined && value !== "").length;
}

export function fingerprintImportRow(row) {
  const parts = [
    compactKey(row.property),
    compactKey(row.streetAddress),
    compactKey(row.city),
    compactKey(row.province),
    compactKey(row.postalCode),
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
  const address = row.streetAddress || row.property;
  if (!row.property) warnings.push("Missing property name.");
  if (!address) warnings.push("Missing street address.");
  if (row.importFormat === "enriched" && !row.city) warnings.push("Missing city.");
  if (row.importFormat === "enriched" && !row.province) warnings.push("Missing province.");
  if (row.importFormat === "enriched" && !row.postalCode) warnings.push("Missing postal code.");
  if (row.rent == null) warnings.push("Missing or invalid rent.");
  if (row.roomsAvailable == null) warnings.push("Missing rooms available.");
  if (row.totalRooms == null) warnings.push("Missing total rooms.");
  if (row.bathrooms == null) warnings.push("Missing bathroom count.");
  if (
    row.importFormat !== "enriched" &&
    row.property &&
    !/\b(on|ontario|canada)\b/i.test(row.property)
  ) {
    warnings.push("Address likely incomplete; confirm city/province before publishing.");
  }
  return warnings;
}

export function importRowBlockingError(row) {
  if (!row?.property) return "Missing property/address.";
  if (row.rent == null || row.rent <= 0) return "Missing or invalid rent.";
  return null;
}

export function importButtonState({
  selectedLandlord = null,
  preview = null,
  rows = [],
  selectedFingerprints = [],
  importing = false,
} = {}) {
  if (importing) {
    return {
      disabled: true,
      reason: "Import already in progress.",
      selectedValidRows: [],
      blockingErrorCount: 0,
    };
  }

  if (!selectedLandlord) {
    return {
      disabled: true,
      reason: "Select a landlord first.",
      selectedValidRows: [],
      blockingErrorCount: 0,
    };
  }

  if (!preview) {
    return {
      disabled: true,
      reason: "Parse and preview a spreadsheet first.",
      selectedValidRows: [],
      blockingErrorCount: 0,
    };
  }

  const selectedSet =
    selectedFingerprints instanceof Set
      ? selectedFingerprints
      : new Set(selectedFingerprints);
  const selectedRows = rows.filter((row) => selectedSet.has(row.fingerprint));
  const blockingErrorCount = selectedRows.filter((row) => importRowBlockingError(row)).length;
  const selectedValidRows = selectedRows.filter((row) => !importRowBlockingError(row));

  if (!selectedRows.length || !selectedValidRows.length) {
    return {
      disabled: true,
      reason: "No valid listings selected.",
      selectedValidRows,
      blockingErrorCount,
    };
  }

  if (blockingErrorCount > 0) {
    return {
      disabled: true,
      reason: `Resolve ${blockingErrorCount} blocking validation ${
        blockingErrorCount === 1 ? "error" : "errors"
      }.`,
      selectedValidRows,
      blockingErrorCount,
    };
  }

  return {
    disabled: false,
    reason: "",
    selectedValidRows,
    blockingErrorCount: 0,
  };
}

export function normalizeImportRows(rows) {
  return rows.map((row) => normalizeImportRow(row));
}

function duplicateKey(row) {
  return [
    compactKey(row.property),
    compactKey(row.streetAddress),
    compactKey(row.city),
    compactKey(row.province),
    compactKey(row.postalCode),
    compactKey(row.unit),
    row.rent ?? "",
    row.roomsAvailable ?? "",
    row.totalRooms ?? "",
    row.bathrooms ?? "",
  ].join("|");
}

function loosePropertyUnitKey(row) {
  return [
    compactKey(row.streetAddress || row.property),
    compactKey(row.city),
    compactKey(row.unit),
  ].join("|");
}

function loosePropertyKey(row) {
  return [compactKey(row.streetAddress || row.property), compactKey(row.city)].join("|");
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
  if (row.listingTitle) return row.listingTitle;

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
  if (row.description) return row.description;

  const sentences = [];
  const location = row.streetAddress || row.property || "this property";
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
      const addressKey = compactKey(row.streetAddress);
      const matches = normalizedImages
        .filter(
          (image) =>
            (propertyKey && image.key.includes(propertyKey)) ||
            (addressKey && image.key.includes(addressKey))
        )
        .map((image) => image.name);
      return [row.fingerprint, matches];
    })
  );
}

export function buildDraftListingPayload({ ownerId, row, city = "", province = "Ontario" }) {
  const now = new Date().toISOString();
  const listingCity = clean(row.city || city);
  const listingProvince = clean(row.province || province) || "Ontario";
  const listingAddress = clean(row.streetAddress || row.property);
  const utilitiesStatuses = {};
  ["electricity", "water", "heating"].forEach((key) => {
    utilitiesStatuses[key] = row.utilitiesIncluded === true ? "included" : "ask_landlord";
  });
  utilitiesStatuses.internet = row.internetIncluded === true ? "included" : "ask_landlord";

  return {
    user_id: ownerId,
    title: generateListingTitle(row),
    city: listingCity,
    location: listingCity,
    campus: "",
    address_line: listingAddress,
    unit: row.unit || "",
    province: listingProvince,
    postal_code: row.postalCode || "",
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
