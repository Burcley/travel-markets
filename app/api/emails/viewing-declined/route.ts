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

    const { data: viewing, error } = await supabaseAdmin
      .from("viewings")
      .select("id, owner_id, requester_id, listing_id, status")
      .eq("id", viewingId)
      .maybeSingle();

    if (error || !viewing) {
      return NextResponse.json(
        { error: error?.message || "Viewing not found" },
        { status: 404 }
      );
    }

    if (viewing.owner_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: listing } = await supabaseAdmin
      .from("listings")
      .select("title")
      .eq("id", viewing.listing_id)
      .maybeSingle();

    const { data: requesterUser } =
      await supabaseAdmin.auth.admin.getUserById(viewing.requester_id);

    if (!requesterUser?.user?.email) {
      return NextResponse.json(
        { error: "Requester email not found" },
        { status: 404 }
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    await resend.emails.send({
      from:
        process.env.EMAIL_FROM ||
        "Travel Markets <noreply@travelmarkets.ca>",
      to: requesterUser.user.email,
      subject: "Your viewing request was declined",
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111">
          <h2>Your viewing request was declined</h2>
          <p>The owner declined your viewing request for:</p>
          <p><strong>${listing?.title || "a listing"}</strong></p>
          <p>You can continue browsing other listings on Travel Markets.</p>
          <p>
            <a href="${appUrl}/search" style="display:inline-block;background:#000;color:#fff;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:bold;">
              Browse Listings
            </a>
          </p>
        </div>
      `,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("VIEWING DECLINED EMAIL ERROR:", error);

    return NextResponse.json(
      { error: error?.message || "Failed to send viewing declined email" },
      { status: 500 }
    );
  }
}