export function propertyVerificationDocumentSelectionMessage(input: {
  hasSelectedFiles: boolean;
  persisted: boolean;
}): string;

export function listingPropertyVerificationStatusLabel(
  status?: string | null
): string;

export function listingPropertyVerificationState(status?: string | null): {
  label: string;
  description: string;
  actionLabel: string | null;
};

export function legacyAccountVerificationNotice(input: {
  hasListingVerification: boolean;
  hasApprovedLegacyPropertyVerification: boolean;
}): {
  title: string;
  description: string;
  actionLabel: string;
} | null;
