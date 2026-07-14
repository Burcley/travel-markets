import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

function logPreviewIssue(
  operation: string,
  details: {
    submissionId?: string;
    userId?: string;
    requestId?: string | null;
    inquiryId?: string | null;
    listingId?: string | null;
    error?: {
      code?: string;
      message?: string;
      details?: string;
      hint?: string;
    } | null;
  } = {}
) {
  console.error("RENTAL DOCUMENT PREVIEW:", {
    operation,
    ...details,
  });
}

function normalizeStoragePath(path: string | null) {
  if (!path) return "";
  const trimmed = path.trim();

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return "";
  }

  return trimmed
    .replace(/^\/+/, "")
    .replace(/^rental-application-documents\/+/, "");
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ submissionId: string }> }
) {
  const supabase = await createClient();
  const admin = createAdminClient();
  const { submissionId } = await context.params;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    logPreviewIssue("USER_NOT_AUTHORIZED", { submissionId });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const expectedInquiryId = body?.inquiryId ? String(body.inquiryId) : "";

  const { data: profile } = await admin
    .from("profiles")
    .select("id, role, is_admin, account_status")
    .eq("id", user.id)
    .maybeSingle();

  const isAdmin =
    Boolean(profile?.is_admin || profile?.role === "admin") &&
    profile?.account_status !== "banned" &&
    profile?.account_status !== "suspended";

  const { data: submission, error: submissionError } = await admin
    .from("rental_document_submissions")
    .select(
      `
      id,
      uploader_id,
      storage_path,
      original_filename,
      mime_type,
      request_id,
      rental_document_requests (
        id,
        inquiry_id,
        conversation_id,
        listing_id,
        requester_id,
        recipient_id,
        status
      )
    `
    )
    .eq("id", submissionId)
    .maybeSingle();

  if (submissionError || !submission) {
    logPreviewIssue("RENTAL_DOCUMENT_NOT_FOUND", {
      submissionId,
      userId: user.id,
      error: submissionError,
    });

    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const requestRecord = Array.isArray(submission?.rental_document_requests)
    ? submission?.rental_document_requests[0]
    : submission?.rental_document_requests;

  if (!requestRecord) {
    logPreviewIssue("RENTAL_REQUEST_NOT_FOUND", {
      submissionId,
      userId: user.id,
      requestId: submission.request_id,
    });

    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (expectedInquiryId && expectedInquiryId !== requestRecord.inquiry_id) {
    logPreviewIssue("USER_NOT_AUTHORIZED", {
      submissionId,
      userId: user.id,
      requestId: requestRecord.id,
      inquiryId: requestRecord.inquiry_id,
    });

    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: inquiry, error: inquiryError } = await admin
    .from("inquiries")
    .select("id, listing_id, owner_id, requester_id, status")
    .eq("id", requestRecord.inquiry_id)
    .maybeSingle();

  if (inquiryError || !inquiry) {
    logPreviewIssue("INQUIRY_NOT_FOUND", {
      submissionId,
      userId: user.id,
      requestId: requestRecord.id,
      inquiryId: requestRecord.inquiry_id,
      error: inquiryError,
    });

    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const listingId = requestRecord.listing_id || inquiry.listing_id;
  const { data: listing, error: listingError } = await admin
    .from("listings")
    .select("id, user_id")
    .eq("id", listingId)
    .maybeSingle();

  if (listingError || !listing) {
    logPreviewIssue("LISTING_NOT_FOUND", {
      submissionId,
      userId: user.id,
      requestId: requestRecord.id,
      inquiryId: inquiry.id,
      listingId,
      error: listingError,
    });

    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const canAccess =
    inquiry.status === "accepted" &&
    (submission.uploader_id === user.id ||
      requestRecord?.requester_id === user.id ||
      requestRecord?.recipient_id === user.id ||
      inquiry.owner_id === user.id ||
      inquiry.requester_id === user.id ||
      listing.user_id === user.id ||
      isAdmin);

  if (!canAccess) {
    logPreviewIssue("USER_NOT_AUTHORIZED", {
      submissionId,
      userId: user.id,
      requestId: requestRecord.id,
      inquiryId: inquiry.id,
      listingId: listing.id,
    });

    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const storagePath = normalizeStoragePath(submission.storage_path);

  if (!storagePath) {
    logPreviewIssue("STORAGE_PATH_MISSING", {
      submissionId,
      userId: user.id,
      requestId: requestRecord.id,
      inquiryId: inquiry.id,
      listingId: listing.id,
    });

    return NextResponse.json(
      { error: "We could not open this document." },
      { status: 400 }
    );
  }

  const { data, error } = await admin.storage
    .from("rental-application-documents")
    .createSignedUrl(storagePath, 300);

  if (error || !data?.signedUrl) {
    logPreviewIssue(
      error?.message?.toLowerCase().includes("not found")
        ? "STORAGE_OBJECT_NOT_FOUND"
        : "SIGNED_URL_CREATE_FAILED",
      {
        submissionId,
        userId: user.id,
        requestId: requestRecord.id,
        inquiryId: inquiry.id,
        listingId: listing.id,
        error,
      }
    );

    return NextResponse.json(
      { error: "We could not open this document." },
      { status: 500 }
    );
  }

  await admin.from("rental_document_audit_events").insert({
    request_id: submission.request_id,
    submission_id: submission.id,
    actor_id: user.id,
    event_type: "signed_url_created",
    metadata: {},
  });

  return NextResponse.json({
    success: true,
    signedUrl: data.signedUrl,
    mimeType: submission.mime_type || null,
    originalFilename: submission.original_filename || null,
  });
}
