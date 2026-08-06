import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  BarChart3,
  Check,
  Crown,
  CreditCard,
  Home,
  Sparkles,
  Zap,
} from "lucide-react";
import BillingActions from "./BillingActions";
import { createClient } from "@/lib/supabase/server";
import {
  getFoundingBenefitStatus,
  getFoundingProfile,
} from "@/lib/founding-landlords/server";
import {
  formatCurrencyFromCents,
  getFoundingPricingRows,
} from "@/lib/founding-landlords/pricing";
import {
  CHECKOUT_OWNER_PLANS,
  OWNER_PLAN_ENTITLEMENTS,
  getOwnerPlanLabel,
  getPublicPlan,
  subscriptionStatusHasPaidAccess,
  type CheckoutOwnerPlan,
} from "@/lib/subscriptions/plans";
import { getCurrentUserSubscription } from "@/lib/subscriptions/server";

const comparisonRows = [
  {
    label: "Active listing limit",
    free: "1",
    premium: "5",
    elite: "Unlimited",
  },
  {
    label: "Search visibility",
    free: "Basic",
    premium: "Ahead of Free",
    elite: "Highest priority",
  },
  {
    label: "Monthly boosts",
    free: "0",
    premium: "2",
    elite: "10",
  },
  {
    label: "Landlord badge",
    free: "None",
    premium: "Premium Landlord",
    elite: "Elite Property Manager",
  },
  {
    label: "Listing analytics",
    free: "Basic totals",
    premium: "Listing insights",
    elite: "Portfolio insights",
  },
  {
    label: "Homepage eligibility",
    free: "No",
    premium: "Recommendations",
    elite: "Featured eligibility",
  },
  {
    label: "Priority support",
    free: "Standard",
    premium: "Included",
    elite: "Included",
  },
];

