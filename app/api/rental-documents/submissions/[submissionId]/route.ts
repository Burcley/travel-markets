import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const allowedActions = ["accept", "request_replacement", "withdraw"] as const;

export async function PATCH(
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
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const action = String(body.action || "") as (typeof allowedActions)[number];
  const reason = String(body.reason || "").trim();

  if (!allowedActions.includes(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const { data: submission } = await admin
    .from("rental_document_submissions")
    .select(
      `
      id,
      request_id,
      uploader_id,
      storage_path,
      status,
      rejection_reason,
      rental_document_requests (
        id,
        inquiry_id,
        requester_id,
        recipient_id
      )
    `
    )
    .eq("id", submissionId)
    .maybeSingle();

  const documentRequest = Array.isArray(submission?.rental_document_requests)
    ? submission?.rental_document_requests[0]
    : submission?.rental_document_requests;

  if (!submission || !documentRequest) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (action === "withdraw") {
    if (submission.uploader_id !== user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (submission.status === "withdrawn") {
      return NextResponse.json({ ok: true, status: "withdrawn" });
    }

    await admin.storage
      .from("rental-application-documents")
      .remove([submission.storage_path]);

    await admin
      .from("rental_document_submissions")
      .update({ status: "withdrawn" })
      .eq("id", submission.id);

    await admin
      .from("rental_document_requests")
      .update({ status: "requested" })
      .eq("id", documentRequest.id);
  } else {
    if (documentRequest.requester_id !== user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const nextSubmissionStatus = action === "accept" ? "accepted" : "rejected";
    const nextRequestStatus =
      action === "accept" ? "accepted" : "replacement_requested";

    if (
      submission.status === nextSubmissionStatus &&
      (action !== "request_replacement" ||
        (submission.rejection_reason || "") === (reason || ""))
    ) {
      return NextResponse.json({ ok: true, status: nextSubmissionStatus });
    }

    await admin
      .from("rental_document_submissions")
      .update({
        status: nextSubmissionStatus,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        rejection_reason: action === "request_replacement" ? reason || null : null,
      })
      .eq("id", submission.id);

    await admin
      .from("rental_document_requests")
      .update({ status: nextRequestStatus })
      .eq("id", documentRequest.id);
  }

  await admin.from("rental_document_audit_events").insert({
    request_id: documentRequest.id,
    submission_id: submission.id,
    actor_id: user.id,
    event_type:
      action === "accept"
        ? "submission_accepted"
        : action === "withdraw"
          ? "submission_withdrawn"
          : "replacement_requested",
    metadata: reason ? { reason } : {},
  });

  await admin.from("notifications").insert({
    user_id:
      action === "withdraw"
        ? documentRequest.requester_id
        : documentRequest.recipient_id,
    inquiry_id: documentRequest.inquiry_id,
    type:
      action === "accept"
        ? "document_accepted"
        : action === "withdraw"
          ? "document_withdrawn"
          : "document_replacement_requested",
    title:
      action === "accept"
        ? "Application document accepted"
        : action === "withdraw"
          ? "Application document withdrawn"
          : "Replacement requested",
    body:
      action === "accept"
        ? "A submitted application document was accepted."
        : action === "withdraw"
          ? "A submitted application document was withdrawn."
          : "A landlord requested a replacement document. Review the reason before uploading again.",
    message:
      action === "accept"
        ? "A submitted application document was accepted."
        : action === "withdraw"
          ? "A submitted application document was withdrawn."
          : "A landlord requested a replacement document. Review the reason before uploading again.",
    link: `/messages/${documentRequest.inquiry_id}`,
  });

  return NextResponse.json({ ok: true });
}
