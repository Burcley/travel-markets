import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { canCreateOrActivateListing } from "@/lib/subscriptions/server";

const ACTIVE_STATUSES = new Set(["available", "pending"]);
const ALLOWED_STATUSES = new Set(["draft", "available", "pending", "rented"]);

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const admin = createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const listingId = String(body?.listingId || "");
  const status = String(body?.status || "");
  const dryRun = Boolean(body?.dryRun);

  if (!listingId || !ALLOWED_STATUSES.has(status)) {
    return NextResponse.json({ error: "Invalid listing status." }, { status: 400 });
  }

  const { data: listing, error: readError } = await admin
    .from("listings")
    .select("id, user_id, status")
    .eq("id", listingId)
    .maybeSingle();

  if (readError) {
    console.error("LISTING STATUS READ ERROR:", readError);
    return NextResponse.json(
      { error: "We could not update this listing status." },
      { status: 500 }
    );
  }

  if (!listing || listing.user_id !== user.id) {
    return NextResponse.json({ error: "Listing not found." }, { status: 404 });
  }

  const currentlyActive = ACTIVE_STATUSES.has(String(listing.status || ""));
  const nextActive = ACTIVE_STATUSES.has(status);

  if (nextActive && !currentlyActive) {
    const planCheck = await canCreateOrActivateListing({
      userId: user.id,
      excludeListingId: listingId,
    });

    if (!planCheck.allowed) {
      return NextResponse.json(
        {
          error: planCheck.reason,
          code: planCheck.code,
          billingUrl: "/billing",
          currentCount: planCheck.currentCount,
          limit: planCheck.limit,
          plan: planCheck.plan,
        },
        { status: 403 }
      );
    }
  }

  if (dryRun) {
    return NextResponse.json({ ok: true });
  }

  const { error: updateError } = await admin
    .from("listings")
    .update({ status })
    .eq("id", listingId)
    .eq("user_id", user.id);

  if (updateError) {
    console.error("LISTING STATUS UPDATE ERROR:", updateError);
    return NextResponse.json(
      { error: "We could not update this listing status." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
