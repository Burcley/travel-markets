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
const editListingSource = readFileSync(
  new URL("../app/listings/[id]/edit/page.tsx", import.meta.url),
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
  assert.match(postPageSource, /Step \{draft\.activeStep \+ 1\} of \{steps\.length\}/);
  assert.match(postPageSource, /progressPercent/);
});

test("listing wizard footer has a clear primary and secondary action hierarchy", () => {
  assert.match(postPageSource, /border border-transparent bg-transparent[\s\S]*Back/);
  assert.match(postPageSource, /border border-white\/15 bg-white\/\[0\.04\][\s\S]*Save & Exit/);
  assert.match(postPageSource, /bg-\[#FF2E72\][\s\S]*Continue/);
  assert.match(postPageSource, /bg-\[#FF2E72\][\s\S]*Publish listing/);
  assert.doesNotMatch(postPageSource, /Publish Listing/);
  assert.match(postPageSource, /env\(safe-area-inset-bottom\)/);
});

test("listing wizard uses full address geocoding, Mapbox autocomplete, and centralized campuses", () => {
  assert.match(postPageSource, /geocodeListingAddressWithMapbox/);
  assert.match(postPageSource, /autocomplete/);
  assert.match(postPageSource, /country", "ca"/);
  assert.match(postPageSource, /campusOptions/);
  assert.match(postPageSource, /selectCampus/);
  assert.match(postPageSource, /onKeyDown/);
});

test("location autocomplete suggestions are visible and scrollable", () => {
  assert.match(postPageSource, /overflow-visible rounded-\[2rem\]/);
  assert.match(postPageSource, /z-\[60\]/);
  assert.match(postPageSource, /max-h-\[300px\]/);
  assert.match(postPageSource, /overflow-y-auto/);
  assert.match(postPageSource, /overscroll-contain/);
  assert.match(postPageSource, /cursor-pointer/);
});

test("location autocomplete uses premium shared result rows and empty state", () => {
  assert.match(postPageSource, /function SuggestionRow/);
  assert.match(postPageSource, /role="listbox"/);
  assert.match(postPageSource, /role="option"/);
  assert.match(postPageSource, /aria-selected/);
  assert.match(postPageSource, /min-h-\[68px\]/);
  assert.match(postPageSource, /rounded-\[18px\]/);
  assert.match(postPageSource, /shadow-\[0_24px_70px_rgba\(0,0,0,0\.55\)\]/);
  assert.match(postPageSource, /Search university or campus/);
  assert.match(postPageSource, /tag="Campus"/);
  assert.match(postPageSource, /No campuses found/);
  assert.match(postPageSource, /Try another university, campus, or city\./);
  assert.match(postPageSource, /Clear \$\{label\}/);
});

test("location autocomplete selection and keyboard handling stay functional", () => {
  assert.match(postPageSource, /ArrowDown/);
  assert.match(postPageSource, /ArrowUp/);
  assert.match(postPageSource, /setCampusSearchOpen\(false\)/);
  assert.match(postPageSource, /chooseCampus/);
  assert.match(postPageSource, /selectAddressSuggestion\(addressSuggestions\[selectedAddressIndex\]\)/);
  assert.match(postPageSource, /patchDraft\(\{ city: matchingCities\[selectedCityIndex\] \}\)/);
  assert.match(postPageSource, /SuggestionRow[\s\S]*Verified address result/);
  assert.match(postPageSource, /SuggestionRow[\s\S]*Ontario city/);
});

test("optional listing details are presented as collapsible sections", () => {
  assert.match(postPageSource, /CollapsibleSection/);
  assert.match(postPageSource, /Add amenities/);
  assert.match(postPageSource, /Add lease and living arrangement details/);
});

test("edit listing uses direct section navigation instead of a sequential wizard", () => {
  [
    "Basics",
    "Location",
    "Photos",
    "Property details",
    "Amenities",
    "Rental details",
  ].forEach((label) => assert.match(editListingSource, new RegExp(label)));

  assert.match(editListingSource, /type EditSectionId/);
  assert.match(editListingSource, /EditSectionNav/);
  assert.match(editListingSource, /scrollIntoView/);
  assert.doesNotMatch(editListingSource, /activeStep/);
  assert.doesNotMatch(editListingSource, /goNext/);
  assert.doesNotMatch(editListingSource, />\s*Continue\s*</);
});

test("edit listing preserves optional data in collapsed editable sections", () => {
  assert.match(editListingSource, /EditOptionalSection/);
  assert.match(editListingSource, /const \[open, setOpen\] = useState\(false\)/);
  assert.match(editListingSource, /Additional rental details/);
  assert.match(editListingSource, /Application requirements/);
  assert.match(editListingSource, /Living arrangement/);
  assert.match(editListingSource, /Parking details/);
  assert.match(editListingSource, /RequirementEditor/);
});

test("edit listing save and status panels use production-safe operational UI", () => {
  assert.match(editListingSource, /Edit listing/);
  assert.match(editListingSource, /ListingOperationalStatusPanel/);
  assert.match(editListingSource, /Listing operations/);
  assert.match(editListingSource, /Visible in search/);
  assert.match(editListingSource, /ListingCompletionProgress/);
  assert.match(editListingSource, /bg-\[#FF2E72\][\s\S]*t\("saveChanges"\)/);
  assert.doesNotMatch(editListingSource, /bg-blue-600/);
});

test("listing wizard does not reintroduce per-listing document verification", () => {
  assert.doesNotMatch(postPageSource, /listing_document_requirements/);
  assert.match(
    postPageSource,
    /Publishing uses account-level landlord verification\./
  );
  assert.match(publishRouteSource, /getLandlordAccountEligibility/);
  assert.match(publishRouteSource, /verification_submissions/);
  assert.doesNotMatch(publishRouteSource, /listing_verifications/);
  assert.doesNotMatch(publishRouteSource, /listing_verification_audit_events/);
  assert.doesNotMatch(
    publishRouteSource,
    /We could not save your verification details/
  );
  assert.doesNotMatch(publishRouteSource, /livingArrangementComplete/);
  assert.doesNotMatch(publishRouteSource, /fair_housing_acknowledged[^:]/);
});

test("publish failures use listing or account-level verification messages only", () => {
  assert.match(
    publishRouteSource,
    /We couldn't publish your listing\. Please try again\./
  );
  assert.match(
    publishRouteSource,
    /Complete landlord verification to publish listings\./
  );
  assert.match(publishRouteSource, /verificationUrl: "\/dashboard\/verification"/);
  assert.match(
    postPageSource,
    /The listing was saved as a draft, but could not be published\./
  );
});

test("successful publish clears the completed wizard session", () => {
  assert.match(postPageSource, /function clearCompletedListingSession/);
  assert.match(
    postPageSource,
    /clearCompletedListingSession\(listingId\)/
  );
  assert.match(
    postPageSource,
    /window\.localStorage\.removeItem\(STORAGE_KEY\)[\s\S]*setDraft\(defaultDraftState\(\)\)/
  );
  assert.match(postPageSource, /setAddressSuggestions\(\[\]\)/);
  assert.match(postPageSource, /setAddressSearchOpen\(false\)/);
  assert.match(postPageSource, /setCampusQuery\(""\)/);
  assert.match(postPageSource, /setCityQuery\(""\)/);
  assert.match(postPageSource, /setPublishedId\(listingId\)/);
});

test("publish failure preserves draft data and temporary photos for retry", () => {
  assert.match(
    postPageSource,
    /if \(!response\.ok\) \{[\s\S]*setFormError\([\s\S]*return;[\s\S]*\}/
  );
  assert.match(
    postPageSource,
    /await uploadPhotos\(listingId, false\);[\s\S]*clearCompletedListingSession\(listingId\)/
  );
  assert.doesNotMatch(
    postPageSource,
    /await uploadPhotos\(listingId\);[\s\S]*if \(mode === "publish"\)/
  );
});

test("missing or non-editable server drafts are recovered before publish", () => {
  assert.match(postPageSource, /function persistActiveDraft/);
  assert.match(postPageSource, /function createDraftListing/);
  assert.match(postPageSource, /\.select\("id, status"\)/);
  assert.match(postPageSource, /\.eq\("status", "draft"\)/);
  assert.match(postPageSource, /setSaveStatus\("Restoring your listing\.\.\."\)/);
  assert.match(
    postPageSource,
    /creationIdempotencyKey: draft\.listingId[\s\S]*crypto\.randomUUID\(\)[\s\S]*draft\.creationIdempotencyKey/
  );
  assert.match(
    postPageSource,
    /patchDraft\(\{[\s\S]*listingId,[\s\S]*creationIdempotencyKey: persistedDraft\.creationIdempotencyKey/
  );
  assert.doesNotMatch(postPageSource, /\.update\(payload\)[\s\S]*\.eq\("user_id", user\.id\);/);
});

test("stale listing not found responses are recoverable user-facing publish errors", () => {
  assert.match(
    postPageSource,
    /data\?\.error === "Listing not found"[\s\S]*We couldn't confirm this draft\. Please try publishing again\./
  );
  assert.match(
    postPageSource,
    /data\?\.error \|\| "The listing was saved as a draft, but could not be published\."/
  );
});

test("fresh listing sessions reset photos, campus, address, step, and idempotency state", () => {
  assert.match(postPageSource, /creationIdempotencyKey: crypto\.randomUUID\(\)/);
  assert.match(postPageSource, /activeStep: 0/);
  assert.match(postPageSource, /listingId: null/);
  assert.match(postPageSource, /selectedAmenities: \[\]/);
  assert.match(postPageSource, /nearestCampusName: ""/);
  assert.match(postPageSource, /addressLine: ""/);
  assert.match(postPageSource, /function startAnotherProperty/);
  assert.match(postPageSource, /clearPhotoPreviewState\(\)/);
  assert.match(postPageSource, /URL\.revokeObjectURL\(photo\.url\)/);
  assert.match(
    postPageSource,
    /setPublishedId\(null\);[\s\S]*setDraft\(defaultDraftState\(\)\)/
  );
});

test("draft recovery remains tied to incomplete local wizard state", () => {
  assert.match(postPageSource, /function loadStoredDraft/);
  assert.match(postPageSource, /window\.localStorage\.getItem\(STORAGE_KEY\)/);
  assert.match(
    postPageSource,
    /if \(!hydrated \|\| publishedId\) return;[\s\S]*window\.localStorage\.setItem/
  );
  assert.match(postPageSource, /setSaveStatus\("Draft saved\."\)/);
  assert.match(postPageSource, /router\.push\("\/my-listings"\)/);
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
