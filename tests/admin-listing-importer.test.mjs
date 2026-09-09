import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  appendImageUploads,
  assignImageNamesToRow,
  suggestImageAssignmentsForRows,
} from "../lib/admin/listing-importer-images.mjs";
import {
  buildDraftListingPayload,
  collectAssignedImportImages,
  dedupeImportRows,
  detectImportFormat,
  ENRICHED_IMPORT_HEADERS,
  fingerprintImportRow,
  importButtonState,
  LANDLORD_IMPORT_HEADERS,
  LISTING_DRAFT_INSERT_COLUMNS,
  parseSpreadsheetBuffer,
  parseBoolean,
  parseCount,
  parseCurrency,
  rowsFromSheetJson,
  suggestImageMatches,
  validateEnrichedHeaders,
} from "../lib/admin/listing-importer-core.mjs";

const previewRouteSource = readFileSync(
  new URL("../app/api/admin/listings/import/preview/route.ts", import.meta.url),
  "utf8"
);
const commitRouteSource = readFileSync(
  new URL("../app/api/admin/listings/import/commit/route.ts", import.meta.url),
  "utf8"
);
const importerLocationSource = readFileSync(
  new URL("../lib/admin/listing-importer-location.ts", import.meta.url),
  "utf8"
);
const templateRouteSource = readFileSync(
  new URL("../app/api/admin/listings/import/template/route.ts", import.meta.url),
  "utf8"
);
const serverSource = readFileSync(
  new URL("../lib/admin/listing-importer-server.ts", import.meta.url),
  "utf8"
);
const importerPageSource = readFileSync(
  new URL("../app/admin/listings/import/page.tsx", import.meta.url),
  "utf8"
);
const importerClientSource = readFileSync(
  new URL("../app/admin/listings/import/ImportListingsClient.tsx", import.meta.url),
  "utf8"
);
const adminDashboardSource = readFileSync(
  new URL("../app/admin/page.tsx", import.meta.url),
  "utf8"
);
const migrationSource = readFileSync(
  new URL(
    "../supabase/migrations/20260907001000_admin_bulk_listing_imports.sql",
    import.meta.url
  ),
  "utf8"
);

function enrichedRow(overrides = {}) {
  return {
    Property: "Durham Student House",
    "Street Address": "112 Berthune Ave",
    City: "Oshawa",
    Province: "Ontario",
    "Postal Code": "L1H 2L8",
    "Rooms Available": "4",
    Unit: "Upper",
    "Rent CAD": "$2,800",
    Arrangement: "Group/Family",
    Gender: "N/A",
    Utilities: "Yes",
    Internet: "No",
    Available: "ASAP",
    "Total Rooms": "4",
    Baths: "4",
    "Listing Title": "Four-bedroom upper unit near campus",
    Description: "Bright upper unit for a student group.",
    "Source / Verification Notes": "Confirmed by landlord spreadsheet.",
    "Source URL": "https://example.com/source",
    ...overrides,
  };
}

function imageFile(name, size = 1024, lastModified = 1788800000000) {
  return {
    name,
    size,
    lastModified,
    type: "image/jpeg",
  };
}

function importableRows(count = 9) {
  return Array.from({ length: count }, (_, index) => ({
    fingerprint: `row-${index + 1}`,
    property: `Property ${index + 1}`,
    rent: 1200 + index,
    warnings: [],
  }));
}

function enabledImportState(overrides = {}) {
  const rows = overrides.rows || importableRows(9);
  return importButtonState({
    selectedLandlord: { id: "landlord-user-id" },
    preview: { sourceFilename: "enriched.xlsx" },
    rows,
    selectedFingerprints: rows.map((row) => row.fingerprint),
    importing: false,
    ...overrides,
  });
}

