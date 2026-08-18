import { NextRequest, NextResponse } from "next/server";
import { getPublicListingEligibility } from "@/lib/listings/public-visibility";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  if (!id) {
    return NextResponse.json(
      { publiclyEligible: false, listingExists: false },
      { status: 400 }
    );
  }

  try {
    const eligibility = await getPublicListingEligibility(id);

    return NextResponse.json(eligibility);
  } catch (error) {
    console.error("PUBLIC LISTING ELIGIBILITY ERROR:", error);

    return NextResponse.json(
      { publiclyEligible: false, listingExists: false },
      { status: 500 }
    );
  }
}
