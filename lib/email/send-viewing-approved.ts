import { resend } from "./resend";
import { viewingApprovedTemplate } from "./templates/viewing-approved";

export async function sendViewingApprovedEmail(
  email: string,
  listingTitle: string,
  viewingDate: string,
  viewingTime: string,
  addressUrl: string
) {
  return resend.emails.send({
    from:
      process.env.EMAIL_FROM ||
      "Travel Markets <noreply@travelmarkets.ca>",
    to: email,
    subject: "Viewing Approved",
    html: viewingApprovedTemplate({
      listingTitle,
      viewingDate,
      viewingTime,
      addressUrl,
    }),
  });
}