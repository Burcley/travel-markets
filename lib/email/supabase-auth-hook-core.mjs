import { Webhook, WebhookVerificationError } from "standardwebhooks";

export const FROM_EMAIL = "Travel Markets <noreply@travelmarkets.ca>";

export function normalizeHookSecret(secret) {
  const value = String(secret || "").trim();

  if (!value) return "";

  return value.replace(/^v\d+,/, "");
}

function headersToRecord(headers) {
  if (!headers) return {};

  if (typeof headers.entries === "function") {
    return Object.fromEntries(headers.entries());
  }

  return headers;
}

export function verifySupabaseAuthHookPayload({ rawBody, headers, secret }) {
  const normalizedSecret = normalizeHookSecret(secret);

  if (!normalizedSecret) {
    return {
      ok: false,
      status: 500,
      error: "Auth email hook secret is not configured.",
    };
  }

  try {
    const webhook = new Webhook(normalizedSecret);
    const payload = webhook.verify(rawBody, headersToRecord(headers));

    if (!payload || typeof payload !== "object") {
      return {
        ok: false,
        status: 400,
        error: "Invalid hook payload.",
      };
    }

    return {
      ok: true,
      payload,
    };
  } catch (error) {
    const isSignatureError = error instanceof WebhookVerificationError;

    return {
      ok: false,
      status: isSignatureError ? 401 : 400,
      error: isSignatureError ? "Unauthorized" : "Invalid hook payload.",
    };
  }
}

export function authKind(actionType) {
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

function otpType(actionType) {
  const normalized = String(actionType || "").toLowerCase();

  if (normalized.includes("recovery")) return "recovery";
  if (normalized.includes("invite")) return "invite";
  if (normalized.includes("email_change")) return "email_change";
  if (normalized.includes("magiclink")) return "magiclink";
  return "email";
}

export function actionUrl({ requestUrl, payload, env = {} }) {
  const emailData = payload.email_data || {};
  const providedUrl = emailData.confirmation_url || emailData.ConfirmationURL;

  if (providedUrl) return providedUrl;

  const tokenHash = emailData.token_hash_new || emailData.token_hash;
  if (!tokenHash) return null;

  const currentUrl = new URL(requestUrl);
  const isLocal =
    currentUrl.hostname === "localhost" || currentUrl.hostname === "127.0.0.1";
  const appUrl = isLocal
    ? currentUrl.origin
    : env.NEXT_PUBLIC_SITE_URL ||
      env.NEXT_PUBLIC_APP_URL ||
      emailData.site_url ||
      "https://travelmarkets.ca";
  const url = new URL("/auth/callback", appUrl);

  url.searchParams.set("token_hash", tokenHash);
  url.searchParams.set("type", otpType(emailData.email_action_type));

  if (emailData.redirect_to) {
    url.searchParams.set("next", emailData.redirect_to);
  }

  return url.toString();
}

export function recipientFor({ payload, kind }) {
  if (kind === "email_change" && payload.user?.new_email) {
    return payload.user.new_email;
  }

  return payload.user?.email || null;
}

export async function processSupabaseAuthEmailHook({
  rawBody,
  headers,
  requestUrl,
  env = process.env,
  sendEmail,
  subjectForKind,
  htmlForEmail,
}) {
  const verified = verifySupabaseAuthHookPayload({
    rawBody,
    headers,
    secret: env.SUPABASE_AUTH_SEND_EMAIL_HOOK_SECRET,
  });

  if (!verified.ok) {
    return {
      status: verified.status,
      body: { error: verified.error },
    };
  }

  const payload = verified.payload;
  const kind = authKind(payload.email_data?.email_action_type);
  const to = recipientFor({ payload, kind });
  const url = actionUrl({ requestUrl, payload, env });

  if (!to || !url) {
    return {
      status: 400,
      body: { error: "Missing email hook recipient or action URL." },
      log: {
        hasRecipient: Boolean(to),
        hasUrl: Boolean(url),
        actionType: payload.email_data?.email_action_type,
      },
    };
  }

  await sendEmail({
    from: env.AUTH_EMAIL_FROM || FROM_EMAIL,
    to,
    subject: subjectForKind(kind),
    html: htmlForEmail({
      kind,
      actionUrl: url,
    }),
  });

  return {
    status: 200,
    body: {},
  };
}
