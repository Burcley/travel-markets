import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function getProjectRef() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!url) return null;

  try {
    return new URL(url).hostname.split(".")[0] || null;
  } catch {
    return null;
  }
}

function isAuthorized(request: NextRequest) {
  const expectedToken = process.env.CRON_SECRET;
  const providedToken =
    request.headers.get("x-debug-token") ||
    request.nextUrl.searchParams.get("token");

  return Boolean(expectedToken && providedToken === expectedToken);
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const supabase = await createClient();
  const admin = createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [profileResult, verificationsResult, pendingResult, documentsResult] =
    await Promise.all([
      user
        ? admin
            .from("profiles")
            .select("id, role, is_admin, account_status")
            .eq("id", user.id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      admin.from("listing_verifications").select("id, status"),
      admin
        .from("listing_verifications")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
      admin
        .from("listing_verification_documents")
        .select("id", { count: "exact", head: true }),
    ]);

  if (
    profileResult.error ||
    verificationsResult.error ||
    pendingResult.error ||
    documentsResult.error
  ) {
    console.error("PROPERTY VERIFICATIONS DIAGNOSTIC ERROR:", {
      profile: profileResult.error,
      verifications: verificationsResult.error,
      pending: pendingResult.error,
      documents: documentsResult.error,
    });

    return NextResponse.json(
      {
        error: "Could not inspect property-verification diagnostics.",
        projectRef: getProjectRef(),
      },
      { status: 500 }
    );
  }

  const statusCounts = (verificationsResult.data || []).reduce(
    (counts: Record<string, number>, item: { status: string | null }) => {
      const status = item.status || "unknown";
      counts[status] = (counts[status] || 0) + 1;
      return counts;
    },
    {}
  );

  return NextResponse.json({
    projectRef: getProjectRef(),
    currentUser: profileResult.data
      ? {
          id: profileResult.data.id,
          role: profileResult.data.role,
          isAdmin: Boolean(profileResult.data.is_admin),
          accountStatus: profileResult.data.account_status,
        }
      : null,
    counts: {
      totalVerifications: verificationsResult.data?.length || 0,
      pendingVerifications: pendingResult.count || 0,
      documentMetadataRows: documentsResult.count || 0,
      byStatus: statusCounts,
    },
  });
}
