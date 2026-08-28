import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  formatActiveListingCount,
  formatPublicReviewSummary,
  getPublicLandlordReputation,
} from "../lib/public-landlord-reputation-core.mjs";

const ownerTrustCardSource = readFileSync(
  new URL("../components/OwnerTrustCard.tsx", import.meta.url),
  "utf8"
);
const listingCardSource = readFileSync(
  new URL("../components/ListingCard.tsx", import.meta.url),
  "utf8"
);
const publicProfileSource = readFileSync(
  new URL("../app/users/[id]/page.tsx", import.meta.url),
  "utf8"
);
const listingDetailSource = readFileSync(
  new URL("../app/listings/[id]/page.tsx", import.meta.url),
  "utf8"
);
const ownerReviewsSource = readFileSync(
  new URL("../components/OwnerReviews.tsx", import.meta.url),
  "utf8"
);
const homeSource = readFileSync(
  new URL("../components/home/TravelMarketsHome.tsx", import.meta.url),
  "utf8"
);

test("public landlord reputation is based on marketplace history, not hidden trust score", () => {
  assert.equal(
    getPublicLandlordReputation({
      verified: true,
      listingCount: 1,
      reviewCount: 0,
      averageRating: 0,
    }).label,
    "New Landlord"
  );

  assert.equal(
    getPublicLandlordReputation({
      verified: true,
      listingCount: 2,
      reviewCount: 3,
      averageRating: 4.2,
    }).label,
    "Established Landlord"
  );

  assert.equal(
    getPublicLandlordReputation({
      verified: true,
      listingCount: 1,
      reviewCount: 10,
      averageRating: 4.7,
    }).label,
    "Highly Rated Landlord"
  );

  assert.equal(
    getPublicLandlordReputation({
      verified: false,
      listingCount: 20,
      reviewCount: 30,
      averageRating: 5,
    }).label,
    "New Landlord"
  );
});

test("public zero-review summaries avoid zero-star-looking ratings", () => {
  assert.deepEqual(formatPublicReviewSummary(0, 0), {
    ratingLabel: "New",
    reviewLabel: "No Reviews Yet",
    compactLabel: "No Reviews Yet",
  });
  assert.equal(formatPublicReviewSummary(1, 5).reviewLabel, "1 Review");
  assert.equal(formatPublicReviewSummary(2, 4.5).reviewLabel, "2 Reviews");
});

test("public owner trust surfaces do not expose numeric trust scores", () => {
  [
    ownerTrustCardSource,
    listingCardSource,
    publicProfileSource,
    listingDetailSource,
    ownerReviewsSource,
    homeSource,
  ].forEach((source) => {
    assert.doesNotMatch(source, /Travel Markets trust score/);
    assert.doesNotMatch(source, /Trust score/);
    assert.doesNotMatch(source, /trustScore/);
    assert.doesNotMatch(source, /\/100/);
  });

  assert.doesNotMatch(ownerTrustCardSource, /value=\{averageRating\}/);
  assert.doesNotMatch(publicProfileSource, /return "0\.0"/);
  assert.doesNotMatch(listingDetailSource, /return "0\.0"/);
  assert.doesNotMatch(ownerReviewsSource, /: "0\.0"/);
});

test("public trust signals use student-friendly wording", () => {
  assert.match(ownerTrustCardSource, /Verified Landlord/);
  assert.match(
    ownerTrustCardSource,
    /This landlord has completed the Travel Markets landlord verification process\./
  );
  assert.match(ownerTrustCardSource, /reviewSummary\.reviewLabel/);
  assert.match(ownerTrustCardSource, /formatActiveListingCount\(listingCount\)/);
  assert.equal(formatActiveListingCount(1), "1 Active Listing");
  assert.equal(formatActiveListingCount(4), "4 Active Listings");
});
