export type ListingSearchParams = {
  q?: string;
  city?: string;
  campus?: string;
  minPrice?: string;
  maxPrice?: string;
  bedrooms?: string;
  bathrooms?: string;
  guests?: string;
  status?: string;
  sort?: string;
  page?: string;
};

export type ListingCardData = {
  id: string;
  title: string;
  city: string | null;
  campus: string | null;
  price: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  guests: number | null;
  status: string | null;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
  cover_image_url: string | null;
};