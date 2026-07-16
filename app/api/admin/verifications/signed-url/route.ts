import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { admin: null, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("role, is_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.is_admin && profile?.role !== "admin") {
    return { admin, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { admin, response: null };
}

export async function POST(request: Request) {
  const { admin, response } = await requireAdmin();
  if (response) return response;
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { path, bucket } = await request.json().catch(() => ({ path: "" }));
  const documentPath = typeof path === "string" ? path : "";
  const bucketName =
    bucket === "verification-documents"
      ? "verification-documents"
      : "verification-submissions";

  if (!documentPath || documentPath.includes("..")) {
    return NextResponse.json({ error: "Invalid document path." }, { status: 400 });
  }

  const { data, error } = await admin.storage
    .from(bucketName)
    .createSignedUrl(documentPath, 60 * 5, {
      download: false,
    });

  if (error || !data?.signedUrl) {
    return NextResponse.json(
      { error: "We could not create a secure preview link." },
      { status: 500 }
    );
  }

  return NextResponse.json({ signedUrl: data.signedUrl, expiresIn: 300 });
}
