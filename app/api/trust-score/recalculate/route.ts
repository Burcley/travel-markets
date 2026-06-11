import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select(
        "id, full_name, phone, bio, avatar_url, is_verified, identity_verified, phone_verified, student_email_verified, created_at"
      )
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "Profile not found." },
        { status: 404 }
      );
    }

    const { count: reviewCount } = await supabase
      .from("reviews")
      .select("*", { count: "exact", head: true })
      .eq("owner_id", user.id);

    const { count: acceptedViewings } = await supabase
      .from("viewings")
      .select("*", { count: "exact", head: true })
      .eq("owner_id", user.id)
      .eq("status", "accepted");

    let score = 20;

    if (profile.full_name) score += 10;
    if (profile.avatar_url) score += 10;
    if (profile.bio) score += 10;
    if (profile.phone) score += 10;
    if (profile.phone_verified) score += 10;
    if (profile.student_email_verified) score += 15;
    if (profile.identity_verified || profile.is_verified) score += 25;

    score += Math.min((reviewCount || 0) * 3, 15);
    score += Math.min((acceptedViewings || 0) * 2, 10);

    score = Math.min(score, 100);

    let trustLevel: "new" | "basic" | "trusted" | "elite" = "new";

    if (score >= 80) trustLevel = "elite";
    else if (score >= 60) trustLevel = "trusted";
    else if (score >= 35) trustLevel = "basic";

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        trust_score: score,
        trust_level: trustLevel,
        trust_score_updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      trust_score: score,
      trust_level: trustLevel,
    });
  } catch (error) {
    console.error("TRUST SCORE ERROR:", error);

    return NextResponse.json(
      { error: "Failed to recalculate trust score." },
      { status: 500 }
    );
  }
}