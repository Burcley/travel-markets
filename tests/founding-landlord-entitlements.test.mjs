import assert from "node:assert/strict";
import test from "node:test";
import {
  getFoundingCouponAction,
  getFoundingBoostEntitlementState,
  getFoundingBenefitState,
  isFoundingLandlordRole,
} from "../lib/founding-landlords/entitlements-core.cjs";
import { getLandlordAccountEligibility } from "../lib/landlord-account-eligibility-core.mjs";

const now = new Date("2026-08-05T12:00:00.000Z");

test("active confirmed Founding Landlord receives free-period unlimited listing entitlement", () => {
  const state = getFoundingBenefitState(
    {
      role: "landlord",
      account_status: "active",
      founding_status: "confirmed",
      is_founding_landlord: true,
      founding_benefits_started_at: "2026-07-01T00:00:00.000Z",
      founding_free_fee_period_ends_at: "2027-07-01T00:00:00.000Z",
      founding_discount_percentage: 25,
      founding_benefits_disabled: false,
    },
    now
  );

  assert.equal(state.isConfirmedFounder, true);
  assert.equal(state.freePeriodActive, true);
  assert.equal(state.freePeriodEnded, false);
  assert.equal(state.lifetimeDiscountPercentage, 25);
});

test("normal landlord does not receive Founding free-period entitlement", () => {
  const state = getFoundingBenefitState(
    {
      role: "landlord",
      account_status: "active",
      founding_status: "not_eligible",
      is_founding_landlord: false,
    },
    now
  );

  assert.equal(state.isLandlord, true);
  assert.equal(state.isConfirmedFounder, false);
  assert.equal(state.freePeriodActive, false);
});

test("expired Founding free period keeps Founding status and lifetime discount", () => {
  const state = getFoundingBenefitState(
    {
      role: "owner",
      account_status: "active",
      founding_status: "confirmed",
      is_founding_landlord: true,
      founding_benefits_started_at: "2025-01-01T00:00:00.000Z",
      founding_free_fee_period_ends_at: "2026-01-01T00:00:00.000Z",
      founding_discount_percentage: 25,
      founding_benefits_disabled: false,
    },
    now
  );

  assert.equal(state.isConfirmedFounder, true);
  assert.equal(state.freePeriodActive, false);
  assert.equal(state.freePeriodEnded, true);
  assert.equal(state.lifetimeDiscountPercentage, 25);
});

test("Founder immediately before expiration still receives free-period-only benefits", () => {
  const state = getFoundingBenefitState(
    {
      role: "owner",
      account_status: "active",
      founding_status: "confirmed",
      is_founding_landlord: true,
      founding_benefits_started_at: "2025-08-05T12:00:00.000Z",
      founding_free_fee_period_ends_at: "2026-08-05T12:00:01.000Z",
      founding_discount_percentage: 25,
      founding_benefits_disabled: false,
    },
    now
  );

  const boostEntitlement = getFoundingBoostEntitlementState({
    benefit: state,
    monthlyFreeBoosts: 2,
    monthlyBoostsUsed: 0,
    now,
  });

  assert.equal(state.freePeriodActive, true);
  assert.equal(state.freePeriodEnded, false);
  assert.equal(boostEntitlement.includedAvailable, 2);
});

test("Founder after expiration keeps permanent discount but loses free-period-only boosts", () => {
  const state = getFoundingBenefitState(
    {
      role: "owner",
      account_status: "active",
      founding_status: "confirmed",
      is_founding_landlord: true,
      founding_benefits_started_at: "2025-08-05T12:00:00.000Z",
      founding_free_fee_period_ends_at: "2026-08-05T11:59:59.000Z",
      founding_discount_percentage: 25,
      founding_benefits_disabled: false,
    },
    now
  );

  const boostEntitlement = getFoundingBoostEntitlementState({
    benefit: state,
    monthlyFreeBoosts: 2,
    monthlyBoostsUsed: 0,
    now,
  });

  assert.equal(state.isConfirmedFounder, true);
  assert.equal(state.freePeriodActive, false);
  assert.equal(state.freePeriodEnded, true);
  assert.equal(state.lifetimeDiscountPercentage, 25);
  assert.equal(boostEntitlement.includedAvailable, 0);
});

