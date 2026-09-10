import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const pageSource = readFileSync("app/brock/page.tsx", "utf8");
const clientSource = readFileSync(
  "components/brock/BrockLandingClient.tsx",
  "utf8"
);
const searchLinkSource = readFileSync("lib/brock/search-links.ts", "utf8");
const analyticsSource = readFileSync("lib/brock/analytics.ts", "utf8");
const adminDashboardSource = readFileSync("app/admin/page.tsx", "utf8");
const homePageSource = readFileSync("app/page.tsx", "utf8");
const heroSource = readFileSync("components/home/HeroSection.tsx", "utf8");
const campusDiscoverySource = readFileSync(
  "components/home/CampusDiscovery.tsx",
  "utf8"
);
const campusDiscoveryHelperSource = readFileSync(
  "lib/campus-discovery.ts",
  "utf8"
);
const navbarSource = readFileSync("components/Navbar.tsx", "utf8");
const searchExperienceSource = readFileSync(
  "components/home/TravelMarketsHome.tsx",
  "utf8"
);
const migrationSource = readFileSync(
  "supabase/migrations/20260910001000_brock_acquisition_events.sql",
  "utf8"
);

test("Brock landing page uses real public listing search data", () => {
  assert.match(pageSource, /import \{ searchListings \}/);
  assert.match(pageSource, /searchListings\(\{/);
  assert.doesNotMatch(pageSource, /Founding E2E Listing/);
  assert.doesNotMatch(pageSource, /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  assert.match(pageSource, /Student Housing Near Brock University/);
});

test("Brock search and map CTAs use existing search route filters", () => {
  assert.match(searchLinkSource, /city: "St\. Catharines"/);
  assert.match(searchLinkSource, /campus: "Brock"/);
  assert.match(searchLinkSource, /return `\/search\?\$\{params\.toString\(\)\}`/);
  assert.match(searchLinkSource, /view: "map"/);
  assert.doesNotMatch(searchLinkSource, /\/api\/.*search/);
});

test("Brock page tracks the requested acquisition events", () => {
  [
    "brock_page_view",
    "brock_listing_impression",
    "brock_listing_click",
    "brock_search_started",
    "brock_search_completed",
    "brock_signup_started",
    "brock_signup_completed",
    "brock_listing_saved",
    "brock_message_started",
    "brock_inquiry_sent",
    "brock_viewing_requested",
    "brock_saved_search_created",
  ].forEach((eventName) => {
    assert.match(analyticsSource, new RegExp(`"${eventName}"`));
    assert.match(migrationSource, new RegExp(`'${eventName}'`));
  });

  assert.match(clientSource, /navigator\.sendBeacon/);
  assert.match(clientSource, /utm_source/);
  assert.match(clientSource, /sessionStorage/);
});

test("Brock saved search uses existing saved-search endpoint and auth flow", () => {
  assert.match(clientSource, /fetch\("\/api\/saved-searches"/);
  assert.match(clientSource, /response\.status === 401/);
  assert.match(clientSource, /\/auth\?next=\/brock/);
  assert.match(clientSource, /tm_after_auth_redirect/);
});

test("Brock admin analytics extends the existing admin dashboard", () => {
  assert.match(adminDashboardSource, /Brock Acquisition/);
  assert.match(adminDashboardSource, /\/api\/admin\/analytics\/brock/);
  assert.match(adminDashboardSource, /Visitors|page view|Funnel/i);
  assert.match(migrationSource, /create table if not exists public\.brock_acquisition_events/);
  assert.match(migrationSource, /enable row level security/);
});

test("homepage exposes Brock within one campus-selection action", () => {
  assert.match(homePageSource, /<Hero brockAvailableCount=\{brockResult\.count \|\| null\}/);
  assert.match(heroSource, /Find housing near your school|CampusDiscovery/);
  assert.match(campusDiscoverySource, /Search university or campus/);
  assert.match(campusDiscoverySource, /router\.push\(campus\.destination\)/);
  assert.match(campusDiscoveryHelperSource, /institutionId === "brock-university"\) return "\/brock"/);
  assert.doesNotMatch(campusDiscoveryHelperSource, /\/campus\//);
});

test("homepage campus cards show Brock prominently without fake counts", () => {
  assert.match(campusDiscoverySource, /Explore housing by campus/);
  assert.match(campusDiscoverySource, /brockAvailableCount != null/);
  assert.doesNotMatch(campusDiscoverySource, /12 available|fake|mock/i);
  assert.match(campusDiscoveryHelperSource, /"brock-st-catharines"/);
});

test("navigation and search provide public Brock discovery paths", () => {
  assert.match(navbarSource, /studentHousing/);
  assert.match(navbarSource, /\/#campuses/);
  assert.match(searchExperienceSource, /isBrockContext/);
  assert.match(searchExperienceSource, /Explore Brock housing/);
});

test("campus discovery analytics events are persisted through the existing event endpoint", () => {
  ["campus_search_opened", "campus_selected", "campus_card_clicked"].forEach(
    (eventName) => {
      assert.match(analyticsSource, new RegExp(`"${eventName}"`));
      assert.match(migrationSource, new RegExp(`'${eventName}'`));
      assert.match(campusDiscoverySource, new RegExp(eventName));
    }
  );
});
