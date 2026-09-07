import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildDraftListingPayload,
  dedupeImportRows,
  detectImportFormat,
  ENRICHED_IMPORT_HEADERS,
  fingerprintImportRow,
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
  assert.match(commitRouteSource, /\.upload\(storagePath, buffer/);
  assert.match(commitRouteSource, /\.getPublicUrl\(storagePath\)/);
  assert.match(commitRouteSource, /\.from\("listing_images"\)\.insert\(uploadedRows\)/);
  assert.match(commitRouteSource, /sort_order: index/);
  assert.match(commitRouteSource, /is_cover: index === 0/);
  assert.match(commitRouteSource, /imageAssignments\?\.\[row\.fingerprint\]/);
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
