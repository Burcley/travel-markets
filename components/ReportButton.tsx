"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";

type ReportButtonProps = {
  targetType: "listing" | "user";
  targetId: string;
};

export default function ReportButton({ targetType, targetId }: ReportButtonProps) {
  const t = useTranslations("report");
  const router = useRouter();
  const supabase = createClient();

  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("Spam or scam");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submitReport() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/auth");
      return;
    }

    if (!description.trim()) {
      alert(t("describeIssue"));
      return;
    }

    try {
      setSubmitting(true);

      const { error } = await supabase.from("reports").insert({
        reporter_id: user.id,
        target_type: targetType,
        target_listing_id: targetType === "listing" ? targetId : null,
        target_user_id: targetType === "user" ? targetId : null,
        reason,
        description: description.trim(),
        status: "pending",
      });

      if (error) {
        alert(error.message);
        return;
      }

      alert(t("submitted"));
      setOpen(false);
      setReason("Spam or scam");
      setDescription("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-xl border border-red-500/30 bg-red-500/10 px-5 py-4 font-semibold text-red-300 transition hover:bg-red-500/20"
      >
        {t("reportTarget", {
          target: targetType === "listing" ? t("listing") : t("user"),
        })}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4">
          <div className="w-full max-w-lg rounded-3xl border border-gray-800 bg-[#070707] p-6 text-white">
            <h2 className="text-2xl font-bold">
              {t("reportTarget", {
                target: targetType === "listing" ? t("listing") : t("user"),
              })}
            </h2>

            <p className="mt-2 text-sm text-gray-400">
              {t("subtitle")}
            </p>

            <label className="mt-6 block text-sm font-semibold text-gray-300">
              {t("reason")}
            </label>

            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-2 w-full rounded-xl border border-gray-700 bg-black px-4 py-3 text-white"
            >
              <option value="Spam or scam">{t("reasons.spamOrScam")}</option>
              <option value="Fake listing">{t("reasons.fakeListing")}</option>
              <option value="Wrong information">{t("reasons.wrongInformation")}</option>
              <option value="Harassment or abuse">{t("reasons.harassmentOrAbuse")}</option>
              <option value="Unsafe or suspicious activity">{t("reasons.unsafeOrSuspicious")}</option>
              <option value="Other">{t("reasons.other")}</option>
            </select>

            <label className="mt-5 block text-sm font-semibold text-gray-300">
              {t("description")}
            </label>

            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              placeholder={t("descriptionPlaceholder")}
              className="mt-2 w-full resize-none rounded-xl border border-gray-700 bg-black px-4 py-3 text-white outline-none"
            />

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setOpen(false)}
                className="flex-1 rounded-xl border border-gray-700 px-5 py-3 font-semibold text-white"
              >
                {t("cancel")}
              </button>

              <button
                onClick={submitReport}
                disabled={submitting}
                className="flex-1 rounded-xl bg-red-600 px-5 py-3 font-semibold text-white disabled:bg-gray-600"
              >
                {submitting ? t("submitting") : t("submit")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
