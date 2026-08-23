import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const postPageSource = readFileSync(
  new URL("../app/post/page.tsx", import.meta.url),
  "utf8"
);
const publishRouteSource = readFileSync(
  new URL("../app/api/listings/publish/route.ts", import.meta.url),
  "utf8"
);
const duplicateRouteSource = readFileSync(
  new URL("../app/api/listings/[id]/duplicate/route.ts", import.meta.url),
  "utf8"
);
const dashboardSource = readFileSync(
  new URL("../app/my-listings/page.tsx", import.meta.url),
  "utf8"
);

test("landlord posting flow is a focused step-by-step listing wizard", () => {
  [
    "Property basics",
    "Location",
    "Photos",
    "Property details",
    "Amenities",
    "Additional rental details",
    "Review & publish",
  ].forEach((label) => assert.match(postPageSource, new RegExp(label)));

  assert.match(postPageSource, /Save & Exit/);
  assert.match(postPageSource, /Post another property/);
  assert.match(postPageSource, /STORAGE_KEY = "travel-markets-post-listing-wizard-v2"/);
});

test("listing wizard uses full address geocoding, Mapbox autocomplete, and centralized campuses", () => {
  assert.match(postPageSource, /geocodeListingAddressWithMapbox/);
  assert.match(postPageSource, /autocomplete/);
  assert.match(postPageSource, /country", "ca"/);
  assert.match(postPageSource, /campusOptions/);
  assert.match(postPageSource, /selectCampus/);
});

test("listing wizard does not reintroduce per-listing document verification", () => {
  assert.doesNotMatch(postPageSource, /listing_document_requirements/);
  assert.match(
    postPageSource,
    /Publishing uses account-level landlord verification\./
  );
  assert.doesNotMatch(publishRouteSource, /livingArrangementComplete/);
  assert.doesNotMatch(publishRouteSource, /fair_housing_acknowledged[^:]/);
});

test("duplicate listing action creates only a new draft listing", () => {
  assert.match(dashboardSource, /DuplicateListingButton/);
  assert.match(duplicateRouteSource, /status: "draft"/);
  assert.match(duplicateRouteSource, /creation_idempotency_key/);
  [
    "inquiries",
    "messages",
    "viewings",
    "listing_verifications",
    "boost_redemption",
  ].forEach((forbiddenTable) =>
    assert.doesNotMatch(duplicateRouteSource, new RegExp(`\\.from\\("${forbiddenTable}"\\)`))
  );
});
