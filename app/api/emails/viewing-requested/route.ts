import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { resend } from "@/lib/email/resend";

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { viewingId } = await request.json();

    if (!viewingId) {
      return NextResponse.json({ error: "Missing viewingId" }, { status: 400 });
    }

    const { data: viewing, error: viewingError } = await supabaseAdmin
      .from("viewings")
      .select(
        "id, owner_id, requester_id, listing_id, requested_date, requested_time"
      )
      .eq("id", viewingId)
      .maybeSingle();

    if (viewingError || !viewing) {
      return NextResponse.json(
        { error: viewingError?.message || "Viewing not found" },
        { status: 404 }
      );
    }

    const { data: listing } = await supabaseAdmin
      .from("listings")
      .select("title")
      .eq("id", viewing.listing_id)
      .maybeSingle();

    const { data: ownerUser, error: ownerError } =
      await supabaseAdmin.auth.admin.getUserById(viewing.owner_id);

    if (ownerError || !ownerUser?.user?.email) {
      return NextResponse.json(
        { error: ownerError?.message || "Owner email not found" },
        { status: 404 }
      );
    }

    const ownerEmail = ownerUser.user.email;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const emailResult = await resend.emails.send({
      from:
        process.env.EMAIL_FROM ||
        "Travel Markets <noreply@travelmarkets.ca>",
      to: ownerEmail,
      subject: "ACTION NEEDED: New viewing request on Travel Markets",
      text: `
You received a new viewing request on Travel Markets.

Listing: ${listing?.title || "Your listing"}
Date: ${viewing.requested_date || "Date unavailable"}
Time: ${viewing.requested_time || "Time unavailable"}

Review it here:
${appUrl}/viewings
      `,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111; background: #ffffff; padding: 24px;">
          <h1>ACTION NEEDED: New viewing request</h1>
          <p>You received a new viewing request on Travel Markets.</p>

          <p><strong>Listing:</strong> ${listing?.title || "Your listing"}</p>
          <p><strong>Date:</strong> ${viewing.requested_date || "Date unavailable"}</p>
          <p><strong>Time:</strong> ${viewing.requested_time || "Time unavailable"}</p>

          <p>
            <a href="${appUrl}/viewings" style="display:inline-block;background:#000;color:#fff;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:bold;">
              Review Viewing
            </a>
          </p>
        </div>
      `,
    });

    console.log("VIEWING REQUEST EMAIL DEBUG:", {
      viewingId,
      ownerId: viewing.owner_id,
      ownerEmail,
      resendResult: emailResult,
    });

    return NextResponse.json({
      success: true,
      ownerEmail,
      viewingId,
      result: emailResult,
    });
  } catch (error: any) {
    console.error("VIEWING REQUESTED EMAIL HARD ERROR:", error);

    return NextResponse.json(
      { error: error?.message || "Failed to send viewing request email" },
      { status: 500 }
    );
  }
}