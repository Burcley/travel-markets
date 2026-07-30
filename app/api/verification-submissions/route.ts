import { NextResponse } from "next/server";
import {
  OTHER_CAMPUS_ID,
  UNLISTED_INSTITUTION_ID,
  campusBelongsToInstitution,
  getCampusesForInstitution,
  getInstitutionById,
} from "@/lib/data/canadian-institutions";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_TYPES = new Set([
  "identity",
  "student_status",
  "property_relationship",
]);

function isHostRole(role?: string | null) {
  return ["owner", "host", "landlord"].includes(String(role || "").toLowerCase());
}

function clean(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function safeFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 120) || "document";
}

function validateStudentInstitutionMetadata(formData: FormData) {
  const institutionId = clean(formData.get("institution_id"));
  const campusId = clean(formData.get("campus_id"));
  const unlistedInstitutionName = clean(formData.get("unlisted_institution_name"));
  const unlistedCampusName = clean(formData.get("unlisted_campus_name"));
  const submittedInstitutionName = clean(formData.get("institution_name"));
  const submittedCampusName = clean(formData.get("campus_name"));

  if (!institutionId) {
    return {
      error: "Choose your university.",
    };
  }

  if (institutionId === UNLISTED_INSTITUTION_ID) {
    if (!unlistedInstitutionName) {
      return {
        error: "Enter the Ontario university name for review.",
      };
    }

    return {
      institutionId: null,
      institutionName: unlistedInstitutionName,
      institutionNotListed: true,
      unlistedInstitutionName,
      campusId: null,
      campusName: unlistedCampusName || submittedCampusName || null,
      campusNotListed: Boolean(unlistedCampusName || submittedCampusName),
      unlistedCampusName: unlistedCampusName || submittedCampusName || null,
    };
  }

  const institution = getInstitutionById(institutionId);

  if (
    !institution ||
    !institution.active ||
    institution.province !== "Ontario" ||
    institution.type !== "university"
  ) {
    return {
      error: "Choose a recognized Ontario university.",
    };
  }

  const campuses = getCampusesForInstitution(institution.id);
  let campusName: string | null = null;
  let normalizedCampusId: string | null = null;
  let campusNotListed = false;
  let normalizedUnlistedCampusName: string | null = null;

  if (campuses.length > 0) {
    if (!campusId) {
      return {
        error: "Choose your campus.",
      };
    }

    if (campusId === OTHER_CAMPUS_ID) {
      if (!unlistedCampusName) {
        return {
          error: "Enter the campus name for review.",
        };
      }

      campusName = unlistedCampusName;
      campusNotListed = true;
      normalizedUnlistedCampusName = unlistedCampusName;
    } else {
      if (!campusBelongsToInstitution({ campusId, institutionId: institution.id })) {
        return {
          error: "Choose a valid campus for the selected university.",
        };
      }

      const campus = campuses.find((item) => item.id === campusId);
      normalizedCampusId = campusId;
      campusName = campus?.name || submittedCampusName || null;
    }
  }

  return {
    institutionId: institution.id,
    institutionName: institution.name,
    institutionNotListed: false,
    unlistedInstitutionName: null,
    campusId: normalizedCampusId,
    campusName,
    campusNotListed,
    unlistedCampusName: normalizedUnlistedCampusName,
    submittedInstitutionName,
  };
}

