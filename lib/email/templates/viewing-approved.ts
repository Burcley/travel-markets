export function viewingApprovedTemplate({
  listingTitle,
  viewingDate,
  viewingTime,
  addressUrl,
}: {
  listingTitle: string;
  viewingDate: string;
  viewingTime: string;
  addressUrl: string;
}) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
      <h1>Your viewing was approved</h1>
      <p>Your viewing request for <strong>${listingTitle}</strong> has been approved.</p>
      <p><strong>Date:</strong> ${viewingDate}</p>
      <p><strong>Time:</strong> ${viewingTime}</p>
      <p>You can now view the unlocked address inside Travel Markets.</p>
      <a href="${addressUrl}" style="display:inline-block;background:#10b981;color:#000;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:bold;">
        View Unlocked Address
      </a>
    </div>
  `;
}