function enrichedWorkbookRows() {
  return [
    ENRICHED_IMPORT_HEADERS,
    [
      "Durham Student House",
      "112 Berthune Ave",
      "Oshawa",
      "Ontario",
      "L1H 2L8",
      "4",
      "Upper",
      "$2,800",
      "Group/Family",
      "N/A",
      "Yes",
      "No",
      "ASAP",
      "4",
      "4",
      "Four-bedroom upper unit near campus",
      "Bright upper unit for a student group.",
      "Confirmed by landlord spreadsheet.",
      "https://example.com/source-1",
    ],
    [
      "North Oshawa Rooms",
      "55 Thornton Rd S",
      "Oshawa",
      "ON",
      "L1J 5Y1",
      "2",
      "Main",
      "1600",
      "Individual",
      "Female",
      "No",
      "Yes",
      "September",
      "5",
      "2",
      "Two rooms close to Durham campus",
      "Two bright rooms with internet included.",
      "Landlord supplied lease notes.",
      "https://example.com/source-2",
    ],
    [
      "Simcoe Student Rental",
      "44 Simcoe St N",
      "Oshawa",
      "Ontario",
      "L1G 4S1",
      "1",
      "Basement",
      "$725",
      "Individual",
      "Male",
      "Yes",
      "Yes",
      "Available now",
      "3",
      "1",
      "Basement room near downtown Oshawa",
      "Compact basement room with utilities included.",
      "Imported from verified owner file.",
      "https://example.com/source-3",
    ],
    [
      "Whitby Upper",
      "12 Brock St N",
      "Whitby",
      "Ontario",
      "L1N 4H2",
      "3",
      "Upper",
      "$2400",
      "Group",
      "",
      "Yes",
      "No",
      "October",
      "3",
      "1.5",
      "Upper unit for three students",
      "Upper unit with three bedrooms and flexible move-in.",
      "Brokerage packet reviewed.",
      "https://example.com/source-4",
    ],
    [
      "Ajax Main Floor",
      "88 Harwood Ave S",
      "Ajax",
      "Ontario",
      "L1S 2H6",
      "2",
      "Main",
      "$1900",
      "Group/Family",
      "N/A",
      "No",
      "No",
      "November",
      "2",
      "1",
      "Main floor rental in Ajax",
      "Main floor rental with two rooms available.",
      "Owner spreadsheet notes.",
      "https://example.com/source-5",
    ],
    [
      "Scarborough Student Suite",
      "1265 Military Trail",
      "Toronto",
      "Ontario",
      "M1C 1A4",
      "5",
      "Lower",
      "$3500",
      "Group",
      "",
      "Yes",
      "Yes",
      "January",
      "5",
      "2",
      "Five-room student suite",
      "Large suite suitable for a group.",
      "Campus-adjacent owner note.",
      "https://example.com/source-6",
    ],
    [
      "Peterborough Rooms",
      "1600 West Bank Dr",
      "Peterborough",
      "Ontario",
      "K9L 0G2",
      "2",
      "Upper",
      "$1500",
      "Individual",
      "",
      "Yes",
      "Yes",
      "May",
      "4",
      "2",
      "Student rooms in Peterborough",
      "Two rooms available in a shared student property.",
      "Verification source note.",
      "https://example.com/source-7",
    ],
    [
      "Hamilton Group Rental",
      "1280 Main St W",
      "Hamilton",
      "Ontario",
      "L8S 4L8",
      "4",
      "Main",
      "$3200",
      "Group/Family",
      "",
      "No",
      "Yes",
      "August",
      "4",
      "2",
      "Group rental near McMaster",
      "Four-bedroom rental for a student group.",
      "Admin source note.",
      "https://example.com/source-8",
    ],
    [
      "Waterloo Student Home",
      "200 University Ave W",
      "Waterloo",
      "Ontario",
      "N2L 3G1",
      "6",
      "Main",
      "$4200",
      "Group",
      "",
      "Yes",
      "No",
      "July",
      "6",
      "3",
      "Six-room student home",
      "Large student home with six rooms available.",
      "Public source URL supplied.",
      "https://example.com/source-9",
    ],
  ];
}

async function workbookBufferFromRows(rows) {
  const XLSX = await import("xlsx");
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, worksheet, "Listings");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}

test("admin importer detects enriched header spreadsheets and validates required columns", () => {
  const rows = [enrichedRow()];

  assert.equal(detectImportFormat(rows), "enriched");
  assert.deepEqual(validateEnrichedHeaders(rows), {
    valid: true,
    missingHeaders: [],
  });

  const malformed = [
    {
      Property: "Durham Student House",
      "Street Address": "112 Berthune Ave",
      City: "Oshawa",
      Province: "Ontario",
      "Rent CAD": "$2,800",
    },
  ];

  assert.equal(detectImportFormat(malformed), "enriched");
  assert.equal(validateEnrichedHeaders(malformed).valid, false);
  assert.deepEqual(validateEnrichedHeaders(malformed).missingHeaders, [
    "Postal Code",
    "Rooms Available",
    "Total Rooms",
    "Baths",
    "Listing Title",
    "Description",
  ]);
});

test("real enriched XLSX preview parser detects header row and maps all enriched fields", async () => {
  const buffer = await workbookBufferFromRows(enrichedWorkbookRows());
  const preview = await parseSpreadsheetBuffer({
    buffer,
    fileName: "enriched-import.xlsx",
    useTemplateOrder: true,
  });
  const first = preview.uniqueRows[0];

  assert.equal(preview.importFormat, "enriched");
  assert.equal(preview.sourceRows.length, 9);
  assert.equal(preview.summary.rowsDetected, 9);
  assert.equal(preview.summary.uniqueRows, 9);
  assert.equal(preview.uniqueRows.length, 9);
  assert.equal(preview.uniqueRows.some((row) => row.property === "Property"), false);
  assert.equal(first.property, "Durham Student House");
  assert.equal(first.streetAddress, "112 Berthune Ave");
  assert.equal(first.city, "Oshawa");
  assert.equal(first.province, "Ontario");
  assert.equal(first.postalCode, "L1H 2L8");
  assert.equal(first.roomsAvailable, 4);
  assert.equal(first.rent, 2800);
  assert.equal(first.totalRooms, 4);
  assert.equal(first.bathrooms, 4);
  assert.equal(first.listingTitle, "Four-bedroom upper unit near campus");
  assert.equal(first.description, "Bright upper unit for a student group.");
  assert.equal(first.sourceVerificationNotes, "Confirmed by landlord spreadsheet.");
  assert.equal(first.sourceUrl, "https://example.com/source-1");

  const payload = buildDraftListingPayload({
    ownerId: "landlord-user-id",
    row: first,
  });

  assert.equal(payload.address_line, "112 Berthune Ave");
  assert.equal(payload.city, "Oshawa");
  assert.equal(payload.province, "Ontario");
  assert.equal(payload.postal_code, "L1H 2L8");
  assert.equal(payload.title, "Four-bedroom upper unit near campus");
  assert.equal(payload.description, "Bright upper unit for a student group.");
  assert.equal("sourceVerificationNotes" in payload, false);
  assert.equal("sourceUrl" in payload, false);
});

