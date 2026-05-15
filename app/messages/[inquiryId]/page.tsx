"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Inquiry = {
  id: string;
  listing_id: string;
  owner_id: string;
  requester_id: string;
  status: string;
};

type Message = {
  id: string;
  inquiry_id: string;
  listing_id: string;
  sender_id: string;
  receiver_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
};

export default function ChatPage() {
  const supabase = createClient();
  const router = useRouter();
  const params = useParams();

  const inquiryId = Array.isArray(params.inquiryId)
    ? params.inquiryId[0]
    : params.inquiryId;

  const bottomRef = useRef<HTMLDivElement | null>(null);

  const [userId, setUserId] = useState("");
  const [isBanned, setIsBanned] = useState(false);
  const [inquiry, setInquiry] = useState<Inquiry | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const receiverId = useMemo(() => {
    if (!inquiry || !userId) return "";
    if (userId === inquiry.owner_id) return inquiry.requester_id;
    if (userId === inquiry.requester_id) return inquiry.owner_id;
    return "";
  }, [inquiry, userId]);

  const isOwner = inquiry?.owner_id === userId;
  const isRequester = inquiry?.requester_id === userId;

  async function markMessagesAsRead(currentUserId: string) {
    await supabase
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .eq("inquiry_id", inquiryId)
      .eq("receiver_id", currentUserId)
      .is("read_at", null);
  }

  async function loadChat() {
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
      setIsBanned(true);
      setError("Your account has been restricted. You cannot access messages.");
      setLoading(false);
      return;
    }

    const { data: inquiryData, error: inquiryError } = await supabase
      .from("inquiries")
      .select("*")
      .eq("id", inquiryId)
      .single();

    if (inquiryError || !inquiryData) {
      setError("Inquiry not found.");
      setLoading(false);
      return;
    }

    if (inquiryData.status !== "accepted") {
      setError("Chat only available after acceptance.");
      setLoading(false);
      return;
    }

    const isParticipant =
      inquiryData.owner_id === user.id || inquiryData.requester_id === user.id;

    if (!isParticipant) {
      setError("You do not have permission to open this chat.");
      setLoading(false);
      return;
    }

    setInquiry(inquiryData);

    await markMessagesAsRead(user.id);

    const { data: messageData, error: messageError } = await supabase
      .from("messages")
      .select("*")
      .eq("inquiry_id", inquiryId)
      .order("created_at", { ascending: true });

    if (messageError) {
      setError(messageError.message);
      setLoading(false);
      return;
    }

    setMessages(messageData || []);
    setLoading(false);
  }

  useEffect(() => {
    loadChat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inquiryId]);

  useEffect(() => {
    if (!inquiryId || !userId || isBanned) return;

    const channel = supabase
      .channel(`chat-${inquiryId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `inquiry_id=eq.${inquiryId}`,
        },
        async () => {
          await markMessagesAsRead(userId);

          const { data } = await supabase
            .from("messages")
            .select("*")
            .eq("inquiry_id", inquiryId)
            .order("created_at", { ascending: true });

          setMessages(data || []);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inquiryId, userId, isBanned]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const cleanBody = body.trim();

    if (!cleanBody || !inquiry || !userId || !receiverId) return;

    setSending(true);
    setError("");

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) {
      setError(profileError.message);
      setSending(false);
      return;
    }

    if (profile?.role === "banned") {
      setIsBanned(true);
      setError("Your account has been restricted. You cannot send messages.");
      setSending(false);
      return;
    }

    const { data: latestInquiry, error: inquiryCheckError } = await supabase
      .from("inquiries")
      .select("status")
      .eq("id", inquiry.id)
      .single();

    if (inquiryCheckError) {
      setError(inquiryCheckError.message);
      setSending(false);
      return;
    }

    if (latestInquiry?.status !== "accepted") {
      setError("This chat is no longer active.");
      setSending(false);
      return;
    }

    const { error: sendError } = await supabase.from("messages").insert({
      inquiry_id: inquiry.id,
      listing_id: inquiry.listing_id,
      sender_id: userId,
      receiver_id: receiverId,
      body: cleanBody,
    });

    if (sendError) {
      setError(sendError.message);
      setSending(false);
      return;
    }

    await supabase.from("notifications").insert({
      user_id: receiverId,
      inquiry_id: inquiry.id,
      type: "new_message",
      title: "New Message",
      body: "You received a new message",
      link: `/messages/${inquiry.id}`,
    });

    setBody("");
    setSending(false);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black px-6 py-10 text-white">
        Loading chat...
      </main>
    );
  }

  if (isBanned) {
    return (
      <main className="min-h-screen bg-black px-6 py-10 text-white">
        <div className="mx-auto max-w-2xl rounded-2xl border border-red-800 bg-red-950/40 p-6">
          <h1 className="text-2xl font-bold text-red-300">
            Account Restricted
          </h1>
          <p className="mt-3 text-red-200">
            Your account has been restricted. You cannot access messages.
          </p>

          <Link
            href="/"
            className="mt-5 inline-block rounded-xl bg-white px-5 py-3 font-semibold text-black"
          >
            Back Home
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-6 py-8 text-white">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <Link href="/messages" className="text-sm text-zinc-400 hover:text-white">
            ← Back to messages
          </Link>

          {inquiry && (
            <div className="flex flex-wrap gap-3">
              <Link
                href={`/listings/${inquiry.listing_id}`}
                className="rounded-xl border border-zinc-800 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-900"
              >
                View Listing
              </Link>

              {isRequester && (
                <Link
                  href={`/viewings/request/${inquiry.id}`}
                  className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-zinc-200"
                >
                  Request Viewing
                </Link>
              )}

              {isOwner && (
                <Link
                  href="/viewings"
                  className="rounded-xl border border-zinc-800 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-900"
                >
                  Manage Viewings
                </Link>
              )}
            </div>
          )}
        </div>

        {error && <p className="mb-4 text-red-400">{error}</p>}

        <div className="h-[65vh] overflow-y-auto rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
          {messages.length === 0 ? (
            <div className="flex h-full items-center justify-center text-zinc-500">
              No messages yet.
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg) => {
                const isMine = msg.sender_id === userId;

                return (
                  <div
                    key={msg.id}
                    className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm ${
                        isMine
                          ? "bg-white text-black"
                          : "bg-zinc-800 text-white"
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">{msg.body}</p>

                      <div
                        className={`mt-2 flex justify-between gap-4 text-[11px] ${
                          isMine ? "text-zinc-600" : "text-zinc-400"
                        }`}
                      >
                        <span>
                          {new Date(msg.created_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>

                        {isMine && <span>{msg.read_at ? "Read" : "Sent"}</span>}
                      </div>
                    </div>
                  </div>
                );
              })}

              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {inquiry && (
          <form onSubmit={sendMessage} className="mt-4 flex gap-3">
            <input
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Message..."
              className="flex-1 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-white outline-none"
            />

            <button
              type="submit"
              disabled={sending || body.trim().length === 0}
              className="rounded-xl bg-white px-6 py-3 font-semibold text-black disabled:opacity-50"
            >
              {sending ? "Sending..." : "Send"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}