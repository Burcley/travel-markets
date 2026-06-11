import { resend } from "./resend";
import { viewingApprovedTemplate } from "./templates/viewing-approved";

export async function sendViewingApprovedEmail(
  email: string,
  listingTitle: string,
  viewingDate: string
) {
  return resend.emails.send({
    from: "Travel Markets <noreply@yourdomain.com>",
    to: email,
    subject: "Viewing Approved",
    html: viewingApprovedTemplate(
      listingTitle,
      viewingDate
    ),
  });
}