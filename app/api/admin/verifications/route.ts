import { NextResponse } from "next/server";
import {
  groupVerificationRecords,
  type UnifiedVerificationRecord,
  type VerificationStatus,
} from "@/lib/admin-verification-profiles";
import {
  documentReviewStatusForAdminAction,
  legacyRelationshipTypeForListingVerification,
  listingVerificationStatusForAdminAction,
} from "@/lib/admin-verification-review-core.mjs";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function normalizeStatus(status?: string | null): VerificationStatus {
  const value = String(status || "").toLowerCase();
  if (["approved", "verified", "accepted"].includes(value)) return "approved";
  if (["rejected", "declined", "denied"].includes(value)) return "rejected";
  if (["resubmission_required", "more_information_required"].includes(value)) {
    return "resubmission_required";
  }
  if (value === "expired") return "expired";
  if (value === "pending" || value === "submitted") return "pending";
  return "not_started";
}

function maskPhone(value?: string | null) {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  const last = digits.slice(-4);
  const prefix = value.trim().startsWith("+")
    ? `+${digits.slice(0, Math.max(1, digits.length - 10)) || digits.slice(0, 1)}`
    : "";

  return `${prefix} ••• ••• ${last}`;
}

function formatStudentInstitution({
  metadata,
  profile,
}: {
  metadata?: Record<string, unknown>;
  profile?: {
    institution_name?: string | null;
    school?: string | null;
    campus_name?: string | null;
  } | null;
}) {
  const institution =
    String(metadata?.institutionName || "") ||
    profile?.institution_name ||
    profile?.school ||
    "";
  const campus = String(metadata?.campusName || "") || profile?.campus_name || "";

  return [institution, campus].filter(Boolean).join(" - ") || null;
}

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { user: null, admin: null, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id, role, is_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.is_admin && profile?.role !== "admin") {
    return { user, admin, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { user, admin, response: null };
}

export async function GET() {
  const { admin, response } = await requireAdmin();
  if (response) return response;
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [
    profilesResult,
    submissionsResult,
    identityResult,
    propertyResult,
  ] = await Promise.all([
    admin
      .from("profiles")
      .select(
        "id, email, full_name, avatar_url, role, institution_name, school, campus_name, phone, phone_number_e164, phone_country_code, phone_country_iso, phone_verified, phone_verified_at, phone_verification_status, email_verified_at"
      ),
    admin
      .from("verification_submissions")
      .select("id, user_id, verification_type, role, status, submitted_at, reviewed_at, reviewed_by, rejection_reason, request_more_information_message, document_paths, document_metadata, created_at, updated_at")
      .order("updated_at", { ascending: false }),
    admin
      .from("identity_verifications")
      .select("id, user_id, status, rejection_reason, document_url, selfie_url, proof_url, document_type, created_at, reviewed_at, full_legal_name")
      .order("created_at", { ascending: false }),
    admin
      .from("listing_verifications")
      .select("id, owner_id, listing_id, status, relationship_type, submitted_at, reviewed_at, reviewed_by, owner_visible_reason, listing_verification_documents(id, original_filename, document_type, review_status, created_at), listings(title, address, city, campus, status)")
      .order("submitted_at", { ascending: false }),
  ]);

  if (profilesResult.error) {
    return NextResponse.json({ error: profilesResult.error.message }, { status: 500 });
  }

  const profiles = new Map(
    (profilesResult.data || []).map((profile) => [profile.id, profile])
  );
  const reviewerIds = new Set<string>();

  (submissionsResult.data || []).forEach((submission) => {
    if (submission.reviewed_by) reviewerIds.add(submission.reviewed_by);
  });
  (propertyResult.data || []).forEach((item) => {
    if (item.reviewed_by) reviewerIds.add(item.reviewed_by);
  });

  const { data: reviewers } = reviewerIds.size
    ? await admin
        .from("profiles")
        .select("id, full_name, email")
        .in("id", Array.from(reviewerIds))
    : { data: [] };
  const reviewerMap = new Map((reviewers || []).map((item) => [item.id, item]));

  const records: UnifiedVerificationRecord[] = [];

  for (const submission of submissionsResult.data || []) {
    const profile = profiles.get(submission.user_id);
    const metadata = (submission.document_metadata || {}) as Record<string, unknown>;
    records.push({
      id: submission.id,
      source: "verification_submissions",
      userId: submission.user_id,
      fullName: profile?.full_name || null,
      email: profile?.email || null,
      avatarUrl: profile?.avatar_url || null,
      role: profile?.role || submission.role || null,
      verificationType: submission.verification_type as UnifiedVerificationRecord["verificationType"],
      status: normalizeStatus(submission.status),
      submittedAt: submission.submitted_at || submission.created_at,
      reviewedAt: submission.reviewed_at,
      reviewerName: submission.reviewed_by
        ? reviewerMap.get(submission.reviewed_by)?.full_name || reviewerMap.get(submission.reviewed_by)?.email || null
        : null,
      rejectionReason:
        submission.rejection_reason ||
        submission.request_more_information_message ||
        null,
      institution: formatStudentInstitution({ metadata, profile }),
      property: String(metadata.listingId || "") || null,
      documentPaths: submission.document_paths || [],
      metadata,
    });
  }

  for (const item of identityResult.data || []) {
    const profile = profiles.get(item.user_id);
    records.push({
      id: item.id,
      source: "identity_verifications",
      userId: item.user_id,
      fullName: profile?.full_name || item.full_legal_name || null,
      email: profile?.email || null,
      avatarUrl: profile?.avatar_url || null,
      role: profile?.role || null,
      verificationType: "identity",
      status: normalizeStatus(item.status),
      submittedAt: item.created_at,
      reviewedAt: item.reviewed_at || null,
      reviewerName: null,
      rejectionReason: item.rejection_reason,
      institution: formatStudentInstitution({ profile }),
      property: null,
      documentPaths: [item.document_url, item.selfie_url, item.proof_url]
        .filter(Boolean)
        .map((path) => `identity-document:${path}`) as string[],
      metadata: { documentType: item.document_type, legacy: true },
    });
  }

  for (const item of propertyResult.data || []) {
    const profile = profiles.get(item.owner_id);
    const listing = Array.isArray(item.listings) ? item.listings[0] : item.listings;
    const documents = Array.isArray(item.listing_verification_documents)
      ? item.listing_verification_documents
      : [];

    records.push({
      id: item.id,
      source: "listing_verifications",
      userId: item.owner_id,
      fullName: profile?.full_name || null,
      email: profile?.email || null,
      avatarUrl: profile?.avatar_url || null,
      role: profile?.role || "owner",
      verificationType: "property_relationship",
      status: normalizeStatus(item.status),
      submittedAt: item.submitted_at,
      reviewedAt: item.reviewed_at || null,
      reviewerName: item.reviewed_by
        ? reviewerMap.get(item.reviewed_by)?.full_name || reviewerMap.get(item.reviewed_by)?.email || null
        : null,
      rejectionReason: item.owner_visible_reason,
      institution: null,
      property: listing
        ? [listing.title, listing.address, listing.city, listing.campus]
            .filter(Boolean)
            .join(" · ")
        : item.listing_id,
      documentPaths: documents
        .filter((document) => document?.id)
        .map((document) =>
          `listing-document:${document.id}:${document.original_filename || "Property document"}`
        ),
      metadata: {
        relationshipType: item.relationship_type,
        source: "listing_verifications",
        listingId: item.listing_id,
        listingStatus: listing?.status || null,
        documentCount: documents.length,
      },
    });
  }

  for (const profile of profilesResult.data || []) {
    records.push({
      id: `${profile.id}:email`,
      source: "profile",
      userId: profile.id,
      fullName: profile.full_name || null,
      email: profile.email || null,
      avatarUrl: profile.avatar_url || null,
      role: profile.role || null,
      verificationType: "email",
      status: profile.email_verified_at ? "approved" : "not_started",
      submittedAt: null,
      reviewedAt: profile.email_verified_at || null,
      reviewerName: "Supabase Auth",
      rejectionReason: null,
      institution: formatStudentInstitution({ profile }),
      property: null,
      documentPaths: [],
      metadata: {},
      verifiedAt: profile.email_verified_at || null,
    });

    records.push({
      id: `${profile.id}:phone`,
      source: "profile",
      userId: profile.id,
      fullName: profile.full_name || null,
      email: profile.email || null,
      avatarUrl: profile.avatar_url || null,
      role: profile.role || null,
      verificationType: "phone",
      status: profile.phone_verified_at || profile.phone_verified ? "approved" : normalizeStatus(profile.phone_verification_status),
      submittedAt: null,
      reviewedAt: profile.phone_verified_at || null,
      reviewerName: "Supabase Auth",
      rejectionReason: null,
      institution: formatStudentInstitution({ profile }),
      property: null,
      documentPaths: [],
      metadata: {
        countryIso: profile.phone_country_iso,
        countryCode: profile.phone_country_code,
      },
      phoneMasked: maskPhone(profile.phone_number_e164 || profile.phone),
      verifiedAt: profile.phone_verified_at || null,
    });
  }

  const sortedRecords = records.sort((a, b) => {
    const left = a.submittedAt || a.reviewedAt || "";
    const right = b.submittedAt || b.reviewedAt || "";
    return right.localeCompare(left);
  });

  return NextResponse.json({
    records: sortedRecords,
    profiles: groupVerificationRecords(sortedRecords),
  });
}

export async function POST(request: Request) {
  const { user, admin, response } = await requireAdmin();
  if (response) return response;
  if (!admin || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const id = String(body?.id || "");
  const source = String(body?.source || "");
  const action = String(body?.action || "");
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
  const now = new Date().toISOString();

  if (!id || !["verification_submissions", "listing_verifications"].includes(source)) {
    return NextResponse.json(
      { error: "Choose a valid verification record to review." },
      { status: 400 }
    );
  }

  const nextStatus =
    action === "approve"
      ? "approved"
      : action === "reject"
        ? "rejected"
        : action === "resubmission"
          ? "resubmission_required"
          : null;

  if (!nextStatus) {
    return NextResponse.json({ error: "Invalid review action." }, { status: 400 });
  }

  if ((nextStatus === "rejected" || nextStatus === "resubmission_required") && !reason) {
    return NextResponse.json({ error: "A user-facing reason is required." }, { status: 400 });
  }

  if (source === "listing_verifications") {
    const listingStatus = listingVerificationStatusForAdminAction(action);
    const documentStatus = documentReviewStatusForAdminAction(action);

    if (!listingStatus || !documentStatus) {
      return NextResponse.json({ error: "Invalid review action." }, { status: 400 });
    }

    const { data: verification, error: readError } = await admin
      .from("listing_verifications")
      .select("id, listing_id, owner_id, status")
      .eq("id", id)
      .maybeSingle();

    if (readError || !verification) {
      return NextResponse.json(
        { error: "Property verification submission not found." },
        { status: 404 }
      );
    }

    const { error: updateError } = await admin
      .from("listing_verifications")
      .update({
        status: listingStatus,
        reviewed_at: now,
        reviewed_by: user.id,
        owner_visible_reason:
          listingStatus === "verified" ? null : reason,
        updated_at: now,
      })
      .eq("id", id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    const documentPatch =
      documentStatus === "accepted"
        ? {
            review_status: "accepted",
            rejection_reason: null,
            reviewed_at: now,
            reviewed_by: user.id,
          }
        : {
            review_status: "rejected",
            rejection_reason: reason,
            reviewed_at: now,
            reviewed_by: user.id,
          };

    const { error: documentUpdateError } = await admin
      .from("listing_verification_documents")
      .update(documentPatch)
      .eq("verification_id", id)
      .eq("review_status", "pending");

    if (documentUpdateError) {
      console.error("PROPERTY VERIFICATION DOCUMENT BULK REVIEW ERROR:", {
        verificationId: id,
        error: documentUpdateError,
      });
    }

    await admin.from("notifications").insert({
      user_id: verification.owner_id,
      title:
        listingStatus === "verified"
          ? "Property verification approved"
          : listingStatus === "declined"
            ? "Property verification rejected"
            : "More property verification information required",
      body:
        reason ||
        "Your Travel Markets property verification status was updated.",
      message:
        reason ||
        "Your Travel Markets property verification status was updated.",
      type: `listing_verification_${listingStatus}`,
      is_read: false,
      link: `/listings/${verification.listing_id}/edit`,
    });

    await admin.from("listing_verification_audit_events").insert({
      listing_id: verification.listing_id,
      verification_id: verification.id,
      actor_id: user.id,
      event_type: `admin_listing_verification_${listingStatus}`,
      metadata: {
        action,
        reason,
        previous_status: verification.status,
      },
    });

    await admin.from("admin_audit_logs").insert({
      admin_id: user.id,
      action: `listing_verification_${listingStatus}`,
      target_user_id: verification.owner_id,
      metadata: {
        verificationId: id,
        listingId: verification.listing_id,
        reason,
      },
    });

    return NextResponse.json({ success: true });
  }

  const { data: submission, error: readError } = await admin
    .from("verification_submissions")
    .select("id, user_id, verification_type, document_metadata, status")
    .eq("id", id)
    .maybeSingle();

  if (readError || !submission) {
    return NextResponse.json({ error: "Verification submission not found." }, { status: 404 });
  }

  const { error } = await admin
    .from("verification_submissions")
    .update({
      status: nextStatus,
      reviewed_at: now,
      reviewed_by: user.id,
      rejection_reason: nextStatus === "rejected" ? reason : null,
      request_more_information_message:
        nextStatus === "resubmission_required" ? reason : null,
      updated_at: now,
    })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const profileUpdate: Record<string, unknown> = { updated_at: now };
  if (submission.verification_type === "identity") {
    profileUpdate.identity_verification_status = nextStatus;
    profileUpdate.identity_verified = nextStatus === "approved";
    profileUpdate.is_verified = nextStatus === "approved";
    profileUpdate.identity_verified_at = nextStatus === "approved" ? now : null;
  }
  if (submission.verification_type === "student_status") {
    const metadata = (submission.document_metadata || {}) as Record<string, unknown>;

    profileUpdate.student_verification_status = nextStatus;
    profileUpdate.student_email_verified = nextStatus === "approved";

    if (nextStatus === "approved") {
      profileUpdate.institution_id =
        typeof metadata.institutionId === "string" ? metadata.institutionId : null;
      profileUpdate.institution_name =
        typeof metadata.institutionName === "string" ? metadata.institutionName : null;
      profileUpdate.school =
        typeof metadata.institutionName === "string" ? metadata.institutionName : null;
      profileUpdate.institution_not_listed = Boolean(metadata.institutionNotListed);
      profileUpdate.unlisted_institution_name =
        typeof metadata.unlistedInstitutionName === "string"
          ? metadata.unlistedInstitutionName
          : null;
      profileUpdate.campus_id =
        typeof metadata.campusId === "string" ? metadata.campusId : null;
      profileUpdate.campus_name =
        typeof metadata.campusName === "string" ? metadata.campusName : null;
      profileUpdate.campus_not_listed = Boolean(metadata.campusNotListed);
      profileUpdate.unlisted_campus_name =
        typeof metadata.unlistedCampusName === "string"
          ? metadata.unlistedCampusName
          : null;
    }
  }

  if (Object.keys(profileUpdate).length > 1) {
    await admin.from("profiles").update(profileUpdate).eq("id", submission.user_id);
  }

  if (submission.verification_type === "property_relationship") {
    const metadata = (submission.document_metadata || {}) as Record<string, unknown>;
    const listingId =
      typeof metadata.listingId === "string" && metadata.listingId.trim()
        ? metadata.listingId.trim()
        : "";

    if (listingId) {
      const { data: listing } = await admin
        .from("listings")
        .select("id, user_id")
        .eq("id", listingId)
        .eq("user_id", submission.user_id)
        .maybeSingle();
      const relationshipType = legacyRelationshipTypeForListingVerification(
        typeof metadata.relationshipType === "string"
          ? metadata.relationshipType
          : null
      );
      const listingStatus = listingVerificationStatusForAdminAction(action);

      if (listing && relationshipType && listingStatus) {
        const { data: existingListingVerification } = await admin
          .from("listing_verifications")
          .select("id, status")
          .eq("listing_id", listing.id)
          .maybeSingle();

        const verificationId =
          existingListingVerification?.id || crypto.randomUUID();

        const { error: listingVerificationError } = await admin
          .from("listing_verifications")
          .upsert(
            {
              id: verificationId,
              listing_id: listing.id,
              owner_id: submission.user_id,
              relationship_type: relationshipType,
              status: listingStatus,
              submitted_at: now,
              reviewed_at: now,
              reviewed_by: user.id,
              owner_visible_reason:
                listingStatus === "verified" ? null : reason,
              updated_at: now,
            },
            { onConflict: "listing_id" }
          );

        if (listingVerificationError) {
          console.error("LEGACY PROPERTY SUBMISSION LISTING SYNC ERROR:", {
            submissionId: submission.id,
            listingId: listing.id,
            error: listingVerificationError,
          });
        } else {
          await admin.from("listing_verification_audit_events").insert({
            listing_id: listing.id,
            verification_id: verificationId,
            actor_id: user.id,
            event_type: `legacy_property_submission_${listingStatus}`,
            metadata: {
              submissionId: submission.id,
              action,
              reason,
              previous_submission_status: submission.status,
            },
          });
        }
      }
    }
  }

  await admin.from("notifications").insert({
    user_id: submission.user_id,
    title:
      nextStatus === "approved"
        ? "Verification approved"
        : nextStatus === "rejected"
          ? "Verification rejected"
          : "More information required",
    body:
      reason ||
      "Your Travel Markets verification status was updated.",
    message:
      reason ||
      "Your Travel Markets verification status was updated.",
    type: `verification_${nextStatus}`,
    is_read: false,
    link: "/dashboard/verification",
  });

  await admin.from("admin_audit_logs").insert({
    admin_id: user.id,
    action: `verification_${nextStatus}`,
    target_user_id: submission.user_id,
    metadata: {
      submissionId: id,
      verificationType: submission.verification_type,
      reason,
    },
  });

  return NextResponse.json({ success: true });
}
