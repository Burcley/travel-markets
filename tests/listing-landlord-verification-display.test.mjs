import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { getListingLandlordVerificationDisplay } from "../lib/listings/landlord-verification-display-core.mjs";

describe("listing landlord verification display", () => {
  it("shows Verified Landlord for an approved landlord account", () => {
    assert.deepEqual(
      getListingLandlordVerificationDisplay({ ownerAccountEligible: true }),
      {
        label: "Verified Landlord",
        verified: true,
        className: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
      }
    );
  });

  it("does not require listing_verifications for the verified landlord display", () => {
    const pageSource = readFileSync("app/listings/[id]/page.tsx", "utf8");

    assert.match(pageSource, /getListingLandlordVerificationDisplay\(\{\s*ownerAccountEligible/s);
    assert.doesNotMatch(pageSource, /verificationStatus\?\.status === "verified"/);
    assert.doesNotMatch(pageSource, /Historical property verification/);
  });

  it("keeps missing listing-level verification from making approved landlords appear unverified", () => {
    const display = getListingLandlordVerificationDisplay({
      ownerAccountEligible: true,
      listingVerificationStatus: null,
    });

    assert.equal(display.label, "Verified Landlord");
    assert.equal(display.verified, true);
  });

  it("uses account-level warning copy for unverified landlord accounts", () => {
    const disclaimerSource = readFileSync(
      "components/trust/TrustDisclaimers.tsx",
      "utf8"
    );

    assert.match(
      disclaimerSource,
      /not yet completed verification of this landlord\s+account/
    );
    assert.doesNotMatch(disclaimerSource, /relationship to the property/);
  });
});