function formatDate(date: string | null | undefined) {
  if (!date) return "Not available";

  return new Date(date).toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function statusClass(status?: string | null) {
  if (status === "active" || status === "trialing") {
    return "border-emerald-400/30 bg-emerald-500/10 text-emerald-200";
  }

  if (status === "past_due") {
    return "border-yellow-400/30 bg-yellow-500/10 text-yellow-200";
  }

  if (status === "canceled") {
    return "border-red-400/30 bg-red-500/10 text-red-200";
  }

  return "border-white/10 bg-white/5 text-white/60";
}

export default async function BillingPage() {
  const {
    user,
    subscription,
    plan,
    entitlements,
    remainingMonthlyBoosts,
  } = await getCurrentUserSubscription();
  const supabase = await createClient();

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black px-6 text-white">
        <div className="max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
          <h1 className="text-2xl font-bold">Sign in required</h1>
          <p className="mt-3 text-white/60">
            Sign in with your landlord account to manage billing.
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_admin")
    .eq("id", user.id)
    .maybeSingle();

  const role = String(profile?.role || "").toLowerCase();
  const isOwner =
    profile?.is_admin ||
    role === "admin" ||
    role === "owner" ||
    role === "landlord" ||
    role === "host";

  if (!isOwner || role === "student") {
    redirect("/search");
  }

  const publicPlan = getPublicPlan(plan);
  const paidAccessActive = subscriptionStatusHasPaidAccess(
    subscription?.status,
    subscription?.current_period_end
  );
  const [foundingProfile, foundingBenefit] = await Promise.all([
    getFoundingProfile(user.id),
    getFoundingBenefitStatus(user.id),
  ]);
  const showFoundingCard = foundingBenefit.isConfirmedFounder;
  const foundingDiscount =
    foundingBenefit.lifetimeDiscountPercentage ??
    foundingProfile?.founding_discount_percentage ??
    null;
  const foundingPricingRows = getFoundingPricingRows(foundingDiscount);

  return (
    <main className="min-h-screen bg-black px-4 py-10 text-white">
      <div className="mx-auto max-w-6xl">
        <section className="overflow-hidden rounded-[2rem] border border-pink-500/20 bg-[radial-gradient(circle_at_top,#3b1028_0%,#0f172a_42%,#020617_100%)] p-6 shadow-2xl md:p-8">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-pink-400/30 bg-pink-500/10 px-4 py-2 text-sm font-semibold text-pink-100">
                <Crown size={16} />
                Owner billing
              </p>
              <h1 className="mt-5 text-4xl font-black tracking-tight md:text-5xl">
                Grow Your Rentals
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
                Choose the visibility and tools you need to reach more students
                and fill vacancies faster.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              {subscription?.stripe_customer_id && (
                <BillingActions action="portal" label="Manage billing" />
              )}
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/10 px-5 py-3 font-bold text-white hover:bg-white/15"
              >
                Back to dashboard
              </Link>
            </div>
          </div>
        </section>

        {subscription?.status === "past_due" && (
          <section className="mt-6 rounded-3xl border border-yellow-500/30 bg-yellow-500/10 p-5">
            <div className="flex gap-3">
              <AlertTriangle className="mt-1 text-yellow-300" />
              <div>
                <h2 className="font-bold text-yellow-100">Payment attention needed</h2>
                <p className="mt-1 text-sm text-yellow-100/75">
                  Update your payment method in Stripe to keep paid owner
                  benefits active.
                </p>
              </div>
            </div>
          </section>
        )}

        {showFoundingCard && (
          <section className="mt-6 overflow-hidden rounded-[2rem] border border-pink-400/30 bg-[radial-gradient(circle_at_top_left,rgba(244,63,94,0.28),rgba(10,10,10,0.94)_42%,rgba(2,6,23,1)_100%)] p-6 shadow-2xl md:p-8">
            <div className="grid gap-8 lg:grid-cols-[1fr_320px] lg:items-center">
              <div>
                <p className="inline-flex items-center gap-2 rounded-full border border-pink-300/30 bg-pink-500/15 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-pink-100">
                  <Crown size={15} />
                  Founding Landlord
                </p>
                <h2 className="mt-5 text-3xl font-black md:text-4xl">
                  {foundingBenefit.freePeriodActive
                    ? "12 months free with unlimited listings"
                    : "Founding status and lifetime discount retained"}
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                  {foundingBenefit.freePeriodActive
                    ? "Your Founding Landlord free period is active. Normal listing caps are bypassed server-side until the free period expires."
                    : "Your 12-month free listing period has ended, but your Founding Landlord status and lifetime discount remain attached to this account."}
                </p>
              </div>

              <div className="rounded-3xl border border-white/10 bg-black/45 p-5">
                <p className="text-sm font-bold uppercase tracking-[0.16em] text-pink-200">
                  Lifetime Discount
                </p>
                <p className="mt-2 text-5xl font-black">
                  {foundingDiscount != null ? `${foundingDiscount}%` : "Configured"}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Applies after the free period according to the existing
                  Founding Landlord Stripe billing rules.
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-4">
              <SummaryCard
                icon={<Sparkles />}
                label="Founding status"
                value={
                  foundingProfile?.founding_benefits_disabled
                    ? "Benefits disabled"
                    : foundingProfile?.founding_status || "confirmed"
                }
              />
              <SummaryCard
                icon={<Home />}
                label="Listings"
                value={
                  foundingBenefit.freePeriodActive
                    ? "Unlimited"
                    : "Normal plan rules"
                }
                helper={
                  foundingBenefit.freePeriodActive
                    ? "Unlimited active listings included during the free period."
                    : "Use your current owner plan allowance after the free period."
                }
              />
              <SummaryCard
                icon={<CreditCard />}
                label="Free period started"
                value={formatDate(foundingBenefit.freePeriodStartedAt)}
              />
              <SummaryCard
                icon={<Zap />}
                label={
                  foundingBenefit.freePeriodEnded
                    ? "Free period ended"
                    : "Free period expires"
                }
                value={formatDate(foundingBenefit.freePeriodEndsAt)}
              />
            </div>

            <div className="mt-6 rounded-3xl border border-white/10 bg-black/45 p-5">
              <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                <div>
                  <h3 className="text-xl font-black">
                    After your 12-month free period
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-slate-400">
                    $0 is due for Travel Markets platform fees during the active
                    Founding free period. After it ends, your lifetime Founding
                    discount applies to eligible paid landlord subscriptions.
                    The discount does not expire while this account remains
                    eligible under the Founding rules.
                  </p>
                </div>
                <Link
                  href="/dashboard/boosts"
                  className="inline-flex items-center justify-center rounded-2xl border border-pink-300/25 bg-pink-500/15 px-4 py-2 text-sm font-bold text-pink-100 hover:bg-pink-500/20"
                >
                  Use Founder boosts
                </Link>
              </div>

              <div className="mt-5 overflow-hidden rounded-2xl border border-white/10">
                <div className="grid grid-cols-4 bg-white/10 px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-slate-300">
                  <span>Plan</span>
                  <span>Regular</span>
                  <span>Founder price</span>
                  <span>Savings</span>
                </div>
                {foundingPricingRows.map((row) => (
                  <div
                    key={row.plan}
                    className="grid grid-cols-4 gap-3 border-t border-white/10 px-4 py-4 text-sm text-slate-200"
                  >
                    <span className="font-bold text-white">
                      {row.planName}
                      <span className="block text-xs font-medium text-slate-500">
                        Monthly
                      </span>
                    </span>
                    <span>{formatCurrencyFromCents(row.regularPriceCents)}</span>
                    <span className="font-bold text-emerald-200">
                      {formatCurrencyFromCents(row.foundingPriceCents)}
                    </span>
                    <span>
                      {formatCurrencyFromCents(row.savingsCents)}/month
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        <section className="mt-6 grid gap-4 md:grid-cols-4">
          <SummaryCard
            icon={<Sparkles />}
            label="Current plan"
            value={getOwnerPlanLabel(plan)}
          />
          <SummaryCard
            icon={<CreditCard />}
            label="Status"
            value={subscription?.status || "free"}
            className={statusClass(subscription?.status)}
          />
          <SummaryCard
            icon={<Zap />}
            label="Monthly Boosts"
            value={
              entitlements.monthlyBoosts > 0
                ? `${remainingMonthlyBoosts} available`
                : "No monthly boosts included"
            }
            helper="Promote your listings and increase visibility."
            actionHref={
              entitlements.monthlyBoosts > 0 ? "/dashboard/boosts" : "/billing"
            }
            actionLabel={
              entitlements.monthlyBoosts > 0 ? "Boost a Listing" : "Upgrade"
            }
          />
          <SummaryCard
            icon={<Home />}
            label="Next reset"
            value={formatDate(subscription?.current_period_end)}
          />
        </section>

        <section className="mt-10 grid gap-5 lg:grid-cols-3">
          {(["free", ...CHECKOUT_OWNER_PLANS] as Array<"free" | CheckoutOwnerPlan>).map((key) => {
            const item = OWNER_PLAN_ENTITLEMENTS[key];
            const isCurrent = publicPlan === key;
            const emphasized = key === "premium";
            const isElite = key === "elite";

            return (
              <article
                key={key}
                className={`relative flex min-h-[560px] flex-col rounded-[2rem] border p-6 shadow-2xl ${
                  emphasized
                    ? "border-pink-400/50 bg-gradient-to-b from-pink-500/20 via-white/[0.07] to-white/[0.03]"
                    : isElite
                      ? "border-violet-400/30 bg-gradient-to-b from-violet-500/15 via-white/[0.06] to-white/[0.03]"
                      : "border-white/10 bg-white/[0.04]"
                }`}
              >
                {(item.cardBadge || isCurrent) && (
                  <div className="mb-5 flex flex-wrap gap-2">
                    {item.cardBadge && (
                      <span className="rounded-full border border-pink-300/30 bg-pink-500/15 px-3 py-1 text-xs font-bold text-pink-100">
                        {item.cardBadge}
                      </span>
                    )}
                    {isCurrent && (
                      <span className="rounded-full border border-emerald-300/30 bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-100">
                        Your current plan
                      </span>
                    )}
                  </div>
                )}

                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-white">
                  {isElite ? <Crown /> : emphasized ? <Zap /> : <Sparkles />}
                </div>

                <h2 className="mt-5 text-2xl font-black">{item.publicName}</h2>
                <p className="mt-2 min-h-12 text-sm leading-6 text-slate-300">
                  {item.tagline}
                </p>
                <p className="mt-5 text-4xl font-black">{item.price}</p>

                <ul className="mt-7 flex-1 space-y-3">
                  {item.features.map((feature) => (
                    <li key={feature} className="flex gap-3 text-sm text-slate-200">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-8">
                  {isCurrent ? (
                    subscription?.stripe_customer_id && paidAccessActive ? (
                      <BillingActions action="portal" label="Manage billing" fullWidth />
                    ) : (
                      <button
                        disabled
                        className="w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 font-bold text-white/55"
                      >
                        Your current plan
                      </button>
                    )
                  ) : key === "free" ? (
                    <button
                      disabled
                      className="w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 font-bold text-white/50"
                    >
                      Switch to Free in Stripe
                    </button>
                  ) : (
                    <BillingActions
                      action="checkout"
                      plan={key}
                      label={item.cta}
                      fullWidth
                    />
                  )}
                </div>
              </article>
            );
          })}
        </section>

        <p className="mt-5 text-center text-sm text-slate-400">
          Cancel or change your plan anytime. Paid subscriptions are managed
          securely through Stripe.
        </p>

        <section className="mt-10 rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 md:p-6">
          <div className="flex items-center gap-3">
            <BarChart3 className="text-pink-200" />
            <div>
              <h2 className="text-2xl font-black">Compare plans</h2>
              <p className="mt-1 text-sm text-slate-400">
                Visibility, trust signals and analytics by plan.
              </p>
            </div>
          </div>

          <div className="mt-6 overflow-hidden rounded-2xl border border-white/10">
            <div className="grid grid-cols-4 bg-white/10 px-4 py-3 text-sm font-bold text-slate-200">
              <span>Feature</span>
              <span>Free</span>
              <span>Premium</span>
              <span>Elite</span>
            </div>
            {comparisonRows.map((row) => (
              <div
                key={row.label}
                className="grid grid-cols-4 gap-3 border-t border-white/10 px-4 py-4 text-sm text-slate-300"
              >
                <span className="font-semibold text-white">{row.label}</span>
                <span>{row.free}</span>
                <span>{row.premium}</span>
                <span>{row.elite}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  helper,
  actionHref,
  actionLabel,
  className,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  helper?: string;
  actionHref?: string;
  actionLabel?: string;
  className?: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
      <div className="flex items-center gap-3 text-slate-400">
        <span className="text-pink-200">{icon}</span>
        <span className="text-sm">{label}</span>
      </div>
      <div
        className={`mt-4 inline-flex rounded-full border px-3 py-1 text-sm font-bold capitalize ${
          className || "border-white/10 bg-white/5 text-white"
        }`}
      >
        {value}
      </div>
      {helper && <p className="mt-3 text-sm text-slate-400">{helper}</p>}
      {actionHref && actionLabel && (
        <Link
          href={actionHref}
          className="mt-4 inline-flex rounded-xl bg-white px-4 py-2 text-sm font-bold text-black"
        >
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
