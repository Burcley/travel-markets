import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { canManageListings } from "@/lib/role-access";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getPropertyVerificationDocumentTypesForRelationship,
  relationshipTypes,
  sanitizeDocumentFilename,
  validateSecureDocumentFile,
} from "@/lib/trust/document-types";

function isAllowedRelationshipType(value: string) {
  return relationshipTypes.some((item) => item.value === value);
}

const verificationSaveError =
  "We could not save your verification details. Please try again.";

function logVerificationError(context: string, error: unknown) {
  console.error(`LISTING VERIFICATION ${context}:`, error);
}

function logVerificationStage(context: string, details: Record<string, unknown>) {
  console.info(`LISTING VERIFICATION ${context}:`, details);
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (!canManageListings(profile)) {
    return NextResponse.json(
      { error: "Property verification tools are available to landlord accounts." },
      { status: 403 }
    );
  }

  const formData = await request.formData();
  const listingId = String(formData.get("listingId") || "");
  const relationshipType = String(formData.get("relationshipType") || "");
  const documentType = String(formData.get("documentType") || "");
  const otherRelationshipExplanation = String(
    formData.get("otherRelationshipExplanation") || ""
  ).trim();
  const files = formData
    .getAll("files")
    .filter((item): item is File => item instanceof File && item.size > 0);

  if (!listingId || !isAllowedRelationshipType(relationshipType)) {
    return NextResponse.json(
      { error: "Choose your relationship to the property." },
      { status: 400 }
    );
  }

  if (files.length === 0) {
    return NextResponse.json(
      { error: "Upload at least one supporting document." },
      { status: 400 }
    );
  }

  if (relationshipType === "other" && !otherRelationshipExplanation) {
    return NextResponse.json(
      { error: "Explain the other authorized relationship before submitting." },
      { status: 400 }
    );
  }

  const allowedDocumentTypes =
    getPropertyVerificationDocumentTypesForRelationship(relationshipType);

  if (!allowedDocumentTypes.some((item) => item.value === documentType)) {
    return NextResponse.json(
      { error: "Choose what this verification document is." },
      { status: 400 }
    );
  }

  const invalidFile = files
    .map((file) => validateSecureDocumentFile(file))
    .find(Boolean);

  if (invalidFile) {
    return NextResponse.json({ error: invalidFile }, { status: 400 });
  }

  const { data: listing } = await admin
    .from("listings")
    .select("id, user_id, title")
    .eq("id", listingId)
    .maybeSingle();

  if (!listing || listing.user_id !== user.id) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }

  logVerificationStage("SUBMISSION_STARTED", {
    listingId: listing.id,
    ownerId: user.id,
    relationshipType,
    documentType,
    fileCount: files.length,
  });

  const { data: existingVerification } = await admin
    .from("listing_verifications")
    .select(
      "id, status, relationship_type, other_relationship_explanation, owner_visible_reason"
    )
    .eq("listing_id", listing.id)
    .maybeSingle();

  const verificationId = existingVerification?.id || crypto.randomUUID();
  const uploadedFiles: {
    file: File;
    storagePath: string;
    fileSha256: string;
    uploaded: boolean;
  }[] = [];

  for (const file of files) {
    const safeFilename = sanitizeDocumentFilename(file.name);
    const buffer = Buffer.from(await file.arrayBuffer());
    const fileSha256 = createHash("sha256").update(buffer).digest("hex");
    const storagePath = `${user.id}/${listing.id}/${verificationId}/${fileSha256}-${safeFilename}`;

    const { error: uploadError } = await admin.storage
      .from("property-verification-documents")
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      const duplicateObject =
        "statusCode" in uploadError &&
        String(uploadError.statusCode) === "409";

      if (!duplicateObject) {
        logVerificationError("STORAGE UPLOAD ERROR", uploadError);
        continue;
      }
    }

    uploadedFiles.push({
      file,
      storagePath,
      fileSha256,
      uploaded: !uploadError,
    });
  }

  if (uploadedFiles.length === 0) {
    return NextResponse.json(
      {
        error:
          "No property verification document uploaded successfully. Please retry with a supported file.",
      },
      { status: 400 }
    );
  }

  const { data: verification, error: verificationError } = await admin
    .from("listing_verifications")
    .upsert(
      {
        id: verificationId,
        listing_id: listing.id,
        owner_id: user.id,
        relationship_type: relationshipType,
        other_relationship_explanation:
          relationshipType === "other" ? otherRelationshipExplanation : null,
        status: existingVerification?.status || "not_submitted",
        owner_visible_reason: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "listing_id" }
    )
    .select("id")
    .single();

  if (verificationError || !verification) {
    logVerificationError("UPSERT ERROR", verificationError);
    await admin.storage
      .from("property-verification-documents")
      .remove(uploadedFiles.map((item) => item.storagePath));

    return NextResponse.json(
      { error: verificationSaveError },
      { status: 500 }
    );
  }

  logVerificationStage("VERIFICATION_ROW_READY", {
    listingId: listing.id,
    verificationId: verification.id,
    status: existingVerification?.status || "not_submitted",
  });

  const documentRows = uploadedFiles.map(({ file, storagePath, fileSha256 }) => ({
    verification_id: verification.id,
    uploader_id: user.id,
    document_type: documentType,
    storage_path: storagePath,
    file_sha256: fileSha256,
    original_filename: sanitizeDocumentFilename(file.name),
    mime_type: file.type,
    file_size: file.size,
    review_status: "pending",
  }));

  const { data: existingDocuments, error: existingDocumentsError } = await admin
    .from("listing_verification_documents")
    .select("storage_path, file_sha256")
    .eq("verification_id", verification.id);

  if (existingDocumentsError) {
    logVerificationError("DOCUMENT DUPLICATE CHECK ERROR", existingDocumentsError);
    await admin.storage
      .from("property-verification-documents")
      .remove(
        uploadedFiles
          .filter((item) => item.uploaded)
          .map((item) => item.storagePath)
      );
    return NextResponse.json({ error: verificationSaveError }, { status: 500 });
  }

  const existingStoragePaths = new Set(
    (existingDocuments || []).map(
      (document: { storage_path: string | null }) => document.storage_path
    )
  );
  const existingFileHashes = new Set(
    (existingDocuments || []).map(
      (document: { file_sha256: string | null }) => document.file_sha256
    )
  );
  const newDocumentRows = documentRows.filter(
    (document) =>
      !existingStoragePaths.has(document.storage_path) &&
      !existingFileHashes.has(document.file_sha256 || null)
  );

  const { error: documentError } = newDocumentRows.length
    ? await admin.from("listing_verification_documents").insert(newDocumentRows)
    : { error: null };

  if (documentError) {
    logVerificationError("DOCUMENT METADATA ERROR", documentError);
    await admin.storage
      .from("property-verification-documents")
      .remove(
        uploadedFiles
          .filter((item) => item.uploaded)
          .map((item) => item.storagePath)
      );

    if (existingVerification) {
      await admin
        .from("listing_verifications")
        .update({
          status: existingVerification.status,
          relationship_type: existingVerification.relationship_type,
          other_relationship_explanation:
            existingVerification.other_relationship_explanation,
          owner_visible_reason: existingVerification.owner_visible_reason,
        })
        .eq("id", verification.id);
    } else {
      await admin.from("listing_verifications").delete().eq("id", verification.id);
    }

    return NextResponse.json({ error: verificationSaveError }, { status: 500 });
  }

  logVerificationStage("DOCUMENT_METADATA_INSERTED", {
    listingId: listing.id,
    verificationId: verification.id,
    documentCount: newDocumentRows.length,
  });

  const { count: documentCount, error: documentCountError } = await admin
    .from("listing_verification_documents")
    .select("id", { count: "exact", head: true })
    .eq("verification_id", verification.id);

  if (documentCountError || !documentCount) {
    logVerificationError("DOCUMENT METADATA COUNT ERROR", documentCountError);
    return NextResponse.json({ error: verificationSaveError }, { status: 500 });
  }

  const { error: statusError } = await admin
    .from("listing_verifications")
    .update({
      status: "pending",
      submitted_at: new Date().toISOString(),
      reviewed_at: null,
      reviewed_by: null,
      owner_visible_reason: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", verification.id);

  if (statusError) {
    logVerificationError("PENDING STATUS UPDATE ERROR", statusError);
    return NextResponse.json({ error: verificationSaveError }, { status: 500 });
  }

  const { data: admins } = await admin
    .from("profiles")
    .select("id, account_status")
    .or("is_admin.eq.true,role.eq.admin");

  const activeAdmins = (admins || []).filter(
    (adminProfile: { account_status?: string | null }) =>
      !adminProfile.account_status || adminProfile.account_status === "active"
  );

  if (activeAdmins.length) {
    const { error: notificationError } = await admin.from("notifications").insert(
      activeAdmins.map((adminProfile: { id: string }) => ({
        user_id: adminProfile.id,
        type: "listing_verification_submitted",
        title: "New property verification submitted",
        body: "A landlord submitted verification documents for a listing.",
        message: "A landlord submitted verification documents for a listing.",
        is_read: false,
        link: `/admin/verifications?verificationId=${verification.id}`,
      }))
    );

    if (notificationError) {
      logVerificationError("ADMIN NOTIFICATION ERROR", notificationError);
    } else {
      logVerificationStage("ADMIN_NOTIFICATIONS_CREATED", {
        listingId: listing.id,
        verificationId: verification.id,
        adminCount: activeAdmins.length,
      });
    }
  } else {
    logVerificationStage("NO_ACTIVE_ADMINS_FOUND", {
      listingId: listing.id,
      verificationId: verification.id,
    });
  }

  const { error: auditError } = await admin.from("listing_verification_audit_events").insert({
    listing_id: listing.id,
    verification_id: verification.id,
    actor_id: user.id,
    event_type: "verification_documents_submitted",
    metadata: {
      relationship_type: relationshipType,
      document_type: documentType,
      document_count: newDocumentRows.length,
    },
  });

  if (auditError) {
    logVerificationError("AUDIT EVENT ERROR", auditError);
  }

  logVerificationStage("SUBMISSION_COMPLETE", {
    listingId: listing.id,
    verificationId: verification.id,
    documentCount: newDocumentRows.length,
  });

  return NextResponse.json({ id: verification.id, documentCount: newDocumentRows.length });
}
