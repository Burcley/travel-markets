export function newMessageTemplate({
  listingTitle,
  messagePreview,
  chatUrl,
}: {
  listingTitle: string;
  messagePreview: string;
  chatUrl: string;
}) {
  return `
    <div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;padding:28px;">
      <h1>New message</h1>
      <p>You received a new message about:</p>
      <p><strong>${listingTitle}</strong></p>

      <div style="margin:20px 0;padding:16px;background:#f5f5f5;border-radius:12px;">
        ${messagePreview}
      </div>

      <a href="${chatUrl}" style="display:inline-block;background:#000;color:#fff;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:bold;">
        Open Chat
      </a>

      <p style="margin-top:24px;color:#666;font-size:13px;">Travel Markets</p>
    </div>
  `;
}