async function notifyAdmins({
  admin,
  submissionId,
  verificationType,
}: {
  admin: ReturnType<typeof createAdminClient>;
  submissionId: string;
  verificationType: string;
}) {
  const { data: admins } = await admin
    .from("profiles")
    .select("id, account_status")
    .or("is_admin.eq.true,role.eq.admin");

  const activeAdmins = (admins || []).filter(
    (profile: { account_status?: string | null }) =>
      !profile.account_status || profile.account_status === "active"
  );

  if (!activeAdmins.length) return;

  await admin.from("notifications").insert(
    activeAdmins.map((profile: { id: string }) => ({
      user_id: profile.id,
      type: "verification_submission_pending",
      title: "New verification submitted",
      body: `A ${verificationType.replaceAll("_", " ")} verification is ready for review.`,
      message: `A ${verificationType.replaceAll("_", " ")} verification is ready for review.`,
      is_read: false,
      link: `/admin/verifications?submissionId=${submissionId}`,
    }))
  );
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in to submit verification." }, { status: 401 });
  }

  const formData = await request.formData();
  const verificationType = clean(formData.get("verification_type"));

  if (!ALLOWED_TYPES.has(verificationType)) {
    return NextResponse.json({ error: "Choose a valid verification type." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id, role, full_name")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    console.error("VERIFICATION SUBMISSION PROFILE ERROR:", profileError);
    return NextResponse.json(
      { error: "We could not load your profile for verification." },
      { status: 500 }
    );
  }

  const role = String(profile.role || "student").toLowerCase();

  if (verificationType === "student_status" && role !== "student") {
    return NextResponse.json(
      { error: "Student status verification is only available for student accounts." },
      { status: 403 }
    );
  }

  if (verificationType === "property_relationship" && !isHostRole(role)) {
    return NextResponse.json(
      { error: "Property relationship verification is only available for host accounts." },
      { status: 403 }
    );
  }

  const files = formData
    .getAll("documents")
    .filter((value): value is File => value instanceof File && value.size > 0);

  if (!files.length) {
    return NextResponse.json(
      { error: "Upload at least one verification document." },
      { status: 400 }
    );
  }

  const studentInstitution =
    verificationType === "student_status"
      ? validateStudentInstitutionMetadata(formData)
      : null;

  if (studentInstitution && "error" in studentInstitution) {
    return NextResponse.json({ error: studentInstitution.error }, { status: 400 });
  }

  const metadata = {
    fullLegalName: clean(formData.get("full_legal_name")),
    documentType: clean(formData.get("document_type")),
    issuingCountry: clean(formData.get("issuing_country")),
    institutionId: studentInstitution?.institutionId || null,
    institutionName:
      studentInstitution?.institutionName || clean(formData.get("institution_name")),
    institutionNotListed: studentInstitution?.institutionNotListed || false,
    unlistedInstitutionName: studentInstitution?.unlistedInstitutionName || null,
    campusId: studentInstitution?.campusId || null,
    campusName: studentInstitution?.campusName || null,
    campusNotListed: studentInstitution?.campusNotListed || false,
    unlistedCampusName: studentInstitution?.unlistedCampusName || null,
    expectedGraduation: clean(formData.get("expected_graduation")),
    relationshipType: clean(formData.get("relationship_type")),
    listingId: clean(formData.get("listing_id")),
    declarationAccepted: clean(formData.get("declaration_accepted")) === "true",
  };

  if (verificationType === "identity" && (!metadata.fullLegalName || !metadata.documentType)) {
    return NextResponse.json(
      { error: "Enter your legal name and government ID type." },
      { status: 400 }
    );
  }

  if (
    verificationType === "student_status" &&
    (!metadata.institutionName || !metadata.documentType || !metadata.expectedGraduation)
  ) {
    return NextResponse.json(
      { error: "Choose your university, document type, and expected graduation date." },
      { status: 400 }
    );
  }

  if (
    verificationType === "property_relationship" &&
    (!metadata.relationshipType || !metadata.declarationAccepted)
  ) {
    return NextResponse.json(
      { error: "Choose your property relationship and confirm your authority." },
      { status: 400 }
    );
  }

  const { data: existing } = await admin
    .from("verification_submissions")
    .select("id, status")
    .eq("user_id", user.id)
    .eq("verification_type", verificationType)
    .in("status", ["pending", "approved", "resubmission_required"])
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: "You already have an active verification submission for this type." },
      { status: 409 }
    );
  }

  const submissionId = crypto.randomUUID();
  const documentPaths: string[] = [];

  try {
    for (const file of files) {
      const path = `${user.id}/${submissionId}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
      const buffer = Buffer.from(await file.arrayBuffer());
      const { error: uploadError } = await admin.storage
        .from("verification-submissions")
        .upload(path, buffer, {
          contentType: file.type || "application/octet-stream",
          upsert: false,
        });

      if (uploadError) throw uploadError;
      documentPaths.push(path);
    }

    const submittedAt = new Date().toISOString();
    const { error: insertError } = await admin.from("verification_submissions").insert({
      id: submissionId,
      user_id: user.id,
      verification_type: verificationType,
      role,
      status: "pending",
      submitted_at: submittedAt,
      document_paths: documentPaths,
      document_metadata: metadata,
      updated_at: submittedAt,
    });

    if (insertError) throw insertError;

    await notifyAdmins({ admin, submissionId, verificationType });

    return NextResponse.json({ success: true, submissionId });
  } catch (error) {
    console.error("VERIFICATION SUBMISSION ERROR:", error);

    if (documentPaths.length) {
      await admin.storage.from("verification-submissions").remove(documentPaths);
    }

    return NextResponse.json(
      { error: "We could not submit your verification. Please try again." },
      { status: 500 }
    );
  }
}
