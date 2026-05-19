"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const CITY_COORDINATES: Record<
  string,
  { latitude: number; longitude: number }
> = {
  oshawa: { latitude: 43.9452, longitude: -78.8969 },
  toronto: { latitude: 43.6532, longitude: -79.3832 },
  waterloo: { latitude: 43.4643, longitude: -80.5204 },
  london: { latitude: 42.9849, longitude: -81.2453 },
  ottawa: { latitude: 45.4215, longitude: -75.6972 },
};

function createApproxCoordinates(city: string) {
  const base = CITY_COORDINATES[city.trim().toLowerCase()];

  if (!base) {
    return {
      latitude: null,
      longitude: null,
    };
  }

  const radius = 0.018;

  const latOffset = (Math.random() - 0.5) * radius;
  const lngOffset = (Math.random() - 0.5) * radius;

  return {
    latitude: base.latitude + latOffset,
    longitude: base.longitude + lngOffset,
  };
}

export default function PostListingPage() {
  const router = useRouter();
  const supabase = createClient();

  const [title, setTitle] = useState("");
  const [city, setCity] = useState("");
  const [campus, setCampus] = useState("");

  const [addressLine, setAddressLine] = useState("");
  const [unit, setUnit] = useState("");
  const [province, setProvince] = useState("");
  const [postalCode, setPostalCode] = useState("");

  const [price, setPrice] = useState("");
  const [bedrooms, setBedrooms] = useState("");
  const [bathrooms, setBathrooms] = useState("");
  const [roommates, setRoommates] = useState("");

  const [description, setDescription] = useState("");
  const [amenities, setAmenities] = useState("");

  const [safetyInstructions, setSafetyInstructions] =
    useState("");

  const [files, setFiles] = useState<FileList | null>(null);

  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/auth");
        return;
      }

      const { latitude, longitude } =
        createApproxCoordinates(city);

      const { data: listing, error } = await supabase
        .from("listings")
        .insert({
          user_id: user.id,

          title: title.trim(),

          city: city.trim(),

          location: city.trim(),

          campus: campus.trim(),

          address_line: addressLine.trim(),

          unit: unit.trim(),

          province: province.trim(),

          postal_code: postalCode.trim(),

          country: "Canada",

          safety_instructions:
            safetyInstructions.trim(),

          price: Number(price),

          bedrooms: bedrooms
            ? Number(bedrooms)
            : null,

          bathrooms: bathrooms
            ? Number(bathrooms)
            : null,

          roommates: roommates
            ? Number(roommates)
            : null,

          description: description.trim(),

          amenities: amenities
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),

          status: "available",

          latitude,
          longitude,
        })
        .select("id")
        .single();

      if (error || !listing) {
        alert(error?.message || "Failed to create listing.");
        return;
      }

      if (files && files.length > 0) {
        const imageRows = [];

        for (let i = 0; i < files.length; i++) {
          const file = files[i];

          const ext = file.name.split(".").pop();

          const fileName = `${crypto.randomUUID()}.${ext}`;

          const path = `listings/${listing.id}/${fileName}`;

          const { error: uploadError } =
            await supabase.storage
              .from("listing-images")
              .upload(path, file);

          if (uploadError) continue;

          const { data } = supabase.storage
            .from("listing-images")
            .getPublicUrl(path);

          imageRows.push({
            listing_id: listing.id,
            image_url: data.publicUrl,
            image_path: path,
            sort_order: i,
            is_cover: i === 0,
          });
        }

        if (imageRows.length > 0) {
          await supabase
            .from("listing_images")
            .insert(imageRows);
        }
      }

      router.push("/my-listings");
      router.refresh();
    } catch (error) {
      console.error(error);
      alert("Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-black px-6 py-10 text-white">
      <div className="mx-auto max-w-5xl">
        <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-8">
          <h1 className="text-4xl font-bold">
            Post New Listing
          </h1>

          <p className="mt-2 text-zinc-400">
            Create a professional listing with secure
            viewing access.
          </p>

          <form
            onSubmit={handleSubmit}
            className="mt-8 space-y-8"
          >
            <div className="grid gap-4 md:grid-cols-2">
              <Input
                label="Listing Title"
                value={title}
                set={setTitle}
              />

              <Input
                label="Campus"
                value={campus}
                set={setCampus}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Input
                label="City"
                value={city}
                set={setCity}
              />

              <Input
                label="Price"
                value={price}
                set={setPrice}
                type="number"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <Input
                label="Bedrooms"
                value={bedrooms}
                set={setBedrooms}
                type="number"
              />

              <Input
                label="Bathrooms"
                value={bathrooms}
                set={setBathrooms}
                type="number"
              />

              <Input
                label="Roommates"
                value={roommates}
                set={setRoommates}
                type="number"
              />
            </div>

            <textarea
              value={description}
              onChange={(e) =>
                setDescription(e.target.value)
              }
              placeholder="Listing description"
              className="w-full rounded-2xl border border-zinc-800 bg-black p-4 outline-none focus:border-white"
              rows={6}
            />

            <Input
              label="Amenities (comma separated)"
              value={amenities}
              set={setAmenities}
            />

            <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/5 p-6">
              <h2 className="text-2xl font-semibold text-emerald-300">
                Secure Viewing Address
              </h2>

              <p className="mt-2 text-sm text-zinc-400">
                This address stays hidden publicly and
                only unlocks after you approve a viewing.
              </p>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <Input
                  label="Street Address"
                  value={addressLine}
                  set={setAddressLine}
                />

                <Input
                  label="Unit / Apartment"
                  value={unit}
                  set={setUnit}
                />

                <Input
                  label="Province"
                  value={province}
                  set={setProvince}
                />

                <Input
                  label="Postal Code"
                  value={postalCode}
                  set={setPostalCode}
                />
              </div>

              <textarea
                value={safetyInstructions}
                onChange={(e) =>
                  setSafetyInstructions(
                    e.target.value
                  )
                }
                placeholder="Safety instructions for approved viewers..."
                rows={4}
                className="mt-4 w-full rounded-2xl border border-zinc-800 bg-black p-4 outline-none focus:border-emerald-400"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-zinc-400">
                Listing Images
              </label>

              <input
                type="file"
                multiple
                accept="image/*"
                onChange={(e) =>
                  setFiles(e.target.files)
                }
                className="w-full rounded-2xl border border-zinc-800 bg-black p-4"
              />
            </div>

            <button
              disabled={loading}
              className="w-full rounded-2xl bg-white py-4 font-bold text-black transition hover:bg-zinc-200 disabled:opacity-50"
            >
              {loading
                ? "Publishing Listing..."
                : "Publish Listing"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}

function Input({
  label,
  value,
  set,
  type = "text",
}: {
  label: string;
  value: string;
  set: (value: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm text-zinc-400">
        {label}
      </label>

      <input
        required
        type={type}
        value={value}
        onChange={(e) => set(e.target.value)}
        className="w-full rounded-2xl border border-zinc-800 bg-black p-4 outline-none focus:border-white"
      />
    </div>
  );
}