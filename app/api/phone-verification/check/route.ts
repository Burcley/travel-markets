import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  isTwilioVerifyApproved,
  redactPhoneNumber,
  safeTwilioCheckError,
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
  userId,
  phone,
  status,
  code,
  message,
  moreInfo,
}: {
  userId: string;
  phone?: string;
  status?: number;
  code?: number | string;
  message?: string;
  moreInfo?: string;
}) {
  console.error("PHONE VERIFICATION TWILIO FAILURE", {
    event: "check",
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
  const code = String(body?.code || "").replace(/\D/g, "");

  if (code.length !== 6) {
    return NextResponse.json(
      { error: "Enter the six-digit verification code." },
      { status: 400 }
    );
  }

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id, phone_number_e164, phone")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("PHONE VERIFICATION PROFILE READ FAILED", {
      userId: user.id,
      code: profileError.code,
      message: profileError.message,
    });

    return NextResponse.json(
      { error: "We could not verify that code. Please try again." },
      { status: 500 }
    );
  }

  const phone = String(profile?.phone_number_e164 || profile?.phone || "");

  if (!phone.startsWith("+")) {
    return NextResponse.json(
      { error: "Please request a new verification code before verifying." },
      { status: 400 }
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
    To: phone,
    Code: code,
  });

  const response = await fetch(
    `https://verify.twilio.com/v2/Services/${encodeURIComponent(
      config.serviceSid
    )}/VerificationCheck`,
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

  if (!response.ok) {
    const errorPayload = payload as TwilioErrorPayload;
    logTwilioFailure({
      userId: user.id,
      phone,
      status: response.status,
      code: errorPayload.code,
      message: errorPayload.message,
      moreInfo: errorPayload.more_info,
    });

    return NextResponse.json(
      {
        error: safeTwilioCheckError({
          code: errorPayload.code,
          status: response.status,
          message: errorPayload.message,
        }),
      },
      { status: response.status || 502 }
    );
  }

  if (!isTwilioVerifyApproved(payload)) {
    return NextResponse.json(
      { error: "That code is incorrect. Please try again." },
      { status: 400 }
    );
  }

  const verifiedAt = new Date().toISOString();
  const { error: updateError } = await admin
    .from("profiles")
    .update({
      phone,
      phone_verified: true,
      phone_verified_at: verifiedAt,
      phone_verification_status: "verified",
      updated_at: verifiedAt,
    })
    .eq("id", user.id);

  if (updateError) {
    console.error("PHONE VERIFICATION PROFILE UPDATE FAILED", {
      userId: user.id,
      code: updateError.code,
      message: updateError.message,
    });

    return NextResponse.json(
      { error: "Your code was approved, but we could not update your profile. Please contact support." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, phone });
}