test("real legacy no-header XLSX remains supported through the preview parser", async () => {
  const buffer = await workbookBufferFromRows([
    [
      "397 First Ave",
      "3 Rooms",
      "Basement",
      1700,
      "Group/Family",
      "N/A",
      "Yes",
      "Yes",
      "ASAP",
      "3 Rooms",
      "1 Bath",
    ],
    [
      "399 First Ave",
      "1 Room",
      "Upper",
      800,
      "Individual",
      "Female",
      "No",
      "Yes",
      "September",
      "4 Rooms",
      "2 Baths",
    ],
  ]);
  const preview = await parseSpreadsheetBuffer({
    buffer,
    fileName: "legacy-template.xlsx",
    useTemplateOrder: true,
  });

  assert.equal(preview.importFormat, "legacy-template");
  assert.equal(preview.summary.rowsDetected, 2);
  assert.equal(preview.summary.uniqueRows, 2);
  assert.equal(preview.uniqueRows[0].property, "397 First Ave");
  assert.equal(preview.uniqueRows[0].rent, 1700);
  assert.equal(preview.uniqueRows[0].streetAddress, null);
  assert.deepEqual(LANDLORD_IMPORT_HEADERS.slice(0, 3), [
    "Property",
    "Rooms",
    "Up/Down?",
  ]);
});

test("bulk draft imports resolve route-ready campus fields with normal listing location helpers", () => {
  assert.match(commitRouteSource, /resolveImportedListingLocationFields/);
  assert.match(
    commitRouteSource,
    /\.insert\(\{ \.\.\.draftPayload, \.\.\.location\.fields \}\)/
  );
  assert.match(commitRouteSource, /Location resolution failed/);
  assert.match(importerLocationSource, /geocodeListingAddressWithMapbox/);
  assert.match(importerLocationSource, /campusOptions/);
  assert.match(importerLocationSource, /nearestRouteReadyCampus/);
  assert.match(importerLocationSource, /generatePublicCoordinate/);
  assert.match(importerLocationSource, /calculateDistanceKm/);
  assert.match(importerLocationSource, /estimateTravelTimes/);
  assert.match(importerLocationSource, /latitude: geocode\.latitude/);
  assert.match(importerLocationSource, /longitude: geocode\.longitude/);
  assert.match(importerLocationSource, /public_latitude: publicCoordinate\.latitude/);
  assert.match(importerLocationSource, /public_longitude: publicCoordinate\.longitude/);
  assert.match(importerLocationSource, /nearest_campus_name: nearest\.campus\.officialName/);
  assert.match(importerLocationSource, /nearest_campus_address: nearest\.campus\.address/);
  assert.match(importerLocationSource, /campus_id: nearest\.campus\.id/);
  assert.match(importerLocationSource, /campus_destination_label: nearest\.campus\.officialName/);
  assert.match(
    importerLocationSource,
    /campus_coordinate_source: "curated_campus_record"/
  );
  assert.match(importerLocationSource, /campus_latitude: nearest\.campus\.latitude/);
  assert.match(importerLocationSource, /campus_longitude: nearest\.campus\.longitude/);
  assert.match(importerLocationSource, /distance_to_campus_km: nearest\.distanceKm/);
  assert.match(importerLocationSource, /walking_time_minutes: travelTimes\.walking/);
  assert.match(importerLocationSource, /cycling_time_minutes: travelTimes\.cycling/);
  assert.match(importerLocationSource, /driving_time_minutes: travelTimes\.driving/);
  assert.match(importerLocationSource, /transit_time_minutes: travelTimes\.transit/);
});

test("header-like XLSX files do not silently fall back to legacy parsing", async () => {
  const buffer = await workbookBufferFromRows([
    ["Property", "Street Address", "City", "Rent CAD"],
    ["Incomplete Header Test", "1 Test St", "Oshawa", "$1000"],
  ]);

  await assert.rejects(
    () =>
      parseSpreadsheetBuffer({
        buffer,
        fileName: "bad-enriched-import.xlsx",
        useTemplateOrder: false,
      }),
    /missing required columns: Province, Postal Code, Rooms Available, Total Rooms, Baths, Listing Title, Description/
  );
});

