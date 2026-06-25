export function identityRejectedTemplate({
  name,
  reason,
  verifyUrl,
}: {
  name?: string | null;
  reason?: string | null;
  verifyUrl: string;
}) {
  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111;">
      <h2>Identity verification could not be approved</h2>

      <p>Hi ${name || "there"},</p>

      <p>Your Travel Markets identity verification was reviewed, but it could not be approved at this time.</p>

      <p><strong>Reason:</strong> ${reason || "Your submitted information could not be verified."}</p>

      <p>You can resubmit your verification documents from your account.</p>

      <p>
        <a href="${verifyUrl}" style="display:inline-block;background:#000;color:#fff;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:bold;">
          Resubmit Verification
        </a>
      </p>

      <p style="color:#666;font-size:13px;">
        Travel Markets — Stay • Rent • Explore
      </p>
    </div>
  `;
}