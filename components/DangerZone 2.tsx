"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";

export default function DangerZone() {
  const t = useTranslations("finalBatchD.dangerZone");
  const router = useRouter();
  const supabase = createClient();

  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function deleteAccount() {
    setError("");

    if (confirmation !== "DELETE") {
      setError(t("confirmError"));
      return;
    }

    setLoading(true);

    const response = await fetch("/api/account/delete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ confirmation }),
    });

    const result = await response.json();

    if (!response.ok) {
      setError(result.error || t("deleteFailed"));
      setLoading(false);
      return;
    }

    await supabase.auth.signOut();
    router.replace("/");
    router.refresh();
  }

  return (
    <section className="mt-8 rounded-3xl border border-red-500/20 bg-red-500/5 p-6">
      <h2 className="text-xl font-bold text-white">{t("title")}</h2>

      <p className="mt-2 text-sm text-white/60">
        {t("text")}
      </p>

      <div className="mt-5">
        <label className="text-sm text-white/70">
          {t.rich("confirmLabel", {
            delete: (chunks) => (
              <span className="font-bold text-red-300">{chunks}</span>
            ),
          })}
        </label>

        <input
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          placeholder="DELETE"
          className="mt-2 w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-red-400"
        />
      </div>

      {error && <p className="mt-3 text-sm text-red-300">{error}</p>}

      <button
        onClick={deleteAccount}
        disabled={loading || confirmation !== "DELETE"}
        className="mt-5 rounded-full bg-red-600 px-6 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
      >
        {loading ? t("deleting") : t("deleteButton")}
      </button>
    </section>
  );
}
