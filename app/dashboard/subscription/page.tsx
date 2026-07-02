import Link from "next/link";
import { getTranslations } from "next-intl/server";
import BillingPortalButton from "@/components/billing/BillingPortalButton";

export default async function SubscriptionPage() {
  const t = await getTranslations("finalBatchD.subscription");

  return (
    <main className="min-h-screen bg-black px-4 py-10 text-white">
      <div className="mx-auto max-w-3xl rounded-3xl border border-white/10 bg-zinc-950 p-8">
        <p className="text-sm text-zinc-500">{t("eyebrow")}</p>

        <h1 className="mt-2 text-3xl font-bold">{t("title")}</h1>

        <p className="mt-3 text-zinc-400">
          {t("subtitle")}
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <BillingPortalButton />

          <Link
            href="/dashboard"
            className="rounded-xl border border-white/10 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10"
          >
            {t("backToDashboard")}
          </Link>
        </div>
      </div>
    </main>
  );
}
