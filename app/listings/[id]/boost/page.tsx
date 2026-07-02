"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Rocket, ShieldCheck, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Listing = {
  id: string;
  user_id: string;
  title: string;
  price: number | null;
  city: string | null;
  campus: string | null;
  is_featured: boolean | null;
  featured_until: string | null;
  featured_rank: number | null;
};

export default function BoostListingPage() {
  const t = useTranslations("listingManagement.boost");
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const listingId = params.id as string;

  const supabase = useMemo(() => createClient(), []);

  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [boosting, setBoosting] = useState(false);
  const [error, setError] = useState("");

  const success = searchParams.get("success") === "1";
  const canceled = searchParams.get("canceled") === "1";

  useEffect(() => {
    loadListing();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listingId]);

  async function loadListing() {
    try {
      setLoading(true);
      setError("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/auth");
        return;
      }

      const { data, error } = await supabase
        .from("listings")
        .select(
          "id, user_id, title, price, city, campus, is_featured, featured_until, featured_rank"
        )
        .eq("id", listingId)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        setError(t("notFound"));
        return;
      }

      if (data.user_id !== user.id) {
        setError(t("ownListingsOnly"));
        return;
      }

      setListing(data as Listing);
    } catch (error: any) {
      console.error("BOOST PAGE LOAD ERROR:", error);
      setError(error?.message || t("loadFailed"));
    } finally {
      setLoading(false);
    }
  }

  async function boostListing() {
    if (!listing) return;

    try {
      setBoosting(true);

      const response = await fetch("/api/stripe/create-boost-checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          listingId: listing.id,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error || t("checkoutFailed"));
      }

      if (!data?.url || typeof data.url !== "string") {
        throw new Error(t("missingUrl"));
      }

      if (!data.url.startsWith("https://checkout.stripe.com/")) {
        throw new Error(t("checkoutFailed"));
      }

      window.location.assign(data.url);
    } catch (error: any) {
      console.error("BOOST CHECKOUT ERROR:", error);
      alert(error?.message || t("checkoutFailed"));
      setBoosting(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#050505] px-4 py-10 text-white">
        {t("loading")}
      </main>
    );
  }

  if (error || !listing) {
    return (
      <main className="min-h-screen bg-[#050505] px-4 py-10 text-white">
        <div className="mx-auto max-w-2xl rounded-3xl border border-white/10 bg-white/[0.04] p-8">
          <h1 className="text-2xl font-bold">{t("unavailableTitle")}</h1>

          <p className="mt-3 text-white/50">{error || t("notFound")}</p>

          <Link
            href="/my-listings"
            className="mt-6 inline-flex rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black"
          >
            {t("backToMyListings")}
          </Link>
        </div>
      </main>
    );
  }

  const isCurrentlyFeatured =
    listing.is_featured &&
    listing.featured_until &&
    new Date(listing.featured_until).getTime() > Date.now();

  return (
    <main className="min-h-screen bg-[#050505] px-4 py-10 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <Link
          href={`/listings/${listing.id}`}
          className="text-sm text-white/50 hover:text-white"
        >
          {t("backToListing")}
        </Link>

        {success && (
          <div className="mt-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-200">
            {t("success")}
          </div>
        )}

        {canceled && (
          <div className="mt-6 rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-4 text-sm text-yellow-200">
            {t("canceled")}
          </div>
        )}

        <div className="mt-8 overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.04] shadow-2xl">
          <div className="border-b border-white/10 bg-gradient-to-br from-yellow-400/20 via-white/[0.04] to-sky-500/10 p-8">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-yellow-400 px-4 py-2 text-sm font-black text-black">
              <Rocket size={16} />
              {t("badge")}
            </div>

            <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">
              {t("title")}
            </h1>

            <p className="mt-4 max-w-2xl text-white/60">
              {t("subtitle")}
            </p>
          </div>

          <div className="grid gap-6 p-8 lg:grid-cols-[1fr_320px]">
            <div>
              <div className="rounded-3xl border border-white/10 bg-black/30 p-5">
                <p className="text-sm uppercase tracking-[0.2em] text-white/35">
                  {t("listing")}
                </p>

                <h2 className="mt-3 text-2xl font-semibold">
                  {listing.title}
                </h2>

                <p className="mt-2 text-white/50">
                  {listing.city || t("cityHidden")}
                  {listing.campus ? ` • ${listing.campus}` : ""}
                </p>

                <p className="mt-4 text-xl font-bold">
                  ${listing.price ?? t("ask")}/mo
                </p>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                  <Sparkles className="text-yellow-300" size={22} />
                  <p className="mt-3 font-semibold">{t("searchPriority")}</p>
                  <p className="mt-2 text-sm text-white/45">
                    {t("searchPriorityText")}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                  <ShieldCheck className="text-sky-300" size={22} />
                  <p className="mt-3 font-semibold">{t("premiumBadge")}</p>
                  <p className="mt-2 text-sm text-white/45">
                    {t("premiumBadgeText")}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                  <Rocket className="text-emerald-300" size={22} />
                  <p className="mt-3 font-semibold">{t("moreViews")}</p>
                  <p className="mt-2 text-sm text-white/45">
                    {t("moreViewsText")}
                  </p>
                </div>
              </div>
            </div>

            <aside className="rounded-3xl border border-yellow-400/20 bg-yellow-400/10 p-6">
              <p className="text-sm font-semibold text-yellow-200">
                {t("sevenDayBoost")}
              </p>

              <h3 className="mt-3 text-4xl font-black text-white">$7.99</h3>

              <p className="mt-3 text-sm leading-6 text-white/60">
                {t("stripeText")}
              </p>

              {isCurrentlyFeatured && (
                <div className="mt-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-200">
                  {t("alreadyFeatured", {
                    date: new Date(
                      listing.featured_until!
                    ).toLocaleDateString("en-CA"),
                  })}
                </div>
              )}

              <button
                onClick={boostListing}
                disabled={boosting}
                className="mt-6 w-full rounded-2xl bg-yellow-400 px-5 py-4 text-sm font-black text-black transition hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {boosting ? t("openingCheckout") : t("boostWithStripe")}
              </button>
            </aside>
          </div>
        </div>
      </div>
    </main>
  );
}