test("enriched spreadsheet fields map to draft listing fields without public source metadata", () => {
  const { unique } = dedupeImportRows(rowsFromSheetJson([enrichedRow()]));
  const row = unique[0];

  assert.equal(row.importFormat, "enriched");
  assert.equal(row.property, "Durham Student House");
  assert.equal(row.streetAddress, "112 Berthune Ave");
  assert.equal(row.city, "Oshawa");
  assert.equal(row.province, "Ontario");
  assert.equal(row.postalCode, "L1H 2L8");
  assert.equal(row.roomsAvailable, 4);
  assert.equal(row.unit, "Upper");
  assert.equal(row.rent, 2800);
  assert.equal(row.arrangement, "Group/Family");
  assert.equal(row.genderPreference, null);
  assert.equal(row.utilitiesIncluded, true);
  assert.equal(row.internetIncluded, false);
  assert.equal(row.availability, "ASAP");
  assert.equal(row.totalRooms, 4);
  assert.equal(row.bathrooms, 4);
  assert.equal(row.listingTitle, "Four-bedroom upper unit near campus");
  assert.equal(row.description, "Bright upper unit for a student group.");
  assert.equal(row.sourceVerificationNotes, "Confirmed by landlord spreadsheet.");
  assert.equal(row.sourceUrl, "https://example.com/source");

  const payload = buildDraftListingPayload({
    ownerId: "landlord-user-id",
    row,
    city: "Fallback City",
    province: "Fallback Province",
  });

  assert.equal(payload.title, "Four-bedroom upper unit near campus");
  assert.equal(payload.description, "Bright upper unit for a student group.");
  assert.equal(payload.address_line, "112 Berthune Ave");
  assert.equal(payload.city, "Oshawa");
  assert.equal(payload.location, "Oshawa");
  assert.equal(payload.province, "Ontario");
  assert.equal(payload.postal_code, "L1H 2L8");
  assert.equal(payload.price, 2800);
  assert.equal(payload.bedrooms, 4);
  assert.equal(payload.bathrooms, 4);
  assert.equal(payload.roommates, 4);
  assert.equal(payload.status, "draft");
  assert.equal("sourceVerificationNotes" in payload, false);
  assert.equal("sourceUrl" in payload, false);
  assert.equal("Source / Verification Notes" in payload, false);
  assert.equal("Source URL" in payload, false);
});

test("admin importer normalizes spreadsheet values without guessing addresses", () => {
  assert.equal(parseCurrency("$1,700"), 1700);
  assert.equal(parseCurrency("N/A"), null);
  assert.equal(parseCount("3 rooms"), 3);
  assert.equal(parseCount("1.5 Baths"), 1.5);
  assert.equal(parseBoolean("Yes"), true);
  assert.equal(parseBoolean("No"), false);
  assert.equal(parseBoolean("N/A"), null);

  const rows = rowsFromSheetJson([
    {
      Property: "112 Berthune Ave",
      Rooms: "1 Room",
      "Up/Down?": "Basement",
      Rent: "$525",
      "Group/Individual?": "Individual",
      "Female/Male": "Female",
      Utilities: "Yes",
      Internet: "No",
      "Lease?": "September",
      "Total rooms": "7",
      Baths: "3",
    },
  ]);
  const { unique } = dedupeImportRows(rows);

  assert.equal(unique.length, 1);
  assert.equal(unique[0].property, "112 Berthune Ave");
  assert.equal(unique[0].rent, 525);
  assert.equal(unique[0].roomsAvailable, 1);
  assert.equal(unique[0].totalRooms, 7);
  assert.equal(unique[0].bathrooms, 3);
  assert.equal(unique[0].internetIncluded, false);
  assert.match(unique[0].warnings.join(" "), /Address likely incomplete/);
});

test("legacy no-header landlord template remains supported", () => {
  const sourceRows = rowsFromSheetJson(
    [
      [
        "397 First Ave",
        "3 Rooms",
        "Basement",
        1700,
        "Group/Family",
        "N/A",
        "Yes",
        "Yes",
        "ASAP",
        "3 Rooms",
        "1 Bath",
      ],
    ],
    { useTemplateOrder: true }
  );
  const { unique } = dedupeImportRows(sourceRows);

  assert.equal(detectImportFormat(sourceRows, { useTemplateOrder: true }), "legacy-template");
  assert.equal(unique.length, 1);
  assert.equal(unique[0].importFormat, "legacy-template");
  assert.equal(unique[0].property, "397 First Ave");
  assert.equal(unique[0].streetAddress, null);
  assert.equal(unique[0].rent, 1700);
  assert.equal(unique[0].roomsAvailable, 3);
});

