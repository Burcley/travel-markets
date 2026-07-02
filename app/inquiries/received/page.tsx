"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";

type Inquiry = {
  id: string;
  listing_id: string;
  requester_id: string;
  owner_id: string;
  message: string;
  phone?: string | null;
  status: "pending" | "accepted" | "declined";
  created_at: string;
  listings?: {
    title: string;
  } | null;
};

export default function ReceivedInquiriesPage() {
  const t = useTranslations("inquiries.received");
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    loadInquiries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadInquiries() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/auth");
      return;
    }

    const { data, error } = await supabase
      .from("inquiries")
      .select(
        `
        id,
        listing_id,
        requester_id,
        owner_id,
        message,
        phone,
        status,
        created_at,
        listings (
          title
        )
      `
      )
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      setInquiries([]);
    } else {
      setInquiries((data ?? []) as unknown as Inquiry[]);
    }

    setLoading(false);
  }

  async function sendInquiryAcceptedEmail(inquiryId: string) {
    try {
      const response = await fetch("/api/emails/inquiry-accepted", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ inquiryId }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        console.error("INQUIRY ACCEPTED EMAIL API ERROR:", data);
      }
    } catch (error) {
      console.error("INQUIRY ACCEPTED EMAIL FETCH ERROR:", error);
    }
  }

  async function sendInquiryDeclinedEmail(inquiryId: string) {
    try {
      const response = await fetch("/api/emails/inquiry-declined", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ inquiryId }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        console.error("INQUIRY DECLINED EMAIL API ERROR:", data);
      }
    } catch (error) {
      console.error("INQUIRY DECLINED EMAIL FETCH ERROR:", error);
    }
  }

  async function acceptInquiry(inquiry: Inquiry) {
    try {
      setUpdatingId(inquiry.id);

      const { error: inquiryError } = await supabase
        .from("inquiries")
        .update({ status: "accepted" })
        .eq("id", inquiry.id);

      if (inquiryError) {
        alert(inquiryError.message);
        return;
      }

      const { error: listingError } = await supabase
        .from("listings")
        .update({ status: "pending" })
        .eq("id", inquiry.listing_id);

      if (listingError) {
        alert(listingError.message);
        return;
      }

      await supabase.from("notifications").insert({
        user_id: inquiry.requester_id,
        inquiry_id: inquiry.id,
        title: "Inquiry accepted",
        body:
          "Your housing inquiry was accepted. You can now request a viewing.",
        message:
          "Your housing inquiry was accepted. You can now request a viewing.",
        type: "inquiry_accepted",
        link: `/inquiries/sent`,
      });

      await sendInquiryAcceptedEmail(inquiry.id);

      setInquiries((current) =>
        current.map((item) =>
          item.id === inquiry.id ? { ...item, status: "accepted" } : item
        )
      );

      router.refresh();
    } finally {
      setUpdatingId(null);
    }
  }

  async function declineInquiry(inquiry: Inquiry) {
    try {
      setUpdatingId(inquiry.id);

      const { error } = await supabase
        .from("inquiries")
        .update({ status: "declined" })
        .eq("id", inquiry.id);

      if (error) {
        alert(error.message);
        return;
      }

      await supabase.from("notifications").insert({
        user_id: inquiry.requester_id,
        inquiry_id: inquiry.id,
        title: "Inquiry declined",
        body: "The owner declined your inquiry for this listing.",
        message: "The owner declined your inquiry for this listing.",
        type: "inquiry_declined",
        link: `/inquiries/sent`,
      });

      await sendInquiryDeclinedEmail(inquiry.id);

      setInquiries((current) =>
        current.map((item) =>
          item.id === inquiry.id ? { ...item, status: "declined" } : item
        )
      );

      router.refresh();
    } finally {
      setUpdatingId(null);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black px-4 py-10 text-white">
        {t("loading")}
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-4 py-10 text-white">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">{t("title")}</h1>
            <p className="mt-1 text-zinc-400">
              {t("subtitle")}
            </p>
          </div>

          <Link
            href="/my-listings"
            className="rounded-xl border border-zinc-700 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10"
          >
            {t("myListings")}
          </Link>
        </div>

        {inquiries.length === 0 ? (
          <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-8 text-center">
            <p className="text-zinc-400">{t("empty")}</p>
          </div>
        ) : (
          <div className="space-y-5">
            {inquiries.map((inquiry) => (
              <div
                key={inquiry.id}
                className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6"
              >
                <div className="flex flex-col gap-5 md:flex-row md:justify-between">
                  <div>
                    <h2 className="text-xl font-semibold">
                      {inquiry.listings?.title ?? t("listingFallback")}
                    </h2>

                    <p className="mt-2 text-sm text-zinc-500">
                      {t("sentOn")}{" "}
                      {new Date(inquiry.created_at).toLocaleDateString("en-CA")}
                    </p>

                    <p className="mt-4 whitespace-pre-wrap text-zinc-300">
                      {inquiry.message}
                    </p>

                    {inquiry.phone && (
                      <p className="mt-3 text-zinc-300">
                        {t("phone")} {inquiry.phone}
                      </p>
                    )}

                    <div className="mt-5 flex flex-wrap gap-3">
                      <Link
                        href={`/listings/${inquiry.listing_id}`}
                        className="rounded-xl border border-zinc-700 px-4 py-2 text-sm text-white hover:bg-white/10"
                      >
                        {t("viewListing")}
                      </Link>

                      {inquiry.status === "accepted" && (
                        <Link
                          href={`/messages/${inquiry.id}`}
                          className="rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-sm text-blue-300"
                        >
                          {t("openChat")}
                        </Link>
                      )}
                    </div>
                  </div>

                  <div className="min-w-[220px]">
                    <p className="mb-4 text-sm text-zinc-400">
                      {t("status")}{" "}
                      <span className="font-semibold capitalize text-white">
                        {inquiry.status}
                      </span>
                    </p>

                    {inquiry.status === "pending" && (
                      <div className="space-y-2">
                        <button
                          onClick={() => acceptInquiry(inquiry)}
                          disabled={updatingId === inquiry.id}
                          className="w-full rounded-xl bg-white px-4 py-3 font-semibold text-black disabled:bg-zinc-600"
                        >
                          {updatingId === inquiry.id ? t("accepting") : t("accept")}
                        </button>

                        <button
                          onClick={() => declineInquiry(inquiry)}
                          disabled={updatingId === inquiry.id}
                          className="w-full rounded-xl bg-red-600 px-4 py-3 font-semibold text-white disabled:bg-zinc-600"
                        >
                          {updatingId === inquiry.id ? t("updating") : t("decline")}
                        </button>
                      </div>
                    )}

                    {inquiry.status === "accepted" && (
                      <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-300">
                        {t("acceptedNotice")}
                      </div>
                    )}

                    {inquiry.status === "declined" && (
                      <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
                        {t("declinedNotice")}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
