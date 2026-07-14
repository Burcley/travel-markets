import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  sanitizeDocumentFilename,
  validateSecureDocumentFile,
} from "@/lib/trust/document-types";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const admin = createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const requestId = String(formData.get("requestId") || "");
  const applicantNote = String(formData.get("applicantNote") || "").trim();
  const acknowledged = formData.get("acknowledged") === "true";
  const file = formData.get("file");

  if (!requestId || !(file instanceof File)) {
    return NextResponse.json({ error: "Missing document upload" }, { status: 400 });
  }

  if (!acknowledged) {
    return NextResponse.json(
      { error: "Confirm who will receive this document before uploading." },
      { status: 400 }
    );
  }

  const validationError = validateSecureDocumentFile(file);

  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const { data: documentRequest } = await admin
    .from("rental_document_requests")
    .select("id, inquiry_id, requester_id, recipient_id, status")
    .eq("id", requestId)
    .maybeSingle();

  if (
    !documentRequest ||
    documentRequest.recipient_id !== user.id ||
    !["requested", "replacement_requested"].includes(documentRequest.status)
  ) {
    return NextResponse.json({ error: "Document request is not available." }, { status: 403 });
  }

  const safeFilename = sanitizeDocumentFilename(file.name);
  const storagePath = `${documentRequest.inquiry_id}/${requestId}/${crypto.randomUUID()}-${safeFilename}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await admin.storage
    .from("rental-application-documents")
    .upload(storagePath, buffer, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: submission, error: insertError } = await admin
    .from("rental_document_submissions")
    .insert({
      request_id: requestId,
      uploader_id: user.id,
      storage_path: storagePath,
      original_filename: safeFilename,
      mime_type: file.type,
      file_size: file.size,
      applicant_note: applicantNote || null,
      status: "submitted",
    })
    .select("id")
    .single();

  if (insertError || !submission) {
    await admin.storage.from("rental-application-documents").remove([storagePath]);
    return NextResponse.json(
      { error: insertError?.message || "Could not save document submission" },
      { status: 500 }
    );
  }

  await admin
    .from("rental_document_requests")
    .update({ status: "submitted" })
    .eq("id", requestId);

  await admin.from("rental_document_audit_events").insert({
    request_id: requestId,
    submission_id: submission.id,
    actor_id: user.id,
    event_type: "submission_uploaded",
    metadata: {
      mime_type: file.type,
      file_size: file.size,
    },
  });

  await admin.from("notifications").insert({
    user_id: documentRequest.requester_id,
    inquiry_id: documentRequest.inquiry_id,
    type: "document_submitted",
    title: "Application document submitted",
    body: "A requested application document was submitted securely.",
    message: "A requested application document was submitted securely.",
    link: `/messages/${documentRequest.inquiry_id}`,
  });

  return NextResponse.json({ id: submission.id });
}