test("admin importer removes exact duplicates and keeps complete address rows", () => {
  const sourceRows = rowsFromSheetJson([
    {
      Property: "112 Berthune Ave",
      Rooms: "1 Room",
      "Up/Down?": "Basement",
      Rent: "$525",
      "Total rooms": "7",
      Baths: "3",
    },
    {
      Property: "112 Berthune Ave",
      Rooms: "1 Room",
      "Up/Down?": "Basement",
      Rent: "$525",
      "Total rooms": "7",
      Baths: "3",
    },
    {
      Property: "23 Glenayr St",
      Rooms: "",
      "Up/Down?": "Basement",
      Rent: "",
      "Total rooms": "",
      Baths: "",
    },
    {
      Property: "23 Glenayr St",
      Rooms: "2",
      "Up/Down?": "Upper",
      Rent: "$1700",
      "Total rooms": "4",
      Baths: "2",
    },
  ]);

  const { unique, skipped } = dedupeImportRows(sourceRows);

  assert.equal(unique.length, 2);
  assert.equal(skipped.length, 2);
  assert.equal(
    unique.find((row) => row.property === "23 Glenayr St")?.rent,
    1700
  );
  assert.ok(skipped.some((item) => item.reason === "Duplicate row skipped."));
  assert.ok(
    skipped.some((item) =>
      item.reason.includes("Incomplete duplicate skipped")
    )
  );
});

test("draft listing payload uses selected landlord ownership and existing listing schema", () => {
  const row = dedupeImportRows(
    rowsFromSheetJson([
      {
        Property: "30 Trent Ave",
        Rooms: "1",
        "Up/Down?": "Main",
        Rent: "$725",
        "Group/Individual?": "Individual",
        Utilities: "Yes",
        Internet: "Yes",
        "Lease?": "Available now",
        "Total rooms": "7",
        Baths: "3",
      },
    ])
  ).unique[0];

  const payload = buildDraftListingPayload({
    ownerId: "landlord-user-id",
    row,
    city: "Oshawa",
    province: "Ontario",
  });

  assert.equal(payload.user_id, "landlord-user-id");
  assert.equal(payload.status, "draft");
  assert.equal(payload.address_line, "30 Trent Ave");
  assert.equal(payload.city, "Oshawa");
  assert.equal(payload.location, "Oshawa");
  assert.equal(payload.price, 725);
  assert.equal(payload.bedrooms, 7);
  assert.equal(payload.roommates, 1);
  assert.equal(payload.latitude, null);
  assert.equal(payload.longitude, null);
  assert.equal(payload.public_latitude, null);
  assert.equal(payload.public_longitude, null);
  assert.equal(
    payload.creation_idempotency_key,
    `admin-bulk-import:${row.fingerprint}`
  );
  assert.equal("updated_at" in payload, false);
  assert.deepEqual(
    Object.keys(payload).filter((key) => !LISTING_DRAFT_INSERT_COLUMNS.includes(key)),
    []
  );
  assert.equal(LISTING_DRAFT_INSERT_COLUMNS.includes("updated_at"), false);
});

test("import fingerprints are stable and image suggestions remain confirmable", () => {
  const row = {
    property: "112 Berthune Ave",
    unit: "Basement",
    rent: 525,
    roomsAvailable: 1,
    totalRooms: 7,
    bathrooms: 3,
  };

  assert.equal(fingerprintImportRow(row), fingerprintImportRow({ ...row }));

  const suggestions = suggestImageMatches(
    [{ ...row, fingerprint: "row-1" }],
    ["112-Berthune-Ave-front.jpg", "unrelated.jpg"]
  );

  assert.deepEqual(suggestions["row-1"], ["112-Berthune-Ave-front.jpg"]);
  assert.match(importerClientSource, /imageAssignments/);
  assert.match(importerClientSource, /ImageAssignmentBoard/);
  assert.match(importerClientSource, /Automatic filename matches are pre-filled/);
  assert.match(importerClientSource, /Unassigned images/);
  assert.match(importerClientSource, /Drop images here/);
  assert.match(importerClientSource, /Add image/);
  assert.match(importerClientSource, /URL\.createObjectURL/);
  assert.match(importerClientSource, /draggable/);
  assert.match(importerClientSource, /onDrop/);
  assert.doesNotMatch(importerClientSource, /placeholder="image-1.jpg, image-2.jpg"/);
});

