"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type ReportButtonProps = {
  targetType: "listing" | "user";
  targetId: string;
};

export default function ReportButton({ targetType, targetId }: ReportButtonProps) {
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
      alert("Please describe the issue.");
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

      alert("Report submitted successfully.");
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
        Report {targetType === "listing" ? "Listing" : "User"}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4">
          <div className="w-full max-w-lg rounded-3xl border border-gray-800 bg-[#070707] p-6 text-white">
            <h2 className="text-2xl font-bold">
              Report {targetType === "listing" ? "Listing" : "User"}
            </h2>

            <p className="mt-2 text-sm text-gray-400">
              Submit a report for admin review.
            </p>

            <label className="mt-6 block text-sm font-semibold text-gray-300">
              Reason
            </label>

            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-2 w-full rounded-xl border border-gray-700 bg-black px-4 py-3 text-white"
            >
              <option>Spam or scam</option>
              <option>Fake listing</option>
              <option>Wrong information</option>
              <option>Harassment or abuse</option>
              <option>Unsafe or suspicious activity</option>
              <option>Other</option>
            </select>

            <label className="mt-5 block text-sm font-semibold text-gray-300">
              Description
            </label>

            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              placeholder="Explain the issue..."
              className="mt-2 w-full resize-none rounded-xl border border-gray-700 bg-black px-4 py-3 text-white outline-none"
            />

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setOpen(false)}
                className="flex-1 rounded-xl border border-gray-700 px-5 py-3 font-semibold text-white"
              >
                Cancel
              </button>

              <button
                onClick={submitReport}
                disabled={submitting}
                className="flex-1 rounded-xl bg-red-600 px-5 py-3 font-semibold text-white disabled:bg-gray-600"
              >
                {submitting ? "Submitting..." : "Submit Report"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}