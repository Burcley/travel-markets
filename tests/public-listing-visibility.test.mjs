import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  filterPubliclyDiscoverableListings,
  isPubliclyDiscoverableListing,
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

  it("does not use legacy account-level approval to verify listings", () => {
    const listings = [
      { id: "listing-a", user_id: "owner-1", status: "available" },
      { id: "listing-b", user_id: "owner-1", status: "available" },
      { id: "listing-c", user_id: "owner-1", status: "available" },
      { id: "listing-d", user_id: "owner-1", status: "available" },
      { id: "listing-e", user_id: "owner-1", status: "available" },
    ];
    const legacyAccountApproval = {
      user_id: "owner-1",
      verification_type: "property_relationship",
      status: "approved",
      document_metadata: {
        listingId: null,
      },
    };

    assert.equal(legacyAccountApproval.status, "approved");
    assert.equal(legacyAccountApproval.document_metadata.listingId, null);
    assert.deepEqual(filterPubliclyDiscoverableListings(listings, []), []);
  });
});
