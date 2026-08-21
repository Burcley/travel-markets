import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  filterPubliclyDiscoverableListings,
  isPubliclyDiscoverableListing,
} from "../lib/listings/public-visibility-core.mjs";
import { getLandlordAccountEligibility } from "../lib/landlord-account-eligibility-core.mjs";

const verifiedLandlordProfile = {
  id: "owner-1",
  role: "owner",
  account_status: "active",
  identity_verified: true,
  is_admin: false,
};

const approvedLandlordSubmission = {
  user_id: "owner-1",
  verification_type: "property_relationship",
  status: "approved",
};

describe("public listing account-level verification gate", () => {
  it("hides available listings when the owner account is not landlord verified", () => {
    assert.equal(
      isPubliclyDiscoverableListing({
        listingStatus: "available",
        ownerEligible: false,
      }),
      false
    );
  });

  it("hides draft listings even when the owner account is verified", () => {
    assert.equal(
      isPubliclyDiscoverableListing({
        listingStatus: "draft",
        ownerEligible: true,
      }),
      false
    );
  });

  it("shows available listings from verified landlord accounts without listing-specific verification", () => {
    assert.equal(
      isPubliclyDiscoverableListing({
        listingStatus: "available",
        ownerEligible: true,
      }),
      true
    );
  });

  it("requires identity and landlord account verification before public discovery", () => {
    assert.equal(
      getLandlordAccountEligibility({
        profile: verifiedLandlordProfile,
        submissions: [],
      }).canPublishListings,
      false
    );
    assert.equal(
      getLandlordAccountEligibility({
        profile: verifiedLandlordProfile,
        submissions: [approvedLandlordSubmission],
      }).canPublishListings,
      true
    );
  });

  it("keeps normal listing status independent from account verification", () => {
    const listings = [
      { id: "listing-a", user_id: "owner-1", status: "available" },
      { id: "listing-b", user_id: "owner-1", status: "draft" },
      { id: "listing-c", user_id: "owner-1", status: "rented" },
    ];

    assert.deepEqual(
      filterPubliclyDiscoverableListings(
        listings,
        [verifiedLandlordProfile],
        [approvedLandlordSubmission]
      ).map((listing) => listing.id),
      ["listing-a"]
    );
  });

  it("lets one verified landlord publish many listings without many verification submissions", () => {
    const listings = Array.from({ length: 25 }, (_, index) => ({
      id: `listing-${index + 1}`,
      user_id: "owner-1",
      status: "available",
    }));

    assert.equal(
      filterPubliclyDiscoverableListings(
        listings,
        [verifiedLandlordProfile],
        [approvedLandlordSubmission]
      ).length,
      25
    );
  });

  it("blocks suspended landlord accounts", () => {
    assert.equal(
      getLandlordAccountEligibility({
        profile: {
          ...verifiedLandlordProfile,
          account_status: "suspended",
        },
        submissions: [approvedLandlordSubmission],
      }).canPublishListings,
      false
    );
  });

  it("does not treat listing-specific verification as required for new listings", () => {
    assert.deepEqual(
      filterPubliclyDiscoverableListings(
        [{ id: "new-listing", user_id: "owner-1", status: "available" }],
        [verifiedLandlordProfile],
        [approvedLandlordSubmission]
      ).map((listing) => listing.id),
      ["new-listing"]
    );
  });
});
