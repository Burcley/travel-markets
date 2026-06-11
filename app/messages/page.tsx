"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  Clock3,
  Loader2,
  MessageCircle,
  Search,
  ShieldCheck,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type ListingImage = {
  image_url: string | null;
  is_cover: boolean | null;
  sort_order: number | null;
};

type Profile = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string | null;
  is_verified: boolean | null;
};

type Inquiry = {
  id: string;
  listing_id: string;
  owner_id: string;
  requester_id: string;
  status: string;
  created_at: string;
  otherUser?: Profile | null;
  listings?: {
    title: string | null;
    city: string | null;
    campus: string | null;
    price: number | null;
    status: string | null;
    listing_images: ListingImage[] | null;
  } | null;
};

function getInitials(name?: string | null) {
  if (!name) return "TM";

  const parts = name
    .trim()
    .split(" ")
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) return "TM";

  return parts.map((part) => part[0]?.toUpperCase()).join("");
}

function formatDate(date: string) {
  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) return "";

  return parsed.toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
  });
}

function getListingCover(listing?: Inquiry["listings"]) {
  const images = listing?.listing_images ?? [];

  const sorted = [...images].sort(
    (a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999)
  );

  return (
    images.find((image) => image.is_cover)?.image_url ||
    sorted[0]?.image_url ||
    null
  );
}

export default function MessagesPage() {
  const supabase = useMemo(() => createClient(), []);
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
      const name = item.otherUser?.full_name?.toLowerCase() || "";

      return (
        title.includes(q) ||
        city.includes(q) ||
        campus.includes(q) ||
        name.includes(q)
      );
    });
  }, [inquiries, query]);

  useEffect(() => {
    async function loadMessages() {
      setLoading(true);
      setError("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
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
            status,
            listing_images (
              image_url,
              is_cover,
              sort_order
            )
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

      const rows = (data ?? []) as unknown as Inquiry[];

      const otherUserIds = Array.from(
        new Set(
          rows
            .map((item) =>
              item.owner_id === user.id ? item.requester_id : item.owner_id
            )
            .filter(Boolean)
        )
      );

      let profilesById = new Map<string, Profile>();

      if (otherUserIds.length > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from("profiles")
          .select("id, full_name, avatar_url, role, is_verified")
          .in("id", otherUserIds);

        if (profilesError) {
          console.error("LOAD MESSAGE PROFILES ERROR:", profilesError);
        } else {
          profilesById = new Map(
            ((profilesData ?? []) as Profile[]).map((item) => [item.id, item])
          );
        }
      }

      const enrichedRows = rows.map((item) => {
        const otherUserId =
          item.owner_id === user.id ? item.requester_id : item.owner_id;

        return {
          ...item,
          otherUser: profilesById.get(otherUserId) ?? null,
        };
      });

      setInquiries(enrichedRows);
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
              Student-owner conversations with verified listing context,
              profile identity, and housing details.
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
              placeholder="Search by person, listing, city, or campus..."
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
              const otherUser = inquiry.otherUser;
              const listing = inquiry.listings;
              const cover = getListingCover(listing);
              const displayName =
                otherUser?.full_name ||
                (isOwner ? "Student renter" : "Property owner");
              const initials = getInitials(displayName);

              return (
                <Link
                  key={inquiry.id}
                  href={`/messages/${inquiry.id}`}
                  className="group overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.04] transition hover:-translate-y-0.5 hover:border-white/30 hover:bg-white/[0.07]"
                >
                  <div className="grid gap-0 md:grid-cols-[180px_1fr_auto]">
                    <div className="relative min-h-[150px] overflow-hidden bg-zinc-950 md:min-h-full">
                      {cover ? (
                        <Image
                          src={cover}
                          alt={listing?.title || "Listing cover"}
                          fill
                          sizes="180px"
                          className="object-cover opacity-80 transition duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full min-h-[150px] w-full items-center justify-center bg-zinc-950">
                          <Building2 size={32} className="text-white/25" />
                        </div>
                      )}

                      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />

                      <div className="absolute bottom-4 left-4 flex items-end gap-3">
                        <div className="relative h-16 w-16 overflow-hidden rounded-3xl border-4 border-black bg-white shadow-2xl">
                          {otherUser?.avatar_url ? (
                            <Image
                              src={otherUser.avatar_url}
                              alt={displayName}
                              fill
                              sizes="64px"
                              className="object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-sm font-black text-black">
                              {initials}
                            </div>
                          )}
                        </div>

                        <div className="mb-1 rounded-full bg-emerald-500 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-black">
                          Live chat
                        </div>
                      </div>
                    </div>

                    <div className="min-w-0 p-5 md:p-6">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <h2 className="line-clamp-1 text-xl font-black">
                          {displayName}
                        </h2>

                        {otherUser?.is_verified ? (
                          <span className="rounded-full bg-blue-500/10 px-3 py-1 text-xs font-bold text-blue-300">
                            Verified
                          </span>
                        ) : null}

                        <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-300">
                          Accepted
                        </span>
                      </div>

                      <p className="line-clamp-1 text-sm font-semibold text-white/80">
                        {listing?.title || "Housing chat"}
                      </p>

                      <p className="mt-2 line-clamp-1 text-sm text-zinc-400">
                        {listing?.city || "City hidden"}
                        {listing?.campus ? ` • ${listing.campus}` : ""}
                        {listing?.price ? ` • $${listing.price}/mo` : ""}
                      </p>

                      <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-zinc-500">
                        <span className="inline-flex items-center gap-1.5">
                          <ShieldCheck size={14} />
                          {isOwner ? "Owner view" : "Student view"}
                        </span>

                        <span className="inline-flex items-center gap-1.5">
                          <Clock3 size={14} />
                          {formatDate(inquiry.created_at)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 border-t border-white/10 p-5 md:border-l md:border-t-0 md:p-6">
                      <div className="md:hidden">
                        <p className="text-xs font-semibold text-zinc-500">
                          Open this conversation
                        </p>
                      </div>

                      <span className="whitespace-nowrap rounded-2xl border border-white/10 px-4 py-3 text-sm font-bold text-white transition group-hover:bg-white group-hover:text-black">
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