"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Flag, MessageCircle, Star, ThumbsUp, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatPublicReviewSummary } from "@/lib/public-landlord-reputation-core.mjs";

type Reviewer = {
  full_name: string | null;
  avatar_url: string | null;
};

type ReviewListing = {
  title: string | null;
};

type Review = {
  id: string;
  owner_id: string;
  reviewer_id: string;
  listing_id: string | null;
  rating: number;
  comment: string | null;
  created_at: string;
  owner_reply: string | null;
  owner_reply_at: string | null;
  helpful_count: number | null;
  reviewer: Reviewer | null;
  listing: ReviewListing | null;
};

export default function OwnerReviews({ ownerId }: { ownerId: string }) {
  const t = useTranslations("finalBatchD.ownerReviews");
  const supabase = createClient();

  const [reviews, setReviews] = useState<Review[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [replyingId, setReplyingId] = useState<string | null>(null);

  useEffect(() => {
    loadReviews();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerId]);

  async function loadReviews() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    setCurrentUserId(user?.id ?? null);

    const { data, error } = await supabase
      .from("reviews")
      .select(
        `
        id,
        owner_id,
        reviewer_id,
        listing_id,
        rating,
        comment,
        created_at,
        owner_reply,
        owner_reply_at,
        helpful_count,
        reviewer:profiles!reviews_reviewer_id_fkey (
          full_name,
          avatar_url
        ),
        listing:listings (
          title
        )
      `
      )
      .eq("owner_id", ownerId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Reviews error:", error);
      setReviews([]);
      setLoading(false);
      return;
    }

    const normalizedReviews: Review[] =
      data?.map((item: {
        id: string;
        owner_id: string;
        reviewer_id: string;
        listing_id: string | null;
        rating: number | null;
        comment: string | null;
        created_at: string;
        owner_reply: string | null;
        owner_reply_at: string | null;
        helpful_count: number | null;
        reviewer: Reviewer | Reviewer[] | null;
        listing: ReviewListing | ReviewListing[] | null;
      }) => ({
        id: item.id,
        owner_id: item.owner_id,
        reviewer_id: item.reviewer_id,
        listing_id: item.listing_id,
        rating: Number(item.rating || 0),
        comment: item.comment ?? null,
        created_at: item.created_at,
        owner_reply: item.owner_reply ?? null,
        owner_reply_at: item.owner_reply_at ?? null,
        helpful_count: item.helpful_count ?? 0,
        reviewer: Array.isArray(item.reviewer)
          ? item.reviewer[0] ?? null
          : item.reviewer ?? null,
        listing: Array.isArray(item.listing)
          ? item.listing[0] ?? null
          : item.listing ?? null,
      })) || [];

    setReviews(normalizedReviews);
    setLoading(false);
  }

  const averageRating = useMemo(() => {
    if (reviews.length === 0) return 0;
    const total = reviews.reduce((sum, review) => sum + review.rating, 0);
    return total / reviews.length;
  }, [reviews]);
  const reviewSummary = formatPublicReviewSummary(reviews.length, averageRating);

  const ratingCounts = useMemo(() => {
    return [5, 4, 3, 2, 1].map((star) => ({
      star,
      count: reviews.filter((review) => review.rating === star).length,
    }));
  }, [reviews]);

  async function markHelpful(reviewId: string) {
    const review = reviews.find((item) => item.id === reviewId);
    if (!review) return;

    const nextCount = (review.helpful_count || 0) + 1;

    const { error } = await supabase
      .from("reviews")
      .update({ helpful_count: nextCount })
      .eq("id", reviewId);

    if (error) {
      alert(error.message);
      return;
    }

    setReviews((prev) =>
      prev.map((item) =>
        item.id === reviewId ? { ...item, helpful_count: nextCount } : item
      )
    );
  }

  async function submitOwnerReply(reviewId: string) {
    const text = replyText[reviewId]?.trim();

    if (!text) {
      alert(t("writeReplyFirst"));
      return;
    }

    setReplyingId(reviewId);

    const { error } = await supabase
      .from("reviews")
      .update({
        owner_reply: text,
        owner_reply_at: new Date().toISOString(),
      })
      .eq("id", reviewId)
      .eq("owner_id", ownerId);

    setReplyingId(null);

    if (error) {
      alert(error.message);
      return;
    }

    setReplyText((prev) => ({ ...prev, [reviewId]: "" }));
    await loadReviews();
  }

  async function deleteOwnReview(reviewId: string) {
    if (!currentUserId) return;

    const confirmed = confirm(t("deleteConfirm"));
    if (!confirmed) return;

    const { error } = await supabase
      .from("reviews")
      .delete()
      .eq("id", reviewId)
      .eq("reviewer_id", currentUserId);

    if (error) {
      alert(error.message);
      return;
    }

    setReviews((prev) => prev.filter((review) => review.id !== reviewId));
  }

  if (loading) {
    return (
      <section className="rounded-3xl border border-white/10 bg-white/5 p-6 text-white">
        <p className="text-white/50">{t("loading")}</p>
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-6 text-white">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-2xl font-black">{t("title")}</h2>
          <p className="mt-2 text-sm text-white/50">
            {t("subtitle")}
          </p>
        </div>

        <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/10 px-5 py-4">
          <div className="flex items-center gap-2">
            <Star className="fill-yellow-400 text-yellow-400" size={22} />
            <span className="text-3xl font-black">
              {reviewSummary.ratingLabel}
            </span>
          </div>
          <p className="mt-1 text-sm text-yellow-100/70">
            {reviewSummary.reviewLabel}
          </p>
        </div>
      </div>

      <div className="mt-8 grid gap-3">
        {ratingCounts.map((item) => {
          const percentage =
            reviews.length > 0 ? (item.count / reviews.length) * 100 : 0;

          return (
            <div key={item.star} className="flex items-center gap-3">
              <span className="w-10 text-sm text-white/60">{item.star}★</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-black">
                <div
                  className="h-full rounded-full bg-yellow-400"
                  style={{ width: `${percentage}%` }}
                />
              </div>
              <span className="w-8 text-right text-sm text-white/50">
                {item.count}
              </span>
            </div>
          );
        })}
      </div>

      {reviews.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-white/10 bg-black p-6 text-center">
          <p className="text-white/50">{t("empty")}</p>
        </div>
      ) : (
        <div className="mt-8 space-y-5">
          {reviews.map((review) => {
            const isOwner = currentUserId === ownerId;
            const isReviewer = currentUserId === review.reviewer_id;

            return (
              <article
                key={review.id}
                className="rounded-3xl border border-white/10 bg-black p-5"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex gap-3">
                    <div className="h-12 w-12 overflow-hidden rounded-full bg-white/10">
                      {review.reviewer?.avatar_url ? (
                        <img
                          src={review.reviewer.avatar_url}
                          alt={t("reviewerAlt")}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center font-bold">
                          {(review.reviewer?.full_name || t("unknownInitial"))
                            .charAt(0)
                            .toUpperCase()}
                        </div>
                      )}
                    </div>

                    <div>
                      <p className="font-bold">
                        {review.reviewer?.full_name || t("anonymousUser")}
                      </p>

                      <p className="text-xs text-white/40">
                        {new Date(review.created_at).toLocaleDateString()}
                      </p>

                      {review.listing?.title && (
                        <p className="mt-1 text-xs text-white/40">
                          {t("listingLabel", { title: review.listing.title })}
                        </p>
                      )}

                      <span className="mt-2 inline-flex rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                        {t("verifiedInteraction")}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        size={17}
                        className={
                          star <= review.rating
                            ? "fill-yellow-400 text-yellow-400"
                            : "text-white/20"
                        }
                      />
                    ))}
                  </div>
                </div>

                {review.comment && (
                  <p className="mt-5 leading-7 text-white/75">
                    {review.comment}
                  </p>
                )}

                {review.owner_reply && (
                  <div className="mt-5 rounded-2xl border border-blue-500/20 bg-blue-500/10 p-4">
                    <p className="text-sm font-bold text-blue-200">
                      {t("ownerResponse")}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-white/70">
                      {review.owner_reply}
                    </p>
                  </div>
                )}

                {isOwner && !review.owner_reply && (
                  <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
                    <textarea
                      value={replyText[review.id] || ""}
                      onChange={(event) =>
                        setReplyText((prev) => ({
                          ...prev,
                          [review.id]: event.target.value,
                        }))
                      }
                      placeholder={t("replyPlaceholder")}
                      rows={3}
                      className="w-full rounded-xl border border-white/10 bg-black p-3 text-sm outline-none focus:border-blue-500"
                    />

                    <button
                      onClick={() => submitOwnerReply(review.id)}
                      disabled={replyingId === review.id}
                      className="mt-3 rounded-xl bg-white px-4 py-2 text-sm font-bold text-black disabled:opacity-50"
                    >
                      {replyingId === review.id ? t("replying") : t("postReply")}
                    </button>
                  </div>
                )}

                <div className="mt-5 flex flex-wrap items-center gap-3 text-sm">
                  <button
                    onClick={() => markHelpful(review.id)}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-white/60 hover:text-white"
                  >
                    <ThumbsUp size={15} />
                    {t("helpful", { count: review.helpful_count || 0 })}
                  </button>

                  <Link
                    href={`/reports?type=review&id=${review.id}`}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-white/60 hover:text-white"
                  >
                    <Flag size={15} />
                    {t("report")}
                  </Link>

                  {isReviewer && (
                    <button
                      onClick={() => deleteOwnReview(review.id)}
                      className="inline-flex items-center gap-2 rounded-full border border-red-500/20 bg-red-500/10 px-4 py-2 text-red-300"
                    >
                      <Trash2 size={15} />
                      {t("delete")}
                    </button>
                  )}

                  <Link
                    href={`/users/${ownerId}`}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-white/60 hover:text-white"
                  >
                    <MessageCircle size={15} />
                    {t("viewProfile")}
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
