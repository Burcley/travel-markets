import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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

  it("keeps restored pre-migration listings visible only after they are available", () => {
    const listings = [
      { id: "pre-migration-public", user_id: "owner-1", status: "available" },
      { id: "pre-migration-draft", user_id: "owner-1", status: "draft" },
      { id: "pre-migration-rented", user_id: "owner-1", status: "rented" },
    ];

    assert.deepEqual(
      filterPubliclyDiscoverableListings(
        listings,
        [verifiedLandlordProfile],
        [approvedLandlordSubmission]
      ).map((listing) => listing.id),
      ["pre-migration-public"]
    );
  });

  it("account verification approval unlocks publishing eligibility", () => {
    const pendingLandlordSubmission = {
      ...approvedLandlordSubmission,
      status: "pending",
    };

    assert.equal(
      getLandlordAccountEligibility({
        profile: verifiedLandlordProfile,
        submissions: [pendingLandlordSubmission],
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

  it("search visibility ignores listing verification document rows", () => {
    const listing = { id: "docless-listing", user_id: "owner-1", status: "available" };

    assert.deepEqual(
      filterPubliclyDiscoverableListings(
        [listing],
        [verifiedLandlordProfile],
        [approvedLandlordSubmission]
      ),
      [listing]
    );
  });

  it("listing creation idempotency is backed by a partial unique index", () => {
    const migration = readFileSync(
      "supabase/migrations/20260820001000_landlord_account_verification_publish_flow.sql",
      "utf8"
    );

    assert.match(migration, /creation_idempotency_key text/);
    assert.match(
      migration,
      /create unique index if not exists listings_user_creation_idempotency_key_idx/
    );
    assert.match(migration, /where creation_idempotency_key is not null/);
  });

  it("account eligibility queries do not request a removed profiles status column", () => {
    const publicVisibilitySource = readFileSync(
      "lib/listings/public-visibility.ts",
      "utf8"
    );
    const landlordEligibilitySource = readFileSync(
      "lib/landlord-account-eligibility.ts",
      "utf8"
    );

    assert.doesNotMatch(
      publicVisibilitySource,
      /role, is_admin, account_status, status, identity_verified/
    );
    assert.doesNotMatch(
      landlordEligibilitySource,
      /role, is_admin, account_status, status, identity_verified/
    );
  });

  it("production reconciliation migration is targeted and idempotent", () => {
    const migration = readFileSync(
      "supabase/migrations/20260820002000_restore_account_eligible_existing_listings.sql",
      "utf8"
    );

    assert.match(migration, /c97ee863-ef1b-4746-9e9d-3c183300ace2/);
    assert.match(migration, /931c5a5f-e1db-4504-95f5-58b7afd3ac2a/);
    assert.match(migration, /l\.status in \('draft', 'pending'\)/);
    assert.match(
      migration,
      /public\.landlord_account_has_marketplace_access\(l\.user_id\)/
    );
    assert.doesNotMatch(migration, /delete from public\.listings/i);
  });
});
