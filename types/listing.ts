export type ListingImage = {
  id: string;
  listing_id: string;
  image_url: string;
  storage_path: string | null;
  sort_order: number | null;
  is_cover: boolean | null;
  created_at: string | null;
};

export type Listing = {
  id: string;
  title: string;
  description: string | null;
  price: number;
  location: string;
  bedrooms: number | null;
  bathrooms: number | null;
  created_at: string | null;
  user_id: string;
};

export type ListingWithImages = Listing & {
  listing_images: ListingImage[];
};