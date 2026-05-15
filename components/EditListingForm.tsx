"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
};

export default function EditListingForm({ listing }: { listing: Listing }) {
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
  const [description, setDescription] = useState(listing.description || "");
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
        })
        .eq("id", listing.id)
        .eq("user_id", user.id);

      if (error) {
        throw new Error(error.message);
      }

      setMessage("Listing updated successfully!");
      router.push("/my-listings");
      router.refresh();
    } catch (error: any) {
      setMessage(error.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: "700px", margin: "40px auto", padding: "20px" }}>
      <div style={{ marginBottom: "20px" }}>
        <Link href="/my-listings">← Back to My Listings</Link>
      </div>

      <h1 style={{ marginBottom: "20px" }}>Edit Listing</h1>

      <form onSubmit={handleUpdate} style={{ display: "grid", gap: "12px" }}>
        <input
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />

        <input
          placeholder="Location"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          required
        />

        <input
          placeholder="Campus"
          value={campus}
          onChange={(e) => setCampus(e.target.value)}
          required
        />

        <input
          type="number"
          placeholder="Price"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          required
        />

        <input
          type="number"
          placeholder="Rating"
          value={rating}
          onChange={(e) => setRating(e.target.value)}
        />

        <textarea
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
        />

        <input
          type="number"
          placeholder="Beds"
          value={beds}
          onChange={(e) => setBeds(e.target.value)}
        />

        <input
          type="number"
          placeholder="Baths"
          value={baths}
          onChange={(e) => setBaths(e.target.value)}
        />

        <input
          type="number"
          placeholder="Guests"
          value={guests}
          onChange={(e) => setGuests(e.target.value)}
        />

        <input
          placeholder="Host Name"
          value={host}
          onChange={(e) => setHost(e.target.value)}
        />

        <input
          placeholder="Amenities (comma separated)"
          value={amenities}
          onChange={(e) => setAmenities(e.target.value)}
        />

        <button type="submit" disabled={loading}>
          {loading ? "Updating..." : "Save Changes"}
        </button>
      </form>

      {message && <p style={{ marginTop: "16px" }}>{message}</p>}
    </main>
  );
}