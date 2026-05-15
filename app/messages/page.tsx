"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Inquiry = {
  id: string;
  listing_id: string;
  owner_id: string;
  requester_id: string;
  status: string;
  created_at: string;
  listings?: {
    title: string;
  } | null;
};

export default function MessagesPage() {
  const supabase = createClient();
  const router = useRouter();

  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
            title
          )
        `
        )
        .or(`owner_id.eq.${user.id},requester_id.eq.${user.id}`)
        .order("created_at", { ascending: false });

      if (error) {
        setError(error.message);
        setInquiries([]);
        setLoading(false);
        return;
      }

      const acceptedOnly = ((data || []) as unknown as Inquiry[]).filter(
        (item) => item.status?.toLowerCase() === "accepted"
      );

      setInquiries(acceptedOnly);
      setLoading(false);
    }

    loadMessages();
  }, [router, supabase]);

  if (loading) {
    return (
      <main className="min-h-screen bg-black px-6 py-10 text-white">
        Loading messages...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-6 py-10 text-white">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-3xl font-bold">Messages</h1>
        <p className="mt-2 text-zinc-400">Accepted inquiry conversations.</p>

        {error && (
          <div className="mt-6 rounded-xl border border-red-900 bg-red-950/40 p-4 text-red-300">
            {error}
          </div>
        )}

        {!error && inquiries.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-950 p-8">
            <p className="text-zinc-400">
              No accepted chats found for this account.
            </p>
          </div>
        ) : null}

        {!error && inquiries.length > 0 ? (
          <div className="mt-8 space-y-4">
            {inquiries.map((inquiry) => (
              <Link
                key={inquiry.id}
                href={`/messages/${inquiry.id}`}
                className="block rounded-2xl border border-zinc-800 bg-zinc-950 p-5 hover:bg-zinc-900"
              >
                <h2 className="text-xl font-semibold">
                  {inquiry.listings?.title || "Listing"}
                </h2>

                <p className="mt-2 text-sm text-zinc-500">
                  Status: {inquiry.status}
                </p>

                <p className="mt-4 text-sm text-emerald-400">Open chat →</p>
              </Link>
            ))}
          </div>
        ) : null}
      </div>
    </main>
  );
}