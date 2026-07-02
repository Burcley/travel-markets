"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";

type SaveListingButtonProps = {
  listingId: string;
};

export default function SaveListingButton({ listingId }: SaveListingButtonProps) {
  const t = useTranslations("saveListing");
  const router = useRouter();
  const supabase = createClient();

  const [userId, setUserId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    checkSavedStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listingId]);

  async function checkSavedStatus() {
    try {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setUserId(null);
        setSaved(false);
        return;
      }

      setUserId(user.id);

      const { data } = await supabase
        .from("saved_listings")
        .select("id")
        .eq("user_id", user.id)
        .eq("listing_id", listingId)
        .maybeSingle();

      setSaved(!!data);
    } finally {
      setLoading(false);
    }
  }

  async function toggleSave() {
    if (!userId) {
      router.push("/auth");
      return;
    }

    try {
      setWorking(true);

      if (saved) {
        const { error } = await supabase
          .from("saved_listings")
          .delete()
          .eq("user_id", userId)
          .eq("listing_id", listingId);

        if (error) {
          alert(error.message);
          return;
        }

        setSaved(false);
      } else {
        const { error } = await supabase.from("saved_listings").insert({
          user_id: userId,
          listing_id: listingId,
        });

        if (error) {
          alert(error.message);
          return;
        }

        setSaved(true);
      }

      router.refresh();
    } finally {
      setWorking(false);
    }
  }

  return (
    <button
      onClick={toggleSave}
      disabled={loading || working}
      className={`w-full rounded-xl border px-5 py-4 font-semibold transition disabled:opacity-60 ${
        saved
          ? "border-yellow-500 bg-yellow-500/20 text-yellow-300 hover:bg-yellow-500/30"
          : "border-yellow-500/30 bg-yellow-500/10 text-yellow-300 hover:bg-yellow-500/20"
      }`}
    >
      {loading
        ? t("checking")
        : working
        ? t("saving")
        : saved
        ? `★ ${t("saved")}`
        : `☆ ${t("saveListing")}`}
    </button>
  );
}