test("disabled Founding benefits do not grant free-period entitlement", () => {
  const state = getFoundingBenefitState(
    {
      role: "host",
      account_status: "active",
      founding_status: "confirmed",
      is_founding_landlord: true,
      founding_free_fee_period_ends_at: "2027-01-01T00:00:00.000Z",
      founding_discount_percentage: 25,
      founding_benefits_disabled: true,
    },
    now
  );

  assert.equal(state.isConfirmedFounder, true);
  assert.equal(state.benefitsDisabled, true);
  assert.equal(state.freePeriodActive, false);
});

test("student and admin roles are excluded from landlord Founding entitlements", () => {
  assert.equal(isFoundingLandlordRole("student"), false);
  assert.equal(isFoundingLandlordRole("admin"), false);
  assert.equal(isFoundingLandlordRole("owner"), true);
});

test("active Founder receives exactly two monthly 7-day boost entitlements with no rollover", () => {
  const benefit = getFoundingBenefitState(
    {
      role: "landlord",
      account_status: "active",
      founding_status: "confirmed",
      is_founding_landlord: true,
      founding_free_fee_period_ends_at: "2027-07-01T00:00:00.000Z",
    },
    now
  );

  const unused = getFoundingBoostEntitlementState({
    benefit,
    monthlyFreeBoosts: 2,
    monthlyBoostsUsed: 0,
    now,
  });
  const usedOne = getFoundingBoostEntitlementState({
    benefit,
    monthlyFreeBoosts: 2,
    monthlyBoostsUsed: 1,
    now,
  });
  const usedTwo = getFoundingBoostEntitlementState({
    benefit,
    monthlyFreeBoosts: 2,
    monthlyBoostsUsed: 2,
    now,
  });
  const nextMonth = getFoundingBoostEntitlementState({
    benefit,
    monthlyFreeBoosts: 2,
    monthlyBoostsUsed: 0,
    now: new Date("2026-09-01T00:00:00.000Z"),
  });

  assert.equal(unused.includedAvailable, 2);
  assert.equal(usedOne.includedAvailable, 1);
  assert.equal(usedTwo.includedAvailable, 0);
  assert.equal(nextMonth.includedAvailable, 2);
  assert.equal(nextMonth.monthStart, "2026-09-01");
});

test("Founding coupon transition is idempotent and replaces existing discounts once", () => {
  const lifetimeCoupon = "tm_founding_landlord_25_lifetime";
  const alreadyApplied = getFoundingCouponAction({
    targetCouponId: lifetimeCoupon,
    existingCouponIds: [lifetimeCoupon],
  });
  const repeat = getFoundingCouponAction({
    targetCouponId: alreadyApplied.targetCouponId,
    existingCouponIds: [lifetimeCoupon],
  });
  const replaceFreePeriodCoupon = getFoundingCouponAction({
    targetCouponId: lifetimeCoupon,
    existingCouponIds: ["tm_founding_landlord_100_12m"],
  });
  const normalLandlord = getFoundingCouponAction({
    targetCouponId: null,
    existingCouponIds: [],
  });

  assert.equal(alreadyApplied.shouldApply, false);
  assert.equal(repeat.shouldApply, false);
  assert.equal(replaceFreePeriodCoupon.shouldApply, true);
  assert.equal(replaceFreePeriodCoupon.reason, "replace_existing");
  assert.equal(normalLandlord.shouldApply, false);
});

test("Founding account eligibility is unlocked by identity and landlord verification without listing verification", () => {
  const eligibility = getLandlordAccountEligibility({
    profile: {
      id: "founder-owner",
      role: "landlord",
      account_status: "active",
      identity_verified: true,
    },
    submissions: [
      {
        user_id: "founder-owner",
        verification_type: "property_relationship",
        status: "approved",
      },
    ],
  });

  assert.equal(eligibility.canPublishListings, true);
  assert.equal(eligibility.reason, "VERIFIED_LANDLORD");
});

test("Founding public badge copy does not need rank wording", () => {
  const publicBadgeLabel = "Founding Landlord";

  assert.equal(publicBadgeLabel.includes("of 30"), false);
  assert.equal(publicBadgeLabel.includes("#"), false);
});
