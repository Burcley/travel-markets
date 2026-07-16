import { NextResponse } from "next/server";
import { resend } from "@/lib/email/resend";
import {
  authEmailHtml,
  authEmailSubject,
  type AuthEmailKind,
} from "@/lib/email/templates/auth-emails";

type SupabaseSendEmailHookPayload = {
  user?: {
    email?: string;
    new_email?: string;
    user_metadata?: Record<string, unknown>;
  };
  email_data?: {
    email_action_type?: string;
    token_hash?: string;
    token_hash_new?: string;
    redirect_to?: string;
    site_url?: string;
    confirmation_url?: string;
    ConfirmationURL?: string;
  };
};

const FROM_EMAIL = "Travel Markets <no-reply@travelmarkets.ca>";

function assertAuthorized(request: Request) {
  const hookSecret = process.env.SUPABASE_AUTH_SEND_EMAIL_HOOK_SECRET;

  if (!hookSecret) return true;

  const authorization = request.headers.get("authorization") || "";
  return authorization === `Bearer ${hookSecret}`;
}

function authKind(actionType?: string | null): AuthEmailKind {
  const normalized = String(actionType || "").toLowerCase();

  if (normalized.includes("recovery") || normalized.includes("reset")) {
    return "recovery";
  }

  if (normalized.includes("email_change") || normalized.includes("change")) {
    return "email_change";
  }

  if (normalized.includes("invite")) {
    return "invite";
  }

  return "verification";
}

function otpType(actionType?: string | null) {
  const normalized = String(actionType || "").toLowerCase();

  if (normalized.includes("recovery")) return "recovery";
  if (normalized.includes("invite")) return "invite";
  if (normalized.includes("email_change")) return "email_change";
  if (normalized.includes("magiclink")) return "magiclink";
  return "email";
}

function actionUrl({
  request,
  payload,
}: {
  request: Request;
  payload: SupabaseSendEmailHookPayload;
}) {
  const emailData = payload.email_data || {};
  const providedUrl = emailData.confirmation_url || emailData.ConfirmationURL;

  if (providedUrl) return providedUrl;

  const tokenHash = emailData.token_hash_new || emailData.token_hash;
  if (!tokenHash) return null;

  const requestUrl = new URL(request.url);
  const appUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    emailData.site_url ||
    requestUrl.origin;
  const url = new URL("/auth/callback", appUrl);

  url.searchParams.set("token_hash", tokenHash);
  url.searchParams.set("type", otpType(emailData.email_action_type));

  if (emailData.redirect_to) {
    url.searchParams.set("next", emailData.redirect_to);
  }

  return url.toString();
}

function recipientFor({
  payload,
  kind,
}: {
  payload: SupabaseSendEmailHookPayload;
  kind: AuthEmailKind;
}) {
  if (kind === "email_change" && payload.user?.new_email) {
    return payload.user.new_email;
  }

  return payload.user?.email || null;
}

export async function POST(request: Request) {
  if (!assertAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: SupabaseSendEmailHookPayload;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid hook payload." }, { status: 400 });
  }

  const kind = authKind(payload.email_data?.email_action_type);
  const to = recipientFor({ payload, kind });
  const url = actionUrl({ request, payload });

  if (!to || !url) {
    console.error("SUPABASE AUTH EMAIL HOOK MISSING DATA", {
      hasRecipient: Boolean(to),
      hasUrl: Boolean(url),
      actionType: payload.email_data?.email_action_type,
    });

    return NextResponse.json(
      { error: "Missing email hook recipient or action URL." },
      { status: 400 }
    );
  }

  try {
    await resend.emails.send({
      from: process.env.AUTH_EMAIL_FROM || FROM_EMAIL,
      to,
      subject: authEmailSubject(kind),
      html: authEmailHtml({
        kind,
        actionUrl: url,
      }),
    });

    return NextResponse.json({});
  } catch (error) {
    console.error("RESEND AUTH EMAIL HOOK ERROR", error);

    return NextResponse.json(
      { error: "Failed to send authentication email." },
      { status: 500 }
    );
  }
}
