"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Listing = {
  id: string;
  title: string;
  user_id: string;
};

export default function ContactOwnerPage() {
  const params = useParams();
  const router = useRouter();
  const listingId = params.id as string;
  const supabase = useMemo(() => createClient(), []);

  const [listing, setListing] = useState<Listing | null>(null);
  const [message, setMessage] = useState("");
  const [phone, setPhone] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listingId]);

  async function loadData() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/auth");
      return;
    }

    setCurrentUserId(user.id);

    // 🔒 check if user is banned
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, status")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.role === "banned" || profile?.status === "banned") {
      setErrorMessage("Your account is restricted.");
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("listings")
      .select("id, title, user_id, status")
      .eq("id", listingId)
      .single();

    if (error || !data) {
      setErrorMessage("Listing not found.");
      setLoading(false);
      return;
    }

    if (data.user_id === user.id) {
      setErrorMessage("You cannot send an inquiry to your own listing.");
      setLoading(false);
      return;
    }

    if (data.status === "rented") {
      setErrorMessage("This listing is no longer available.");
      setLoading(false);
      return;
    }

    setListing(data);
    setLoading(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");

    if (!listing || !currentUserId) return;

    if (!message.trim()) {
      setErrorMessage("Please enter a message.");
      return;
    }

    setSubmitting(true);

    const { error } = await supabase.from("inquiries").insert({
      listing_id: listing.id,
      requester_id: currentUserId,
      owner_id: listing.user_id,
      message: message.trim(),
      phone: phone.trim() || null,
      status: "pending",
    });

    setSubmitting(false);

    if (error) {
      console.error(error.message);
      setErrorMessage(error.message);
      return;
    }

    router.push("/inquiries/sent");
    router.refresh();
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black px-4 py-10 text-white">
        <div className="mx-auto max-w-2xl">
          <p className="text-zinc-400">Loading contact form...</p>
        </div>
      </main>
    );
  }

  if (errorMessage && !listing) {
    return (
      <main className="min-h-screen bg-black px-4 py-10 text-white">
        <div className="mx-auto max-w-2xl rounded-3xl border border-red-900/60 bg-red-950/40 p-6">
          <p className="text-red-300">{errorMessage}</p>

          <Link
            href={`/listings/${listingId}`}
            className="mt-4 inline-block rounded-xl bg-white px-5 py-3 font-semibold text-black"
          >
            Back to listing
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-4 py-10 text-white">
      <div className="mx-auto max-w-2xl">
        <Link
          href={`/listings/${listingId}`}
          className="text-sm text-zinc-400 hover:text-white"
        >
          ← Back to listing
        </Link>

        <div className="mt-6 rounded-3xl border border-zinc-800 bg-zinc-950 p-6">
          <h1 className="text-3xl font-bold">Contact Owner</h1>

          <p className="mt-2 text-sm text-zinc-400">
            Send a request for:{" "}
            <span className="font-semibold">
              {listing?.title || "Listing"}
            </span>
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-300">
                Message
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Hi, I am interested in this listing. Is it still available?"
                className="w-full min-h-[140px] rounded-xl border border-zinc-800 bg-black px-4 py-3 text-white outline-none placeholder:text-zinc-600 focus:border-zinc-500"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-300">
                Phone (optional)
              </label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Your phone number"
                className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-white outline-none placeholder:text-zinc-600 focus:border-zinc-500"
              />
            </div>

            {errorMessage && (
              <div className="rounded-xl border border-red-900/60 bg-red-950/40 p-4 text-sm text-red-300">
                {errorMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-white px-5 py-4 font-semibold text-black hover:bg-zinc-200 disabled:opacity-50"
            >
              {submitting ? "Sending..." : "Send Inquiry"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}