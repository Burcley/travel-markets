import { brandedEmailLayout } from "./branded-layout";

export const verificationEmailSubject =
  "Verify your email address | Travel Markets";

export function verificationEmailTemplate({
  verificationUrl,
}: {
  verificationUrl: string;
}) {
  return brandedEmailLayout({
    preheader:
      "Complete your Travel Markets account and access trusted student housing.",
    eyebrow: "Travel Markets",
    headline: "Verify your email address",
    body: `
      <p style="margin:0 0 14px 0;">Hi {{ .Data.full_name | default: "there" }},</p>
      <p style="margin:0 0 14px 0;">Welcome to Travel Markets.</p>
      <p style="margin:0 0 14px 0;">Please confirm your email address to secure your account and complete your registration.</p>
      <p style="margin:0;">Email verification helps us protect our community and maintain a trusted housing marketplace for students and property owners.</p>
    `,
    ctaLabel: "Verify my email",
    ctaUrl: verificationUrl,
    secondary:
      "<p style=\"margin:0 0 10px 0;\">This secure link will expire. If the button does not work, copy and paste this link into your browser:</p><p style=\"margin:0 0 16px 0;word-break:break-all;color:#f9a8d4;\">{{ .ConfirmationURL }}</p><p style=\"margin:0;\">If you did not create a Travel Markets account, you can safely ignore this email. No account access will be granted until the email address is confirmed.</p>",
  });
}

export const supabaseVerificationEmailHtml = verificationEmailTemplate({
  verificationUrl: "{{ .ConfirmationURL }}",
});
