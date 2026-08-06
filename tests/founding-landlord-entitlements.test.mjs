import assert from "node:assert/strict";
import test from "node:test";
import {
  getFoundingBenefitState,
  isFoundingLandlordRole,
} from "../lib/founding-landlords/entitlements-core.cjs";

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

