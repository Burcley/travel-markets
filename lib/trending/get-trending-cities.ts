import { createClient } from "@/lib/supabase/server";

type ListingViewRow = {
  listing_id: string | null;
  listings:
    | {
        city: string | null;
        campus: string | null;
      }
    | null;
};

export async function getTrendingCities() {
  const supabase = await createClient();

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { data, error } = await supabase
    .from("listing_views")
    .select(
      `
      listing_id,
      listings (
        city,
        campus
      )
    `
    )
    .gte("viewed_at", sevenDaysAgo.toISOString());

  if (error) {
    console.error("TRENDING CITIES ERROR:", error);
    return [];
  }

  const rows = (data ?? []) as unknown as ListingViewRow[];

  const grouped = new Map<string, { name: string; count: number }>();

  for (const row of rows) {
    const city = row.listings?.city?.trim();

    if (!city) continue;

    const key = city.toLowerCase();
    const existing = grouped.get(key);

    if (existing) {
      existing.count += 1;
    } else {
      grouped.set(key, {
        name: city,
        count: 1,
      });
    }
  }

  return Array.from(grouped.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
}