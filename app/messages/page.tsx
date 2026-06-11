"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  Loader2,
  MessageCircle,
  Search,
  ShieldCheck,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Inquiry = {
  id: string;
  listing_id: string;
  owner_id: string;
  requester_id: string;
  status: string;
  created_at: string;
  listings?: {
    title: string | null;
    city?: string | null;
    campus?: string | null;
    price?: number | null;
    status?: string | null;
  } | null;
};

export default function MessagesPage() {
  const supabase = createClient();
  const router = useRouter();

  const [userId, setUserId] = useState("");
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const filteredInquiries = useMemo(() => {
    const q = query.trim().toLowerCase();

    if (!q) return inquiries;

    return inquiries.filter((item) => {
      const title = item.listings?.title?.toLowerCase() || "";
      const city = item.listings?.city?.toLowerCase() || "";
      const campus = item.listings?.campus?.toLowerCase() || "";

      return title.includes(q) || city.includes(q) || campus.includes(q);
    });
  }, [inquiries, query]);

  useEffect(() => {
    async function loadMessages() {
      setLoading(true);
      setError("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/auth");
        return;
      }

      setUserId(user.id);

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        setError(profileError.message);
        setLoading(false);
        return;
      }

      if (profile?.role === "banned") {
        setError("Your account has been restricted. You cannot access messages.");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("inquiries")
        .select(
          `
          id,
          listing_id,
          owner_id,
          requester_id,
          status,
          created_at,
          listings (
            title,
            city,
            campus,
            price,
            status
          )
        `
        )
        .or(`owner_id.eq.${user.id},requester_id.eq.${user.id}`)
        .eq("status", "accepted")
        .order("created_at", { ascending: false });

      if (error) {
        setError(error.message);
        setInquiries([]);
        setLoading(false);
        return;
      }

      setInquiries((data || []) as unknown as Inquiry[]);
      setLoading(false);
    }

    loadMessages();
  }, [router, supabase]);

  if (loading) {
    return (
      <main className="min-h-screen bg-black px-6 py-10 text-white">
        <div className="mx-auto flex max-w-6xl items-center gap-3 rounded-3xl border border-white/10 bg-white/[0.04] p-6">
          <Loader2 className="animate-spin" size={20} />
          Loading conversations...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-400">
              <MessageCircle size={16} />
              Travel Markets inbox
            </div>

            <h1 className="text-4xl font-black tracking-tight md:text-5xl">
              Messages
            </h1>

            <p className="mt-3 max-w-2xl text-zinc-400">
              Keep every student-owner conversation connected to an accepted
              housing inquiry.
            </p>
          </div>

          <Link
            href="/search"
            className="rounded-2xl bg-white px-5 py-3 text-center text-sm font-black text-black hover:bg-zinc-200"
          >
            Browse Listings
          </Link>
        </div>

        <div className="mb-6 rounded-3xl border border-white/10 bg-white/[0.04] p-4">
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black px-4 py-3">
            <Search size={18} className="text-zinc-500" />

            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search conversations by listing, city, or campus..."
              className="w-full bg-transparent text-sm text-white outline-none placeholder:text-zinc-600"
            />
          </div>
        </div>

        {error && (
          <div className="rounded-3xl border border-red-800 bg-red-950/40 p-6 text-red-300">
            {error}
          </div>
        )}

        {!error && filteredInquiries.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-10 text-center">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-white/10">
              <MessageCircle size={28} className="text-zinc-400" />
            </div>

            <h2 className="text-2xl font-black">No conversations yet</h2>

            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-zinc-500">
              Chats appear after an owner accepts a student housing inquiry.
            </p>

            <Link
              href="/search"
              className="mt-6 inline-flex rounded-2xl bg-white px-5 py-3 text-sm font-black text-black hover:bg-zinc-200"
            >
              Search Housing
            </Link>
          </div>
        ) : null}

        {!error && filteredInquiries.length > 0 ? (
          <div className="grid gap-4">
            {filteredInquiries.map((inquiry) => {
              const isOwner = inquiry.owner_id === userId;

              return (
                <Link
                  key={inquiry.id}
                  href={`/messages/${inquiry.id}`}
                  className="group overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] p-5 transition hover:-translate-y-0.5 hover:border-white/30 hover:bg-white/[0.07]"
                >
                  <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                    <div className="flex min-w-0 items-center gap-4">
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-3xl bg-white text-black shadow-xl">
                        <Building2 size={24} />
                      </div>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="line-clamp-1 text-xl font-black">
                            {inquiry.listings?.title || "Housing chat"}
                          </h2>

                          <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-300">
                            Accepted
                          </span>
                        </div>

                        <p className="mt-2 line-clamp-1 text-sm text-zinc-400">
                          {inquiry.listings?.city || "City hidden"}
                          {inquiry.listings?.campus
                            ? ` • ${inquiry.listings.campus}`
                            : ""}
                          {inquiry.listings?.price
                            ? ` • $${inquiry.listings.price}/mo`
                            : ""}
                        </p>

                        <p className="mt-2 flex items-center gap-2 text-xs text-zinc-500">
                          <ShieldCheck size={14} />
                          {isOwner
                            ? "Owner conversation"
                            : "Student conversation"}
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-3">
                      <span className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-bold text-white group-hover:bg-white group-hover:text-black">
                        Open chat →
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : null}
      </div>
    </main>
  );
}