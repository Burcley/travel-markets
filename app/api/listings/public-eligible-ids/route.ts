import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getVerifiedPublicListingIds } from "@/lib/listings/public-visibility";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const admin = createAdminClient();
    const listingIds = await getVerifiedPublicListingIds(admin as never);

    return NextResponse.json({ listingIds });
  } catch (error) {
    console.error("PUBLIC ELIGIBLE LISTING IDS ERROR:", error);

    return NextResponse.json({ listingIds: [] }, { status: 500 });
  }
}
