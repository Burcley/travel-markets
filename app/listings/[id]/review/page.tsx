"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";

type Listing = {
  id: string;
  user_id: string;
  title: string;
};

export default function LeaveReviewPage() {
  const t = useTranslations("listingManagement.review");
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();

  const listingId = params.id as string;

  const [listing, setListing] = useState<Listing | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadPage();
  }, [listingId]);

  async function loadPage() {
    try {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/auth");
        return;
      }

      setCurrentUserId(user.id);

      const { data, error } = await supabase
        .from("listings")
        .select("id, user_id, title")
        .eq("id", listingId)
        .maybeSingle();

      if (error || !data) {
        console.error("Listing error:", error);
        setListing(null);
        return;
      }

      setListing(data as Listing);
    } finally {
      setLoading(false);
    }
  }

  async function submitReview() {
    if (!listing || !currentUserId) return;

    if (currentUserId === listing.user_id) {
      alert(t("ownListing"));
      return;
    }

    try {
      setSubmitting(true);

      const { data: review, error } = await supabase
        .from("reviews")
        .insert({
          listing_id: listing.id,
          owner_id: listing.user_id,
          reviewer_id: currentUserId,
          rating,
          comment: comment.trim() || null,
        })
        .select("id")
        .single();

      if (error) {
        console.error("Review error:", error);
        alert(error.message);
        return;
      }

      await fetch("/api/reviews/notify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reviewId: review.id,
          listingId: listing.id,
          ownerId: listing.user_id,
          rating,
          comment: comment.trim() || null,
          listingTitle: listing.title,
        }),
      });

      router.push(`/users/${listing.user_id}`);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black px-6 py-10 text-white">
        {t("loading")}
      </main>
    );
  }

  if (!listing) {
    return (
      <main className="min-h-screen bg-black px-6 py-10 text-white">
        {t("notFound")}
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-4 py-10 text-white">
      <div className="mx-auto max-w-2xl">
        <button
          onClick={() => router.back()}
          className="mb-6 text-sm text-gray-400 hover:text-white"
        >
          {t("back")}
        </button>

        <div className="rounded-3xl border border-gray-800 bg-[#070707] p-8">
          <h1 className="text-3xl font-bold">{t("title")}</h1>
          <p className="mt-2 text-gray-400">{listing.title}</p>

          <div className="mt-8">
            <label className="text-sm font-semibold text-gray-300">
              {t("rating")}
            </label>

            <div className="mt-3 flex gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className={`text-4xl ${
                    star <= rating ? "text-yellow-400" : "text-gray-700"
                  }`}
                >
                  ★
                </button>
              ))}
            </div>
          </div>

          <div className="mt-8">
            <label className="text-sm font-semibold text-gray-300">
              {t("comment")}
            </label>

            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={6}
              placeholder={t("commentPlaceholder")}
              className="mt-3 w-full rounded-2xl border border-gray-800 bg-black p-4 text-white outline-none focus:border-gray-500"
            />
          </div>

          <button
            onClick={submitReview}
            disabled={submitting}
            className="mt-8 w-full rounded-xl bg-white px-5 py-4 font-semibold text-black hover:bg-gray-200 disabled:bg-gray-600"
          >
            {submitting ? t("submitting") : t("submitReview")}
          </button>
        </div>
      </div>
    </main>
  );
}
