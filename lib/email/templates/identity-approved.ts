import { brandedEmailLayout, emailText } from "./branded-layout";

export function identityApprovedTemplate({
  name,
  profileUrl,
}: {
  name?: string | null;
  profileUrl: string;
}) {
  return brandedEmailLayout({
    preheader: "Your Travel Markets identity verification has been approved.",
    eyebrow: "Identity verification",
    headline: "Identity verified",
    body: `
      <p style="margin:0 0 14px 0;">Hi ${emailText(name || "there")},</p>
      <p style="margin:0 0 14px 0;">Your Travel Markets identity verification has been approved.</p>
      <p style="margin:0;">Your verified badge and trust signals are now active on your account.</p>
    `,
    ctaLabel: "View Profile",
    ctaUrl: profileUrl,
  });
}
