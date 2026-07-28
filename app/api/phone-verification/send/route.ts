import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  getPhoneVerificationCooldown,
  isTwilioVerifyAccepted,
  normalizePhoneForVerification,
  redactPhoneNumber,
  safeTwilioSendError,
} from "@/lib/phone-verification-core.cjs";

type TwilioErrorPayload = {
  code?: number | string;
  message?: string;
  more_info?: string;
  status?: number;
};

function getTwilioConfig() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID?.trim();

  if (!accountSid || !authToken || !serviceSid) {
    return {
      ok: false as const,
      error: "Phone verification is not configured. Please contact support.",
      logCode: "TWILIO_VERIFY_ENV_MISSING",
    };
  }

  if (!serviceSid.startsWith("VA")) {
    return {
      ok: false as const,
      error: "Phone verification is not configured correctly. Please contact support.",
      logCode: "TWILIO_VERIFY_SERVICE_SID_INVALID",
    };
  }

  return {
    ok: true as const,
    accountSid,
    authToken,
    serviceSid,
  };
}

function twilioAuthHeader(accountSid: string, authToken: string) {
  return `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`;
}

function logTwilioFailure({
  event,
  userId,
  phone,
  status,
  code,
  message,
  moreInfo,
}: {
  event: string;
  userId: string;
  phone?: string;
  status?: number;
  code?: number | string;
  message?: string;
  moreInfo?: string;
}) {
  console.error("PHONE VERIFICATION TWILIO FAILURE", {
    event,
    userId,
    phone: phone ? redactPhoneNumber(phone) : undefined,
    status,
    code,
    message,
    moreInfo,
  });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const admin = createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const normalized = normalizePhoneForVerification({
    country: body?.country,
    phone: body?.phone,
  });

  if (!normalized.ok) {
    return NextResponse.json({ error: normalized.error }, { status: 400 });
  }

  const e164Phone = normalized.e164 as string;
  const countryCallingCode = normalized.countryCallingCode as string;
  const countryIso = normalized.countryIso as string;

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id, phone_verification_sent_at, phone_verification_status")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("PHONE VERIFICATION PROFILE READ FAILED", {
      userId: user.id,
      code: profileError.code,
      message: profileError.message,
    });

    return NextResponse.json(
      { error: "We could not start phone verification. Please try again." },
      { status: 500 }
    );
  }

  if (profile?.phone_verification_status === "verified") {
    return NextResponse.json({ ok: true, alreadyVerified: true });
  }

  const cooldownSeconds = getPhoneVerificationCooldown(
    profile?.phone_verification_sent_at
  );

  if (cooldownSeconds > 0) {
    return NextResponse.json(
      {
        error: `Please wait ${cooldownSeconds} seconds before requesting another code.`,
        cooldownSeconds,
      },
      { status: 429 }
    );
  }

  const config = getTwilioConfig();

  if (!config.ok) {
    console.error("PHONE VERIFICATION CONFIG ERROR", {
      userId: user.id,
      code: config.logCode,
    });

    return NextResponse.json({ error: config.error }, { status: 500 });
  }

  const params = new URLSearchParams({
    To: e164Phone,
    Channel: "sms",
  });

  const response = await fetch(
    `https://verify.twilio.com/v2/Services/${encodeURIComponent(
      config.serviceSid
    )}/Verifications`,
    {
      method: "POST",
      headers: {
        Authorization: twilioAuthHeader(config.accountSid, config.authToken),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
      cache: "no-store",
    }
  );

  const payload = (await response.json().catch(() => ({}))) as
    | TwilioErrorPayload
    | Record<string, unknown>;

  if (!response.ok || !isTwilioVerifyAccepted(payload)) {
    const errorPayload = payload as TwilioErrorPayload;
    logTwilioFailure({
      event: "send",
      userId: user.id,
      phone: e164Phone,
      status: response.status,
      code: errorPayload.code,
      message: errorPayload.message,
      moreInfo: errorPayload.more_info,
    });

    const safeError = safeTwilioSendError({
      code: errorPayload.code,
      status: response.status,
      message: errorPayload.message,
    });

    await admin
      .from("profiles")
      .update({
        phone: e164Phone,
        phone_country_code: countryCallingCode,
        phone_country_iso: countryIso,
        phone_number_e164: e164Phone,
        phone_verification_status: "failed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    return NextResponse.json({ error: safeError }, { status: response.status || 502 });
  }

  const sentAt = new Date().toISOString();
  const { error: updateError } = await admin
    .from("profiles")
    .update({
      phone: e164Phone,
      phone_country_code: countryCallingCode,
      phone_country_iso: countryIso,
      phone_number_e164: e164Phone,
      phone_verified: false,
      phone_verified_at: null,
      phone_verification_status: "code_sent",
      phone_verification_sent_at: sentAt,
      updated_at: sentAt,
    })
    .eq("id", user.id);

  if (updateError) {
    console.error("PHONE VERIFICATION PROFILE UPDATE FAILED", {
      userId: user.id,
      code: updateError.code,
      message: updateError.message,
    });

    return NextResponse.json(
      { error: "Twilio accepted the code, but we could not update your profile. Please contact support." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    phone: e164Phone,
    cooldownSeconds: 45,
  });
}
