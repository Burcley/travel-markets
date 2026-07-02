"use client";

import { useEffect, useState } from "react";
import { Calendar, Clock, Send } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";

type Slot = {
  id: string;
  slot_date: string;
  start_time: string;
  end_time: string;
};

type Listing = {
  id: string;
  title: string;
  user_id: string;
};

type ViewingRow = {
  id: string;
  listing_id: string;
  owner_id: string;
  requester_id: string;
  slot_id: string | null;
  status: string;
};

export default function BookViewingPage() {
  const t = useTranslations("listingManagement.bookViewing");
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();

  const [listing, setListing] = useState<Listing | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    loadBookingData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function loadBookingData() {
    setLoading(true);

    const { data: listingData, error: listingError } = await supabase
      .from("listings")
      .select("id,title,user_id")
      .eq("id", id)
      .maybeSingle();

    if (listingError) {
      alert(listingError.message);
      setLoading(false);
      return;
    }

    const { data: slotData, error: slotError } = await supabase
      .from("viewing_slots")
      .select("id,slot_date,start_time,end_time")
      .eq("listing_id", id)
      .eq("is_booked", false)
      .gte("slot_date", new Date().toISOString().split("T")[0])
      .order("slot_date", { ascending: true })
      .order("start_time", { ascending: true });

    if (slotError) {
      alert(slotError.message);
    }

    setListing(listingData);
    setSlots(slotData || []);
    setLoading(false);
  }

  async function sendViewingRequestedEmail(viewingId: string) {
    try {
      const response = await fetch("/api/emails/viewing-requested", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ viewingId }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        console.error("VIEWING REQUEST EMAIL API ERROR:", data);
      } else {
        console.log("VIEWING REQUEST EMAIL SENT:", data);
      }
    } catch (error) {
      console.error("VIEWING REQUEST EMAIL FETCH ERROR:", error);
    }
  }

  async function findLatestViewingForSlot(slotId: string) {
    const { data, error } = await supabase
      .from("viewings")
      .select("id, listing_id, owner_id, requester_id, slot_id, status")
      .eq("slot_id", slotId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("FIND LATEST VIEWING ERROR:", error);
      return null;
    }

    return data as ViewingRow | null;
  }

  async function requestViewing() {
    if (!selectedSlot) {
      alert(t("chooseSlot"));
      return;
    }

    setRequesting(true);

    const { error } = await supabase.rpc("request_viewing_slot", {
      p_slot_id: selectedSlot,
      p_message: message || null,
    });

    if (error) {
      setRequesting(false);
      alert(error.message);
      await loadBookingData();
      return;
    }

    const latestViewing = await findLatestViewingForSlot(selectedSlot);

    if (latestViewing?.id) {
      await sendViewingRequestedEmail(latestViewing.id);
    } else {
      console.error("NO VIEWING FOUND AFTER RPC FOR SLOT:", selectedSlot);
    }

    setRequesting(false);

    alert(t("requestSent"));
    router.push("/viewings");
    router.refresh();
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black text-white">
        {t("loading")}
      </main>
    );
  }

  if (!listing) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black text-white">
        {t("notFound")}
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-4 py-8 text-white">
      <div className="mx-auto max-w-4xl space-y-6">
        <section className="rounded-3xl border border-white/10 bg-zinc-950 p-6 shadow-2xl">
          <div className="mb-6">
            <h1 className="text-2xl font-bold">{t("title")}</h1>
            <p className="mt-1 text-zinc-400">{listing.title}</p>
          </div>

          {slots.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 p-6 text-zinc-400">
              {t("noTimes")}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {slots.map((slot) => {
                const active = selectedSlot === slot.id;

                return (
                  <button
                    key={slot.id}
                    onClick={() => setSelectedSlot(slot.id)}
                    className={`rounded-2xl border p-5 text-left transition ${
                      active
                        ? "border-white bg-white text-black"
                        : "border-white/10 bg-black hover:border-white/30"
                    }`}
                  >
                    <div className="flex items-center gap-2 font-semibold">
                      <Calendar className="h-4 w-4" />
                      {slot.slot_date}
                    </div>

                    <div
                      className={`mt-3 flex items-center gap-2 text-sm ${
                        active ? "text-zinc-700" : "text-zinc-400"
                      }`}
                    >
                      <Clock className="h-4 w-4" />
                      {slot.start_time.slice(0, 5)} -{" "}
                      {slot.end_time.slice(0, 5)}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {slots.length > 0 && (
            <div className="mt-6 space-y-4">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t("messagePlaceholder")}
                className="min-h-32 w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none placeholder:text-zinc-600"
              />

              <button
                onClick={requestViewing}
                disabled={requesting}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 font-semibold text-black transition hover:bg-zinc-200 disabled:opacity-50"
              >
                <Send className="h-5 w-5" />
                {requesting ? t("sending") : t("requestViewing")}
              </button>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
