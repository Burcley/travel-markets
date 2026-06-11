export function savedSearchAlertTemplate({
  searchTitle,
  listingTitle,
  price,
  city,
  campus,
  listingUrl,
}: {
  searchTitle: string;
  listingTitle: string;
  price: number | null;
  city: string | null;
  campus: string | null;
  listingUrl: string;
}) {
  return `
    <div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;padding:28px;">
      <h1>New listing match</h1>
      <p>A new listing matches your saved search:</p>
      <p><strong>${searchTitle}</strong></p>

      <div style="margin:20px 0;padding:18px;border:1px solid #ddd;border-radius:12px;">
        <h2>${listingTitle}</h2>
        <p>${city || "City hidden"}${campus ? ` • ${campus}` : ""}</p>
        <p><strong>${price ? `$${price}/month` : "Price not listed"}</strong></p>
      </div>

      <a href="${listingUrl}" style="display:inline-block;background:#000;color:#fff;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:bold;">
        View Listing
      </a>

      <p style="margin-top:24px;color:#666;font-size:13px;">
        Travel Markets
      </p>
    </div>
  `;
}