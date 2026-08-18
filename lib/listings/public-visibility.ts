import {
  PUBLIC_LISTING_STATUS,
  PUBLIC_LISTING_VERIFICATION_STATUS,
} from "./public-visibility-core.mjs";

type SupabaseLike = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (
        column: string,
        value: string
      ) => {
        range: (from: number, to: number) => unknown;
      };
    };
  };
};

const PAGE_SIZE = 1000;

export { PUBLIC_LISTING_STATUS, PUBLIC_LISTING_VERIFICATION_STATUS };

export async function getVerifiedPublicListingIds(supabase: SupabaseLike) {
  const ids: string[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await (supabase
      .from("public_listing_verification_status")
      .select("listing_id")
      .eq("status", PUBLIC_LISTING_VERIFICATION_STATUS)
      .range(from, from + PAGE_SIZE - 1) as PromiseLike<{
      data: Array<{ listing_id: string | null }> | null;
      error: { message?: string | null } | null;
    }>);

    if (error) {
      throw new Error(error.message || "Unable to load verified listings.");
    }

    const page = data || [];
    ids.push(
      ...page
        .map((item) => item.listing_id)
        .filter((id): id is string => Boolean(id))
    );

    if (page.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return ids;
}

export function listingIsVerifiedForPublicDiscovery(
  verificationStatus?: string | null
) {
  return verificationStatus === PUBLIC_LISTING_VERIFICATION_STATUS;
}
