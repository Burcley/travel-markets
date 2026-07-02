"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

type Listing = {
  id: number;
  title: string;
  location: string;
  campus: string;
  price: number;
  rating: number | null;
  description: string;
  beds: number | null;
  baths: number | null;
  guests: number | null;
  host: string | null;
  amenities: string[] | null;

  address_line?: string | null;
  unit?: string | null;
  city?: string | null;
  province?: string | null;
  postal_code?: string | null;
  safety_instructions?: string | null;
};

export default function EditListingForm({
  listing,
}: {
  listing: Listing;
}) {
  const t = useTranslations("finalBatchD.editListingForm");
  const router = useRouter();
  const supabase = createClient();

  const [title, setTitle] = useState(listing.title || "");
  const [location, setLocation] = useState(listing.location || "");
  const [campus, setCampus] = useState(listing.campus || "");
  const [price, setPrice] = useState(String(listing.price || ""));
  const [rating, setRating] = useState(
    listing.rating !== null && listing.rating !== undefined
      ? String(listing.rating)
      : ""
  );

  const [description, setDescription] = useState(
    listing.description || ""
  );

  const [beds, setBeds] = useState(
    listing.beds !== null && listing.beds !== undefined
      ? String(listing.beds)
      : ""
  );

  const [baths, setBaths] = useState(
    listing.baths !== null && listing.baths !== undefined
      ? String(listing.baths)
      : ""
  );

  const [guests, setGuests] = useState(
    listing.guests !== null && listing.guests !== undefined
      ? String(listing.guests)
      : ""
  );

  const [host, setHost] = useState(listing.host || "");

  const [amenities, setAmenities] = useState(
    listing.amenities ? listing.amenities.join(", ") : ""
  );

  const [addressLine, setAddressLine] = useState(
    listing.address_line || ""
  );

  const [unit, setUnit] = useState(listing.unit || "");

  const [city, setCity] = useState(listing.city || "");

  const [province, setProvince] = useState(
    listing.province || ""
  );

  const [postalCode, setPostalCode] = useState(
    listing.postal_code || ""
  );

  const [safetyInstructions, setSafetyInstructions] =
    useState(listing.safety_instructions || "");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();

    setLoading(true);
    setMessage("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/auth");
        return;
      }

      const amenitiesArray = amenities
        .split(",")
        .map((item) => item.trim())
        .filter((item) => item !== "");

      const { error } = await supabase
        .from("listings")
        .update({
          title,
          location,
          campus,
          price: Number(price),
          rating: rating ? Number(rating) : null,
          description,
          beds: beds ? Number(beds) : 1,
          baths: baths ? Number(baths) : 1,
          guests: guests ? Number(guests) : 1,
          host,
          amenities: amenitiesArray,

          address_line: addressLine,
          unit,
          city,
          province,
          postal_code: postalCode,
          safety_instructions: safetyInstructions,
        })
        .eq("id", listing.id)
        .eq("user_id", user.id);

      if (error) {
        throw new Error(error.message);
      }

      setMessage(t("updated"));

      router.push("/my-listings");
      router.refresh();
    } catch (error: any) {
      setMessage(error.message || t("genericError"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-black px-6 py-10 text-white">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6">
          <Link
            href="/my-listings"
            className="text-sm text-zinc-400 hover:text-white"
          >
            {t("backToMyListings")}
          </Link>
        </div>

        <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-8">
          <h1 className="text-3xl font-bold">{t("title")}</h1>

          <p className="mt-2 text-zinc-400">
            {t("subtitle")}
          </p>

          <form
            onSubmit={handleUpdate}
            className="mt-8 space-y-6"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <input
                placeholder={t("titlePlaceholder")}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="rounded-2xl border border-zinc-700 bg-black px-4 py-3 outline-none focus:border-white"
              />

              <input
                placeholder={t("locationPlaceholder")}
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                required
                className="rounded-2xl border border-zinc-700 bg-black px-4 py-3 outline-none focus:border-white"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <input
                placeholder={t("campusPlaceholder")}
                value={campus}
                onChange={(e) => setCampus(e.target.value)}
                required
                className="rounded-2xl border border-zinc-700 bg-black px-4 py-3 outline-none focus:border-white"
              />

              <input
                type="number"
                placeholder={t("pricePlaceholder")}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
                className="rounded-2xl border border-zinc-700 bg-black px-4 py-3 outline-none focus:border-white"
              />

              <input
                type="number"
                placeholder={t("ratingPlaceholder")}
                value={rating}
                onChange={(e) => setRating(e.target.value)}
                className="rounded-2xl border border-zinc-700 bg-black px-4 py-3 outline-none focus:border-white"
              />
            </div>

            <textarea
              placeholder={t("descriptionPlaceholder")}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              rows={5}
              className="w-full rounded-2xl border border-zinc-700 bg-black px-4 py-3 outline-none focus:border-white"
            />

            <div className="grid gap-4 sm:grid-cols-3">
              <input
                type="number"
                placeholder={t("bedsPlaceholder")}
                value={beds}
                onChange={(e) => setBeds(e.target.value)}
                className="rounded-2xl border border-zinc-700 bg-black px-4 py-3 outline-none focus:border-white"
              />

              <input
                type="number"
                placeholder={t("bathsPlaceholder")}
                value={baths}
                onChange={(e) => setBaths(e.target.value)}
                className="rounded-2xl border border-zinc-700 bg-black px-4 py-3 outline-none focus:border-white"
              />

              <input
                type="number"
                placeholder={t("guestsPlaceholder")}
                value={guests}
                onChange={(e) => setGuests(e.target.value)}
                className="rounded-2xl border border-zinc-700 bg-black px-4 py-3 outline-none focus:border-white"
              />
            </div>

            <input
              placeholder={t("hostNamePlaceholder")}
              value={host}
              onChange={(e) => setHost(e.target.value)}
              className="w-full rounded-2xl border border-zinc-700 bg-black px-4 py-3 outline-none focus:border-white"
            />

            <input
              placeholder={t("amenitiesPlaceholder")}
              value={amenities}
              onChange={(e) => setAmenities(e.target.value)}
              className="w-full rounded-2xl border border-zinc-700 bg-black px-4 py-3 outline-none focus:border-white"
            />

            <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/5 p-6">
              <h2 className="text-xl font-semibold text-emerald-300">
                {t("secureAddressTitle")}
              </h2>

              <p className="mt-2 text-sm text-zinc-400">
                {t("secureAddressText")}
              </p>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <input
                  placeholder={t("streetAddressPlaceholder")}
                  value={addressLine}
                  onChange={(e) =>
                    setAddressLine(e.target.value)
                  }
                  className="rounded-2xl border border-zinc-700 bg-black px-4 py-3 outline-none focus:border-emerald-400"
                />

                <input
                  placeholder={t("unitPlaceholder")}
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="rounded-2xl border border-zinc-700 bg-black px-4 py-3 outline-none focus:border-emerald-400"
                />

                <input
                  placeholder={t("cityPlaceholder")}
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="rounded-2xl border border-zinc-700 bg-black px-4 py-3 outline-none focus:border-emerald-400"
                />

                <input
                  placeholder={t("provincePlaceholder")}
                  value={province}
                  onChange={(e) =>
                    setProvince(e.target.value)
                  }
                  className="rounded-2xl border border-zinc-700 bg-black px-4 py-3 outline-none focus:border-emerald-400"
                />

                <input
                  placeholder={t("postalCodePlaceholder")}
                  value={postalCode}
                  onChange={(e) =>
                    setPostalCode(e.target.value)
                  }
                  className="rounded-2xl border border-zinc-700 bg-black px-4 py-3 outline-none focus:border-emerald-400"
                />
              </div>

              <textarea
                placeholder={t("safetyInstructionsPlaceholder")}
                rows={4}
                value={safetyInstructions}
                onChange={(e) =>
                  setSafetyInstructions(e.target.value)
                }
                className="mt-4 w-full rounded-2xl border border-zinc-700 bg-black px-4 py-3 outline-none focus:border-emerald-400"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-white px-6 py-4 font-bold text-black transition hover:bg-zinc-200 disabled:bg-zinc-600"
            >
              {loading ? t("updating") : t("saveChanges")}
            </button>
          </form>

          {message && (
            <div className="mt-6 rounded-2xl border border-zinc-800 bg-black p-4 text-sm text-zinc-300">
              {message}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
