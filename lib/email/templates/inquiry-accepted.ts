export function inquiryAcceptedTemplate({
  listingTitle,
  inquiryUrl,
}: {
  listingTitle: string;
  inquiryUrl: string;
}) {
  return `
    <div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;padding:28px;">
      <h1>Your inquiry was accepted 🎉</h1>
      <p>The owner accepted your inquiry for:</p>
      <p><strong>${listingTitle}</strong></p>
      <p>You can now request a viewing inside Travel Markets.</p>

      <a href="${inquiryUrl}" style="display:inline-block;margin-top:16px;background:#10b981;color:#000;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:bold;">
        Open Inquiry
      </a>

      <p style="margin-top:24px;color:#666;font-size:13px;">
        Travel Markets
      </p>
    </div>
  `;
}