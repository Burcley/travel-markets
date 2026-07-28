/* eslint-disable @typescript-eslint/no-require-imports */
const {
  getCountries,
  getCountryCallingCode,
  isValidPhoneNumber,
  parsePhoneNumberFromString,
} = require("libphonenumber-js");

const PHONE_VERIFICATION_COOLDOWN_SECONDS = 45;
const supportedCountries = new Set(getCountries());

function normalizePhoneForVerification({ country, phone }) {
  const normalizedCountry = String(country || "").trim().toUpperCase();
  const rawPhone = String(phone || "").trim();

  if (!supportedCountries.has(normalizedCountry) || !rawPhone) {
    return {
      ok: false,
      error: "Enter a valid phone number for the selected country.",
    };
  }

  const parsed = parsePhoneNumberFromString(rawPhone, normalizedCountry);

  if (!parsed || !isValidPhoneNumber(rawPhone, normalizedCountry)) {
    return {
      ok: false,
      error: "Enter a valid phone number for the selected country.",
    };
  }

  return {
    ok: true,
    e164: parsed.number,
    countryIso: normalizedCountry,
    countryCallingCode: `+${getCountryCallingCode(normalizedCountry)}`,
  };
}

function getPhoneVerificationCooldown(sentAt, now = new Date()) {
  if (!sentAt) return 0;

  const sentTime = new Date(sentAt).getTime();

  if (!Number.isFinite(sentTime)) return 0;

  const elapsedSeconds = Math.floor((now.getTime() - sentTime) / 1000);

  return Math.max(0, PHONE_VERIFICATION_COOLDOWN_SECONDS - elapsedSeconds);
}

function redactPhoneNumber(phone) {
  const digits = String(phone || "").replace(/\D/g, "");

  if (digits.length <= 4) return "[redacted-phone]";

  return `[redacted-phone-ending-${digits.slice(-2)}]`;
}

function isTwilioVerifyAccepted(payload) {
  const status = String(payload?.status || "").toLowerCase();
  return Boolean(payload?.sid) && ["pending", "approved"].includes(status);
}

function isTwilioVerifyApproved(payload) {
  return payload?.valid === true || String(payload?.status || "").toLowerCase() === "approved";
}

function safeTwilioSendError({ code, status, message }) {
  const normalized = String(message || "").toLowerCase();
  const numericCode = Number(code);

  if (
    numericCode === 21608 ||
    normalized.includes("trial") ||
    normalized.includes("unverified")
  ) {
    return "This phone number cannot receive SMS from the current Twilio account. Check Twilio trial or verified-recipient settings.";
  }

  if (
    numericCode === 21408 ||
    numericCode === 60605 ||
    normalized.includes("permission") ||
    normalized.includes("country") ||
    normalized.includes("region") ||
    normalized.includes("blocked")
  ) {
    return "SMS verification is not currently available for this country or region.";
  }

  if (
    numericCode === 60200 ||
    numericCode === 21211 ||
    normalized.includes("invalid") ||
    normalized.includes("not a valid")
  ) {
    return "Enter a valid phone number with the correct country code.";
  }

  if (
    numericCode === 60203 ||
    numericCode === 60212 ||
    numericCode === 20429 ||
    status === 429 ||
    normalized.includes("rate") ||
    normalized.includes("too many") ||
    normalized.includes("max send")
  ) {
    return "Too many verification attempts. Please wait before requesting another code.";
  }

  return "We could not send a verification code right now. Please try again later or contact support.";
}

function safeTwilioCheckError({ code, status, message }) {
  const normalized = String(message || "").toLowerCase();
  const numericCode = Number(code);

  if (
    numericCode === 60202 ||
    numericCode === 60205 ||
    normalized.includes("max check") ||
    normalized.includes("too many") ||
    status === 429
  ) {
    return "Too many verification attempts. Please request a new code later.";
  }

  if (numericCode === 20404 || normalized.includes("not found")) {
    return "That code expired or no longer exists. Please request a new code.";
  }

  if (normalized.includes("expired")) {
    return "That code expired. Please request a new code.";
  }

  return "We could not verify that code right now. Please try again.";
}

module.exports = {
  PHONE_VERIFICATION_COOLDOWN_SECONDS,
  getPhoneVerificationCooldown,
  isTwilioVerifyAccepted,
  isTwilioVerifyApproved,
  normalizePhoneForVerification,
  redactPhoneNumber,
  safeTwilioCheckError,
  safeTwilioSendError,
};
