import assert from "node:assert/strict";
import test from "node:test";
import { Webhook } from "standardwebhooks";
import {
  normalizeHookSecret,
  processSupabaseAuthEmailHook,
  verifySupabaseAuthHookPayload,
} from "../lib/email/supabase-auth-hook-core.mjs";

const base64Secret = Buffer.from("travel-markets-test-hook-secret").toString(
  "base64"
);
const supabaseSecret = `v1,whsec_${base64Secret}`;
const requestUrl = "https://travelmarkets.ca/api/auth/send-email-hook";

function signedHeaders(rawBody, { secret = supabaseSecret } = {}) {
  const messageId = "msg_test_123";
  const timestamp = new Date();
  const webhook = new Webhook(normalizeHookSecret(secret));

  return {
    "webhook-id": messageId,
    "webhook-timestamp": String(Math.floor(timestamp.getTime() / 1000)),
    "webhook-signature": webhook.sign(messageId, timestamp, rawBody),
  };
}

function validPayload(overrides = {}) {
  return {
    user: {
      email: "student@example.com",
      ...overrides.user,
    },
    email_data: {
      email_action_type: "signup",
      token_hash: "token_hash_123",
      site_url: "https://travelmarkets.ca",
      ...overrides.email_data,
    },
  };
}

function renderSubject(kind) {
  return `subject:${kind}`;
}

function renderHtml({ kind, actionUrl }) {
  return `<p>${kind}:${actionUrl}</p>`;
}

test("valid signed Supabase auth hook request succeeds", async () => {
  const rawBody = JSON.stringify(validPayload());
  const sent = [];

  const result = await processSupabaseAuthEmailHook({
    rawBody,
    headers: signedHeaders(rawBody),
    requestUrl,
    env: {
      SUPABASE_AUTH_SEND_EMAIL_HOOK_SECRET: supabaseSecret,
      AUTH_EMAIL_FROM: "Travel Markets <noreply@travelmarkets.ca>",
      NEXT_PUBLIC_SITE_URL: "https://travelmarkets.ca",
    },
    sendEmail: async (email) => {
      sent.push(email);
    },
    subjectForKind: renderSubject,
    htmlForEmail: renderHtml,
  });

  assert.equal(result.status, 200);
  assert.deepEqual(result.body, {});
  assert.equal(sent.length, 1);
  assert.equal(sent[0].from, "Travel Markets <noreply@travelmarkets.ca>");
  assert.equal(sent[0].to, "student@example.com");
  assert.equal(sent[0].subject, "subject:verification");
  assert.match(sent[0].html, /token_hash_123/);
});

test("missing Standard Webhooks signature headers are rejected", () => {
  const rawBody = JSON.stringify(validPayload());
  const result = verifySupabaseAuthHookPayload({
    rawBody,
    headers: {},
    secret: supabaseSecret,
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, 401);
});

test("invalid Standard Webhooks signature is rejected", () => {
  const rawBody = JSON.stringify(validPayload());
  const headers = signedHeaders(rawBody);
  const result = verifySupabaseAuthHookPayload({
    rawBody: JSON.stringify(validPayload({ user: { email: "changed@example.com" } })),
    headers,
    secret: supabaseSecret,
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, 401);
});

test("malformed signed payload is handled safely", async () => {
  const rawBody = "not-json";
  const result = await processSupabaseAuthEmailHook({
    rawBody,
    headers: signedHeaders(rawBody),
    requestUrl,
    env: {
      SUPABASE_AUTH_SEND_EMAIL_HOOK_SECRET: supabaseSecret,
    },
    sendEmail: async () => {
      throw new Error("sendEmail should not be called");
    },
    subjectForKind: renderSubject,
    htmlForEmail: renderHtml,
  });

  assert.equal(result.status, 400);
  assert.match(result.body.error, /invalid/i);
});

test("valid request reaches mocked Resend sending logic", async () => {
  const rawBody = JSON.stringify(
    validPayload({
      email_data: {
        email_action_type: "recovery",
        confirmation_url: "https://travelmarkets.ca/reset-password?token=abc",
      },
    })
  );
  let called = false;

  await processSupabaseAuthEmailHook({
    rawBody,
    headers: signedHeaders(rawBody),
    requestUrl,
    env: {
      SUPABASE_AUTH_SEND_EMAIL_HOOK_SECRET: supabaseSecret,
    },
    sendEmail: async (email) => {
      called = true;
      assert.equal(email.to, "student@example.com");
      assert.equal(email.subject, "subject:recovery");
      assert.match(email.html, /reset-password/);
    },
    subjectForKind: renderSubject,
    htmlForEmail: renderHtml,
  });

  assert.equal(called, true);
});
