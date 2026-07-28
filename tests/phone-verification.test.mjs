import assert from "node:assert/strict";
import test from "node:test";
import {
  getPhoneVerificationCooldown,
  isTwilioVerifyAccepted,
  isTwilioVerifyApproved,
  normalizePhoneForVerification,
  redactPhoneNumber,
  safeTwilioCheckError,
  safeTwilioSendError,
} from "../lib/phone-verification-core.cjs";

test("normalizes Canadian national numbers to E.164", () => {
  const result = normalizePhoneForVerification({
    country: "CA",
    phone: "(416) 555-0100",
  });

  assert.equal(result.ok, true);
  assert.equal(result.e164, "+14165550100");
  assert.equal(result.countryIso, "CA");
  assert.equal(result.countryCallingCode, "+1");
});

test("normalizes international numbers when a country is selected", () => {
  const result = normalizePhoneForVerification({
    country: "GB",
    phone: "020 7946 0018",
  });

  assert.equal(result.ok, true);
  assert.equal(result.e164, "+442079460018");
});

test("rejects invalid or mismatched phone numbers", () => {
  const result = normalizePhoneForVerification({
    country: "CA",
    phone: "123",
  });

  assert.equal(result.ok, false);
});

test("calculates resend cooldown from the profile sent timestamp", () => {
  const now = new Date("2026-07-28T12:00:45.000Z");

  assert.equal(
    getPhoneVerificationCooldown("2026-07-28T12:00:30.000Z", now),
    30
  );
  assert.equal(
    getPhoneVerificationCooldown("2026-07-28T11:59:00.000Z", now),
    0
  );
});

test("maps common Twilio send failures to safe messages", () => {
  assert.match(
    safeTwilioSendError({ code: 21608, message: "trial account" }),
    /trial/i
  );
  assert.match(
    safeTwilioSendError({ code: 21408, message: "Permission to send" }),
    /country|region/i
  );
  assert.match(
    safeTwilioSendError({ status: 429, message: "Too many requests" }),
    /too many/i
  );
});

test("maps Twilio check failures to safe messages", () => {
  assert.match(
    safeTwilioCheckError({ code: 20404, message: "not found" }),
    /expired|new code/i
  );
  assert.match(
    safeTwilioCheckError({ code: 60205, message: "Max check attempts" }),
    /too many/i
  );
});

test("recognizes Twilio Verify accepted and approved payloads", () => {
  assert.equal(
    isTwilioVerifyAccepted({ sid: "VE123", status: "pending" }),
    true
  );
  assert.equal(isTwilioVerifyAccepted({ status: "pending" }), false);
  assert.equal(isTwilioVerifyApproved({ status: "approved" }), true);
  assert.equal(isTwilioVerifyApproved({ valid: true }), true);
  assert.equal(isTwilioVerifyApproved({ status: "pending" }), false);
});

test("redacts phone numbers in logs", () => {
  assert.equal(redactPhoneNumber("+14165550100"), "[redacted-phone-ending-00]");
});
