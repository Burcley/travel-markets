import { brandedEmailLayout, emailText } from "./branded-layout";

export function identityRejectedTemplate({
  name,
  reason,
  verifyUrl,
}: {
  name?: string | null;
  reason?: string | null;
  verifyUrl: string;
}) {
  const safeReason =
    reason || "Your submitted information could not be verified.";

  return brandedEmailLayout({
    preheader: "Your Travel Markets identity verification needs another review.",
    eyebrow: "Identity verification",
    headline: "Verification needs another look",
    body: `
      <p style="margin:0 0 14px 0;">Hi ${emailText(name || "there")},</p>
      <p style="margin:0 0 14px 0;">Your Travel Markets identity verification was reviewed, but it could not be approved at this time.</p>
      <div style="margin:18px 0;padding:16px;border-radius:16px;border:1px solid rgba(248,113,113,.28);background:rgba(248,113,113,.10);color:#fecaca;">
        <strong>Reason:</strong> ${emailText(safeReason)}
      </div>
      <p style="margin:0;">You can resubmit your verification documents from your account.</p>
    `,
    ctaLabel: "Resubmit Verification",
    ctaUrl: verifyUrl,
  });
}