test("image uploads append multiple property folders without replacing assignments", () => {
  const rows = [
    {
      fingerprint: "row-30-trent",
      property: "30 Trent",
      streetAddress: "30 Trent Ave",
    },
    {
      fingerprint: "row-23-glenayr",
      property: "23 Glenayr",
      streetAddress: "23 Glenayr St",
    },
    {
      fingerprint: "row-86-glendale",
      property: "86 Glendale",
      streetAddress: "86 Glendale Ave",
    },
  ];

  const firstBatch = appendImageUploads([], [
    imageFile("30-trent-front.jpg", 1000, 1),
    imageFile("30-trent-kitchen.jpg", 1001, 2),
    imageFile("30-trent-bedroom.jpg", 1002, 3),
    imageFile("30-trent-bath.jpg", 1003, 4),
  ]);
  let assignments = suggestImageAssignmentsForRows(
    rows,
    firstBatch.addedImages.map((image) => image.name),
    {}
  );

  const secondBatch = appendImageUploads(firstBatch.images, [
    imageFile("23-glenayr-front.jpg", 1100, 5),
    imageFile("23-glenayr-kitchen.jpg", 1101, 6),
    imageFile("23-glenayr-bedroom.jpg", 1102, 7),
    imageFile("23-glenayr-bath.jpg", 1103, 8),
  ]);
  assignments = suggestImageAssignmentsForRows(
    rows,
    secondBatch.addedImages.map((image) => image.name),
    assignments
  );

  const thirdBatch = appendImageUploads(secondBatch.images, [
    imageFile("86-glendale-front.jpg", 1200, 9),
    imageFile("86-glendale-kitchen.jpg", 1201, 10),
    imageFile("86-glendale-bedroom.jpg", 1202, 11),
    imageFile("86-glendale-bath.jpg", 1203, 12),
  ]);
  assignments = suggestImageAssignmentsForRows(
    rows,
    thirdBatch.addedImages.map((image) => image.name),
    assignments
  );

  const allImageNames = thirdBatch.images.map((image) => image.name);
  const assignedImageNames = new Set(Object.values(assignments).flat());
  const unassigned = allImageNames.filter((imageName) => !assignedImageNames.has(imageName));

  assert.equal(thirdBatch.images.length, 12);
  assert.deepEqual(assignments["row-30-trent"], [
    "30-trent-front.jpg",
    "30-trent-kitchen.jpg",
    "30-trent-bedroom.jpg",
    "30-trent-bath.jpg",
  ]);
  assert.deepEqual(assignments["row-23-glenayr"], [
    "23-glenayr-front.jpg",
    "23-glenayr-kitchen.jpg",
    "23-glenayr-bedroom.jpg",
    "23-glenayr-bath.jpg",
  ]);
  assert.deepEqual(assignments["row-86-glendale"], [
    "86-glendale-front.jpg",
    "86-glendale-kitchen.jpg",
    "86-glendale-bedroom.jpg",
    "86-glendale-bath.jpg",
  ]);
  assert.deepEqual(unassigned, []);
});

test("image upload workflow prevents exact duplicates and keeps same-named different files distinct", () => {
  const first = appendImageUploads([], [imageFile("front.jpg", 1000, 1)]);
  const duplicate = appendImageUploads(first.images, [
    imageFile("front.jpg", 1000, 1),
    imageFile("front.jpg", 1001, 2),
  ]);

  assert.equal(duplicate.duplicateCount, 1);
  assert.equal(duplicate.images.length, 2);
  assert.deepEqual(
    duplicate.images.map((image) => image.name),
    ["front.jpg", "front (2).jpg"]
  );
});

test("property-card image uploads assign generic filenames directly to the target row", () => {
  const rows = [
    {
      fingerprint: "row-30-trent",
      property: "30 Trent",
      streetAddress: "30 Trent Ave",
    },
    {
      fingerprint: "row-23-glenayr",
      property: "23 Glenayr",
      streetAddress: "23 Glenayr St",
    },
    {
      fingerprint: "row-86-glendale",
      property: "86 Glendale",
      streetAddress: "86 Glendale Ave",
    },
  ];

  const firstBatch = appendImageUploads([], [
    imageFile("IMG_001.jpg", 1000, 1),
    imageFile("IMG_002.jpg", 1001, 2),
  ]);
  let assignments = assignImageNamesToRow(
    {},
    "row-30-trent",
    firstBatch.addedImages.map((image) => image.name)
  );

  const secondBatch = appendImageUploads(firstBatch.images, [
    imageFile("photo1.jpg", 1002, 3),
    imageFile("photo2.jpg", 1003, 4),
  ]);
  assignments = assignImageNamesToRow(
    assignments,
    "row-23-glenayr",
    secondBatch.addedImages.map((image) => image.name)
  );

  const thirdBatch = appendImageUploads(secondBatch.images, [
    imageFile("DSC_1001.jpg", 1004, 5),
    imageFile("DSC_1002.jpg", 1005, 6),
  ]);
  assignments = assignImageNamesToRow(
    assignments,
    "row-86-glendale",
    thirdBatch.addedImages.map((image) => image.name)
  );

  const allImageNames = thirdBatch.images.map((image) => image.name);
  const assignedImageNames = new Set(Object.values(assignments).flat());
  const unassigned = allImageNames.filter((imageName) => !assignedImageNames.has(imageName));
  const filenameGuesses = suggestImageAssignmentsForRows(rows, allImageNames, {});

  assert.deepEqual(assignments["row-30-trent"], ["IMG_001.jpg", "IMG_002.jpg"]);
  assert.deepEqual(assignments["row-23-glenayr"], ["photo1.jpg", "photo2.jpg"]);
  assert.deepEqual(assignments["row-86-glendale"], ["DSC_1001.jpg", "DSC_1002.jpg"]);
  assert.deepEqual(unassigned, []);
  assert.deepEqual(filenameGuesses, {});
});

