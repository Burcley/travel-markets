import { NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  const { email, name, subject, response } = await request.json();

  if (!email || !response) {
    return NextResponse.json(
      { error: "Missing email or response" },
      { status: 400 }
    );
  }

  await resend.emails.send({
    from: process.env.EMAIL_FROM || "Travel Markets <onboarding@resend.dev>",
    to: email,
    subject: `Travel Markets Support: ${subject || "Response"}`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6">
        <h2>Support Response</h2>
        <p>Hi ${name || "there"},</p>
        <p>${response}</p>
        <p>Thank you for contacting Travel Markets Support.</p>
      </div>
    `,
  });

  return NextResponse.json({ success: true });
}