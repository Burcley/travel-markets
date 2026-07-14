import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type ReviewStatus = "accepted" | "rejected" | "pending";

const allowedReviewStatuses = ["accepted", "rejected", "pending"];

function getSafeDocument(document: {
  id: string;
  review_status: string;
  reviewed_at: string | null;
  rejection_reason: string | null;
  reviewer?: { full_name: string | null } | null;
}) {
  return {
    id: document.id,
    reviewStatus: document.review_status,
    reviewedAt: document.reviewed_at,
    reviewedByName: document.reviewer?.full_name || null,
    rejectionReason: document.rejection_reason,
  };
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ documentId: string }> }
) {
  const supabase = await createClient();
  const admin = createAdminClient();
  const { documentId } = await context.params;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("id, full_name, role, is_admin, account_status")
    .eq("id", user.id)
    .maybeSingle();

  const isAdmin =
    Boolean(profile?.is_admin || profile?.role === "admin") &&
    profile?.account_status !== "banned" &&
    profile?.account_status !== "suspended";

  if (!isAdmin) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const reviewStatus = String(body?.reviewStatus || "") as ReviewStatus;
  const rejectionReason = String(body?.rejectionReason || "").trim();

  if (!allowedReviewStatuses.includes(reviewStatus)) {
    return NextResponse.json(
      { error: "Choose a valid document review status." },
      { status: 400 }
    );
  }

  if (reviewStatus === "rejected" && !rejectionReason) {
    return NextResponse.json(
      { error: "Enter a rejection reason before rejecting this document." },
      { status: 400 }
    );
  }

  const { data: existingDocument, error: existingError } = await admin
    .from("listing_verification_documents")
    .select(
      `
      id,
      verification_id,
      review_status,
      rejection_reason,
      reviewed_at,
      reviewed_by,
      listing_verifications (
        id,
        listing_id,
        owner_id
      )
    `
    )
    .eq("id", documentId)
    .maybeSingle();

  if (existingError || !existingDocument) {
    console.error("PROPERTY VERIFICATION DOCUMENT REVIEW LOOKUP ERROR:", {
      documentId,
      error: existingError,
    });

    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const verification = Array.isArray(existingDocument.listing_verifications)
    ? existingDocument.listing_verifications[0]
    : existingDocument.listing_verifications;

  const sameDecision =
    existingDocument.review_status === reviewStatus &&
    (reviewStatus !== "rejected" ||
      (existingDocument.rejection_reason || "") === rejectionReason);

  if (!sameDecision) {
    const { error: updateError } = await admin
      .from("listing_verification_documents")
      .update({
        review_status: reviewStatus,
        rejection_reason: reviewStatus === "rejected" ? rejectionReason : null,
        reviewed_at:
          reviewStatus === "pending" ? null : new Date().toISOString(),
        reviewed_by: reviewStatus === "pending" ? null : user.id,
      })
      .eq("id", documentId);

    if (updateError) {
      console.error("PROPERTY VERIFICATION DOCUMENT REVIEW UPDATE ERROR:", {
        documentId,
        error: updateError,
      });

      return NextResponse.json(
        { error: "We could not update this document review." },
        { status: 500 }
      );
    }

    await admin.from("listing_verification_audit_events").insert({
      listing_id: verification?.listing_id || null,
      verification_id: verification?.id || existingDocument.verification_id,
      actor_id: user.id,
      event_type:
        reviewStatus === "accepted"
          ? "verification_document_accepted"
          : reviewStatus === "rejected"
            ? "verification_document_rejected"
            : "verification_document_marked_pending",
      metadata: {
        document_id: documentId,
        action: reviewStatus,
      },
    });

    if (reviewStatus === "rejected" && verification?.owner_id) {
      await admin.from("notifications").insert({
        user_id: verification.owner_id,
        title: "Verification document needs attention",
        body: rejectionReason,
        message: rejectionReason,
        type: "listing_verification_document_rejected",
        is_read: false,
        link: `/listings/${verification.listing_id}/edit`,
      });
    }
  }

  const { data: updatedDocument, error: updatedError } = await admin
    .from("listing_verification_documents")
    .select(
      `
      id,
      review_status,
      reviewed_at,
      rejection_reason,
      reviewer:profiles!listing_verification_documents_reviewed_by_fkey (
        full_name
      )
    `
    )
    .eq("id", documentId)
    .single();

  if (updatedError || !updatedDocument) {
    console.error("PROPERTY VERIFICATION DOCUMENT REVIEW RESPONSE ERROR:", {
      documentId,
      error: updatedError,
    });

    return NextResponse.json(
      { error: "We could not update this document review." },
      { status: 500 }
    );
  }

  const reviewer = Array.isArray(updatedDocument.reviewer)
    ? updatedDocument.reviewer[0]
    : updatedDocument.reviewer;

  return NextResponse.json({
    success: true,
    document: getSafeDocument({ ...updatedDocument, reviewer }),
  });
}
