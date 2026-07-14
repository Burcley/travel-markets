import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { documentTypes, requirementLevels } from "@/lib/trust/document-types";

function isAllowedDocumentType(value: string) {
  return documentTypes.some((item) => item.value === value);
}

function isAllowedRequirementLevel(value: string) {
  return requirementLevels.some((item) => item.value === value);
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const admin = createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const inquiryId = request.nextUrl.searchParams.get("inquiryId");

  if (!inquiryId) {
    return NextResponse.json({ error: "Missing inquiryId" }, { status: 400 });
  }

  const { data: inquiry } = await admin
    .from("inquiries")
    .select("id, owner_id, requester_id, status")
    .eq("id", inquiryId)
    .maybeSingle();

  if (
    !inquiry ||
    inquiry.status !== "accepted" ||
    (inquiry.owner_id !== user.id && inquiry.requester_id !== user.id)
  ) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data, error } = await admin
    .from("rental_document_requests")
    .select(
      `
      *,
      rental_document_submissions (*)
    `
    )
    .eq("inquiry_id", inquiryId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ requests: data || [] });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const admin = createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const inquiryId = String(body.inquiryId || "");
  const documentType = String(body.documentType || "");
  const purpose = String(body.purpose || "").trim();
  const requirementLevel = String(body.requirementLevel || "required");
  const customTitle = String(body.customTitle || "").trim();
  const dueAt = body.dueAt ? String(body.dueAt) : null;
  const alternatives = Array.isArray(body.alternativeDocuments)
    ? body.alternativeDocuments
        .map((item: unknown) => String(item).trim())
        .filter(Boolean)
    : [];

  if (!inquiryId || !isAllowedDocumentType(documentType)) {
    return NextResponse.json({ error: "Invalid document request" }, { status: 400 });
  }

  if (!purpose) {
    return NextResponse.json({ error: "Purpose is required" }, { status: 400 });
  }

  if (!isAllowedRequirementLevel(requirementLevel)) {
    return NextResponse.json({ error: "Invalid requirement level" }, { status: 400 });
  }

  const { data: inquiry } = await admin
    .from("inquiries")
    .select("id, listing_id, owner_id, requester_id, status")
    .eq("id", inquiryId)
    .maybeSingle();

  if (!inquiry || inquiry.status !== "accepted" || inquiry.owner_id !== user.id) {
    return NextResponse.json(
      { error: "Document requests are only available to the landlord in accepted inquiries." },
      { status: 403 }
    );
  }

  const { data: inserted, error } = await admin
    .from("rental_document_requests")
    .insert({
      inquiry_id: inquiry.id,
      listing_id: inquiry.listing_id,
      requester_id: inquiry.owner_id,
      recipient_id: inquiry.requester_id,
      document_type: documentType,
      custom_title: customTitle || null,
      purpose,
      requirement_level: requirementLevel,
      alternative_documents: alternatives,
      due_at: dueAt,
      status: "requested",
    })
    .select("id")
    .single();

  if (error || !inserted) {
    return NextResponse.json(
      { error: error?.message || "Could not create document request" },
      { status: 500 }
    );
  }

  await admin.from("rental_document_audit_events").insert({
    request_id: inserted.id,
    actor_id: user.id,
    event_type: "request_created",
    metadata: {
      document_type: documentType,
      requirement_level: requirementLevel,
    },
  });

  await admin.from("notifications").insert({
    user_id: inquiry.requester_id,
    inquiry_id: inquiry.id,
    type: "document_requested",
    title: "Application document requested",
    body: "A landlord requested an application document. Review the request before uploading anything.",
    message:
      "A landlord requested an application document. Review the request before uploading anything.",
    link: `/messages/${inquiry.id}`,
  });

  return NextResponse.json({ id: inserted.id });
}
