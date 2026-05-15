import { ListingImage } from "@/types/listing";

export function sortListingImages(images: ListingImage[]): ListingImage[] {
  return [...images].sort((a, b) => {
    const aCover = a.is_cover ? 1 : 0;
    const bCover = b.is_cover ? 1 : 0;

    if (aCover !== bCover) {
      return bCover - aCover;
    }

    const aSort = a.sort_order ?? 0;
    const bSort = b.sort_order ?? 0;

    if (aSort !== bSort) {
      return aSort - bSort;
    }

    const aCreated = a.created_at ? new Date(a.created_at).getTime() : 0;
    const bCreated = b.created_at ? new Date(b.created_at).getTime() : 0;

    return aCreated - bCreated;
  });
}

export function getCoverImage(images: ListingImage[]): ListingImage | null {
  if (!images.length) return null;
  const sorted = sortListingImages(images);
  return sorted[0] ?? null;
}