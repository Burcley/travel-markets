export function newInquiryTemplate({
  listingTitle,
  studentMessage,
  inquiriesUrl,
}: {
  listingTitle: string;
  studentMessage: string;
  inquiriesUrl: string;
}) {
  return `
    <div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;padding:28px;">
      <h1>New Housing Inquiry</h1>

      <p>You received a new inquiry for:</p>

      <p>
        <strong>${listingTitle}</strong>
      </p>

      <div style="padding:16px;background:#f5f5f5;border-radius:10px;margin:16px 0;">
        ${studentMessage}
      </div>

      <a
        href="${inquiriesUrl}"
        style="
          display:inline-block;
          padding:12px 18px;
          background:black;
          color:white;
          text-decoration:none;
          border-radius:10px;
          font-weight:bold;
        "
      >
        View Inquiry
      </a>

      <p style="margin-top:24px;color:#666;font-size:13px;">
        Travel Markets
      </p>
    </div>
  `;
}