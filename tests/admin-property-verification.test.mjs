import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canReviewAdminVerificationRecord,
  documentReviewStatusForAdminAction,
  legacyRelationshipTypeForListingVerification,
  listingVerificationStatusForAdminAction,
} from "../lib/admin-verification-review-core.mjs";
import {
  adminVerificationProfileState,
  countActionableAdminReviewRecords,
  mergeVerificationTypeKeys,
  profileHasActionableAdminReviewRecords,
} from "../lib/admin-verification-queue-core.mjs";

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

  it("keeps listing-specific property submissions as historical records", () => {
    assert.equal(
      canReviewAdminVerificationRecord({
        source: "listing_verifications",
        verificationType: "property_relationship",
        status: "pending",
      }),
      false
    );
  });

  it("allows admins to review pending account-level landlord submissions", () => {
    assert.equal(
      canReviewAdminVerificationRecord({
        source: "verification_submissions",
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

  it("promotes a pending account-level landlord verification into the admin review queue", () => {
    const propertyRecord = {
      id: "93eab93a-75ef-4605-b724-1f31faa053f9",
      source: "verification_submissions",
      verificationType: "property_relationship",
      status: "pending",
    };
    const emailRecord = {
      id: "owner:email",
      source: "profile",
      verificationType: "email",
      status: "not_started",
    };
    const allRecords = [propertyRecord, emailRecord];
    const applicableTypes = mergeVerificationTypeKeys(
      ["email", "phone", "identity"],
      allRecords
    );
    const recordsByType = {
      property_relationship: propertyRecord,
      email: emailRecord,
    };
    const state = adminVerificationProfileState({
      recordsByType,
      allRecords,
      applicableTypes,
    });

    assert.deepEqual(applicableTypes, [
      "email",
      "phone",
      "identity",
      "property_relationship",
    ]);
    assert.equal(countActionableAdminReviewRecords(allRecords), 1);
    assert.equal(profileHasActionableAdminReviewRecords({ allRecords }), true);
    assert.equal(state.pendingCount, 1);
    assert.equal(state.overallStatus, "needs_review");
  });

  it("removes the review action after account-level landlord verification is approved", () => {
    const propertyRecord = {
      source: "verification_submissions",
      verificationType: "property_relationship",
      status: "approved",
    };
    const allRecords = [propertyRecord];
    const applicableTypes = mergeVerificationTypeKeys(
      ["email", "phone", "identity"],
      allRecords
    );
    const state = adminVerificationProfileState({
      recordsByType: {
        property_relationship: propertyRecord,
      },
      allRecords,
      applicableTypes,
    });

    assert.equal(countActionableAdminReviewRecords(allRecords), 0);
    assert.equal(profileHasActionableAdminReviewRecords({ allRecords }), false);
    assert.equal(state.pendingCount, 0);
    assert.notEqual(state.overallStatus, "needs_review");
  });

  it("does not mark normal landlords as requiring review without actionable pending records", () => {
    const allRecords = [
      {
        source: "profile",
        verificationType: "email",
        status: "approved",
      },
      {
        source: "profile",
        verificationType: "phone",
        status: "not_started",
      },
    ];
    const state = adminVerificationProfileState({
      recordsByType: {
        email: allRecords[0],
        phone: allRecords[1],
      },
      allRecords,
      applicableTypes: ["email", "phone", "identity", "property_relationship"],
    });

    assert.equal(state.pendingCount, 0);
    assert.equal(state.overallStatus, "partially_verified");
  });

  it("keeps property manager account verifications in the property review lane", () => {
    const propertyRecord = {
      source: "verification_submissions",
      verificationType: "property_relationship",
      status: "pending",
    };
    const allRecords = [propertyRecord];
    const state = adminVerificationProfileState({
      recordsByType: {
        property_relationship: propertyRecord,
      },
      allRecords,
      applicableTypes: ["email", "phone", "identity", "property_relationship"],
    });

    assert.equal(canReviewAdminVerificationRecord(propertyRecord), true);
    assert.equal(profileHasActionableAdminReviewRecords({ allRecords }), true);
    assert.equal(state.pendingCount, 1);
    assert.equal(state.overallStatus, "needs_review");
  });
});
