import { NextResponse } from "next/server";
import { resolvePropertyRelationshipStatus } from "@/lib/public-profile-verification-core.mjs";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;

  if (!userId) {
    return NextResponse.json(
      { error: "User profile was not found." },
      { status: 404 }
    );
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("verification_submissions")
    .select("status")
    .eq("user_id", userId)
    .eq("verification_type", "property_relationship")
    .order("submitted_at", { ascending: false });

  if (error) {
    console.error("Public profile verification status lookup failed", {
      userId,
      code: error.code,
      message: error.message,
    });

    return NextResponse.json(
      { error: "Verification status is unavailable right now." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    propertyRelationshipStatus: resolvePropertyRelationshipStatus(data || []),
  });
}
