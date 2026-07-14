import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

function logSignedUrlIssue(
  code: string,
  details: {
    documentId?: string;
    userId?: string;
    error?: {
      code?: string;
      message?: string;
      details?: string;
      hint?: string;
    } | null;
  } = {}
) {
  console.error("PROPERTY VERIFICATION DOCUMENT PREVIEW:", {
    code,
    ...details,
  });
}

function isMalformedStoragePath(path: string) {
  return (
    !path ||
    path.startsWith("/") ||
    path.startsWith("http://") ||
    path.startsWith("https://") ||
    path.startsWith("property-verification-documents/")
  );
}

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ documentId: string }> }
) {
  const supabase = await createClient();
  const admin = createAdminClient();
  const { documentId } = await context.params;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    logSignedUrlIssue("ADMIN_AUTH_FAILED", { documentId });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("is_admin, role, account_status")
    .eq("id", user.id)
    .maybeSingle();

  const isAdmin =
    Boolean(profile?.is_admin || profile?.role === "admin") &&
    profile?.account_status !== "banned" &&
    profile?.account_status !== "suspended";

  if (profileError || !isAdmin) {
    logSignedUrlIssue("ADMIN_AUTH_FAILED", {
      documentId,
      userId: user.id,
      error: profileError,
    });

    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: document, error: documentError } = await admin
    .from("listing_verification_documents")
    .select(
      `
      id,
      storage_path,
      original_filename,
      mime_type,
      verification_id,
      listing_verifications (
        id,
        listing_id,
        owner_id
      )
    `
    )
    .eq("id", documentId)
    .maybeSingle();

  if (documentError || !document) {
    logSignedUrlIssue("DOCUMENT_NOT_FOUND", {
      documentId,
      userId: user.id,
      error: documentError,
    });

    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!document.storage_path || isMalformedStoragePath(document.storage_path)) {
    logSignedUrlIssue("STORAGE_PATH_MISSING", {
      documentId,
      userId: user.id,
    });

    return NextResponse.json(
      { error: "We could not open this verification document." },
      { status: 400 }
    );
  }

  const { data, error } = await admin.storage
    .from("property-verification-documents")
    .createSignedUrl(document.storage_path, 300);

  if (error || !data?.signedUrl) {
    logSignedUrlIssue(
      error?.message?.toLowerCase().includes("not found")
        ? "STORAGE_OBJECT_NOT_FOUND"
        : "SIGNED_URL_CREATE_FAILED",
      {
        documentId,
        userId: user.id,
        error,
      }
    );

    return NextResponse.json(
      { error: "We could not open this verification document." },
      { status: 500 }
    );
  }

  const verification = Array.isArray(document.listing_verifications)
    ? document.listing_verifications[0]
    : document.listing_verifications;

  await admin.from("listing_verification_audit_events").insert({
    listing_id: verification?.listing_id || null,
    verification_id: verification?.id || document.verification_id,
    actor_id: user.id,
    event_type: "verification_document_previewed",
    metadata: {
      document_id: document.id,
      action: "previewed",
    },
  });

  return NextResponse.json({
    success: true,
    signedUrl: data.signedUrl,
    mimeType: document.mime_type || null,
    originalFilename: document.original_filename || null,
  });
}
