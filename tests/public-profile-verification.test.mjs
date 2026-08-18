import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getPublicProfileTrustCards,
  isPublicProfileFullyVerified,
  resolvePropertyRelationshipStatus,
} from "../lib/public-profile-verification-core.mjs";

describe("public profile verification display", () => {
  it("shows student status only for student profiles", () => {
    const cards = getPublicProfileTrustCards({
      role: "student",
      identityStatus: "verified",
      emailStatus: "verified",
      phoneStatus: "verified",
      studentStatus: "pending",
      propertyRelationshipStatus: "verified",
      profileCompletion: 75,
      memberSince: "Jul 2026",
    });

    assert.ok(cards.some((card) => card.key === "student_status"));
    assert.ok(!cards.some((card) => card.key === "property_relationship"));
  });

  it("shows property relationship only for landlord profiles", () => {
    const cards = getPublicProfileTrustCards({
      role: "landlord",
      identityStatus: "verified",
      emailStatus: "verified",
      phoneStatus: "verified",
      studentStatus: "verified",
      propertyRelationshipStatus: "pending",
      profileCompletion: 75,
      memberSince: "Jul 2026",
    });

    assert.ok(cards.some((card) => card.key === "property_relationship"));
    assert.ok(!cards.some((card) => card.key === "student_status"));
  });

  it("prefers approved property relationship submissions over older or newer non-approved records", () => {
    assert.equal(
      resolvePropertyRelationshipStatus([
        { status: "rejected" },
        { status: "pending" },
        { status: "approved" },
      ]),
      "verified"
    );
  });

  it("uses pending property relationship status when no approval exists", () => {
    assert.equal(
      resolvePropertyRelationshipStatus([
        { status: "rejected" },
        { status: "pending" },
      ]),
      "pending"
    );
  });

  it("requires the role-specific verification before marking a public account fully verified", () => {
    assert.equal(
      isPublicProfileFullyVerified({
        role: "host",
        identityStatus: "verified",
        emailStatus: "verified",
        phoneStatus: "verified",
        studentStatus: "verified",
        propertyRelationshipStatus: "pending",
      }),
      false
    );

    assert.equal(
      isPublicProfileFullyVerified({
        role: "host",
        identityStatus: "verified",
        emailStatus: "verified",
        phoneStatus: "verified",
        studentStatus: "not_started",
        propertyRelationshipStatus: "verified",
      }),
      true
    );
  });
});
