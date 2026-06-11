import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const body = await request.json();
    const listingId = body.listingId;

    if (!listingId) {
      return NextResponse.json(
        { error: "Missing listingId" },
        { status: 400 }
      );
    }

    const { error } = await supabase.from("listing_views").insert({
      listing_id: listingId,
      user_id: user?.id || null,
    });

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("LISTING VIEW TRACK ERROR:", error);

    return NextResponse.json(
      { error: "Failed to track listing view" },
      { status: 500 }
    );
  }
}