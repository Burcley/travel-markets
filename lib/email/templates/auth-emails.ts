import { brandedEmailLayout } from "./branded-layout";

export type AuthEmailKind =
  | "verification"
  | "recovery"
  | "email_change"
  | "invite";

const copy = {
  verification: {
    subject: "Verify your email address | Travel Markets",
    headline: "Welcome to Travel Markets",
    eyebrow: "Travel Markets",
    cta: "Verify Email",
    body: `
      <p style="margin:0 0 14px 0;">Thank you for joining Travel Markets.</p>
      <p style="margin:0 0 14px 0;">Please verify your email address to activate your account and continue building a trusted marketplace for students and landlords.</p>
    `,
    secondary:
      "If you did not create a Travel Markets account, you can safely ignore this message.",
  },
  recovery: {
    subject: "Reset your password | Travel Markets",
    headline: "Reset your password",
    eyebrow: "Travel Markets Security",
    cta: "Reset Password",
    body: `
      <p style="margin:0 0 14px 0;">Use this secure link to reset your Travel Markets password.</p>
      <p style="margin:0;">If you did not request a password reset, you can safely ignore this email.</p>
    `,
    secondary:
      "For your security, this link expires automatically after a short time.",
  },
  email_change: {
    subject: "Confirm your new email | Travel Markets",
    headline: "Confirm your new email",
    eyebrow: "Travel Markets Security",
    cta: "Confirm Email",
    body: `
      <p style="margin:0 0 14px 0;">Confirm this email address to keep your Travel Markets account secure.</p>
      <p style="margin:0;">If you did not request this change, contact Travel Markets support.</p>
    `,
    secondary:
      "For your security, this confirmation link expires automatically.",
  },
  invite: {
    subject: "You are invited to Travel Markets",
    headline: "You are invited",
    eyebrow: "Travel Markets",
    cta: "Accept Invitation",
    body: `
      <p style="margin:0 0 14px 0;">You have been invited to join Travel Markets.</p>
      <p style="margin:0;">Accept your invitation to set up your account.</p>
    `,
    secondary:
      "If you were not expecting this invitation, you can safely ignore it.",
  },
} satisfies Record<
  AuthEmailKind,
  {
    subject: string;
    headline: string;
    eyebrow: string;
    cta: string;
    body: string;
    secondary: string;
  }
>;

export function authEmailSubject(kind: AuthEmailKind) {
  return copy[kind].subject;
}

export function authEmailHtml({
  kind,
  actionUrl,
}: {
  kind: AuthEmailKind;
  actionUrl: string;
}) {
  const email = copy[kind];

  return brandedEmailLayout({
    preheader:
      kind === "verification"
        ? "Verify your Travel Markets account."
        : email.subject,
    eyebrow: email.eyebrow,
    headline: email.headline,
    body: email.body,
    ctaLabel: email.cta,
    ctaUrl: actionUrl,
    secondary: `
      <p style="margin:0 0 10px 0;">${email.secondary}</p>
      <p style="margin:0 0 10px 0;">If the button does not work, copy and paste this secure link into your browser:</p>
      <p style="margin:0;word-break:break-all;color:#f9a8d4;">${actionUrl}</p>
    `,
  });
}
