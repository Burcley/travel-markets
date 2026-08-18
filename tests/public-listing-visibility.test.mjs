import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  filterPubliclyDiscoverableListings,
  isPubliclyDiscoverableListing,
  listingQualifiesForLegacyPropertyVerification,
} from "../lib/listings/public-visibility-core.mjs";

describe("public listing property verification gate", () => {
  it("hides available listings with pending verification", () => {
    assert.equal(
      isPubliclyDiscoverableListing({
        listingStatus: "available",
        verificationStatus: "pending",
      }),
      false
    );
  });

  it("hides available listings requiring more information", () => {
    assert.equal(
      isPubliclyDiscoverableListing({
        listingStatus: "available",
        verificationStatus: "more_information_required",
      }),
      false
    );
  });

  it("hides declined, rejected, missing, and null verification states", () => {
    for (const status of ["declined", "rejected", "not_started", null, undefined]) {
      assert.equal(
        isPubliclyDiscoverableListing({
          listingStatus: "available",
          verificationStatus: status,
        }),
        false
      );
    }
  });

  it("hides verified draft listings", () => {
    assert.equal(
      isPubliclyDiscoverableListing({
        listingStatus: "draft",
        verificationStatus: "verified",
      }),
      false
    );
  });

  it("shows verified available listings", () => {
    assert.equal(
      isPubliclyDiscoverableListing({
        listingStatus: "available",
        verificationStatus: "verified",
      }),
      true
    );
  });

  it("keeps multiple properties independent for the same owner", () => {
    const listings = [
      { id: "listing-a", user_id: "owner-1", status: "available" },
      { id: "listing-b", user_id: "owner-1", status: "available" },
      { id: "listing-c", user_id: "owner-1", status: "draft" },
    ];
    const verifications = [
      { listing_id: "listing-a", status: "verified" },
      { listing_id: "listing-b", status: "pending" },
      { listing_id: "listing-c", status: "verified" },
    ];

    assert.deepEqual(
      filterPubliclyDiscoverableListings(listings, verifications).map(
        (listing) => listing.id
      ),
      ["listing-a"]
    );
  });

  it("keeps a qualifying existing legacy listing publicly eligible without a listing-specific row", () => {
    const listing = {
      id: "legacy-listing",
      user_id: "owner-1",
      status: "available",
      created_at: "2026-08-18T14:25:36.549Z",
    };
    const legacyAccountApproval = {
      user_id: "owner-1",
      verification_type: "property_relationship",
      status: "approved",
    };

    assert.equal(legacyAccountApproval.status, "approved");
    const legacyPropertyVerified = listingQualifiesForLegacyPropertyVerification({
      listing,
      ownerProfile: {
        id: "owner-1",
        role: "owner",
        is_admin: false,
        account_status: "active",
      },
      legacyVerification: legacyAccountApproval,
      listingVerification: null,
    });

    assert.equal(legacyPropertyVerified, true);
    assert.equal(
      isPubliclyDiscoverableListing({
        listingStatus: listing.status,
        verificationStatus: null,
        legacyPropertyVerified,
      }),
      true
    );
    assert.deepEqual(
      filterPubliclyDiscoverableListings([listing], [], ["legacy-listing"]).map(
        (item) => item.id
      ),
      ["legacy-listing"]
    );
  });

  it("does not use legacy account-level approval to verify new listings", () => {
    const listings = [
      {
        id: "listing-a",
        user_id: "owner-1",
        status: "available",
        created_at: "2026-08-18T16:00:00.000Z",
      },
    ];
    const legacyAccountApproval = {
      user_id: "owner-1",
      verification_type: "property_relationship",
      status: "approved",
    };

    assert.equal(legacyAccountApproval.status, "approved");
    assert.equal(
      listingQualifiesForLegacyPropertyVerification({
        listing: listings[0],
        ownerProfile: {
          id: "owner-1",
          role: "owner",
          is_admin: false,
          account_status: "active",
        },
        legacyVerification: legacyAccountApproval,
        listingVerification: null,
      }),
      false
    );
    assert.deepEqual(filterPubliclyDiscoverableListings(listings, [], []), []);
  });

  it("shows new verified available listings", () => {
    assert.deepEqual(
      filterPubliclyDiscoverableListings(
        [
          {
            id: "listing-a",
            user_id: "owner-1",
            status: "available",
            created_at: "2026-08-18T16:00:00.000Z",
          },
        ],
        [{ listing_id: "listing-a", status: "verified" }]
      ).map((listing) => listing.id),
      ["listing-a"]
    );
  });

  it("hides new pending listing-specific submissions", () => {
    assert.deepEqual(
      filterPubliclyDiscoverableListings(
        [
          {
            id: "listing-a",
            user_id: "owner-1",
            status: "available",
            created_at: "2026-08-18T16:00:00.000Z",
          },
        ],
        [{ listing_id: "listing-a", status: "pending" }]
      ),
      []
    );
  });

  it("does not apply legacy fallback to unavailable listing statuses", () => {
    for (const status of ["draft", "pending", "rented", "suspended", "deleted"]) {
      assert.equal(
        isPubliclyDiscoverableListing({
          listingStatus: status,
          verificationStatus: null,
          legacyPropertyVerified: true,
        }),
        false
      );
    }
  });

  it("does not auto-mark existing legacy listings verified in the database model", () => {
    const listing = {
      id: "legacy-listing",
      user_id: "owner-1",
      status: "available",
      created_at: "2026-08-18T14:25:36.549Z",
    };
    const verifications = [];

    assert.deepEqual(
      filterPubliclyDiscoverableListings(
        [listing],
        verifications,
        ["legacy-listing"]
      ).map((item) => item.id),
      ["legacy-listing"]
    );
    assert.deepEqual(verifications, []);
  });
});
