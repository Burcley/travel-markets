import { NextResponse } from "next/server";
import {
  buildDraftListingPayload,
  type NormalizedImportRow,
} from "@/lib/admin/listing-importer-core.mjs";
import {
  isLandlordProfile,
  requireImportAdmin,
} from "@/lib/admin/listing-importer-server";

type ImportRequestRow = NormalizedImportRow & {
  city?: string | null;
  province?: string | null;
  selected?: boolean;
};

type ImportPayload = {
  ownerId?: string;
  sourceFilename?: string;
  rows?: ImportRequestRow[];
  imageAssignments?: Record<string, string[]>;
};

function safeFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 120) || "image";
}

function requiredRowError(row: ImportRequestRow) {
  if (!row.property) return "Missing property/address.";
  if (row.rent == null || row.rent <= 0) return "Missing or invalid rent.";
  return null;
}

export async function POST(request: Request) {
  const context = await requireImportAdmin();
  if ("response" in context) return context.response;

  const formData = await request.formData();
  const payloadValue = formData.get("payload");

  if (typeof payloadValue !== "string") {
    return NextResponse.json({ error: "Missing import payload." }, { status: 400 });
  }

  let payload: ImportPayload;
  try {
    payload = JSON.parse(payloadValue) as ImportPayload;
  } catch {
    return NextResponse.json({ error: "Import payload is not valid JSON." }, { status: 400 });
  }

  const ownerId = String(payload.ownerId || "");
  const rows = (payload.rows || []).filter((row) => row.selected !== false);

  if (!ownerId) {
    return NextResponse.json({ error: "Select a landlord before importing." }, { status: 400 });
  }

  if (!rows.length) {
    return NextResponse.json({ error: "Select at least one validated row to import." }, { status: 400 });
  }

  if (rows.length > 100) {
    return NextResponse.json({ error: "Import at most 100 rows at a time." }, { status: 400 });
  }

  const { data: ownerProfile, error: ownerError } = await context.admin
    .from("profiles")
    .select("id, full_name, email, role, is_admin, account_status")
    .eq("id", ownerId)
    .maybeSingle();

  const ownerStatus = String(ownerProfile?.account_status || "").toLowerCase();
  if (
    ownerError ||
    !isLandlordProfile(ownerProfile) ||
    ["banned", "suspended", "disabled"].includes(ownerStatus)
  ) {
    return NextResponse.json(
      { error: "Choose an existing non-admin landlord account." },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  const { data: batch, error: batchError } = await context.admin
    .from("listing_import_batches")
    .insert({
      admin_id: context.userId,
      owner_id: ownerId,
      source_filename: payload.sourceFilename || null,
      source_row_count: rows.length,
      status: "drafts_created",
      created_at: now,
    })
    .select("id")
    .single();

  if (batchError || !batch?.id) {
    return NextResponse.json(
      { error: "Could not create an import batch record." },
      { status: 500 }
    );
  }

  const imageFiles = new Map<string, File>();
  formData.getAll("images").forEach((value) => {
    if (value instanceof File && value.size > 0) {
      imageFiles.set(value.name, value);
    }
  });

  const rowResults = [];
  let importedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  let warningCount = 0;

  for (const row of rows) {
    const validationError = requiredRowError(row);
    if (row.warnings?.length) warningCount += 1;

    if (validationError) {
      skippedCount += 1;
      rowResults.push({
        batch_id: batch.id,
        source_row_number: row.rowNumber,
        source_fingerprint: row.fingerprint,
        status: "skipped_invalid",
        reason: validationError,
        normalized_data: row,
      });
      continue;
    }

    const idempotencyKey = `admin-bulk-import:${row.fingerprint}`;
    const { data: existing } = await context.admin
      .from("listings")
      .select("id, status")
      .eq("user_id", ownerId)
      .eq("creation_idempotency_key", idempotencyKey)
      .maybeSingle();

    if (existing?.id) {
      skippedCount += 1;
      rowResults.push({
        batch_id: batch.id,
        source_row_number: row.rowNumber,
        listing_id: existing.id,
        source_fingerprint: row.fingerprint,
        status: "skipped_existing",
        reason: "A listing from this source row already exists for this landlord.",
        normalized_data: row,
      });
      continue;
    }

    const draftPayload = buildDraftListingPayload({
      ownerId,
      row,
      city: row.city || "",
      province: row.province || "Ontario",
    });

    const { data: listing, error: listingError } = await context.admin
      .from("listings")
      .insert(draftPayload)
      .select("id")
      .single();

    if (listingError || !listing?.id) {
      failedCount += 1;
      rowResults.push({
        batch_id: batch.id,
        source_row_number: row.rowNumber,
        source_fingerprint: row.fingerprint,
        status: "failed",
        reason: listingError?.message || "Draft listing could not be created.",
        normalized_data: row,
      });
      continue;
    }

    const assignedNames = payload.imageAssignments?.[row.fingerprint] || [];
    const uploadedRows = [];

    for (let index = 0; index < assignedNames.length; index += 1) {
      const file = imageFiles.get(assignedNames[index]);
      if (!file) continue;

      const storagePath = `listings/${listing.id}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
      const buffer = Buffer.from(await file.arrayBuffer());
      const { error: uploadError } = await context.admin.storage
        .from("listing-images")
        .upload(storagePath, buffer, {
          contentType: file.type || "application/octet-stream",
          upsert: false,
        });

      if (uploadError) continue;

      const { data: publicUrl } = context.admin.storage
        .from("listing-images")
        .getPublicUrl(storagePath);

      uploadedRows.push({
        listing_id: listing.id,
        image_path: storagePath,
        image_url: publicUrl.publicUrl,
        sort_order: index,
        is_cover: index === 0,
      });
    }

    if (uploadedRows.length) {
      await context.admin.from("listing_images").insert(uploadedRows);
    }

    importedCount += 1;
    rowResults.push({
      batch_id: batch.id,
      source_row_number: row.rowNumber,
      listing_id: listing.id,
      source_fingerprint: row.fingerprint,
      status: "imported",
      reason: null,
      normalized_data: row,
      image_count: uploadedRows.length,
    });
  }

  if (rowResults.length) {
    await context.admin.from("listing_import_rows").insert(rowResults);
  }

  const finalStatus =
    failedCount > 0 ? "partial_failure" : importedCount > 0 ? "drafts_created" : "failed";

  await context.admin
    .from("listing_import_batches")
    .update({
      imported_count: importedCount,
      skipped_count: skippedCount,
      failed_count: failedCount,
      warning_count: warningCount,
      status: finalStatus,
      summary: {
        importedCount,
        skippedCount,
        failedCount,
        warningCount,
      },
      completed_at: new Date().toISOString(),
    })
    .eq("id", batch.id);

  await context.admin.from("admin_audit_logs").insert({
    admin_id: context.userId,
    target_user_id: ownerId,
    action: "listing.bulk_imported",
    reason: `Batch ${batch.id}: ${importedCount} imported, ${skippedCount} skipped, ${failedCount} failed.`,
  });

  return NextResponse.json({
    batchId: batch.id,
    importedCount,
    skippedCount,
    failedCount,
    warningCount,
    results: rowResults,
  });
}
