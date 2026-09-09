import { NextResponse } from "next/server";
import {
  getListingPublishReview,
  publishListingForOwner,
  type ListingPublishReview,
} from "@/lib/listings/publish-listing";
import {
  buildDraftListingPayload,
  collectAssignedImportImages,
  type NormalizedImportRow,
} from "@/lib/admin/listing-importer-core.mjs";
import {
  isLandlordProfile,
  requireImportAdmin,
} from "@/lib/admin/listing-importer-server";
import { resolveImportedListingLocationFields } from "@/lib/admin/listing-importer-location";

type ImportRequestRow = NormalizedImportRow & {
  city?: string | null;
  province?: string | null;
  selected?: boolean;
};

type ImportPayload = {
  action?:
    | "createDrafts"
    | "finalizeImages"
    | "listImportedDrafts"
    | "reviewImportedDrafts"
    | "publishDrafts";
  batchId?: string;
  ownerId?: string;
  sourceFilename?: string;
  listingIds?: string[];
  rows?: ImportRequestRow[];
  imageAssignments?: Record<string, string[]>;
  imageFiles?: Array<{
    name: string;
    type?: string | null;
    size?: number | null;
  }>;
  uploadedImages?: Array<{
    rowFingerprint: string;
    listingId: string;
    imageName: string;
    storagePath: string;
    imageUrl: string;
    sortOrder: number;
    isCover: boolean;
  }>;
};

type BulkPublishResult = {
  listingId: string;
  status: "published" | "skipped" | "failed";
  title?: string;
  reason?: string | null;
};

function safeFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 120) || "image";
}

function requiredRowError(row: ImportRequestRow) {
  if (!row.property) return "Missing property/address.";
  if (row.rent == null || row.rent <= 0) return "Missing or invalid rent.";
  return null;
}

function importError({
  message,
  status = 500,
  code = "IMPORT_FAILED",
  details,
}: {
  message: string;
  status?: number;
  code?: string;
  details?: unknown;
}) {
  console.error(
    "Admin listing import failed",
    JSON.stringify({
      code,
      status,
      message,
      details,
    })
  );

  return NextResponse.json(
    {
      error: message,
      code,
      details,
    },
    { status }
  );
}

async function readImportPayload(request: Request): Promise<ImportPayload | NextResponse> {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const payloadValue = formData.get("payload");

    if (typeof payloadValue !== "string") {
      return NextResponse.json({ error: "Missing import payload." }, { status: 400 });
    }

    try {
      const payload = JSON.parse(payloadValue) as ImportPayload;
      const imageFiles = formData
        .getAll("images")
        .filter((value): value is File => value instanceof File && value.size > 0)
        .map((file) => ({
          name: file.name,
          type: file.type || null,
          size: file.size,
        }));

      return {
        ...payload,
        imageFiles: payload.imageFiles || imageFiles,
      };
    } catch {
      return NextResponse.json({ error: "Import payload is not valid JSON." }, { status: 400 });
    }
  }

  try {
    return (await request.json()) as ImportPayload;
  } catch {
    return NextResponse.json({ error: "Import payload is not valid JSON." }, { status: 400 });
  }
}

