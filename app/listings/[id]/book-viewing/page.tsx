"use client";

import { useEffect, useState } from "react";
import { Calendar, Clock, Send } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
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

export default function BookViewingPage() {
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

  async function requestViewing() {
    if (!selectedSlot) {
      alert("Choose an available time slot.");
      return;
    }

    setRequesting(true);

    const { error } = await supabase.rpc("request_viewing_slot", {
      p_slot_id: selectedSlot,
      p_message: message || null,
    });

    setRequesting(false);

    if (error) {
      alert(error.message);
      await loadBookingData();
      return;
    }

    alert("Viewing request sent.");
    router.push("/viewings");
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center">
        Loading booking calendar...
      </main>
    );
  }

  if (!listing) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center">
        Listing not found.
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-4 py-8 text-white">
      <div className="mx-auto max-w-4xl space-y-6">
        <section className="rounded-3xl border border-white/10 bg-zinc-950 p-6 shadow-2xl">
          <div className="mb-6">
            <h1 className="text-2xl font-bold">Book a Viewing</h1>
            <p className="mt-1 text-zinc-400">{listing.title}</p>
          </div>

          {slots.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 p-6 text-zinc-400">
              No available viewing times right now.
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
                placeholder="Optional message to the owner..."
                className="min-h-32 w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none placeholder:text-zinc-600"
              />

              <button
                onClick={requestViewing}
                disabled={requesting}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 font-semibold text-black transition hover:bg-zinc-200 disabled:opacity-50"
              >
                <Send className="h-5 w-5" />
                {requesting ? "Sending..." : "Request Viewing"}
              </button>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}