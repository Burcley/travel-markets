"use client";

import { ClipboardEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Phone, ShieldCheck } from "lucide-react";
import {
  getCountries,
  getCountryCallingCode,
  isValidPhoneNumber,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js";
import { createClient } from "@/lib/supabase/client";

const displayNames = new Intl.DisplayNames(["en"], { type: "region" });

function countryFlag(country: string) {
  return country
    .toUpperCase()
    .replace(/./g, (char) =>
      String.fromCodePoint(127397 + char.charCodeAt(0))
    );
}

function countryName(country: CountryCode) {
  return displayNames.of(country) || country;
}

const PHONE_COUNTRIES = getCountries()
  .map((country) => ({
    country,
    name: countryName(country),
    code: `+${getCountryCallingCode(country)}`,
    flag: countryFlag(country),
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

function countryFromName(value?: string | null): CountryCode {
  const normalized = String(value || "").trim().toLowerCase();
  const match = PHONE_COUNTRIES.find(
    (country) => country.name.toLowerCase() === normalized
  );

  return match?.country || "CA";
}

function normalizePhone(country: CountryCode, phone: string) {
  const trimmed = phone.trim();
  const parsed = parsePhoneNumberFromString(trimmed, country);

  if (!parsed || !isValidPhoneNumber(trimmed, country)) return null;

  return parsed.number;
}

function otpError(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("expired")) return "That code expired. Please request a new code.";
  if (normalized.includes("invalid phone") || normalized.includes("phone")) return "Enter a valid phone number for the selected country.";
  if (normalized.includes("invalid") || normalized.includes("token")) return "That code is incorrect. Please try again.";
  if (normalized.includes("rate") || normalized.includes("too many")) return "Too many attempts. Please wait before trying again.";
  if (
    normalized.includes("sms") ||
    normalized.includes("provider") ||
    normalized.includes("twilio") ||
    normalized.includes("messagebird")
  ) {
    if (process.env.NODE_ENV !== "production") {
      return "SMS provider is not configured for this Supabase project.";
    }

    return "We're unable to send a verification code right now. Please try again later or contact support.";
  }
  if (normalized.includes("unsupported")) return "This region is not supported for SMS verification yet.";
  return message || "Phone verification failed. Please try again.";
}

export default function VerifyPhonePage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const [country, setCountry] = useState<CountryCode>("CA");
  const [countrySearch, setCountrySearch] = useState("");
  const [phone, setPhone] = useState("");
  const [normalizedPhone, setNormalizedPhone] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [countdown, setCountdown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const filteredCountries = useMemo(() => {
    const query = countrySearch.trim().toLowerCase();

    return PHONE_COUNTRIES.filter((item) => {
      if (!query) return true;
      return (
        item.name.toLowerCase().includes(query) ||
        item.country.toLowerCase().includes(query) ||
        item.code.includes(query.replace(/\s/g, ""))
      );
    }).slice(0, 60);
  }, [countrySearch]);

  useEffect(() => {
    async function loadProfile() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/auth?returnTo=/verify-phone");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("country, phone, phone_country_iso, phone_number_e164, phone_verified, phone_verified_at, phone_verification_status")
        .eq("id", user.id)
        .maybeSingle();

      setCountry((profile?.phone_country_iso as CountryCode | null) || countryFromName(profile?.country));

      if (profile?.phone_number_e164 || profile?.phone) {
        const savedPhone = profile.phone_number_e164 || profile.phone || "";
        setPhone(savedPhone);
        setNormalizedPhone(savedPhone);
      }

      if (
        profile?.phone_verified ||
        profile?.phone_verified_at ||
        profile?.phone_verification_status === "verified"
      ) {
        setSuccess(true);
      }

      setInitializing(false);
    }

    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((value) => Math.max(0, value - 1)), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  async function sendCode() {
    setError("");
    const e164 = normalizePhone(country, phone);

    if (!e164) {
      setError("Enter a valid phone number for the selected country.");
      return;
    }

    setLoading(true);

    const response = await fetch("/api/phone-verification/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        country,
        phone,
      }),
    });
    const data = await response.json().catch(() => null);

    if (!response.ok || !data?.ok) {
      setError(otpError(data?.error || "We could not send a verification code right now."));
      setCountdown(Number(data?.cooldownSeconds || 0));
      setLoading(false);
      return;
    }

    setNormalizedPhone(data.phone || e164);
    setCodeSent(true);
    setCountdown(Number(data.cooldownSeconds || 45));
    setLoading(false);
    setTimeout(() => inputRefs.current[0]?.focus(), 50);
  }

  async function verifyCode() {
    setError("");
    const token = otp.join("");

    if (token.length !== 6) {
      setError("Enter the six-digit verification code.");
      return;
    }

    setLoading(true);

    const response = await fetch("/api/phone-verification/check", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        code: token,
      }),
    });
    const data = await response.json().catch(() => null);

    if (!response.ok || !data?.ok) {
      setError(otpError(data?.error || "Phone verification failed. Please try again."));
      setLoading(false);
      return;
    }

    setNormalizedPhone(data.phone || normalizedPhone);

    setSuccess(true);
    setLoading(false);

    setTimeout(() => router.push("/dashboard/verification"), 1000);
  }

  function handleOtpChange(index: number, value: string) {
    const digit = value.replace(/\D/g, "").slice(-1);
    setOtp((current) => {
      const next = [...current];
      next[index] = digit;
      return next;
    });

    if (digit && index < 5) inputRefs.current[index + 1]?.focus();
  }

  function handleOtpKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }

    if (event.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }

    if (event.key === "ArrowRight" && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();
    const digits = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!digits) return;

    setOtp(Array.from({ length: 6 }, (_, index) => digits[index] || ""));
    setTimeout(() => inputRefs.current[Math.min(digits.length, 5)]?.focus(), 20);
  }

  if (initializing) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black text-white">
        <Loader2 className="h-8 w-8 animate-spin text-pink-300" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-4 py-10 text-white">
      <div className="mx-auto max-w-3xl rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(244,63,94,0.22),rgba(24,24,27,0.96)_42%,rgba(0,0,0,1)_100%)] p-7 shadow-2xl sm:p-10">
        <div className="flex items-start gap-4">
          <div className="rounded-2xl bg-pink-500/10 p-3 text-pink-200">
            <Phone className="h-7 w-7" />
          </div>
          <div>
            <p className="text-sm font-black uppercase tracking-[0.2em] text-pink-300">
              Phone Verification
            </p>
            <h1 className="mt-2 text-4xl font-black">Verify your phone number</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
              We will send a six-digit SMS code. Your number is private account
              information and helps coordinate safer viewing communication.
            </p>
          </div>
        </div>

        {success ? (
          <div className="mt-8 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-5 text-emerald-100">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-6 w-6" />
              <div>
                <p className="font-black">Phone verified</p>
                {normalizedPhone && (
                  <p className="mt-1 text-sm text-emerald-100/75">
                    {normalizedPhone}
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : !codeSent ? (
          <div className="mt-8 grid gap-4">
            <label>
              <span className="text-sm font-bold text-zinc-300">Country or dialing code</span>
              <input
                value={countrySearch}
                onChange={(event) => setCountrySearch(event.target.value)}
                placeholder="Search Canada, Nigeria, United Kingdom, +234..."
                className="mt-2 w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none placeholder:text-zinc-600 focus:border-pink-400"
              />
            </label>
            <label>
              <span className="text-sm font-bold text-zinc-300">Selected country</span>
              <select
                value={country}
                onChange={(event) => setCountry(event.target.value as CountryCode)}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-pink-400"
              >
                {filteredCountries.map((item) => (
                  <option key={item.country} value={item.country}>
                    {item.flag} {item.name} ({item.code})
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="text-sm font-bold text-zinc-300">Phone number</span>
              <input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder={`${PHONE_COUNTRIES.find((item) => item.country === country)?.code || ""} phone number`}
                inputMode="tel"
                className="mt-2 w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-pink-400"
              />
            </label>
          </div>
        ) : (
          <div className="mt-8">
            <p className="text-sm text-zinc-400">
              Enter the code sent to <span className="font-bold text-white">{normalizedPhone}</span>
            </p>
            <div className="mt-4 grid grid-cols-6 gap-2 sm:gap-3">
              {otp.map((digit, index) => (
                <input
                  key={index}
                  ref={(element) => {
                    inputRefs.current[index] = element;
                  }}
                  value={digit}
                  onChange={(event) => handleOtpChange(index, event.target.value)}
                  onKeyDown={(event) => handleOtpKeyDown(index, event)}
                  onPaste={handlePaste}
                  inputMode="numeric"
                  maxLength={1}
                  className="h-14 rounded-2xl border border-white/10 bg-black text-center text-2xl font-black text-white outline-none focus:border-pink-400"
                />
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="mt-5 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
            {error}
          </div>
        )}

        {success && codeSent && (
          <div className="mt-5 flex items-center gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-200">
            <CheckCircle2 className="h-5 w-5" />
            Phone verified. Returning to Verification Center...
          </div>
        )}

        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
          {success ? (
            <button
              onClick={() => router.push("/dashboard/verification")}
              className="inline-flex items-center justify-center rounded-2xl bg-white px-7 py-3 text-sm font-black text-black transition hover:bg-zinc-200"
            >
              Return to Verification Center
            </button>
          ) : !codeSent ? (
            <button
              onClick={sendCode}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-7 py-3 text-sm font-black text-black transition hover:bg-zinc-200 disabled:opacity-50"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Send SMS Code
            </button>
          ) : (
            <>
              <button
                onClick={verifyCode}
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-7 py-3 text-sm font-black text-black transition hover:bg-zinc-200 disabled:opacity-50"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Verify Code
              </button>
              <button
                onClick={sendCode}
                disabled={loading || countdown > 0}
                className="rounded-2xl border border-white/10 bg-white/5 px-7 py-3 text-sm font-bold text-white transition hover:bg-white/10 disabled:opacity-50"
              >
                {countdown > 0 ? `Resend in ${countdown}s` : "Resend code"}
              </button>
            </>
          )}
        </div>

        <div className="mt-7 flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-pink-200" />
          <p className="text-sm leading-6 text-zinc-400">
            Your phone number is kept private and is used for account security
            and safer communication. Travel Markets will never display it
            publicly without your permission.
          </p>
        </div>
      </div>
    </main>
  );
}
