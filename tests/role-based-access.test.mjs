import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const roleAccessSource = readFileSync(
  new URL("../lib/role-access.ts", import.meta.url),
  "utf8"
);
const navbarSource = readFileSync(
  new URL("../components/Navbar.tsx", import.meta.url),
  "utf8"
);
const dashboardSource = readFileSync(
  new URL("../components/DashboardPage.tsx", import.meta.url),
  "utf8"
);
const middlewareSource = readFileSync(
  new URL("../middleware.ts", import.meta.url),
  "utf8"
);
const postPageSource = readFileSync(
  new URL("../app/post/page.tsx", import.meta.url),
  "utf8"
);
const myListingsSource = readFileSync(
  new URL("../app/my-listings/page.tsx", import.meta.url),
  "utf8"
);
const editListingSource = readFileSync(
  new URL("../app/listings/[id]/edit/page.tsx", import.meta.url),
  "utf8"
);
const duplicateRouteSource = readFileSync(
  new URL("../app/api/listings/[id]/duplicate/route.ts", import.meta.url),
  "utf8"
);
const statusRouteSource = readFileSync(
  new URL("../app/api/listings/status/route.ts", import.meta.url),
  "utf8"
);
const boostCheckoutSource = readFileSync(
  new URL("../app/api/listings/boost/checkout/route.ts", import.meta.url),
  "utf8"
);
const boostIncludedSource = readFileSync(
  new URL("../app/api/listings/boost/included/route.ts", import.meta.url),
  "utf8"
);
const boostCenterSource = readFileSync(
  new URL("../app/dashboard/boosts/page.tsx", import.meta.url),
  "utf8"
);
const billingSource = readFileSync(
  new URL("../app/billing/page.tsx", import.meta.url),
  "utf8"
);
const subscriptionCheckoutSource = readFileSync(
  new URL("../app/api/subscriptions/checkout/route.ts", import.meta.url),
  "utf8"
);
const listingVerificationSource = readFileSync(
  new URL("../app/api/listing-verifications/route.ts", import.meta.url),
  "utf8"
);
const authCallbackSource = readFileSync(
  new URL("../app/auth/callback/route.ts", import.meta.url),
  "utf8"
);
const onboardingVerifyEmailSource = readFileSync(
  new URL("../app/onboarding/verify-email/page.tsx", import.meta.url),
  "utf8"
);
const onboardingVerificationsSource = readFileSync(
  new URL("../app/onboarding/verifications/page.tsx", import.meta.url),
  "utf8"
);
const publicProfileSource = readFileSync(
  new URL("../app/users/[id]/page.tsx", import.meta.url),
  "utf8"
);

test("role access helper normalizes the canonical Travel Markets role aliases", () => {
  assert.match(roleAccessSource, /export type AppRole = "student" \| "landlord" \| "admin"/);
  ["owner", "landlord", "host", "property_owner", "property_manager"].forEach(
    (role) => assert.match(roleAccessSource, new RegExp(`"${role}"`))
  );
  assert.match(roleAccessSource, /canCreateListing/);
  assert.match(roleAccessSource, /canManageListings/);
  assert.match(roleAccessSource, /canAccessLandlordTools/);
});

test("student navbar does not include landlord navigation or a Post Listing action", () => {
  const studentLinks =
    navbarSource.match(/const studentNavLinks[\s\S]*?const hostNavLinks/)?.[0] ||
    "";

  assert.match(studentLinks, /label: "dashboard"/);
  assert.doesNotMatch(studentLinks, /forLandlords/);
  assert.doesNotMatch(studentLinks, /myListings/);
  assert.doesNotMatch(studentLinks, /billing/);
  assert.match(navbarSource, /role === "landlord" \|\| role === "admin"[\s\S]*t\("actions\.postListing"\)/);
});

test("middleware protects landlord-only routes without guarding public listings or profiles", () => {
  const protectedPrefixes =
    middlewareSource.match(/const PROTECTED_ONBOARDING_PATHS[\s\S]*?\];/)?.[0] ||
    "";

  assert.doesNotMatch(protectedPrefixes, /"\/listings"/);
  assert.doesNotMatch(protectedPrefixes, /"\/users"/);
  assert.match(middlewareSource, /const LANDLORD_ONLY_PATHS/);
  ["/post", "/my-listings", "/availability", "/billing", "/dashboard/boosts"].forEach(
    (path) => assert.match(middlewareSource, new RegExp(`"${path}"`))
  );
  assert.match(middlewareSource, /isListingEditPath/);
  assert.match(middlewareSource, /canAccessLandlordTools\(profile\)/);
  assert.match(middlewareSource, /isLandlordRole\(profile\)/);
  assert.match(middlewareSource, /url\.pathname = normalizeAppRole\(profile\) === "student" \? "\/dashboard" : "\/auth"/);
});

test("dashboard uses the centralized role helper for role-specific UI", () => {
  assert.match(dashboardSource, /normalizeAppRole/);
  assert.match(dashboardSource, /const isStudent = appRole === "student"/);
});

test("listing creation and owner mutation paths enforce landlord access", () => {
  [
    postPageSource,
    myListingsSource,
    editListingSource,
    duplicateRouteSource,
    statusRouteSource,
    boostCheckoutSource,
    boostIncludedSource,
    boostCenterSource,
    billingSource,
    subscriptionCheckoutSource,
    listingVerificationSource,
  ].forEach((source) => {
    assert.match(source, /can(?:CreateListing|ManageListings|AccessLandlordTools)/);
    assert.match(source, /role, is_admin/);
  });
});

test("onboarding redirects use the shared role access helpers", () => {
  [authCallbackSource, onboardingVerifyEmailSource, onboardingVerificationsSource].forEach(
    (source) => {
      assert.match(source, /isStudentRole/);
      assert.match(source, /canAccessLandlordTools/);
      assert.match(source, /isAdminRole/);
    }
  );
});

test("student public profiles do not render landlord reputation wording", () => {
  assert.match(publicProfileSource, /isHost \? "Landlord status" : "Community status"/);
  assert.match(publicProfileSource, /"Student member"/);
  assert.match(
    publicProfileSource,
    /"This student is part of the Travel Markets community\."/
  );
  assert.match(publicProfileSource, /"About this student"/);
  assert.match(publicProfileSource, /isHost[\s\S]*"This landlord is new to reviews on Travel Markets\."[\s\S]*"This student is new to Travel Markets reviews\."/);
});
