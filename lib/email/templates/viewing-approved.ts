type ViewingApprovedTemplateProps = {
  listingTitle: string;
  viewingDate: string;
  viewingTime: string;
  addressUrl: string;
};

export function viewingApprovedTemplate({
  listingTitle,
  viewingDate,
  viewingTime,
  addressUrl,
}: ViewingApprovedTemplateProps) {
  return `
    <div style="font-family: Arial, sans-serif; background:#050505; color:#ffffff; padding:32px;">
      <div style="max-width:640px; margin:0 auto; background:#111111; border:1px solid #262626; border-radius:24px; padding:32px;">
        <h1 style="margin:0 0 16px; font-size:28px;">Your viewing was approved</h1>

        <p style="color:#d4d4d4; font-size:16px; line-height:1.6;">
          Your viewing request for <strong>${listingTitle}</strong> has been approved.
        </p>

        <div style="margin:24px 0; padding:18px; border-radius:16px; background:#052e20; border:1px solid #065f46;">
          <p style="margin:0 0 8px; color:#6ee7b7; font-weight:bold;">Viewing Details</p>
          <p style="margin:0; color:#ffffff;"><strong>Date:</strong> ${viewingDate}</p>
          <p style="margin:8px 0 0; color:#ffffff;"><strong>Time:</strong> ${viewingTime}</p>
        </div>

        <p style="color:#a3a3a3; font-size:14px; line-height:1.6;">
          You can now view the unlocked address inside Travel Markets.
        </p>

        <a href="${addressUrl}" style="display:inline-block; margin-top:18px; background:#10b981; color:#000000; padding:14px 20px; border-radius:12px; text-decoration:none; font-weight:bold;">
          View Unlocked Address
        </a>

        <p style="margin-top:32px; color:#737373; font-size:13px;">
          Travel Markets
        </p>
      </div>
    </div>
  `;
}