async function finalizeUploadedImages({
  context,
  payload,
}: {
  context: Exclude<Awaited<ReturnType<typeof requireImportAdmin>>, { response: NextResponse }>;
  payload: ImportPayload;
}) {
  const batchId = String(payload.batchId || "");
  const uploadedImages = payload.uploadedImages || [];

  if (!batchId) {
    return importError({
      status: 400,
      code: "IMPORT_BATCH_MISSING",
      message: "Missing import batch ID for image finalization.",
    });
  }

  if (!uploadedImages.length) {
    return NextResponse.json({ finalizedCount: 0 });
  }

  const { data: batchRows, error: batchRowsError } = await context.admin
    .from("listing_import_rows")
    .select("listing_id, source_fingerprint")
    .eq("batch_id", batchId)
    .eq("status", "imported");

  if (batchRowsError) {
    return importError({
      code: "IMPORT_IMAGE_BATCH_LOOKUP_FAILED",
      message: `Import image batch lookup failed: ${batchRowsError.message}`,
      details: { batchId, supabaseCode: batchRowsError.code },
    });
  }

  const allowedUploads = new Set(
    (batchRows || []).map(
      (row) => `${row.source_fingerprint}:${row.listing_id}`
    )
  );
  const invalidUpload = uploadedImages.find(
    (image) => !allowedUploads.has(`${image.rowFingerprint}:${image.listingId}`)
  );

  if (invalidUpload) {
    return importError({
      status: 400,
      code: "IMPORT_IMAGE_FINALIZE_FORBIDDEN",
      message: "Image finalization includes a listing that does not belong to this import batch.",
      details: { batchId },
    });
  }

  const storagePaths = uploadedImages.map((image) => image.storagePath);
  const { data: existingImages, error: existingImagesError } = await context.admin
    .from("listing_images")
    .select("image_path")
    .in("image_path", storagePaths);

  if (existingImagesError) {
    return importError({
      code: "IMPORT_IMAGE_EXISTING_LOOKUP_FAILED",
      message: `Existing image lookup failed: ${existingImagesError.message}`,
      details: { batchId, supabaseCode: existingImagesError.code },
    });
  }

  const existingPaths = new Set(
    (existingImages || []).map((image) => image.image_path)
  );
  const newUploadedImages = uploadedImages.filter(
    (image) => !existingPaths.has(image.storagePath)
  );

  if (!newUploadedImages.length) {
    return NextResponse.json({ finalizedCount: 0, skippedExistingCount: uploadedImages.length });
  }

  const rows = newUploadedImages.map((image) => ({
    listing_id: image.listingId,
    image_path: image.storagePath,
    image_url: image.imageUrl,
    sort_order: image.sortOrder,
    is_cover: image.isCover,
  }));

  const { error: imageInsertError } = await context.admin
    .from("listing_images")
    .insert(rows);

  if (imageInsertError) {
    return importError({
      code: "IMPORT_IMAGE_ROWS_FAILED",
      message: `Image row insert failed: ${imageInsertError.message}`,
      details: { batchId, count: rows.length, supabaseCode: imageInsertError.code },
    });
  }

  const imageCounts = new Map<string, number>();
  newUploadedImages.forEach((image) => {
    imageCounts.set(
      image.rowFingerprint,
      (imageCounts.get(image.rowFingerprint) || 0) + 1
    );
  });

  await Promise.all(
    Array.from(imageCounts.entries()).map(([fingerprint, imageCount]) =>
      context.admin
        .from("listing_import_rows")
        .update({ image_count: imageCount })
        .eq("batch_id", batchId)
        .eq("source_fingerprint", fingerprint)
    )
  );

  return NextResponse.json({
    finalizedCount: rows.length,
    skippedExistingCount: uploadedImages.length - rows.length,
  });
}

function normalizedListingIds(values?: string[]) {
  return Array.from(
    new Set(
      (values || [])
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    )
  ).slice(0, 100);
}

async function reviewImportedListingIds({
  context,
  listingIds,
  ownerId,
}: {
  context: Exclude<Awaited<ReturnType<typeof requireImportAdmin>>, { response: NextResponse }>;
  listingIds: string[];
  ownerId?: string | null;
}) {
  const drafts: ListingPublishReview[] = [];
  const failures: BulkPublishResult[] = [];

  for (const listingId of listingIds) {
    try {
      const review = await getListingPublishReview({
        admin: context.admin,
        listingId,
        ownerId: ownerId || null,
      });

      if (!review) {
        failures.push({
          listingId,
          status: "failed",
          reason: "Listing not found for the selected landlord.",
        });
        continue;
      }

      drafts.push(review);
    } catch (error) {
      failures.push({
        listingId,
        status: "failed",
        reason: error instanceof Error ? error.message : "Review failed.",
      });
    }
  }

  return { drafts, failures };
}

async function listImportedDrafts({
  context,
  payload,
}: {
  context: Exclude<Awaited<ReturnType<typeof requireImportAdmin>>, { response: NextResponse }>;
  payload: ImportPayload;
}) {
  const ownerId = String(payload.ownerId || "");

  if (!ownerId) {
    return NextResponse.json(
      { error: "Select a landlord before loading imported drafts." },
      { status: 400 }
    );
  }

  const { data: batches, error: batchError } = await context.admin
    .from("listing_import_batches")
    .select("id")
    .eq("owner_id", ownerId)
    .in("status", ["drafts_created", "partial_failure"])
    .order("created_at", { ascending: false })
    .limit(25);

  if (batchError) {
    return importError({
      code: "IMPORTED_DRAFT_BATCH_LOOKUP_FAILED",
      message: `Imported draft batch lookup failed: ${batchError.message}`,
      details: { supabaseCode: batchError.code },
    });
  }

  const batchIds = (batches || []).map((batch) => batch.id).filter(Boolean);
  let listingIds: string[] = [];

  if (batchIds.length > 0) {
    const { data: rows, error: rowsError } = await context.admin
      .from("listing_import_rows")
      .select("listing_id")
      .in("batch_id", batchIds)
      .in("status", ["imported", "skipped_existing"])
      .not("listing_id", "is", null);

    if (rowsError) {
      return importError({
        code: "IMPORTED_DRAFT_ROW_LOOKUP_FAILED",
        message: `Imported draft row lookup failed: ${rowsError.message}`,
        details: { supabaseCode: rowsError.code },
      });
    }

    listingIds = normalizedListingIds(
      (rows || []).map((row) => row.listing_id as string | null).filter(Boolean) as string[]
    );
  }

  if (!listingIds.length) {
    const { data: importedListings, error: listingsError } = await context.admin
      .from("listings")
      .select("id")
      .eq("user_id", ownerId)
      .like("creation_idempotency_key", "admin-bulk-import:%")
      .order("created_at", { ascending: false })
      .limit(100);

    if (listingsError) {
      return importError({
        code: "IMPORTED_DRAFT_LISTING_LOOKUP_FAILED",
        message: `Imported draft listing lookup failed: ${listingsError.message}`,
        details: { supabaseCode: listingsError.code },
      });
    }

    listingIds = normalizedListingIds(
      (importedListings || []).map((listing) => listing.id as string | null).filter(Boolean) as string[]
    );
  }

  const review = await reviewImportedListingIds({
    context,
    listingIds,
    ownerId,
  });

  return NextResponse.json(review);
}

