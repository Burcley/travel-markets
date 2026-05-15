import { supabase } from "@/lib/supabase";

const BUCKET = "listing-images";

function getFileExtension(file: File) {
  return file.name.split(".").pop() || "jpg";
}

function makeFilePath(listingId: number | string, file: File, index: number) {
  const ext = getFileExtension(file);
  const uniqueName = `${Date.now()}-${index}-${crypto.randomUUID()}.${ext}`;
  return `listings/${listingId}/${uniqueName}`;
}

export async function uploadSingleListingImage(
  listingId: number | string,
  file: File
) {
  const filePath = makeFilePath(listingId, file, 0);

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: false,
    });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(filePath);

  const imageUrl = data.publicUrl;

  const { error: insertError } = await supabase.from("listing_images").insert({
    listing_id: listingId,
    image_path: filePath,
    image_url: imageUrl,
    sort_order: 0,
    is_cover: true,
  });

  if (insertError) {
    throw new Error(insertError.message);
  }

  return imageUrl;
}

export async function uploadMultipleListingImages(
  listingId: number | string,
  files: File[]
) {
  const uploadedRows = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const filePath = makeFilePath(listingId, file, i);

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Upload failed for ${file.name}: ${uploadError.message}`);
    }

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(filePath);

    uploadedRows.push({
      listing_id: listingId,
      image_path: filePath,
      image_url: data.publicUrl,
      sort_order: i,
      is_cover: i === 0,
    });
  }

  const { error: insertError } = await supabase
    .from("listing_images")
    .insert(uploadedRows);

  if (insertError) {
    throw new Error(insertError.message);
  }

  return uploadedRows;
}