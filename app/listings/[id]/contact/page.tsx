"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";

type Listing = {
  id: string;
  title: string;
  user_id: string;
  status?: "available" | "pending" | "rented" | null;
};

export default function ContactOwnerPage() {
  const t = useTranslations("listingManagement.contact");
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
    setErrorMessage("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/auth");
      return;
    }

    setCurrentUserId(user.id);

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, status")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.role === "banned" || profile?.status === "banned") {
      setErrorMessage(t("restricted"));
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("listings")
      .select("id, title, user_id, status")
      .eq("id", listingId)
      .single();

    if (error || !data) {
      setErrorMessage(t("notFound"));
      setLoading(false);
      return;
    }

    if (data.user_id === user.id) {
      setErrorMessage(t("ownListing"));
      setLoading(false);
      return;
    }

    if (data.status === "rented") {
      setErrorMessage(t("unavailable"));
      setLoading(false);
      return;
    }

    setListing(data as Listing);
    setLoading(false);
  }

  async function sendNewInquiryEmail(inquiryId: string) {
    try {
      const response = await fetch("/api/emails/new-inquiry", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inquiryId,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        console.error("NEW INQUIRY EMAIL ERROR:", data);
      }
    } catch (error) {
      console.error("NEW INQUIRY EMAIL FETCH ERROR:", error);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");

    if (!listing || !currentUserId) return;

    if (!message.trim()) {
      setErrorMessage(t("messageRequired"));
      return;
    }

    setSubmitting(true);

    const { data: inquiry, error } = await supabase
      .from("inquiries")
      .insert({
        listing_id: listing.id,
        requester_id: currentUserId,
        owner_id: listing.user_id,
        message: message.trim(),
        phone: phone.trim() || null,
        status: "pending",
      })
      .select("id")
      .single();

    if (error) {
      console.error(error.message);
      setErrorMessage(error.message);
      setSubmitting(false);
      return;
    }

    await supabase.from("notifications").insert({
      user_id: listing.user_id,
      inquiry_id: inquiry?.id || null,
      title: "New Housing Inquiry",
      body: "A student sent an inquiry for your listing.",
      message: "A student sent an inquiry for your listing.",
      type: "inquiry_received",
      link: "/inquiries/received",
    });

    if (inquiry?.id) {
      await sendNewInquiryEmail(inquiry.id);
    }

    setSubmitting(false);

    router.push("/inquiries/sent");
    router.refresh();
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black px-4 py-10 text-white">
        <div className="mx-auto max-w-2xl">
          <p className="text-zinc-400">{t("loading")}</p>
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
            {t("backToListing")}
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
          {t("backToListingArrow")}
        </Link>

        <div className="mt-6 rounded-3xl border border-zinc-800 bg-zinc-950 p-6">
          <h1 className="text-3xl font-bold">{t("title")}</h1>

          <p className="mt-2 text-sm text-zinc-400">
            {t("sendRequestFor")}{" "}
            <span className="font-semibold">
              {listing?.title || t("listingFallback")}
            </span>
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-300">
                {t("message")}
              </label>

              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t("messagePlaceholder")}
                className="min-h-[140px] w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-white outline-none placeholder:text-zinc-600 focus:border-zinc-500"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-300">
                {t("phoneOptional")}
              </label>

              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={t("phonePlaceholder")}
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
              {submitting ? t("sending") : t("sendInquiry")}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