async function reviewImportedDrafts({
  context,
  payload,
}: {
  context: Exclude<Awaited<ReturnType<typeof requireImportAdmin>>, { response: NextResponse }>;
  payload: ImportPayload;
}) {
  const listingIds = normalizedListingIds(payload.listingIds);

  if (!listingIds.length) {
    return NextResponse.json(
      { error: "Select at least one imported draft to review." },
      { status: 400 }
    );
  }

  const review = await reviewImportedListingIds({
    context,
    listingIds,
    ownerId: payload.ownerId || null,
  });

  return NextResponse.json(review);
}

async function publishImportedDrafts({
  context,
  payload,
}: {
  context: Exclude<Awaited<ReturnType<typeof requireImportAdmin>>, { response: NextResponse }>;
  payload: ImportPayload;
}) {
  const listingIds = normalizedListingIds(payload.listingIds);

  if (!listingIds.length) {
    return NextResponse.json(
      { error: "Select at least one imported draft to publish." },
      { status: 400 }
    );
  }

  const results: BulkPublishResult[] = [];

  for (const listingId of listingIds) {
    try {
      const result = await publishListingForOwner({
        admin: context.admin,
        listingId,
        ownerId: payload.ownerId || null,
        adminActorId: context.userId,
      });
      const review = await getListingPublishReview({
        admin: context.admin,
        listingId,
        ownerId: payload.ownerId || null,
      });

      results.push({
        listingId,
        status: result.status,
        title: review?.title,
        reason: "reason" in result ? result.reason || null : null,
      });
    } catch (error) {
      results.push({
        listingId,
        status: "failed",
        reason: error instanceof Error ? error.message : "Publish failed.",
      });
    }
  }

  const publishedCount = results.filter((item) => item.status === "published").length;
  const skippedCount = results.filter((item) => item.status === "skipped").length;
  const failedCount = results.filter((item) => item.status === "failed").length;

  const { error: auditError } = await context.admin.from("admin_audit_logs").insert({
    admin_id: context.userId,
    target_user_id: payload.ownerId || null,
    action: "listing.bulk_import_published",
    reason: `Bulk publish: ${publishedCount} published, ${skippedCount} skipped, ${failedCount} failed.`,
  });

  if (auditError) {
    console.error(
      "Admin imported listing publish audit log failed",
      JSON.stringify({
        code: auditError.code,
        message: auditError.message,
      })
    );
  }

  return NextResponse.json({
    publishedCount,
    skippedCount,
    failedCount,
    results,
  });
}

export async function GET() {
  return NextResponse.json(
    {
      error: "Use POST to commit listing imports.",
      code: "IMPORT_METHOD_NOT_ALLOWED",
    },
    { status: 405 }
  );
}

