export function viewingRequestedTemplate({
  listingTitle,
  viewingDate,
  viewingTime,
  viewingsUrl,
}: {
  listingTitle: string;
  viewingDate: string;
  viewingTime: string;
  viewingsUrl: string;
}) {
  return `
    <div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;padding:28px;">
      <h1>New viewing request</h1>
      <p>A student requested a viewing for:</p>
      <p><strong>${listingTitle}</strong></p>

      <p><strong>Date:</strong> ${viewingDate}</p>
      <p><strong>Time:</strong> ${viewingTime}</p>

      <a href="${viewingsUrl}" style="display:inline-block;margin-top:16px;background:#fff;color:#000;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:bold;border:1px solid #ddd;">
        Review Viewing
      </a>

      <p style="margin-top:24px;color:#666;font-size:13px;">
        Travel Markets
      </p>
    </div>
  `;
}