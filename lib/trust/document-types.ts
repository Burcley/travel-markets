export const allowedDocumentMimeTypes = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const maxDocumentFileSize = 10 * 1024 * 1024;

export const documentTypes = [
  {
    value: "proof_of_enrolment",
    label: "Proof of enrolment",
    highRisk: false,
  },
  {
    value: "proof_of_income",
    label: "Proof of income",
    highRisk: true,
  },
  {
    value: "employment_letter",
    label: "Employment letter",
    highRisk: false,
  },
  {
    value: "rental_history",
    label: "Rental history",
    highRisk: false,
  },
  {
    value: "landlord_reference",
    label: "Landlord reference",
    highRisk: false,
  },
  {
    value: "credit_report_or_consent",
    label: "Credit report or consent",
    highRisk: true,
  },
  {
    value: "guarantor_information",
    label: "Guarantor information",
    highRisk: true,
  },
  {
    value: "government_identification",
    label: "Government identification",
    highRisk: true,
  },
  {
    value: "visa_or_study_authorization",
    label: "Visa or study authorization",
    highRisk: true,
  },
  {
    value: "bank_statement",
    label: "Bank statement",
    highRisk: true,
  },
  {
    value: "other",
    label: "Other",
    highRisk: true,
  },
] as const;

export const requirementLevels = [
  { value: "required", label: "Required" },
  { value: "optional", label: "Optional" },
  { value: "conditional", label: "Conditional" },
  { value: "alternative_accepted", label: "Alternative accepted" },
] as const;

export const appliesWhenOptions = [
  { value: "all_applicants", label: "All applicants" },
  { value: "employed", label: "Employed applicants" },
  { value: "self_employed", label: "Self-employed applicants" },
  { value: "student", label: "Students" },
  { value: "newcomer", label: "Newcomers" },
  {
    value: "no_canadian_credit_history",
    label: "No Canadian credit history",
  },
  { value: "guarantor_used", label: "Guarantor used" },
  { value: "other", label: "Other authorized relationship" },
] as const;

export const relationshipTypes = [
  { value: "registered_owner", label: "Registered owner" },
  { value: "property_manager", label: "Property manager" },
  {
    value: "authorized_representative",
    label: "Authorized representative",
  },
  {
    value: "corporate_representative",
    label: "Corporate representative",
  },
  { value: "authorized_sublessor", label: "Authorized sublessor" },
  { value: "other", label: "Other" },
] as const;

export const propertyVerificationDocumentTypes = [
  {
    value: "property_tax_statement",
    label: "Property tax statement",
    relationships: ["registered_owner"],
  },
  {
    value: "municipal_property_assessment",
    label: "Municipal property assessment",
    relationships: ["registered_owner"],
  },
  {
    value: "land_registry_document",
    label: "Land registry or parcel document",
    relationships: ["registered_owner"],
  },
  {
    value: "property_insurance",
    label: "Property insurance document",
    relationships: ["registered_owner"],
  },
  {
    value: "purchase_or_closing_document",
    label: "Purchase or closing document",
    relationships: ["registered_owner"],
  },
  {
    value: "condominium_ownership_statement",
    label: "Condominium ownership statement",
    relationships: ["registered_owner"],
  },
  {
    value: "mortgage_statement",
    label: "Mortgage statement with sensitive information redacted",
    relationships: ["registered_owner"],
  },
  {
    value: "property_management_agreement",
    label: "Property-management agreement",
    relationships: ["property_manager"],
  },
  {
    value: "management_authorization_letter",
    label: "Management authorization letter",
    relationships: ["property_manager"],
  },
  {
    value: "owner_authorization_letter",
    label: "Owner authorization letter",
    relationships: ["authorized_representative"],
  },
  {
    value: "corporate_authorization",
    label: "Corporate authorization document",
    relationships: ["corporate_representative"],
  },
  {
    value: "current_lease",
    label: "Current lease",
    relationships: ["authorized_sublessor"],
  },
  {
    value: "sublet_permission",
    label: "Written permission to sublet",
    relationships: ["authorized_sublessor"],
  },
  {
    value: "supporting_ownership_document",
    label: "Supporting ownership document",
    relationships: [
      "property_manager",
      "authorized_representative",
      "corporate_representative",
    ],
  },
  {
    value: "other",
    label: "Other supporting document",
    relationships: [
      "registered_owner",
      "property_manager",
      "authorized_representative",
      "corporate_representative",
      "authorized_sublessor",
      "other",
    ],
  },
] as const;

