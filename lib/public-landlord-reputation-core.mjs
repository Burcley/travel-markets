export function getPublicLandlordReputation({
  verified,
  listingCount,
  reviewCount,
  averageRating,
}) {
  const safeListingCount = Number.isFinite(listingCount)
    ? Math.max(0, listingCount)
    : 0;
  const safeReviewCount = Number.isFinite(reviewCount)
    ? Math.max(0, reviewCount)
    : 0;
  const safeAverageRating = Number.isFinite(averageRating)
    ? Math.max(0, averageRating)
    : 0;

  if (
    verified &&
    safeReviewCount >= 10 &&
    safeAverageRating >= 4.7 &&
    safeListingCount >= 1
  ) {
    return {
      level: "highly_rated",
      label: "Highly Rated Landlord",
      description: "Strong review history from Travel Markets renters.",
      className: "border-yellow-400/30 bg-yellow-400/10 text-yellow-200",
    };
  }

  if (
    verified &&
    safeListingCount >= 2 &&
    safeReviewCount >= 3 &&
    safeAverageRating >= 4.2
  ) {
    return {
      level: "established",
      label: "Established Landlord",
      description: "Verified with growing marketplace history.",
      className: "border-sky-400/30 bg-sky-400/10 text-sky-200",
    };
  }

  return {
    level: "new",
    label: "New Landlord",
    description: "Recently joined Travel Markets.",
    className: "border-white/10 bg-white/[0.04] text-zinc-200",
  };
}

export function formatPublicReviewSummary(reviewCount, averageRating) {
  const safeReviewCount = Number.isFinite(reviewCount)
    ? Math.max(0, reviewCount)
    : 0;
  const safeAverageRating = Number.isFinite(averageRating)
    ? Math.max(0, averageRating)
    : 0;

  if (safeReviewCount === 0) {
    return {
      ratingLabel: "New",
      reviewLabel: "No Reviews Yet",
      compactLabel: "No Reviews Yet",
    };
  }

  return {
    ratingLabel: safeAverageRating.toFixed(1),
    reviewLabel: `${safeReviewCount} ${
      safeReviewCount === 1 ? "Review" : "Reviews"
    }`,
    compactLabel: `${safeAverageRating.toFixed(1)} • ${safeReviewCount} ${
      safeReviewCount === 1 ? "Review" : "Reviews"
    }`,
  };
}

export function formatActiveListingCount(listingCount) {
  const safeListingCount = Number.isFinite(listingCount)
    ? Math.max(0, listingCount)
    : 0;

  return `${safeListingCount} Active ${
    safeListingCount === 1 ? "Listing" : "Listings"
  }`;
}
