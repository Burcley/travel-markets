import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  const { viewingId } = await request.json();

  if (!viewingId) {
    return NextResponse.json({ error: "Missing viewingId" }, { status: 400 });
  }

  const supabaseAdmin = createAdminClient();

  const { data: viewing, error } = await supabaseAdmin
    .from("viewings")
    .select(
      `
      id,
      owner_id,
      requester_id,
      listing_id,
      listings (
        title
      )
    `
    )
    .eq("id", viewingId)
    .single();

  if (error || !viewing) {
    return NextResponse.json({ error: "Viewing not found" }, { status: 404 });
  }

  const { data: users } = await supabaseAdmin
    .from("profiles")
    .select("id, email, full_name")
    .in("id", [viewing.owner_id, viewing.requester_id]);

  const listingTitle = (viewing.listings as any)?.title || "a listing";

  await Promise.all(
    (users || [])
      .filter((user) => user.email)
      .map((user) =>
        resend.emails.send({
          from:
            process.env.EMAIL_FROM || "Travel Markets <onboarding@resend.dev>",
          to: user.email,
          subject: "Viewing cancelled",
          html: `
            <div style="font-family:Arial,sans-serif;line-height:1.6">
              <h2>Viewing cancelled</h2>
              <p>Hi ${user.full_name || "there"},</p>
              <p>A viewing appointment for <strong>${listingTitle}</strong> has been cancelled.</p>
              <p>You can manage your viewing appointments from your Travel Markets account.</p>
            </div>
          `,
        })
      )
  );

  return NextResponse.json({ success: true });
}