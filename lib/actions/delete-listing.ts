"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET_NAME = "listing-images";

type DeleteListingResult = {
  success: boolean;
  message: string;
};

function extractStoragePathFromUrl(url: string | null) {
  if (!url) return null;

  const marker = `/object/public/${BUCKET_NAME}/`;
  const index = url.indexOf(marker);

  if (index === -1) return null;

  return decodeURIComponent(url.substring(index + marker.length));
}

export async function deleteListingAction(
  listingId: string
): Promise<DeleteListingResult> {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return {
        success: false,
        message: "You must be logged in to delete a listing.",
      };
    }

    const { data: listing, error: listingError } = await supabase
      .from("listings")
      .select("id, user_id")
      .eq("id", listingId)
      .single();

    if (listingError || !listing) {
      return {
        success: false,
        message: "Listing not found.",
      };
    }

    if (listing.user_id !== user.id) {
      return {
        success: false,
        message: "You are not allowed to delete this listing.",
      };
    }

    const { data: images, error: imagesError } = await supabase
      .from("listing_images")
      .select("id, image_url, storage_path")
      .eq("listing_id", listingId);

    if (imagesError) {
      return {
        success: false,
        message: "Could not load listing images.",
      };
    }

    const storagePaths =
      images
        ?.map((img) => img.storage_path || extractStoragePathFromUrl(img.image_url))
        .filter((path): path is string => Boolean(path)) || [];

    if (storagePaths.length > 0) {
      const { error: storageDeleteError } = await adminSupabase.storage
        .from(BUCKET_NAME)
        .remove(storagePaths);

      if (storageDeleteError) {
        return {
          success: false,
          message: `Storage delete failed: ${storageDeleteError.message}`,
        };
      }
    }

    const { error: imagesDeleteError } = await supabase
      .from("listing_images")
      .delete()
      .eq("listing_id", listingId);

    if (imagesDeleteError) {
      return {
        success: false,
        message: `Could not delete image records: ${imagesDeleteError.message}`,
      };
    }

    const { error: listingDeleteError } = await supabase
      .from("listings")
      .delete()
      .eq("id", listingId)
      .eq("user_id", user.id);

    if (listingDeleteError) {
      return {
        success: false,
        message: `Could not delete listing: ${listingDeleteError.message}`,
      };
    }

    revalidatePath("/");
    revalidatePath("/my-listings");
    revalidatePath(`/listings/${listingId}`);

    return {
      success: true,
      message: "Listing deleted successfully.",
    };
  } catch (error) {
    console.error("Delete listing error:", error);

    return {
      success: false,
      message: "Something went wrong while deleting the listing.",
    };
  }
}