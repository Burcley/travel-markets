import ListingsExplorer from "../components/ListingsExplorer";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("listings")
    .select(`
      id,
      title,
      location,
      campus,
      price,
      status,
      created_at,
      latitude,
      longitude,
      listing_images (
        image_url,
        is_cover,
        sort_order
      )
    `)
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <main className="min-h-screen bg-black p-10 text-white">
        Error loading listings: {error.message}
      </main>
    );
  }

  const listings =
    data?.map((listing: any) => {
      const images = listing.listing_images || [];

      const cover =
        images.find((img: any) => img.is_cover)?.image_url ||
        images.sort(
          (a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
        )[0]?.image_url ||
        null;

      return {
        id: listing.id,
        title: listing.title,
        city: listing.location,
        campus: listing.campus,
        price: listing.price,
        status: listing.status || "available",
        created_at: listing.created_at,
        cover_image: cover,
        latitude: listing.latitude,
        longitude: listing.longitude,
      };
    }) || [];

  return (
    <ListingsExplorer
      initialListings={listings}
      userEmail={user?.email || null}
    />
  );
}