export const relationshipDocumentExamples: Record<string, string[]> = {
  registered_owner: [
    "Property tax statement",
    "Municipal property assessment",
    "Land registry or parcel document",
    "Property insurance document",
    "Purchase or closing document",
    "Condominium ownership statement",
    "Mortgage statement with financial information redacted",
  ],
  property_manager: [
    "Signed property-management agreement",
    "Management authorization letter",
    "Company authorization combined with evidence connecting the owner to the property",
  ],
  authorized_representative: [
    "Signed authorization from the owner",
    "Power or authority document where appropriate",
    "Supporting document connecting the owner to the property",
  ],
  corporate_representative: [
    "Corporate ownership document",
    "Company authorization",
    "Evidence connecting the corporation to the property",
    "Evidence showing the uploader is authorized to act for the corporation",
  ],
  authorized_sublessor: [
    "Current lease",
    "Written permission to sublet where applicable",
    "Other supporting authorization",
  ],
  other: [
    "Written explanation of your authorized relationship",
    "At least one supporting authorization document",
  ],
};

export const relationshipClaimDescriptions: Record<string, string> = {
  registered_owner:
    "The landlord states that they are the registered owner of this property.",
  property_manager:
    "The landlord states that they are authorized to manage this property for the owner.",
  authorized_representative:
    "The landlord states that the owner has authorized them to advertise or manage this property.",
  corporate_representative:
    "The landlord states that they are authorized to act for the company that owns or manages this property.",
  authorized_sublessor:
    "The landlord states that they are the current tenant and have permission to sublet this property.",
  other: "The landlord selected another authorized relationship.",
};

export const relationshipGuidance: Record<
  string,
  { title: string; description: string; examples?: string[] }
> = {
  registered_owner: {
    title: "Registered owner",
    description:
      "Choose this when your name or your company appears on official property records.",
    examples: [
      "Property tax statement",
      "Municipal property assessment",
      "Land registry or parcel document",
      "Property insurance document",
      "Purchase or closing document",
      "Condominium ownership statement",
    ],
  },
  property_manager: {
    title: "Property manager",
    description:
      "Choose this when you manage the property for the owner or ownership company.",
    examples: [
      "Signed property-management agreement",
      "Management authorization letter",
      "Supporting ownership document connecting the owner to the property",
    ],
  },
  authorized_representative: {
    title: "Authorized representative",
    description:
      "Choose this when the owner has given you permission to advertise or manage the rental.",
    examples: [
      "Signed authorization letter from the owner",
      "Document connecting the owner to the property",
      "Power or authority document where appropriate",
    ],
  },
  corporate_representative: {
    title: "Corporate representative",
    description:
      "Choose this when the property belongs to a company and you are authorized to act for that company.",
    examples: [
      "Corporate ownership document",
      "Company authorization letter",
      "Document showing your authority within the company",
    ],
  },
  authorized_sublessor: {
    title: "Authorized sublessor",
    description:
      "Choose this when you are the current tenant and have permission to sublet the property.",
    examples: [
      "Current lease",
      "Written sublet permission where applicable",
      "Other owner or landlord authorization",
    ],
  },
  other: {
    title: "Other authorized relationship",
    description:
      "Explain your connection to the property clearly. Travel Markets may request additional documents before approval.",
  },
};

export const requirementLevelGuidance: Record<string, string> = {
  required:
    "The applicant is expected to provide this unless an approved alternative applies.",
  optional:
    "The applicant may provide this, but it should not automatically prevent an application from being considered.",
  conditional: "Request this only when the listed condition applies.",
  alternative_accepted:
    "The applicant may provide another document instead.",
};

export function getDocumentTypeLabel(value?: string | null) {
  return documentTypes.find((item) => item.value === value)?.label || "Document";
}

export function getPropertyVerificationDocumentTypeLabel(value?: string | null) {
  return (
    propertyVerificationDocumentTypes.find((item) => item.value === value)
      ?.label || "Uploaded verification document"
  );
}

export function getPropertyVerificationDocumentTypesForRelationship(
  relationshipType?: string | null
) {
  if (!relationshipType) return propertyVerificationDocumentTypes;

  return propertyVerificationDocumentTypes.filter((item) =>
    item.relationships.includes(relationshipType as never)
  );
}

export function isHighRiskDocumentType(value?: string | null) {
  return Boolean(documentTypes.find((item) => item.value === value)?.highRisk);
}

export function sanitizeDocumentFilename(filename: string) {
  const extension = filename.split(".").pop()?.toLowerCase() || "bin";
  const base = filename
    .replace(/\.[^/.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return `${base || "document"}.${extension}`;
}

export function validateSecureDocumentFile(file: File) {
  if (!allowedDocumentMimeTypes.includes(file.type as never)) {
    return "Upload a PDF, JPG, PNG, or WebP file.";
  }

  if (file.size > maxDocumentFileSize) {
    return "Files must be 10 MB or smaller.";
  }

  return "";
}
