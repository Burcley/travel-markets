export function inquiryDeclinedTemplate({
  listingTitle,
  searchUrl,
}: {
  listingTitle: string;
  searchUrl: string;
}) {
  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111;">
      <h2>Your inquiry was declined</h2>

      <p>The owner declined your inquiry for:</p>

      <p><strong>${listingTitle}</strong></p>

      <p>You can keep browsing and contact other owners on Travel Markets.</p>

      <p>
        <a href="${searchUrl}" style="display:inline-block;background:#000;color:#fff;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:bold;">
          Browse Listings
        </a>
      </p>

      <p style="color:#666;font-size:13px;">
        Travel Markets — Stay • Rent • Explore
      </p>
    </div>
  `;
}