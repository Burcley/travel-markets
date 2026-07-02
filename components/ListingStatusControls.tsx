"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";

export default function ListingStatusControls({
  listingId,
  currentStatus,
}: {
  listingId: string;
  currentStatus: string | null;
}) {
  const t = useTranslations("finalBatchD.listingStatus");
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);

  async function updateStatus(status: string) {
    setLoading(true);

    const { error } = await supabase
      .from("listings")
      .update({ status })
      .eq("id", listingId);

    if (error) {
      alert(error.message);
    }

    setLoading(false);
    router.refresh();
  }

  return (
    <div className="mt-4">
      <p className="text-xs text-gray-400 mb-2">{t("status")}</p>

      <div className="flex gap-2">
        <button
          onClick={() => updateStatus("available")}
          disabled={loading}
          className="px-3 py-2 rounded-lg bg-green-600 text-white text-sm"
        >
          {t("available")}
        </button>

        <button
          onClick={() => updateStatus("pending")}
          disabled={loading}
          className="px-3 py-2 rounded-lg bg-yellow-600 text-white text-sm"
        >
          {t("pending")}
        </button>

        <button
          onClick={() => updateStatus("rented")}
          disabled={loading}
          className="px-3 py-2 rounded-lg bg-red-600 text-white text-sm"
        >
          {t("rented")}
        </button>
      </div>
    </div>
  );
}
