import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { resend } from "@/lib/email/resend";
import { newMessageTemplate } from "@/lib/email/templates/new-message";

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { messageId } = await request.json();

    if (!messageId) {
      return NextResponse.json({ error: "Missing messageId" }, { status: 400 });
    }

    const { data: message } = await supabaseAdmin
      .from("messages")
      .select("id, inquiry_id, listing_id, receiver_id, body")
      .eq("id", messageId)
      .maybeSingle();

    if (!message) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    const { data: listing } = await supabaseAdmin
      .from("listings")
      .select("title")
      .eq("id", message.listing_id)
      .maybeSingle();

    const { data: receiverUser } =
      await supabaseAdmin.auth.admin.getUserById(message.receiver_id);

    const email = receiverUser?.user?.email;

    if (!email) {
      return NextResponse.json({ error: "Receiver email not found" }, { status: 404 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const result = await resend.emails.send({
      from: process.env.EMAIL_FROM || "Travel Markets <noreply@travelmarkets.ca>",
      to: email,
      subject: "New message on Travel Markets",
      html: newMessageTemplate({
        listingTitle: listing?.title || "your housing inquiry",
        messagePreview: message.body || "You received a new message.",
        chatUrl: `${appUrl}/messages/${message.inquiry_id}`,
      }),
    });

    console.log("NEW MESSAGE EMAIL SENT:", result);

    return NextResponse.json({ success: true, sentTo: email });
  } catch (error: any) {
    console.error("NEW MESSAGE EMAIL ERROR:", error);

    return NextResponse.json(
      { error: error?.message || "Failed to send new message email" },
      { status: 500 }
    );
  }
}