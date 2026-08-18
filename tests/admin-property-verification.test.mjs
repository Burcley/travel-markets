import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canReviewAdminVerificationRecord,
  documentReviewStatusForAdminAction,
  legacyRelationshipTypeForListingVerification,
  listingVerificationStatusForAdminAction,
} from "../lib/admin-verification-review-core.mjs";

describe("admin property/listing verification review", () => {
  it("maps admin actions onto existing listing verification statuses", () => {
    assert.equal(listingVerificationStatusForAdminAction("approve"), "verified");
    assert.equal(listingVerificationStatusForAdminAction("reject"), "declined");
    assert.equal(
      listingVerificationStatusForAdminAction("resubmission"),
      "more_information_required"
    );
    assert.equal(listingVerificationStatusForAdminAction("unknown"), null);
  });

  it("maps document decisions without inventing new document statuses", () => {
    assert.equal(documentReviewStatusForAdminAction("approve"), "accepted");
    assert.equal(documentReviewStatusForAdminAction("reject"), "rejected");
    assert.equal(documentReviewStatusForAdminAction("resubmission"), "rejected");
    assert.equal(documentReviewStatusForAdminAction("unknown"), null);
  });

  it("normalizes legacy property relationship submissions into listing relationships", () => {
    assert.equal(
      legacyRelationshipTypeForListingVerification("owner"),
      "registered_owner"
    );
    assert.equal(
      legacyRelationshipTypeForListingVerification("authorized_property_manager"),
      "property_manager"
    );
    assert.equal(
      legacyRelationshipTypeForListingVerification("agent"),
      "authorized_representative"
    );
    assert.equal(
      legacyRelationshipTypeForListingVerification("representative"),
      "authorized_representative"
    );
    assert.equal(legacyRelationshipTypeForListingVerification("student"), null);
  });

  it("allows admins to review pending listing-specific property submissions", () => {
    assert.equal(
      canReviewAdminVerificationRecord({
        source: "listing_verifications",
        verificationType: "property_relationship",
        status: "pending",
      }),
      true
    );
  });

  it("preserves existing manual identity and student submission reviews", () => {
    assert.equal(
      canReviewAdminVerificationRecord({
        source: "verification_submissions",
        verificationType: "identity",
        status: "pending",
      }),
      true
    );
    assert.equal(
      canReviewAdminVerificationRecord({
        source: "verification_submissions",
        verificationType: "student_status",
        status: "pending",
      }),
      true
    );
  });

  it("does not treat unrelated or already-approved records as pending admin actions", () => {
    assert.equal(
      canReviewAdminVerificationRecord({
        source: "listing_verifications",
        verificationType: "property_relationship",
        status: "approved",
      }),
      false
    );
    assert.equal(
      canReviewAdminVerificationRecord({
        source: "verification_submissions",
        verificationType: "phone",
        status: "pending",
      }),
      false
    );
  });
});