test("import button stays enabled for valid drafts with all, partial, zero, or unassigned images", () => {
  const rows = importableRows(9);
  const allImagesAssigned = Object.fromEntries(
    rows.map((row, index) => [row.fingerprint, [`property-${index + 1}.jpg`]])
  );
  const partialImagesAssigned = {
    "row-1": ["30-trent-front.jpg"],
    "row-2": ["23-glenayr-front.jpg"],
  };
  const noImagesAssigned = {};
  const unassignedImagesPresent = {
    ...partialImagesAssigned,
    unassignedImageNames: ["unknown-room.jpg"],
  };

  assert.equal(enabledImportState({ rows, imageAssignments: allImagesAssigned }).disabled, false);
  assert.equal(enabledImportState({ rows, imageAssignments: partialImagesAssigned }).disabled, false);
  assert.equal(enabledImportState({ rows, imageAssignments: noImagesAssigned }).disabled, false);
  assert.equal(enabledImportState({ rows, imageAssignments: unassignedImagesPresent }).disabled, false);
});

test("import button explains disabled states without using image count as a blocker", () => {
  const rows = importableRows(2);

  assert.deepEqual(
    importButtonState({
      selectedLandlord: null,
      preview: { sourceFilename: "enriched.xlsx" },
      rows,
      selectedFingerprints: rows.map((row) => row.fingerprint),
    }),
    {
      disabled: true,
      reason: "Select a landlord first.",
      selectedValidRows: [],
      blockingErrorCount: 0,
    }
  );

  assert.deepEqual(
    importButtonState({
      selectedLandlord: { id: "landlord-user-id" },
      preview: null,
      rows,
      selectedFingerprints: rows.map((row) => row.fingerprint),
    }),
    {
      disabled: true,
      reason: "Parse and preview a spreadsheet first.",
      selectedValidRows: [],
      blockingErrorCount: 0,
    }
  );

  assert.equal(
    importButtonState({
      selectedLandlord: { id: "landlord-user-id" },
      preview: { sourceFilename: "enriched.xlsx" },
      rows,
      selectedFingerprints: [],
    }).reason,
    "No valid listings selected."
  );

  assert.equal(
    importButtonState({
      selectedLandlord: { id: "landlord-user-id" },
      preview: { sourceFilename: "enriched.xlsx" },
      rows: [{ ...rows[0], rent: null }],
      selectedFingerprints: [rows[0].fingerprint],
    }).reason,
    "No valid listings selected."
  );

  assert.equal(
    importButtonState({
      selectedLandlord: { id: "landlord-user-id" },
      preview: { sourceFilename: "enriched.xlsx" },
      rows: [rows[0], { ...rows[1], rent: null }],
      selectedFingerprints: rows.map((row) => row.fingerprint),
    }).reason,
    "Resolve 1 blocking validation error."
  );

  assert.equal(enabledImportState({ importing: true }).reason, "Import already in progress.");
});

