import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  listingPropertyVerificationState,
  listingPropertyVerificationStatusLabel,
  propertyVerificationDocumentSelectionMessage,
} from "../lib/listings/property-verification-ui-core.mjs";

describe("listing property verification UI state", () => {
  it("does not call local file selection uploaded or submitted", () => {
    assert.equal(
      propertyVerificationDocumentSelectionMessage({
        hasSelectedFiles: true,
        persisted: false,
      }),
      "Document selected. Save or submit this listing to upload it for review."
    );
  });

  it("shows submitted copy only after persistence succeeds", () => {
    assert.equal(
      propertyVerificationDocumentSelectionMessage({
        hasSelectedFiles: true,
        persisted: true,
      }),
      "Property verification submitted and awaiting review."
    );
  });

  it("uses listing-specific canonical verification state labels", () => {
    assert.equal(listingPropertyVerificationStatusLabel(null), "Not submitted");
    assert.equal(listingPropertyVerificationStatusLabel("pending"), "Pending review");
    assert.equal(
      listingPropertyVerificationStatusLabel("more_information_required"),
      "More information required"
    );
    assert.equal(listingPropertyVerificationStatusLabel("declined"), "Declined");
    assert.equal(listingPropertyVerificationStatusLabel("verified"), "Verified");
  });

  it("explains not-submitted and pending listing-specific states", () => {
    assert.deepEqual(listingPropertyVerificationState(null), {
      label: "Not submitted",
      description: "Property verification has not been submitted for this listing.",
      actionLabel: "Submit property verification",
    });
    assert.deepEqual(listingPropertyVerificationState("pending"), {
      label: "Pending review",
      description: "Property verification submitted and awaiting review.",
      actionLabel: null,
    });
  });
});
