export function propertyVerificationDocumentSelectionMessage({
  hasSelectedFiles,
  persisted,
}) {
  if (persisted) {
    return "Property verification submitted and awaiting review.";
  }

  if (hasSelectedFiles) {
    return "Document selected. Save or submit this listing to upload it for review.";
  }

  return "Supporting document still required.";
}

export function listingPropertyVerificationStatusLabel(status) {
  if (status === "verified" || status === "accepted") {
    return "Verified";
  }

  if (status === "pending" || status === "submitted") {
    return "Pending review";
  }

  if (status === "more_information_required") {
    return "More information required";
  }

  if (status === "declined" || status === "rejected") {
    return "Declined";
  }

  if (status === "expired") {
    return "Expired";
  }

  return "Not submitted";
}

export function listingPropertyVerificationState(status) {
  const label = listingPropertyVerificationStatusLabel(status);

  if (label === "Not submitted") {
    return {
      label,
      description: "Property verification has not been submitted for this listing.",
      actionLabel: "Submit property verification",
    };
  }

  if (label === "Pending review") {
    return {
      label,
      description: "Property verification submitted and awaiting review.",
      actionLabel: null,
    };
  }

  if (label === "Verified") {
    return {
      label,
      description: "Property verification approved for this listing.",
      actionLabel: null,
    };
  }

  return {
    label,
    description: "Submit updated property verification documents for this listing.",
    actionLabel: "Resubmit property verification",
  };
}

export function legacyAccountVerificationNotice({
  hasListingVerification,
  hasApprovedLegacyPropertyVerification,
}) {
  if (hasListingVerification || !hasApprovedLegacyPropertyVerification) {
    return null;
  }

  return {
    title: "Property verification not submitted",
    description:
      "Your landlord account was previously verified, but this specific property has not yet been verified.",
    actionLabel: "Submit property verification",
  };
}
