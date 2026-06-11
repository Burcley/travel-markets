export function viewingRequestedTemplate({
  listingTitle,
  viewingDate,
  viewingTime,
}: {
  listingTitle: string;
  viewingDate: string;
  viewingTime: string;
}) {
  return `
    <div>
      <h2>New Viewing Request</h2>
      <p>A student requested a viewing.</p>

      <p><strong>${listingTitle}</strong></p>

      <p>Date: ${viewingDate}</p>
      <p>Time: ${viewingTime}</p>
    </div>
  `;
}