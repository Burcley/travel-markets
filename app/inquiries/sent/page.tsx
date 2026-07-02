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
    status?: "available" | "pending" | "rented" | null;
  } | null;
};

export default function SentInquiriesPage() {
  const t = useTranslations("inquiries.sent");
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);

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
          title,
          status
        )
      `
      )
      .eq("requester_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error.message);
      setInquiries([]);
    } else {
      setInquiries((data ?? []) as unknown as Inquiry[]);
    }

    setLoading(false);
  }

  function statusStyle(status: Inquiry["status"]) {
    if (status === "accepted") {
      return "border-green-500/30 bg-green-500/10 text-green-300";
    }

    if (status === "declined") {
      return "border-red-500/30 bg-red-500/10 text-red-300";
    }

    return "border-yellow-500/30 bg-yellow-500/10 text-yellow-300";
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black px-4 py-10 text-white">
        <div className="mx-auto max-w-5xl">
          <p className="text-zinc-400">{t("loading")}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-4 py-10 text-white">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">{t("title")}</h1>
            <p className="mt-1 text-zinc-400">
              {t("subtitle")}
            </p>
          </div>

          <Link
            href="/listings"
            className="rounded-xl border border-zinc-700 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10"
          >
            {t("browseListings")}
          </Link>
        </div>

        {inquiries.length === 0 ? (
          <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-8 text-center">
            <p className="text-zinc-400">{t("empty")}</p>
          </div>
        ) : (
          <div className="space-y-5">
            {inquiries.map((inquiry) => {
              const isAccepted = inquiry.status === "accepted";
              const isRented = inquiry.listings?.status === "rented";

              return (
                <div
                  key={inquiry.id}
                  className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6 shadow-sm"
                >
                  <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-3">
                        <h2 className="text-xl font-semibold">
                          {inquiry.listings?.title ?? t("listingFallback")}
                        </h2>

                        <span
                          className={`rounded-full border px-4 py-1 text-sm font-semibold capitalize ${statusStyle(
                            inquiry.status
                          )}`}
                        >
                          {inquiry.status}
                        </span>
                      </div>

                      <p className="mt-2 text-sm text-zinc-500">
                        {t("sentOn")}{" "}
                        {new Date(inquiry.created_at).toLocaleDateString(
                          "en-CA",
                          {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          }
                        )}
                      </p>

                      <p className="mt-4 whitespace-pre-wrap leading-7 text-zinc-300">
                        {inquiry.message}
                      </p>

                      {inquiry.phone && (
                        <p className="mt-3 text-zinc-300">
                          {t("phone")}{" "}
                          <span className="font-medium">{inquiry.phone}</span>
                        </p>
                      )}

                      {isAccepted && !isRented && (
                        <div className="mt-5 rounded-2xl border border-green-500/20 bg-green-500/10 p-4">
                          <p className="font-semibold text-green-300">
                            {t("acceptedTitle")}
                          </p>
                          <p className="mt-1 text-sm text-green-200/80">
                            {t("acceptedText")}
                          </p>
                        </div>
                      )}

                      {isRented && (
                        <div className="mt-5 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
                          {t("rentedNotice")}
                        </div>
                      )}
                    </div>

                    <div className="flex min-w-[220px] flex-col gap-3">
                      <Link
                        href={`/listings/${inquiry.listing_id}`}
                        className="flex w-full items-center justify-center rounded-xl border border-zinc-700 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10"
                      >
                        {t("viewListing")}
                      </Link>

                      {isAccepted && !isRented && (
                        <Link
                          href={`/viewings/request/${inquiry.id}`}
                          className="flex w-full items-center justify-center rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black hover:bg-zinc-200"
                        >
                          {t("requestViewing")}
                        </Link>
                      )}

                      <Link
                        href={`/messages/${inquiry.id}`}
                        className="flex w-full items-center justify-center rounded-xl border border-blue-500/30 bg-blue-500/10 px-5 py-3 text-sm font-semibold text-blue-300 hover:bg-blue-500/20"
                      >
                        {t("openChat")}
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
