export function getListingLandlordVerificationDisplay({
  ownerAccountEligible = false,
} = {}) {
  if (ownerAccountEligible) {
    return {
      label: "Verified Landlord",
      verified: true,
      className: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
    };
  }

  return {
    label: "Not verified",
    verified: false,
    className: "border-gray-800 bg-white/5 text-gray-300",
  };
}