export async function POST(request: Request) {
  const context = await requireImportAdmin();
  if ("response" in context) return context.response;

  const payload = await readImportPayload(request);
  if (payload instanceof NextResponse) return payload;

  if (payload.action === "finalizeImages") {
    return finalizeUploadedImages({ context, payload });
  }

  if (payload.action === "listImportedDrafts") {
    return listImportedDrafts({ context, payload });
  }

  if (payload.action === "reviewImportedDrafts") {
    return reviewImportedDrafts({ context, payload });
  }

  if (payload.action === "publishDrafts") {
    return publishImportedDrafts({ context, payload });
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
    return importError({
      code: "IMPORT_BATCH_INSERT_FAILED",
      message: `Import batch insert failed: ${batchError?.message || "No batch ID returned."}`,
      details: { supabaseCode: batchError?.code },
    });
  }

  const rowResults = [];
  const uploadTargets = [];
  const assignedImagePlans = collectAssignedImportImages({
    rows,
    imageAssignments: payload.imageAssignments || {},
    imageFiles: payload.imageFiles || [],
  });
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
    const { data: existing, error: existingError } = await context.admin
      .from("listings")
      .select("id, status")
      .eq("user_id", ownerId)
      .eq("creation_idempotency_key", idempotencyKey)
      .maybeSingle();

    if (existingError) {
      failedCount += 1;
      rowResults.push({
        batch_id: batch.id,
        source_row_number: row.rowNumber,
        source_fingerprint: row.fingerprint,
        status: "failed",
        reason: `Existing-listing lookup failed: ${existingError.message}`,
        normalized_data: row,
      });
      continue;
    }

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
    const location = await resolveImportedListingLocationFields(row);

    if (!location.ok) {
      failedCount += 1;
      rowResults.push({
        batch_id: batch.id,
        source_row_number: row.rowNumber,
        source_fingerprint: row.fingerprint,
        status: "failed",
        reason: `Location resolution failed: ${location.message}`,
        normalized_data: {
          ...row,
          location_resolution_error: {
            code: location.code,
            fullAddress: location.fullAddress,
          },
        },
      });
      continue;
    }

    const { data: listing, error: listingError } = await context.admin
      .from("listings")
      .insert({ ...draftPayload, ...location.fields })
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

    const rowImagePlans = assignedImagePlans.filter(
      (plan) => plan.rowFingerprint === row.fingerprint
    );

    for (const imagePlan of rowImagePlans) {
      const storagePath = `listings/${listing.id}/${crypto.randomUUID()}-${safeFileName(imagePlan.imageName)}`;
      const { data: signedUpload, error: signedUploadError } =
        await context.admin.storage
          .from("listing-images")
          .createSignedUploadUrl(storagePath);

      if (signedUploadError || !signedUpload?.token) {
        failedCount += 1;
        rowResults.push({
          batch_id: batch.id,
          source_row_number: row.rowNumber,
          listing_id: listing.id,
          source_fingerprint: row.fingerprint,
          status: "failed",
          reason: `Image upload target failed for ${imagePlan.imageName}: ${
            signedUploadError?.message || "No signed upload token returned."
          }`,
          normalized_data: row,
        });
        continue;
      }

      const { data: publicUrl } = context.admin.storage
        .from("listing-images")
        .getPublicUrl(storagePath);

      uploadTargets.push({
        rowFingerprint: row.fingerprint,
        listingId: listing.id,
        imageName: imagePlan.imageName,
        storagePath,
        token: signedUpload.token,
        publicUrl: publicUrl.publicUrl,
        sortOrder: imagePlan.sortOrder,
        isCover: imagePlan.isCover,
        contentType: imagePlan.contentType,
      });
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
      image_count: rowImagePlans.length,
    });
  }

  if (rowResults.length) {
    const { error: rowsError } = await context.admin
      .from("listing_import_rows")
      .insert(rowResults);

    if (rowsError) {
      return importError({
        code: "IMPORT_ROW_AUDIT_INSERT_FAILED",
        message: `Import row audit insert failed: ${rowsError.message}`,
        details: { batchId: batch.id, supabaseCode: rowsError.code },
      });
    }
  }

  const finalStatus =
    failedCount > 0 ? "partial_failure" : importedCount > 0 ? "drafts_created" : "failed";

  const { error: batchUpdateError } = await context.admin
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

  if (batchUpdateError) {
    return importError({
      code: "IMPORT_BATCH_UPDATE_FAILED",
      message: `Import batch update failed: ${batchUpdateError.message}`,
      details: { batchId: batch.id, supabaseCode: batchUpdateError.code },
    });
  }

  const { error: auditError } = await context.admin.from("admin_audit_logs").insert({
    admin_id: context.userId,
    target_user_id: ownerId,
    action: "listing.bulk_imported",
    reason: `Batch ${batch.id}: ${importedCount} imported, ${skippedCount} skipped, ${failedCount} failed.`,
  });

  if (auditError) {
    console.error(
      "Admin listing import audit log failed",
      JSON.stringify({
        batchId: batch.id,
        code: auditError.code,
        message: auditError.message,
      })
    );
  }

  return NextResponse.json({
    batchId: batch.id,
    importedCount,
    skippedCount,
    failedCount,
    warningCount,
    results: rowResults,
    uploadTargets,
  });
}
