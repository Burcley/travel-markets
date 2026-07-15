"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";

type Inquiry = {
  id: string;
  listing_id: string;
  requester_id: string;
  status: "pending" | "accepted" | "declined";
  listings?: {
    status?: "available" | "pending" | "rented" | null;
  } | null;
};

export default function RequestViewingPage() {
  const t = useTranslations("viewings.request");
  const router = useRouter();
  const params = useParams();
  const supabase = useMemo(() => createClient(), []);
  const [errorMessage, setErrorMessage] = useState("");

  const inquiryId = Array.isArray(params.inquiryId)
    ? params.inquiryId[0]
    : params.inquiryId;

  useEffect(() => {
    async function redirectToBooking() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/auth");
        return;
      }

      const { data, error } = await supabase
        .from("inquiries")
        .select("id, listing_id, requester_id, status, listings(status)")
        .eq("id", inquiryId)
        .maybeSingle();

      if (error || !data) {
        setErrorMessage(error?.message || t("inquiryNotFound"));
        return;
      }

      const inquiry = data as unknown as Inquiry;

      if (inquiry.requester_id !== user.id) {
        setErrorMessage(t("onlyRequester"));
        return;
      }

      if (inquiry.status !== "accepted") {
        setErrorMessage(t("onlyAfterAccepted"));
        return;
      }

      if (inquiry.listings?.status !== "available") {
        setErrorMessage(t("listingUnavailable"));
        return;
      }

      router.replace(
        `/listings/${inquiry.listing_id}/book-viewing?inquiry=${inquiry.id}`
      );
    }

    redirectToBooking();
  }, [inquiryId, router, supabase, t]);

  if (errorMessage) {
    return (
      <main className="min-h-screen bg-black px-4 py-10 text-white">
        <div className="mx-auto max-w-2xl rounded-3xl border border-zinc-800 bg-zinc-950 p-8">
          <h1 className="text-2xl font-bold">{t("unavailableTitle")}</h1>
          <p className="mt-3 text-zinc-400">{errorMessage}</p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/inquiries/sent"
              className="rounded-xl bg-white px-5 py-3 font-semibold text-black"
            >
              {t("backToSentInquiries")}
            </Link>

            <Link
              href="/viewings"
              className="rounded-xl border border-zinc-700 px-5 py-3 font-semibold text-white"
            >
              {t("viewAppointments")}
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-4 py-10 text-white">
      <div className="mx-auto max-w-2xl">
        <p className="text-zinc-400">{t("loading")}</p>
      </div>
    </main>
  );
}
