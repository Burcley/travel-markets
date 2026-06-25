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
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111;background:#ffffff;padding:24px;">
      <h2>New viewing request on Travel Markets</h2>

      <p>A student requested a viewing for your listing:</p>

      <p><strong>${listingTitle}</strong></p>

      <p><strong>Date:</strong> ${viewingDate}</p>
      <p><strong>Time:</strong> ${viewingTime}</p>

      <p>Please log in to approve or decline this viewing request.</p>

      <p>
        <a href="${viewingsUrl}" style="display:inline-block;background:#000;color:#fff;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:bold;">
          Review Viewing Request
        </a>
      </p>

      <p style="margin-top:24px;color:#666;font-size:13px;">
        Travel Markets — Stay • Rent • Explore
      </p>
    </div>
  `;
}