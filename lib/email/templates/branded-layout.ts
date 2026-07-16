function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function emailText(value?: string | null) {
  return escapeHtml(value || "");
}

export function brandedEmailLayout({
  preheader,
  eyebrow,
  headline,
  body,
  ctaLabel,
  ctaUrl,
  secondary,
}: {
  preheader: string;
  eyebrow?: string;
  headline: string;
  body: string;
  ctaLabel?: string;
  ctaUrl?: string;
  secondary?: string;
}) {
  const safePreheader = emailText(preheader);
  const safeEyebrow = emailText(eyebrow || "Travel Markets");
  const safeHeadline = emailText(headline);
  const safeCtaLabel = emailText(ctaLabel || "");
  const safeCtaUrl = emailText(ctaUrl || "");

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${safeHeadline}</title>
  </head>
  <body style="margin:0;background:#030303;color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${safePreheader}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#030303;padding:32px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;">
            <tr>
              <td style="padding:0 0 18px 0;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td>
                      <div style="display:inline-block;width:48px;height:48px;border-radius:16px;background:#ff2d5f;text-align:center;line-height:48px;font-weight:900;font-size:18px;color:#fff;box-shadow:0 18px 40px rgba(255,45,95,.28);">TM</div>
                    </td>
                    <td align="right" style="font-size:13px;color:#a1a1aa;font-weight:600;">Stay • Rent • Explore</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="border:1px solid rgba(255,255,255,.10);border-radius:28px;background:radial-gradient(circle at top left,rgba(255,45,95,.22),rgba(24,24,27,.96) 42%,#050505 100%);padding:34px;box-shadow:0 28px 80px rgba(0,0,0,.45);">
                <p style="margin:0 0 12px 0;color:#f9a8d4;font-size:12px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;">${safeEyebrow}</p>
                <h1 style="margin:0;color:#ffffff;font-size:34px;line-height:1.08;font-weight:900;letter-spacing:-.03em;">${safeHeadline}</h1>
                <div style="margin-top:20px;color:#d4d4d8;font-size:16px;line-height:1.72;">${body}</div>
                ${
                  safeCtaLabel && safeCtaUrl
                    ? `<div style="margin-top:30px;"><a href="${safeCtaUrl}" style="display:inline-block;border-radius:16px;background:#ffffff;color:#050505;text-decoration:none;padding:15px 24px;font-size:15px;font-weight:900;box-shadow:0 14px 35px rgba(255,255,255,.12);">${safeCtaLabel}</a></div>`
                    : ""
                }
                ${
                  secondary
                    ? `<div style="margin-top:22px;color:#a1a1aa;font-size:13px;line-height:1.6;">${secondary}</div>`
                    : ""
                }
              </td>
            </tr>
            <tr>
              <td style="padding:26px 8px 0;text-align:center;color:#71717a;font-size:13px;line-height:1.7;">
                <p style="margin:0;font-weight:800;color:#e4e4e7;">Travel Markets</p>
                <p style="margin:4px 0 0;">Canada&apos;s Trusted Student Housing Marketplace</p>
                <p style="margin:4px 0 0;">Stay • Rent • Explore</p>
                <p style="margin:18px 0 0;">
                  <a href="https://travelmarkets.ca/help" style="color:#f9a8d4;text-decoration:none;">Help</a>
                  <span style="color:#3f3f46;"> &nbsp;•&nbsp; </span>
                  <a href="https://travelmarkets.ca/privacy" style="color:#f9a8d4;text-decoration:none;">Privacy</a>
                  <span style="color:#3f3f46;"> &nbsp;•&nbsp; </span>
                  <a href="https://travelmarkets.ca/terms" style="color:#f9a8d4;text-decoration:none;">Terms</a>
                  <span style="color:#3f3f46;"> &nbsp;•&nbsp; </span>
                  <a href="https://travelmarkets.ca/safety" style="color:#f9a8d4;text-decoration:none;">Safety</a>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
