import { NextRequest, NextResponse } from "next/server";
import {
  getFoundingProfile,
  getFoundingProgress,
  getFoundingPublicStats,
  isLandlordRole,
  reserveAndEvaluateFoundingLandlord,
} from "@/lib/founding-landlords/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await getFoundingProfile(user.id);

  if (!profile) {
    return NextResponse.json({ error: "Profile not found." }, { status: 404 });
  }

  let evaluation: Record<string, unknown> | null = null;
  const referralCode = request.nextUrl.searchParams.get("ref");

  if (
    isLandlordRole(profile.role) &&
    !profile.is_admin &&
    profile.founding_status !== "confirmed" &&
    profile.founding_status !== "disqualified" &&
    !profile.founding_benefits_disabled
  ) {
    try {
      evaluation = await reserveAndEvaluateFoundingLandlord({
        userId: user.id,
        referralCode,
      });
    } catch (error) {
      console.error("FOUNDING STATUS ROUTE ERROR:", error);
    }
  }

  const [freshProfile, progress, stats] = await Promise.all([
    getFoundingProfile(user.id),
    getFoundingProgress(user.id),
    getFoundingPublicStats(),
  ]);

  return NextResponse.json({
    profile: freshProfile || profile,
    progress,
    stats,
    evaluation,
    benefits: {
      platformCommissionWaivedMonths: 12,
      lifetimeDiscountPercentage:
        freshProfile?.founding_discount_percentage ||
        profile.founding_discount_percentage ||
        25,
      monthlyFreeBoosts: 2,
      referralReward: "One extra 7-day listing boost per qualified landlord referral.",
    },
  });
}
