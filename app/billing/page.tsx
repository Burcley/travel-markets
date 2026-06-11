import Link from "next/link";
import { Check, Crown, Sparkles, Zap } from "lucide-react";
import { getCurrentUserSubscription } from "@/lib/subscriptions/server";
import { OWNER_PLANS } from "@/lib/subscriptions/plans";
import BillingActions from "./BillingActions";

export default async function BillingPage() {
  const { user, subscription, plan } = await getCurrentUserSubscription();

  if (!user) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center px-6">
        <div className="max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
          <h1 className="text-2xl font-bold">Sign in required</h1>
          <p className="mt-3 text-white/60">You need to sign in to manage billing.</p>
          <Link
            href="/login"
            className="mt-6 inline-flex rounded-2xl bg-white px-5 py-3 font-semibold text-black"
          >
            Sign in
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-4 py-10 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-purple-400/30 bg-purple-500/10 px-4 py-2 text-sm text-purple-200">
              <Crown size={16} />
              Owner subscriptions
            </p>
            <h1 className="text-4xl font-bold tracking-tight">Upgrade your owner account</h1>
            <p className="mt-3 max-w-2xl text-white/60">
              Get more active listings, stronger ranking, featured visibility, and premium owner tools.
            </p>
          </div>

          {subscription?.stripe_customer_id && (
            <BillingActions action="portal" label="Manage billing" />
          )}
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {(Object.keys(OWNER_PLANS) as Array<keyof typeof OWNER_PLANS>).map((key) => {
            const item = OWNER_PLANS[key];
            const isCurrent = plan === key;
            const isPremium = key === "premium";
            const isPro = key === "pro";

            return (
              <div
                key={key}
                className={`relative rounded-3xl border p-6 shadow-2xl ${
                  isPremium
                    ? "border-yellow-400/40 bg-gradient-to-b from-yellow-500/15 to-white/5"
                    : isPro
                    ? "border-purple-400/40 bg-gradient-to-b from-purple-500/15 to-white/5"
                    : "border-white/10 bg-white/5"
                }`}
              >
                {isCurrent && (
                  <div className="absolute right-4 top-4 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-300">
                    Current
                  </div>
                )}

                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
                  {isPremium ? <Crown /> : isPro ? <Zap /> : <Sparkles />}
                </div>

                <h2 className="text-2xl font-bold">{item.name}</h2>
                <p className="mt-2 text-3xl font-black">{item.price}</p>

                <ul className="mt-6 space-y-3">
                  {item.features.map((feature) => (
                    <li key={feature} className="flex gap-3 text-sm text-white/75">
                      <Check className="mt-0.5 h-4 w-4 text-emerald-300" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-8">
                  {key === "free" ? (
                    <button
                      disabled
                      className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 font-semibold text-white/40"
                    >
                      Free plan
                    </button>
                  ) : isCurrent ? (
                    <BillingActions action="portal" label="Change plan" fullWidth />
                  ) : (
                    <BillingActions action="checkout" plan={key} label={`Upgrade to ${item.name}`} fullWidth />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}