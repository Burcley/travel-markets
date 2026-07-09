"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  ArrowLeft,
  Building2,
  Loader2,
  MessageCircle,
  SendHorizonal,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Inquiry = {
  id: string;
  listing_id: string;
  owner_id: string;
  requester_id: string;
  status: string;
  created_at?: string;
  listings?: {
    title: string | null;
    city: string | null;
    campus: string | null;
    price?: number | null;
    status?: string | null;
  } | null;
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

type Profile = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
};

type ListingImageRow = {
  listing_id: string | null;
  image_url: string | null;
};

type Viewing = {
  id: string;
  inquiry_id: string | null;
  listing_id: string;
  owner_id: string;
  requester_id: string;
  requested_date: string | null;
  requested_time: string | null;
  note: string | null;
  status: "pending" | "accepted" | "declined" | "completed" | "suggested";
  viewing_type?: "in_person" | "video_call" | "video_tour" | null;
  owner_suggested_date?: string | null;
  owner_suggested_time?: string | null;
  owner_suggested_message?: string | null;
};

export default function ChatPage() {
  const t = useTranslations("chatPage");
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
  const [conversations, setConversations] = useState<Inquiry[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [listingCovers, setListingCovers] = useState<Record<string, string>>({});
  const [messages, setMessages] = useState<Message[]>([]);
  const [latestViewing, setLatestViewing] = useState<Viewing | null>(null);
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

  const otherUserId = receiverId;
  const otherProfile = otherUserId ? profiles[otherUserId] : null;
  const ownerProfile = inquiry?.owner_id ? profiles[inquiry.owner_id] : null;

  const listingCover = inquiry?.listing_id
    ? listingCovers[inquiry.listing_id]
    : null;

  function getAvatarLetter(profile?: Profile | null) {
    return profile?.full_name?.charAt(0)?.toUpperCase() || "T";
  }

  function renderAvatar(profile?: Profile | null, size = "h-12 w-12") {
    if (profile?.avatar_url) {
      return (
        <img
          src={profile.avatar_url}
          alt={profile.full_name || t("userAlt")}
          className={`${size} rounded-full object-cover`}
        />
      );
    }

    return (
      <div
        className={`${size} flex items-center justify-center rounded-full bg-white font-black text-black`}
      >
        {getAvatarLetter(profile)}
      </div>
    );
  }

  function renderConversationMedia(item: Inquiry, profile?: Profile | null) {
    const cover = listingCovers[item.listing_id];

    return (
      <div className="relative h-16 w-16 shrink-0 overflow-visible">
        <div className="h-14 w-14 overflow-hidden rounded-2xl bg-zinc-900">
          {cover ? (
            <img
              src={cover}
              alt={item.listings?.title || t("listingAlt")}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-zinc-800">
              <Building2 size={22} className="text-zinc-500" />
            </div>
          )}
        </div>

        <div className="absolute -bottom-1 -right-1 rounded-full border-2 border-[#060606] bg-black">
          {renderAvatar(profile, "h-8 w-8")}
        </div>
      </div>
    );
  }

  function getViewingTypeLabel(viewing?: Viewing | null) {
    if (!viewing) return "";
    if (viewing.viewing_type === "video_call") return t("viewingTypes.videoCall");
    if (viewing.viewing_type === "video_tour") {
      return t("viewingTypes.recordedTour");
    }

    return t("viewingTypes.inPerson");
  }

  function getViewingStatusLabel(status?: Viewing["status"]) {
    if (status === "accepted") return t("viewingStatuses.accepted");
    if (status === "declined") return t("viewingStatuses.declined");
    if (status === "completed") return t("viewingStatuses.completed");
    if (status === "suggested") return t("viewingStatuses.suggested");

    return t("viewingStatuses.pending");
  }

  function getViewingGuidance(viewing: Viewing) {
    if (viewing.viewing_type === "video_call") {
      return t("videoCallGuidance");
    }

    if (viewing.viewing_type === "video_tour") {
      return t("videoTourGuidance");
    }

    return t("inPersonGuidance");
  }

  async function markMessagesAsRead(currentUserId: string) {
    if (!inquiryId) return;

    await supabase
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .eq("inquiry_id", inquiryId)
      .eq("receiver_id", currentUserId)
      .is("read_at", null);
  }

  async function loadMessagesOnly(currentUserId: string) {
    if (!inquiryId) return;

    await markMessagesAsRead(currentUserId);

    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("inquiry_id", inquiryId)
      .order("created_at", { ascending: true });

    setMessages((data || []) as Message[]);
  }

  async function loadLatestViewing(currentInquiryId: string) {
    const { data, error } = await supabase
      .from("viewings")
      .select(
        "id, inquiry_id, listing_id, owner_id, requester_id, requested_date, requested_time, note, status, viewing_type, owner_suggested_date, owner_suggested_time, owner_suggested_message"
      )
      .eq("inquiry_id", currentInquiryId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("LOAD LATEST VIEWING ERROR:", error);
      setLatestViewing(null);
      return;
    }

    setLatestViewing((data as Viewing) || null);
  }

  async function loadProfilesAndCovers(items: Inquiry[]) {
    const profileIds = Array.from(
      new Set(items.flatMap((x) => [x.owner_id, x.requester_id]).filter(Boolean))
    );

    const listingIds = Array.from(
      new Set(items.map((x) => x.listing_id).filter(Boolean))
    );

    if (profileIds.length > 0) {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", profileIds);

      const profileMap: Record<string, Profile> = {};

      (data || []).forEach((profile: Profile) => {
        profileMap[profile.id] = profile;
      });

      setProfiles(profileMap);
    }

    if (listingIds.length > 0) {
      const { data } = await supabase
        .from("listing_images")
        .select("listing_id, image_url, is_cover, sort_order")
        .in("listing_id", listingIds)
        .order("is_cover", { ascending: false })
        .order("sort_order", { ascending: true });

      const coverMap: Record<string, string> = {};

      ((data || []) as ListingImageRow[]).forEach((image) => {
        if (!image.listing_id) return;

        if (!coverMap[image.listing_id] && image.image_url) {
          coverMap[image.listing_id] = image.image_url;
        }
      });

      setListingCovers(coverMap);
    }
  }

  async function loadConversations(currentUserId: string) {
    const { data } = await supabase
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
      .or(`owner_id.eq.${currentUserId},requester_id.eq.${currentUserId}`)
      .eq("status", "accepted")
      .order("created_at", { ascending: false });

    const list = (data || []) as unknown as Inquiry[];
    setConversations(list);

    return list;
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
      setError(t("restrictedError"));
      setLoading(false);
      return;
    }

    const conversationList = await loadConversations(user.id);

    const { data: inquiryData, error: inquiryError } = await supabase
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
      .eq("id", inquiryId)
      .single();

    if (inquiryError || !inquiryData) {
      setError(t("inquiryNotFound"));
      setLoading(false);
      return;
    }

    const normalizedInquiry = inquiryData as unknown as Inquiry;

    if (normalizedInquiry.status !== "accepted") {
      setError(t("chatUnavailableAccepted"));
      setLoading(false);
      return;
    }

    const isParticipant =
      normalizedInquiry.owner_id === user.id ||
      normalizedInquiry.requester_id === user.id;

    if (!isParticipant) {
      setError(t("permissionError"));
      setLoading(false);
      return;
    }

    setInquiry(normalizedInquiry);

    await loadProfilesAndCovers([normalizedInquiry, ...conversationList]);
    await loadLatestViewing(normalizedInquiry.id);
    await loadMessagesOnly(user.id);

    setLoading(false);
  }

  async function sendMessageEmail(messageId: string) {
    try {
      const response = await fetch("/api/emails/new-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        console.error("NEW MESSAGE EMAIL API ERROR:", data);
      }
    } catch (error) {
      console.error("NEW MESSAGE EMAIL FETCH ERROR:", error);
    }
  }

  async function sendMessage(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const cleanBody = body.trim();

    if (!cleanBody || !inquiry || !userId || !receiverId) return;

    setSending(true);
    setError("");

    const { data: insertedMessage, error: sendError } = await supabase
      .from("messages")
      .insert({
        inquiry_id: inquiry.id,
        listing_id: inquiry.listing_id,
        sender_id: userId,
        receiver_id: receiverId,
        body: cleanBody,
      })
      .select("id")
      .single();

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
      body: "You received a new message.",
      message: "You received a new message.",
      link: `/messages/${inquiry.id}`,
    });

    if (insertedMessage?.id) {
      await sendMessageEmail(insertedMessage.id);
    }

    setBody("");
    await loadMessagesOnly(userId);
    setSending(false);
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
          await loadMessagesOnly(userId);
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

  if (loading) {
    return (
      <main className="min-h-screen bg-black px-6 py-10 text-white">
        {t("loading")}
      </main>
    );
  }

  if (isBanned || error) {
    return (
      <main className="min-h-screen bg-black px-6 py-10 text-white">
        <div className="mx-auto max-w-2xl rounded-3xl border border-red-800 bg-red-950/40 p-6">
          <h1 className="text-2xl font-bold text-red-300">{t("chatUnavailable")}</h1>
          <p className="mt-3 text-red-200">{error}</p>

          <Link
            href="/messages"
            className="mt-5 inline-flex rounded-xl bg-white px-5 py-3 font-semibold text-black"
          >
            {t("backToMessages")}
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100vh-80px)] bg-black text-white">
      <div className="grid min-h-[calc(100vh-80px)] grid-cols-1 border-t border-white/10 lg:grid-cols-[380px_1fr_360px]">
        <aside className="hidden border-r border-white/10 bg-[#060606] lg:block">
          <div className="border-b border-white/10 p-5">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-black">{t("messages")}</h1>

              <Link
                href="/messages"
                className="rounded-full border border-white/10 p-3 text-zinc-300 hover:bg-white/10"
              >
                <ArrowLeft size={18} />
              </Link>
            </div>

            <p className="mt-2 text-sm text-zinc-500">
              {t("acceptedConversations")}
            </p>
          </div>

          <div className="max-h-[calc(100vh-170px)] overflow-y-auto p-3">
            {conversations.map((item) => {
              const active = item.id === inquiryId;
              const otherId =
                userId === item.owner_id ? item.requester_id : item.owner_id;
              const profile = profiles[otherId];

              return (
                <Link
                  key={item.id}
                  href={`/messages/${item.id}`}
                  className={`mb-3 block rounded-3xl border p-4 transition ${
                    active
                      ? "border-white bg-white text-black"
                      : "border-white/10 bg-white/[0.04] hover:bg-white/[0.08]"
                  }`}
                >
                  <div className="flex gap-4">
                    {renderConversationMedia(item, profile)}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="line-clamp-1 font-black">
                          {profile?.full_name || t("travelMarketsUser")}
                        </p>

                        <span
                          className={`text-[11px] ${
                            active ? "text-zinc-600" : "text-zinc-500"
                          }`}
                        >
                          {t("chat")}
                        </span>
                      </div>

                      <p
                        className={`mt-1 line-clamp-1 text-sm font-medium ${
                          active ? "text-zinc-700" : "text-zinc-400"
                        }`}
                      >
                        {item.listings?.title || t("housingChat")}
                      </p>

                      <p
                        className={`mt-2 text-xs font-bold ${
                          active ? "text-zinc-600" : "text-emerald-400"
                        }`}
                      >
                        {item.listings?.city || t("cityHidden")}
                        {item.listings?.campus
                          ? ` • ${item.listings.campus}`
                          : ""}
                      </p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </aside>

        <section className="flex min-h-[calc(100vh-80px)] flex-col bg-[#050505]">
          <div className="flex items-center justify-between border-b border-white/10 bg-black px-4 py-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <Link
                href="/messages"
                className="rounded-full border border-white/10 p-2 text-zinc-300 hover:bg-white/10 lg:hidden"
              >
                <ArrowLeft size={18} />
              </Link>

              {renderAvatar(otherProfile, "h-11 w-11")}

              <div className="min-w-0">
                <h2 className="line-clamp-1 font-black">
                  {otherProfile?.full_name || t("travelMarketsUser")}
                </h2>

                <p className="text-xs text-zinc-500">
                  {inquiry?.listings?.title || t("housingConversation")}
                </p>
              </div>
            </div>

            <Link
              href={`/listings/${inquiry?.listing_id}`}
              className="rounded-xl border border-white/10 px-4 py-2 text-sm text-zinc-300 hover:bg-white/10"
            >
              {t("listing")}
            </Link>
          </div>

          {latestViewing && (
            <div className="border-b border-white/10 bg-[#060606] px-4 py-4 sm:px-6 xl:hidden">
              <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-bold text-white">
                    {t("viewingRequest")}
                  </p>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-zinc-300">
                    {getViewingStatusLabel(latestViewing.status)}
                  </span>
                </div>

                <p className="mt-3 text-sm text-zinc-300">
                  {getViewingTypeLabel(latestViewing)}
                </p>

                {latestViewing.viewing_type !== "video_tour" && (
                  <p className="mt-2 text-sm text-zinc-500">
                    {latestViewing.requested_date || t("dateUnavailable")}
                    {latestViewing.requested_time
                      ? ` • ${latestViewing.requested_time.slice(0, 5)}`
                      : ""}
                  </p>
                )}

                {latestViewing.note && (
                  <p className="mt-3 text-sm leading-6 text-zinc-400">
                    {latestViewing.note}
                  </p>
                )}

                {latestViewing.status === "suggested" && (
                  <div className="mt-3 rounded-xl border border-purple-500/20 bg-purple-500/10 p-3 text-sm text-purple-100/80">
                    <p className="font-semibold text-purple-300">
                      {t("suggestedTime")}
                    </p>
                    <p className="mt-1">
                      {latestViewing.owner_suggested_date ||
                        t("dateUnavailable")}
                      {latestViewing.owner_suggested_time
                        ? ` • ${latestViewing.owner_suggested_time.slice(0, 5)}`
                        : ""}
                    </p>
                    {latestViewing.owner_suggested_message && (
                      <p className="mt-2">
                        {latestViewing.owner_suggested_message}
                      </p>
                    )}
                  </div>
                )}

                {(latestViewing.status === "pending" ||
                  latestViewing.status === "accepted") && (
                  <p className="mt-3 text-sm leading-6 text-blue-200/80">
                    {getViewingGuidance(latestViewing)}
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center text-zinc-500">
                <MessageCircle size={42} className="mb-4 opacity-50" />

                <p className="text-lg font-bold text-zinc-300">
                  {t("noMessages")}
                </p>

                <p className="mt-2 max-w-sm text-sm">
                  {t("safeConversation")}
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                {messages.map((msg) => {
                  const isMine = msg.sender_id === userId;

                  return (
                    <div
                      key={msg.id}
                      className={`flex ${
                        isMine ? "justify-end" : "justify-start"
                      }`}
                    >
                      <div className="flex max-w-[82%] gap-3 sm:max-w-[70%]">
                        {!isMine &&
                          renderAvatar(profiles[msg.sender_id], "h-9 w-9")}

                        <div
                          className={`rounded-[28px] px-5 py-3 text-sm shadow-xl ${
                            isMine
                              ? "rounded-br-md bg-white text-black"
                              : "rounded-bl-md bg-zinc-900 text-white"
                          }`}
                        >
                          <p className="whitespace-pre-wrap break-words leading-6">
                            {msg.body}
                          </p>

                          <div
                            className={`mt-2 flex justify-end gap-2 text-[11px] ${
                              isMine ? "text-zinc-600" : "text-zinc-500"
                            }`}
                          >
                            <span>
                              {new Date(msg.created_at).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>

                            {isMine && (
                              <span>{msg.read_at ? t("read") : t("sent")}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}

                <div ref={bottomRef} />
              </div>
            )}
          </div>

          <form
            onSubmit={sendMessage}
            className="border-t border-white/10 bg-black p-4"
          >
            <div className="flex items-end gap-3 rounded-3xl border border-white/10 bg-white/[0.04] p-3">
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder={t("writeMessage")}
                rows={1}
                className="max-h-32 min-h-[44px] flex-1 resize-none bg-transparent px-3 py-3 text-white outline-none placeholder:text-zinc-600"
              />

              <button
                type="submit"
                disabled={sending || body.trim().length === 0}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-black transition hover:bg-zinc-200 disabled:opacity-40"
              >
                {sending ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <SendHorizonal size={18} />
                )}
              </button>
            </div>
          </form>
        </section>

        <aside className="hidden border-l border-white/10 bg-[#060606] p-5 xl:block">
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-zinc-500">
              {t("listing")}
            </p>

            <div className="mt-5 h-44 overflow-hidden rounded-3xl bg-gradient-to-br from-zinc-800 to-black">
              {listingCover ? (
                <img
                  src={listingCover}
                  alt={inquiry?.listings?.title || t("listingAlt")}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <Building2 size={46} className="text-zinc-500" />
                </div>
              )}
            </div>

            <h2 className="mt-5 text-2xl font-black">
              {inquiry?.listings?.title || t("housingListing")}
            </h2>

            <p className="mt-2 text-zinc-400">
              {inquiry?.listings?.city || t("cityHidden")}
              {inquiry?.listings?.campus
                ? ` • ${inquiry.listings.campus}`
                : ""}
            </p>

            <p className="mt-4 text-3xl font-black">
              ${inquiry?.listings?.price || 0}
              <span className="text-sm font-normal text-zinc-500">
                {" "}
                {t("perMonth")}
              </span>
            </p>

            <div className="mt-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-300">
              {t("acceptedInquiryNotice")}
            </div>

            {latestViewing && (
              <div className="mt-5 rounded-2xl border border-white/10 bg-black/40 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-bold text-white">
                    {t("viewingRequest")}
                  </p>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-zinc-300">
                    {getViewingStatusLabel(latestViewing.status)}
                  </span>
                </div>

                <p className="mt-3 text-sm text-zinc-300">
                  {getViewingTypeLabel(latestViewing)}
                </p>

                {latestViewing.viewing_type !== "video_tour" && (
                  <p className="mt-2 text-sm text-zinc-500">
                    {latestViewing.requested_date || t("dateUnavailable")}
                    {latestViewing.requested_time
                      ? ` • ${latestViewing.requested_time.slice(0, 5)}`
                      : ""}
                  </p>
                )}

                {latestViewing.note && (
                  <p className="mt-3 text-sm leading-6 text-zinc-400">
                    {latestViewing.note}
                  </p>
                )}

                {latestViewing.status === "suggested" && (
                  <div className="mt-3 rounded-xl border border-purple-500/20 bg-purple-500/10 p-3 text-sm text-purple-100/80">
                    <p className="font-semibold text-purple-300">
                      {t("suggestedTime")}
                    </p>
                    <p className="mt-1">
                      {latestViewing.owner_suggested_date ||
                        t("dateUnavailable")}
                      {latestViewing.owner_suggested_time
                        ? ` • ${latestViewing.owner_suggested_time.slice(0, 5)}`
                        : ""}
                    </p>
                    {latestViewing.owner_suggested_message && (
                      <p className="mt-2">
                        {latestViewing.owner_suggested_message}
                      </p>
                    )}
                  </div>
                )}

                {(latestViewing.status === "pending" ||
                  latestViewing.status === "accepted") && (
                  <p className="mt-3 text-sm leading-6 text-blue-200/80">
                    {getViewingGuidance(latestViewing)}
                  </p>
                )}
              </div>
            )}

            <div className="mt-5 border-t border-white/10 pt-5">
              <p className="text-sm font-bold text-zinc-400">{t("owner")}</p>

              <div className="mt-3 flex items-center gap-3">
                {renderAvatar(ownerProfile, "h-12 w-12")}

                <div>
                  <p className="font-bold">
                    {ownerProfile?.full_name || t("propertyOwner")}
                  </p>

                  <p className="text-sm text-zinc-500">{t("verifiedContact")}</p>
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-3">
              <Link
                href={`/listings/${inquiry?.listing_id}`}
                className="rounded-2xl bg-white px-5 py-3 text-center font-bold text-black hover:bg-zinc-200"
              >
                {t("viewListing")}
              </Link>

              {isRequester && inquiry && (
                <Link
                  href={`/viewings/request/${inquiry.id}`}
                  className="rounded-2xl border border-white/10 px-5 py-3 text-center font-bold text-white hover:bg-white/10"
                >
                  {t("requestViewing")}
                </Link>
              )}

              {isOwner && (
                <Link
                  href="/viewings"
                  className="rounded-2xl border border-white/10 px-5 py-3 text-center font-bold text-white hover:bg-white/10"
                >
                  {t("manageViewings")}
                </Link>
              )}
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
