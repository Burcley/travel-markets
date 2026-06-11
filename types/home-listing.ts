export type HomeListing = {
  id: string;
  title: string;
  price: number | null;
  city: string | null;
  campus: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  guests: number | null;
  status: string | null;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
  image_url: string | null;
  cover_image_url?: string | null;
  is_saved?: boolean;

  is_featured?: boolean;
  featured_until?: string | null;
  featured_rank?: number | null;

  owner_plan?: "free" | "pro" | "premium" | string;
  owner_badge?: string | null;
};