test("commit payload sends JSON metadata instead of image binaries", () => {
  const rows = importableRows(3);
  const assignedImages = collectAssignedImportImages({
    rows,
    imageAssignments: {
      "row-1": ["30-trent-front.jpg", "30-trent-room.jpg"],
      "row-2": [],
      "row-3": ["86-glendale-front.jpg"],
      unknown: ["unused.jpg"],
    },
    imageFiles: [
      imageFile("30-trent-front.jpg", 1000, 1),
      imageFile("30-trent-room.jpg", 1001, 2),
      imageFile("86-glendale-front.jpg", 1002, 3),
      imageFile("unassigned.jpg", 1003, 4),
    ],
  });

  assert.deepEqual(
    assignedImages.map((image) => ({
      rowFingerprint: image.rowFingerprint,
      imageName: image.imageName,
      sortOrder: image.sortOrder,
      isCover: image.isCover,
    })),
    [
      {
        rowFingerprint: "row-1",
        imageName: "30-trent-front.jpg",
        sortOrder: 0,
        isCover: true,
      },
      {
        rowFingerprint: "row-1",
        imageName: "30-trent-room.jpg",
        sortOrder: 1,
        isCover: false,
      },
      {
        rowFingerprint: "row-3",
        imageName: "86-glendale-front.jpg",
        sortOrder: 0,
        isCover: true,
      },
    ]
  );
  assert.doesNotMatch(importerClientSource, /formData\.append\("images"/);
  assert.match(importerClientSource, /"Content-Type": "application\/json"/);
  assert.match(importerClientSource, /uploadToSignedUrl/);
  assert.match(commitRouteSource, /createSignedUploadUrl/);
  assert.match(commitRouteSource, /action === "finalizeImages"/);
});

test("admin image picker UI advertises additive batches and remove-all reset", () => {
  assert.match(importerClientSource, /appendImageUploads/);
  assert.match(importerClientSource, /assignImageNamesToRow/);
  assert.match(importerClientSource, /suggestImageAssignmentsForRows/);
  assert.match(importerClientSource, /Add More Images/);
  assert.match(importerClientSource, /Add Images/);
  assert.match(importerClientSource, /Remove All Images/);
  assert.match(importerClientSource, /imagePickerRef/);
  assert.match(importerClientSource, /onAddImagesToRow/);
  assert.match(importerClientSource, /event\.dataTransfer\.files/);
  assert.match(importerClientSource, /imageFiles:/);
  assert.match(importerClientSource, /importState\.disabled/);
  assert.match(importerClientSource, /importState\.reason/);
  assert.doesNotMatch(importerClientSource, /setPreview\(null\);\n\s*setReport\(null\);\n\s*setImageAssignments\(\{\}\);/);
});

test("import endpoints require admin authorization and never trust frontend ownership", () => {
  assert.match(previewRouteSource, /requireImportAdmin\(\)/);
  assert.match(commitRouteSource, /requireImportAdmin\(\)/);
  assert.match(serverSource, /supabase\.auth\.getUser\(\)/);
  assert.match(serverSource, /createAdminClient\(\)/);
  assert.match(serverSource, /profile\?\.is_admin \|\| profile\?\.role === "admin"/);
  assert.match(serverSource, /banned", "suspended", "disabled"/);
  assert.match(commitRouteSource, /isLandlordProfile\(ownerProfile\)/);
  assert.match(commitRouteSource, /owner_id: ownerId/);
  assert.match(commitRouteSource, /user_id", ownerId/);
  assert.match(commitRouteSource, /buildDraftListingPayload/);
  assert.match(
    readFileSync(
      new URL("../lib/admin/listing-importer-core.mjs", import.meta.url),
      "utf8"
    ),
    /status: "draft"/
  );
});

test("commit route is idempotent per landlord and records audit metadata", () => {
  assert.match(commitRouteSource, /admin-bulk-import:\$\{row\.fingerprint\}/);
  assert.match(commitRouteSource, /\.eq\("user_id", ownerId\)/);
  assert.match(commitRouteSource, /\.eq\("creation_idempotency_key", idempotencyKey\)/);
  assert.match(commitRouteSource, /listing_import_batches/);
  assert.match(commitRouteSource, /listing_import_rows/);
  assert.match(commitRouteSource, /admin_audit_logs/);
  assert.match(commitRouteSource, /listing\.bulk_imported/);
});

test("committed image assignments use existing listing image storage and table", () => {
  assert.match(commitRouteSource, /\.from\("listing-images"\)/);
  assert.match(commitRouteSource, /\.createSignedUploadUrl\(storagePath\)/);
  assert.match(commitRouteSource, /\.getPublicUrl\(storagePath\)/);
  assert.match(commitRouteSource, /\.from\("listing_images"\)\s*\n\s*\.insert\(rows\)/);
  assert.match(commitRouteSource, /sort_order: image\.sortOrder/);
  assert.match(commitRouteSource, /is_cover: image\.isCover/);
  assert.match(commitRouteSource, /collectAssignedImportImages/);
  assert.match(commitRouteSource, /IMPORT_IMAGE_FINALIZE_FORBIDDEN/);
});

test("enriched preview UI exposes editable fields and admin-only metadata", () => {
  assert.match(importerClientSource, /Street address/);
  assert.match(importerClientSource, /Postal code/);
  assert.match(importerClientSource, /Title/);
  assert.match(importerClientSource, /Description/);
  assert.match(importerClientSource, /Admin source notes/);
  assert.match(importerClientSource, /Source URL/);
  assert.match(importerClientSource, /streetAddress: value \|\| null/);
  assert.match(importerClientSource, /postalCode: value \|\| null/);
  assert.match(importerClientSource, /listingTitle: value \|\| null/);
  assert.match(importerClientSource, /sourceVerificationNotes: value \|\| null/);
  assert.match(importerClientSource, /sourceUrl: value \|\| null/);
  assert.match(templateRouteSource, /ENRICHED_IMPORT_HEADERS/);
  assert.equal(ENRICHED_IMPORT_HEADERS.includes("Source / Verification Notes"), true);
  assert.equal(ENRICHED_IMPORT_HEADERS.includes("Source URL"), true);
});

test("import migration preserves normal listing tables and adds audit tables only", () => {
  assert.match(migrationSource, /create table if not exists public\.listing_import_batches/);
  assert.match(migrationSource, /create table if not exists public\.listing_import_rows/);
  assert.match(migrationSource, /references public\.listings\(id\) on delete set null/);
  assert.match(migrationSource, /references public\.profiles\(id\) on delete restrict/);
  assert.match(migrationSource, /enable row level security/);
  assert.match(migrationSource, /public\.current_user_is_admin\(\)/);
  assert.doesNotMatch(migrationSource, /drop table/i);
  assert.doesNotMatch(migrationSource, /delete from public\.listings/i);
});

test("admin import UI is reachable from admin dashboard and stays preview-first", () => {
  assert.match(adminDashboardSource, /href="\/admin\/listings\/import"/);
  assert.match(adminDashboardSource, /Import Listings/);
  assert.match(importerPageSource, /redirect\("\/dashboard"\)/);
  assert.match(importerPageSource, /property_relationship/);
  assert.match(importerClientSource, /No listings have been created yet/);
  assert.match(importerClientSource, /Parse and Preview/);
  assert.match(importerClientSource, /Import Valid Listings as Drafts/);
  assert.match(importerClientSource, /Create \$\{selected\.length\} draft listing/);
});
