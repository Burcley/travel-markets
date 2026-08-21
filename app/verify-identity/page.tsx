"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Building2,
  CheckCircle2,
  GraduationCap,
  IdCard,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import InstitutionCampusSelector, {
  OTHER_CAMPUS_ID,
  UNLISTED_INSTITUTION_ID,
} from "@/components/institutions/InstitutionCampusSelector";
import {
  getCampusById,
  getCampusesForInstitution,
  getInstitutionById,
} from "@/lib/data/canadian-institutions";

type VerificationType = "identity" | "student_status" | "property_relationship";

function normalizeType(value: string | null): VerificationType {
  if (value === "student_status") return "student_status";
  if (value === "property_relationship") return "property_relationship";
  return "identity";
}

const copy = {
  identity: {
    icon: IdCard,
    eyebrow: "Identity Verification",
    title: "Upload government ID",
    subtitle:
      "Travel Markets reviews identity documents privately to reduce fake accounts and unsafe interactions.",
    documentLabel: "Government ID document",
    button: "Submit identity verification",
  },
  student_status: {
    icon: GraduationCap,
    eyebrow: "Student Status Verification",
    title: "Upload proof of enrollment",
    subtitle:
      "Student documents help hosts identify serious student renters while keeping academic records private.",
    documentLabel: "Enrollment, admission, or current student document",
    button: "Submit student verification",
  },
  property_relationship: {
    icon: Building2,
    eyebrow: "Landlord Verification",
    title: "Upload landlord or property-manager document",
    subtitle:
      "Verify your landlord or property-management role once so you can publish and manage listings without repeating property verification for every listing.",
    documentLabel: "Landlord, business, management, attestation, or authorization document",
    button: "Submit landlord verification",
  },
} satisfies Record<VerificationType, {
  icon: typeof IdCard;
  eyebrow: string;
  title: string;
  subtitle: string;
  documentLabel: string;
  button: string;
}>;

export default function VerifyIdentityPage() {
  return (
    <Suspense fallback={<VerifyIdentityLoading />}>
      <VerifyIdentityContent />
    </Suspense>
  );
}

function VerifyIdentityLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-black text-white">
      <Loader2 className="h-8 w-8 animate-spin text-pink-300" />
    </main>
  );
}

function VerifyIdentityContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);
  const verificationType = normalizeType(searchParams.get("type"));
  const pageCopy = copy[verificationType];
  const Icon = pageCopy.icon;

  const [fullLegalName, setFullLegalName] = useState("");
  const [documentType, setDocumentType] = useState(
    verificationType === "student_status" ? "proof_of_enrollment" : "passport"
  );
  const [issuingCountry, setIssuingCountry] = useState("Canada");
  const [institutionId, setInstitutionId] = useState("");
  const [institutionSearch, setInstitutionSearch] = useState("");
  const [unlistedInstitutionName, setUnlistedInstitutionName] = useState("");
  const [campusId, setCampusId] = useState("");
  const [unlistedCampusName, setUnlistedCampusName] = useState("");
  const [expectedGraduation, setExpectedGraduation] = useState("");
  const [relationshipType, setRelationshipType] = useState("owner");
  const [listingId, setListingId] = useState("");
  const [declarationAccepted, setDeclarationAccepted] = useState(false);
  const [documents, setDocuments] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (verificationType !== "student_status") return;

    let cancelled = false;

    async function loadStudentProfile() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || cancelled) return;

      const { data } = await supabase
        .from("profiles")
        .select(
          "institution_id, institution_name, institution_not_listed, unlisted_institution_name, campus_id, campus_name, campus_not_listed, unlisted_campus_name, expected_graduation"
        )
        .eq("id", user.id)
        .maybeSingle();

      if (!data || cancelled) return;

      if (data.institution_not_listed) {
        setInstitutionId(UNLISTED_INSTITUTION_ID);
        setInstitutionSearch("Other Ontario university");
        setUnlistedInstitutionName(data.unlisted_institution_name || data.institution_name || "");
      } else {
        setInstitutionId(data.institution_id || "");
        setInstitutionSearch(data.institution_name || "");
      }

      if (data.campus_not_listed) {
        setCampusId(OTHER_CAMPUS_ID);
        setUnlistedCampusName(data.unlisted_campus_name || data.campus_name || "");
      } else {
        setCampusId(data.campus_id || "");
      }

      setExpectedGraduation(data.expected_graduation || "");
    }

    loadStudentProfile();

    return () => {
      cancelled = true;
    };
  }, [supabase, verificationType]);

  async function submitVerification() {
    setLoading(true);
    setError("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/auth?returnTo=/verify-identity");
      return;
    }

    const formData = new FormData();
    formData.set("verification_type", verificationType);
    formData.set("full_legal_name", fullLegalName.trim());
    formData.set("document_type", documentType);
    formData.set("issuing_country", issuingCountry.trim());
    const selectedInstitution =
      institutionId && institutionId !== UNLISTED_INSTITUTION_ID
        ? getInstitutionById(institutionId)
        : null;
    const selectedCampus =
      campusId && campusId !== OTHER_CAMPUS_ID ? getCampusById(campusId) : null;
    const canonicalInstitutionName =
      selectedInstitution?.name || unlistedInstitutionName.trim();
    const canonicalCampusName = selectedCampus?.name || unlistedCampusName.trim();

    formData.set("institution_id", institutionId);
    formData.set("institution_name", canonicalInstitutionName);
    formData.set("unlisted_institution_name", unlistedInstitutionName.trim());
    formData.set("campus_id", campusId);
    formData.set("campus_name", canonicalCampusName);
    formData.set("unlisted_campus_name", unlistedCampusName.trim());
    formData.set("expected_graduation", expectedGraduation);
    formData.set("relationship_type", relationshipType);
    formData.set("listing_id", listingId.trim());
    formData.set("declaration_accepted", String(declarationAccepted));

    documents.forEach((file) => formData.append("documents", file));

    const response = await fetch("/api/verification-submissions", {
      method: "POST",
      body: formData,
    });
    const data = await response.json().catch(() => null);

    setLoading(false);

    if (!response.ok) {
      setError(data?.error || "We could not submit your verification. Please try again.");
      return;
    }

    setSuccess(true);
    setTimeout(() => router.push("/dashboard/verification"), 900);
  }

  return (
    <main className="min-h-screen bg-black px-4 py-10 text-white">
      <div className="mx-auto max-w-3xl rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(244,63,94,0.20),rgba(24,24,27,0.96)_42%,rgba(0,0,0,1)_100%)] p-6 shadow-2xl sm:p-10">
        <div className="mb-8 flex items-start gap-4">
          <div className="rounded-2xl bg-pink-500/10 p-3 text-pink-200">
            <Icon className="h-7 w-7" />
          </div>

          <div>
            <p className="text-sm font-black uppercase tracking-[0.2em] text-pink-300">
              {pageCopy.eyebrow}
            </p>
            <h1 className="mt-2 text-3xl font-black sm:text-4xl">
              {pageCopy.title}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
              {pageCopy.subtitle}
            </p>
          </div>
        </div>

        <div className="space-y-5">
          {verificationType === "identity" && (
            <>
              <Field
                label="Full legal name"
                value={fullLegalName}
                onChange={setFullLegalName}
                placeholder="Name exactly as it appears on your ID"
              />
              <SelectField
                label="Government ID type"
                value={documentType}
                onChange={setDocumentType}
                options={[
                  ["passport", "Passport"],
                  ["drivers_license", "Driver's licence"],
                  ["national_id", "National ID"],
                  ["other", "Other government ID"],
                ]}
              />
              <Field label="Issuing country" value={issuingCountry} onChange={setIssuingCountry} />
            </>
          )}

          {verificationType === "student_status" && (
            <>
              <InstitutionCampusSelector
                institutionId={institutionId}
                institutionSearch={institutionSearch}
                campusId={campusId}
                unlistedInstitutionName={unlistedInstitutionName}
                unlistedCampusName={unlistedCampusName}
                onInstitutionSearchChange={setInstitutionSearch}
                onInstitutionChange={(nextInstitutionId) => {
                  const institution =
                    nextInstitutionId === UNLISTED_INSTITUTION_ID
                      ? null
                      : getInstitutionById(nextInstitutionId);

                  setInstitutionId(nextInstitutionId);
                  setInstitutionSearch(
                    nextInstitutionId === UNLISTED_INSTITUTION_ID
                      ? "Other Ontario university"
                      : institution?.name || ""
                  );
                  setCampusId("");
                  setUnlistedCampusName("");
                }}
                onCampusChange={(nextCampusId) => {
                  setCampusId(nextCampusId);
                  if (nextCampusId !== OTHER_CAMPUS_ID) {
                    setUnlistedCampusName("");
                  }
                }}
                onUnlistedInstitutionNameChange={setUnlistedInstitutionName}
                onUnlistedCampusNameChange={setUnlistedCampusName}
              />
              <SelectField
                label="Academic document type"
                value={documentType}
                onChange={setDocumentType}
                options={[
                  ["proof_of_enrollment", "Proof of enrollment"],
                  ["admission_letter", "Admission letter"],
                  ["student_id", "Student ID"],
                  ["current_student_document", "Current student document"],
                ]}
              />
              <Field
                label="Expected graduation date"
                value={expectedGraduation}
                onChange={setExpectedGraduation}
                type="date"
              />
              {institutionId &&
                institutionId !== UNLISTED_INSTITUTION_ID &&
                getCampusesForInstitution(institutionId).length === 0 && (
                  <p className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs leading-5 text-zinc-400">
                    This university does not have multiple campuses listed yet. Your
                    document will still be reviewed against the selected university.
                  </p>
                )}
            </>
          )}

          {verificationType === "property_relationship" && (
            <>
              <SelectField
                label="Landlord or management role"
                value={relationshipType}
                onChange={setRelationshipType}
                options={[
                  ["owner", "Landlord / owner"],
                  ["property_manager", "Property manager"],
                  ["business_operator", "Property-management business"],
                  ["authorized_representative", "Authorized representative"],
                  ["attestation", "Signed landlord/property-manager attestation"],
                  ["other", "Other supporting document"],
                ]}
              />
              <Field
                label="Company or reference note (optional)"
                value={listingId}
                onChange={setListingId}
                placeholder="Example: company name, management role, or context for admin review"
              />
              <details className="rounded-2xl border border-white/10 bg-black/40 p-4 text-sm text-zinc-300">
                <summary className="cursor-pointer font-bold text-white">
                  Why we ask for this
                </summary>
                <p className="mt-3 leading-6 text-zinc-400">
                  Travel Markets reviews one account-level document so students
                  can trust that listings are posted by a legitimate landlord,
                  property manager, or authorized rental operator.
                </p>
              </details>
              <details className="rounded-2xl border border-white/10 bg-black/40 p-4 text-sm text-zinc-300">
                <summary className="cursor-pointer font-bold text-white">
                  Privacy & document guidance
                </summary>
                <p className="mt-3 leading-6 text-zinc-400">
                  Upload a relevant supporting document, such as a property
                  management agreement, business registration showing rental
                  management activity, authorization to manage/rent, signed
                  attestation, or ownership-related document if you choose.
                  Redact banking details, mortgage balances, SINs, complete
                  account numbers, and unrelated private information.
                </p>
              </details>
              <label className="flex items-start gap-3 rounded-2xl border border-white/10 bg-black/50 p-4 text-sm text-zinc-300">
                <input
                  type="checkbox"
                  checked={declarationAccepted}
                  onChange={(event) => setDeclarationAccepted(event.target.checked)}
                  className="mt-1"
                />
                <span>
                  I confirm I am authorized to advertise rental housing on Travel
                  Markets and understand a signed attestation is supporting
                  information for admin review, not automatic legal proof of
                  ownership.
                </span>
              </label>
            </>
          )}

          <label className="block">
            <span className="mb-2 block text-sm font-bold text-zinc-300">
              {pageCopy.documentLabel}
            </span>
            <input
              type="file"
              accept="image/*,.pdf"
              multiple
              onChange={(event) => setDocuments(Array.from(event.target.files || []))}
              className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm text-zinc-300 outline-none file:mr-4 file:rounded-xl file:border-0 file:bg-white file:px-4 file:py-2 file:text-sm file:font-black file:text-black"
            />
            <p className="mt-2 text-xs leading-5 text-zinc-500">
              Documents are uploaded to private storage. Only you and authorized
              Travel Markets admins can access them.
            </p>
          </label>

          {error && (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
              {error}
            </div>
          )}

          {success && (
            <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-200">
              <CheckCircle2 className="h-5 w-5" />
              Verification submitted. Returning to the Verification Center...
            </div>
          )}

          <button
            onClick={submitVerification}
            disabled={loading || success}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 font-black text-black transition hover:bg-zinc-200 disabled:opacity-60"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {pageCopy.button}
          </button>

          <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-pink-200" />
            <p className="text-sm leading-6 text-zinc-400">
              Travel Markets reviews submissions manually. You will see Pending
              Review until an admin approves, rejects, or requests resubmission.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-zinc-300">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        type={type}
        className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none transition placeholder:text-zinc-600 focus:border-pink-400"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<[string, string]>;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-zinc-300">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none transition focus:border-pink-400"
      >
        {options.map(([optionValue, labelText]) => (
          <option key={optionValue} value={optionValue}>
            {labelText}
          </option>
        ))}
      </select>
    </label>
  );
}
