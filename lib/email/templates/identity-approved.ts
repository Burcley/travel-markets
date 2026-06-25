export function identityApprovedTemplate({
  name,
  profileUrl,
}: {
  name?: string | null;
  profileUrl: string;
}) {
  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111;">
      <h2>Identity verification approved</h2>

      <p>Hi ${name || "there"},</p>

      <p>Your Travel Markets identity verification has been approved.</p>

      <p>Your verified badge and trust signals are now active on your account.</p>

      <p>
        <a href="${profileUrl}" style="display:inline-block;background:#000;color:#fff;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:bold;">
          View Profile
        </a>
      </p>

      <p style="color:#666;font-size:13px;">
        Travel Markets — Stay • Rent • Explore
      </p>
    </div>
  `;
}