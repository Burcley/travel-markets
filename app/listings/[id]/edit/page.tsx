"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type ExistingImage = {
  id: string;
  listing_id: string;
  image_url: string;
  image_path: string | null;
  storage_path: string | null;
  sort_order: number | null;
  is_cover: boolean | null;
};

type NewImage = {
  localId: string;
  file: File;
  previewUrl: string;
};

export default function EditListingPage() {
  const router = useRouter();
  const params = useParams();
  const listingId = params.id as string;
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [city, setCity] = useState("");
  const [campus, setCampus] = useState("");
  const [address, setAddress] = useState("");
  const [price, setPrice] = useState("");
  const [bedrooms, setBedrooms] = useState("");
  const [bathrooms, setBathrooms] = useState("");
  const [guests, setGuests] = useState("");
  const [roommates, setRoommates] = useState("");
  const [status, setStatus] = useState<"available" | "pending" | "rented">(
    "available"
  );
  const [description, setDescription] = useState("");
  const [amenities, setAmenities] = useState("");

  const [existingImages, setExistingImages] = useState<ExistingImage[]>([]);
  const [removedImages, setRemovedImages] = useState<ExistingImage[]>([]);
  const [newImages, setNewImages] = useState<NewImage[]>([]);

  const [coverType, setCoverType] = useState<"existing" | "new" | null>(null);
  const [coverId, setCoverId] = useState<string | null>(null);

  useEffect(() => {
    loadListing();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listingId]);

  async function loadListing() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/auth");
      return;
    }

    const { data: listing, error: listingError } = await supabase
      .from("listings")
      .select("*")
      .eq("id", listingId)
      .single();

    if (listingError || !listing) {
      alert("Listing not found.");
      router.push("/my-listings");
      return;
    }

    if (listing.user_id !== user.id) {
      alert("You are not allowed to edit this listing.");
      router.push("/my-listings");
      return;
    }

    setTitle(listing.title || "");
    setCity(listing.city || "");
    setCampus(listing.campus || "");
    setAddress(listing.address || "");
    setPrice(listing.price?.toString() || "");
    setBedrooms(listing.bedrooms?.toString() || "");
    setBathrooms(listing.bathrooms?.toString() || "");
    setGuests(listing.guests?.toString() || "");
    setRoommates(listing.roommates?.toString() || "");
    setStatus(listing.status || "available");
    setDescription(listing.description || "");
    setAmenities(
      Array.isArray(listing.amenities) ? listing.amenities.join(", ") : ""
    );

    const { data: images, error: imageError } = await supabase
      .from("listing_images")
      .select("*")
      .eq("listing_id", listingId)
      .order("sort_order", { ascending: true });

    if (imageError) {
      console.error(imageError);
    }

    const sortedImages = ((images || []) as ExistingImage[]).sort((a, b) => {
      if (a.is_cover && !b.is_cover) return -1;
      if (!a.is_cover && b.is_cover) return 1;
      return (a.sort_order || 0) - (b.sort_order || 0);
    });

    setExistingImages(sortedImages);

    const coverImage = sortedImages.find((img) => img.is_cover);

    if (coverImage) {
      setCoverType("existing");
      setCoverId(coverImage.id);
    } else if (sortedImages.length > 0) {
      setCoverType("existing");
      setCoverId(sortedImages[0].id);
    }

    setLoading(false);
  }

  function addNewImages(files: FileList | null) {
    if (!files) return;

    const mapped = Array.from(files).map((file) => ({
      localId: crypto.randomUUID(),
      file,
      previewUrl: URL.createObjectURL(file),
    }));

    setNewImages((prev) => [...prev, ...mapped]);

    if (!coverId && mapped.length > 0) {
      setCoverType("new");
      setCoverId(mapped[0].localId);
    }
  }

  function deleteExistingImage(image: ExistingImage) {
    setExistingImages((prev) => prev.filter((img) => img.id !== image.id));
    setRemovedImages((prev) => [...prev, image]);

    if (coverType === "existing" && coverId === image.id) {
      setCoverType(null);
      setCoverId(null);
    }
  }

  function deleteNewImage(image: NewImage) {
    URL.revokeObjectURL(image.previewUrl);

    setNewImages((prev) => prev.filter((img) => img.localId !== image.localId));

    if (coverType === "new" && coverId === image.localId) {
      setCoverType(null);
      setCoverId(null);
    }
  }

  function moveExisting(index: number, direction: "up" | "down") {
    setExistingImages((prev) => {
      const copy = [...prev];
      const target = direction === "up" ? index - 1 : index + 1;

      if (target < 0 || target >= copy.length) return copy;

      [copy[index], copy[target]] = [copy[target], copy[index]];
      return copy;
    });
  }

  function moveNew(index: number, direction: "up" | "down") {
    setNewImages((prev) => {
      const copy = [...prev];
      const target = direction === "up" ? index - 1 : index + 1;

      if (target < 0 || target >= copy.length) return copy;

      [copy[index], copy[target]] = [copy[target], copy[index]];
      return copy;
    });
  }

  async function uploadNewImage(file: File, sortOrder: number, isCover: boolean) {
    const fileExt = file.name.split(".").pop() || "jpg";
    const fileName = `${crypto.randomUUID()}.${fileExt}`;
    const storagePath = `listings/${listingId}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("listing-images")
      .upload(storagePath, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) throw uploadError;

    const { data: publicUrlData } = supabase.storage
      .from("listing-images")
      .getPublicUrl(storagePath);

    const { error: insertError } = await supabase.from("listing_images").insert({
      listing_id: listingId,
      image_url: publicUrlData.publicUrl,
      image_path: storagePath,
      storage_path: storagePath,
      sort_order: sortOrder,
      is_cover: isCover,
    });

    if (insertError) throw insertError;
  }

  async function saveChanges(e: React.FormEvent) {
    e.preventDefault();

    if (!title.trim()) {
      alert("Title is required.");
      return;
    }

    if (!city.trim()) {
      alert("City is required.");
      return;
    }

    if (!price) {
      alert("Price is required.");
      return;
    }

    if (existingImages.length + newImages.length === 0) {
      alert("You need at least one image.");
      return;
    }

    setSaving(true);

    try {
      let finalCoverType = coverType;
      let finalCoverId = coverId;

      if (!finalCoverId) {
        if (existingImages.length > 0) {
          finalCoverType = "existing";
          finalCoverId = existingImages[0].id;
        } else if (newImages.length > 0) {
          finalCoverType = "new";
          finalCoverId = newImages[0].localId;
        }
      }

      const amenitiesArray = amenities
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

      const { error: updateError } = await supabase
        .from("listings")
        .update({
          title: title.trim(),
          city: city.trim(),
          campus: campus.trim(),
          address: address.trim(),
          price: Number(price),
          bedrooms: bedrooms ? Number(bedrooms) : null,
          bathrooms: bathrooms ? Number(bathrooms) : null,
          guests: guests ? Number(guests) : null,
          roommates: roommates ? Number(roommates) : null,
          status,
          description: description.trim(),
          amenities: amenitiesArray,
        })
        .eq("id", listingId);

      if (updateError) throw updateError;

      if (removedImages.length > 0) {
        const paths = removedImages
          .map((img) => img.image_path || img.storage_path)
          .filter(Boolean) as string[];

        if (paths.length > 0) {
          await supabase.storage.from("listing-images").remove(paths);
        }

        const ids = removedImages.map((img) => img.id);

        const { error: deleteError } = await supabase
          .from("listing_images")
          .delete()
          .in("id", ids);

        if (deleteError) throw deleteError;
      }

      let sortOrder = 0;

      for (const image of existingImages) {
        const isCover =
          finalCoverType === "existing" && finalCoverId === image.id;

        const { error } = await supabase
          .from("listing_images")
          .update({
            sort_order: sortOrder,
            is_cover: isCover,
          })
          .eq("id", image.id);

        if (error) throw error;

        sortOrder++;
      }

      for (const image of newImages) {
        const isCover = finalCoverType === "new" && finalCoverId === image.localId;

        await uploadNewImage(image.file, sortOrder, isCover);
        sortOrder++;
      }

      alert("Listing updated successfully.");
      router.push(`/listings/${listingId}`);
      router.refresh();
    } catch (error: any) {
      console.error(error);
      alert(error.message || "Something went wrong while saving.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black px-6 py-10 text-white">
        Loading edit page...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-4 py-10 text-white">
      <form
        onSubmit={saveChanges}
        className="mx-auto max-w-5xl space-y-8 rounded-2xl border border-gray-800 bg-[#070707] p-6"
      >
        <button
          type="button"
          onClick={() => router.push("/my-listings")}
          className="text-sm text-gray-300 hover:text-white"
        >
          ← Back to my Listings
        </button>

        <div>
          <h1 className="text-3xl font-bold">Edit Listing</h1>
          <p className="mt-2 text-gray-400">
            Update listing details, location, availability, images, order, and
            cover image.
          </p>
        </div>

        <section className="grid gap-5 md:grid-cols-2">
          <Input label="Title" value={title} setValue={setTitle} />

          <Input label="City" value={city} setValue={setCity} />

          <Input label="Campus" value={campus} setValue={setCampus} />

          <Input label="Address" value={address} setValue={setAddress} />

          <Input label="Price" value={price} setValue={setPrice} type="number" />

          <div>
            <label className="mb-2 block text-sm font-medium">
              Availability Status
            </label>
            <select
              value={status}
              onChange={(e) =>
                setStatus(e.target.value as "available" | "pending" | "rented")
              }
              className="w-full rounded-xl border border-gray-700 bg-black px-4 py-3 text-white"
            >
              <option value="available">Available</option>
              <option value="pending">Pending</option>
              <option value="rented">Rented</option>
            </select>
          </div>

          <Input
            label="Bedrooms"
            value={bedrooms}
            setValue={setBedrooms}
            type="number"
          />

          <Input
            label="Bathrooms"
            value={bathrooms}
            setValue={setBathrooms}
            type="number"
          />

          <Input label="Guests" value={guests} setValue={setGuests} type="number" />

          <Input
            label="Roommates"
            value={roommates}
            setValue={setRoommates}
            type="number"
          />

          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-medium">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              className="w-full rounded-xl border border-gray-700 bg-black px-4 py-3 text-white"
            />
          </div>

          <Input
            label="Amenities, separated by commas"
            value={amenities}
            setValue={setAmenities}
            className="md:col-span-2"
          />
        </section>

        <section className="rounded-2xl border border-gray-800 p-5">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold">Images</h2>
              <p className="text-sm text-gray-400">
                Current images: {existingImages.length} | New images:{" "}
                {newImages.length}
              </p>
            </div>

            <label className="cursor-pointer rounded-xl bg-white px-5 py-3 font-semibold text-black">
              Add Images
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => addNewImages(e.target.files)}
                className="hidden"
              />
            </label>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            {existingImages.map((image, index) => (
              <div
                key={image.id}
                className="overflow-hidden rounded-2xl border border-gray-700 bg-black"
              >
                <img
                  src={image.image_url}
                  alt="Listing image"
                  className="h-64 w-full object-cover"
                />

                <div className="space-y-3 p-4">
                  <button
                    type="button"
                    onClick={() => {
                      setCoverType("existing");
                      setCoverId(image.id);
                    }}
                    className={`w-full rounded-xl px-4 py-3 font-semibold ${
                      coverType === "existing" && coverId === image.id
                        ? "bg-green-600"
                        : "bg-gray-800"
                    }`}
                  >
                    {coverType === "existing" && coverId === image.id
                      ? "Cover Image"
                      : "Set as Cover"}
                  </button>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => moveExisting(index, "up")}
                      className="rounded-xl bg-gray-800 px-4 py-3"
                    >
                      Move Up
                    </button>

                    <button
                      type="button"
                      onClick={() => moveExisting(index, "down")}
                      className="rounded-xl bg-gray-800 px-4 py-3"
                    >
                      Move Down
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => deleteExistingImage(image)}
                    className="w-full rounded-xl bg-red-600 px-4 py-3 font-semibold"
                  >
                    Delete Image
                  </button>
                </div>
              </div>
            ))}

            {newImages.map((image, index) => (
              <div
                key={image.localId}
                className="overflow-hidden rounded-2xl border border-blue-700 bg-blue-950"
              >
                <img
                  src={image.previewUrl}
                  alt="New image"
                  className="h-64 w-full object-cover"
                />

                <div className="space-y-3 p-4">
                  <button
                    type="button"
                    onClick={() => {
                      setCoverType("new");
                      setCoverId(image.localId);
                    }}
                    className={`w-full rounded-xl px-4 py-3 font-semibold ${
                      coverType === "new" && coverId === image.localId
                        ? "bg-green-600"
                        : "bg-blue-800"
                    }`}
                  >
                    {coverType === "new" && coverId === image.localId
                      ? "Cover Image"
                      : "Set as Cover"}
                  </button>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => moveNew(index, "up")}
                      className="rounded-xl bg-blue-800 px-4 py-3"
                    >
                      Move Up
                    </button>

                    <button
                      type="button"
                      onClick={() => moveNew(index, "down")}
                      className="rounded-xl bg-blue-800 px-4 py-3"
                    >
                      Move Down
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => deleteNewImage(image)}
                    className="w-full rounded-xl bg-red-600 px-4 py-3 font-semibold"
                  >
                    Remove New Image
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="flex gap-3 border-t border-gray-800 pt-6">
          <button
            type="button"
            onClick={() => router.push(`/listings/${listingId}`)}
            className="rounded-xl border border-gray-700 px-6 py-3"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-blue-600 px-6 py-3 font-semibold disabled:bg-gray-600"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </main>
  );
}

function Input({
  label,
  value,
  setValue,
  type = "text",
  className = "",
}: {
  label: string;
  value: string;
  setValue: (value: string) => void;
  type?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="mb-2 block text-sm font-medium">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        min={type === "number" ? 0 : undefined}
        className="w-full rounded-xl border border-gray-700 bg-black px-4 py-3 text-white"
      />
    </div>
  );
}