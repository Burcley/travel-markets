import Link from "next/link";
import {
  AlertTriangle,
  Check,
  Crown,
  CreditCard,
  FileText,
  Sparkles,
  Zap,
} from "lucide-react";
import { getCurrentUserSubscription } from "@/lib/subscriptions/server";
import { OWNER_PLANS } from "@/lib/subscriptions/plans";
import BillingActions from "./BillingActions";

const PLAN_LIMITS = {
  free: {
    listings: 1,
    boosts: 0,
  },
  pro: {
    listings: 5,
    boosts: 2,
  },
  premium: {
    listings: 25,
    boosts: 10,
  },
};

function formatDate(date?: string | null) {
  if (!date) return "Not available";

  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getPlanStatusLabel(status?: string | null) {
  if (!status) return "Free";
  if (status === "active") return "Active";
  if (status === "trialing") return "Trial";
  if (status === "past_due") return "Past due";
  if (status === "canceled") return "Canceled";
  return status.replaceAll("_", " ");
}

function getPlanStatusClass(status?: string | null) {
  if (status === "active" || status === "trialing") {
    return "border-emerald-400/30 bg-emerald-500/10 text-emerald-300";
  }

  if (status === "past_due") {
    return "border-yellow-400/30 bg-yellow-500/10 text-yellow-300";
  }

  if (status === "canceled") {
    return "border-red-400/30 bg-red-500/10 text-red-300";
  }

  return "border-white/10 bg-white/5 text-white/60";
}

export default async function BillingPage() {
  const { user, subscription, plan } = await getCurrentUserSubscription();

  const currentPlanKey = (plan || "free") as keyof typeof OWNER_PLANS;
  const currentPlan = OWNER_PLANS[currentPlanKey];
  const limits = PLAN_LIMITS[currentPlanKey] || PLAN_LIMITS.free;

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black px-6 text-white">
        <div className="max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
          <h1 className="text-2xl font-bold">Sign in required</h1>
          <p className="mt-3 text-white/60">
            You need to sign in to manage billing.
          </p>

          <Link
            href="/auth"
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
        <div className="mb-8 rounded-3xl border border-purple-500/20 bg-gradient-to-br from-purple-500/15 via-white/5 to-yellow-500/10 p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-purple-400/30 bg-purple-500/10 px-4 py-2 text-sm font-semibold text-purple-200">
                <Crown size={16} />
                Owner Billing Center
              </p>

              <h1 className="text-4xl font-black tracking-tight">
                {currentPlan?.name || "Free"} Plan
              </h1>

              <p className="mt-3 max-w-2xl text-white/60">
                Manage your subscription, listing limits, monthly boosts, and
                payment settings for Travel Markets.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              {subscription?.stripe_customer_id && (
                <BillingActions action="portal" label="Manage billing" />
              )}

              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-bold text-white hover:bg-white/10"
              >
                Back to Dashboard
              </Link>
            </div>
          </div>
        </div>

        {subscription?.status === "past_due" && (
          <div className="mb-8 rounded-3xl border border-yellow-500/30 bg-yellow-500/10 p-5">
            <div className="flex gap-3">
              <AlertTriangle className="mt-1 text-yellow-300" />
              <div>
                <h2 className="font-bold text-yellow-200">
                  Payment attention required
                </h2>
                <p className="mt-1 text-sm text-yellow-100/70">
                  Your subscription payment failed. Please update your payment
                  method to avoid losing owner plan benefits.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-4">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <p className="text-sm text-white/50">Current Plan</p>
            <h2 className="mt-2 text-3xl font-black capitalize">
              {currentPlan?.name || "Free"}
            </h2>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <p className="text-sm text-white/50">Plan Status</p>
            <span
              className={`mt-3 inline-flex rounded-full border px-3 py-1 text-sm font-bold capitalize ${getPlanStatusClass(
                subscription?.status
              )}`}
            >
              {getPlanStatusLabel(subscription?.status)}
            </span>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <p className="text-sm text-white/50">Next Billing Date</p>
            <h2 className="mt-2 text-2xl font-black">
              {formatDate(subscription?.current_period_end)}
            </h2>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <p className="text-sm text-white/50">Cancel at Period End</p>
            <h2 className="mt-2 text-2xl font-black">
              {subscription?.cancel_at_period_end ? "Yes" : "No"}
            </h2>
          </div>
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-2">
          <div className="rounded-3xl border border-blue-500/20 bg-blue-500/5 p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-blue-500/10 p-3 text-blue-300">
                <FileText />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Listing Usage</h2>
                <p className="text-sm text-white/50">
                  Active listing slots included in your plan.
                </p>
              </div>
            </div>

            <div className="mt-6">
              <div className="flex justify-between text-sm">
                <span className="text-white/60">Available slots</span>
                <span className="font-bold">{limits.listings}</span>
              </div>

              <div className="mt-3 h-3 overflow-hidden rounded-full bg-black/50">
                <div className="h-full w-full rounded-full bg-blue-400" />
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-yellow-500/20 bg-yellow-500/5 p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-yellow-500/10 p-3 text-yellow-300">
                <Zap />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Monthly Boosts</h2>
                <p className="text-sm text-white/50">
                  Featured visibility boosts included monthly.
                </p>
              </div>
            </div>

            <div className="mt-6">
              <div className="flex justify-between text-sm">
                <span className="text-white/60">Included boosts</span>
                <span className="font-bold">{limits.boosts}</span>
              </div>

              <div className="mt-3 h-3 overflow-hidden rounded-full bg-black/50">
                <div
                  className="h-full rounded-full bg-yellow-400"
                  style={{ width: limits.boosts > 0 ? "100%" : "0%" }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <CreditCard className="text-white/60" />
                <h2 className="text-2xl font-bold">Payment & Invoices</h2>
              </div>

              <p className="mt-2 text-sm text-white/50">
                Manage card details, invoices, billing address, cancellation,
                and subscription changes through Stripe.
              </p>
            </div>

            {subscription?.stripe_customer_id ? (
              <BillingActions action="portal" label="Open Stripe Portal" />
            ) : (
              <p className="rounded-2xl border border-white/10 bg-black px-5 py-3 text-sm text-white/50">
                No paid billing account yet.
              </p>
            )}
          </div>
        </div>

        <div className="mt-10">
          <div className="mb-5">
            <h2 className="text-3xl font-black">Choose Your Owner Plan</h2>
            <p className="mt-2 text-white/50">
              Upgrade, downgrade, or manage your owner subscription anytime.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            {(Object.keys(OWNER_PLANS) as Array<keyof typeof OWNER_PLANS>).map(
              (key) => {
                const item = OWNER_PLANS[key];
                const isCurrent = currentPlanKey === key;
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
                        <li
                          key={feature}
                          className="flex gap-3 text-sm text-white/75"
                        >
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
                        <BillingActions
                          action="portal"
                          label="Manage plan"
                          fullWidth
                        />
                      ) : (
                        <BillingActions
                          action="checkout"
                          plan={key}
                          label={`Upgrade to ${item.name}`}
                          fullWidth
                        />
                      )}
                    </div>
                  </div>
                );
              }
            )}
          </div>
        </div>
      </div>
    </main>
  );
}