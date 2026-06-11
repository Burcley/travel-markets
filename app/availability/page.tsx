"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Plus,
  Trash2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Listing = {
  id: string;
  title: string;
};

type Slot = {
  id: string;
  listing_id: string;
  slot_date: string;
  start_time: string;
  end_time: string;
  is_booked: boolean;
};

function formatLocalDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export default function AvailabilityPage() {
  const supabase = createClient();

  const [listings, setListings] = useState<Listing[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedListing, setSelectedListing] = useState("");
  const [selectedDate, setSelectedDate] = useState(formatLocalDate(new Date()));

  const [startTime, setStartTime] = useState("10:00");
  const [endTime, setEndTime] = useState("10:30");

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadData() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/auth";
      return;
    }

    const { data: listingsData } = await supabase
      .from("listings")
      .select("id, title")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    const { data: slotsData } = await supabase
      .from("viewing_slots")
      .select("*")
      .eq("owner_id", user.id)
      .order("slot_date", { ascending: true })
      .order("start_time", { ascending: true });

    const ownerListings = (listingsData || []) as Listing[];

    setListings(ownerListings);
    setSlots((slotsData || []) as Slot[]);

    if (ownerListings.length > 0) {
      setSelectedListing((current) => current || ownerListings[0].id);
    }

    setLoading(false);
  }

  async function createSlot() {
    if (!selectedListing) {
      alert("Select a listing first.");
      return;
    }

    if (!selectedDate || !startTime || !endTime) {
      alert("Fill all fields.");
      return;
    }

    if (endTime <= startTime) {
      alert("End time must be after start time.");
      return;
    }

    setSaving(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setSaving(false);
      window.location.href = "/auth";
      return;
    }

    const { error } = await supabase.from("viewing_slots").insert({
      listing_id: selectedListing,
      owner_id: user.id,
      slot_date: selectedDate,
      start_time: startTime,
      end_time: endTime,
      is_booked: false,
    });

    setSaving(false);

    if (error) {
      alert(error.message);
      return;
    }

    await loadData();
  }

  async function deleteSlot(slot: Slot) {
    if (slot.is_booked) {
      alert("Booked slots cannot be deleted.");
      return;
    }

    const confirmed = confirm("Delete this slot?");
    if (!confirmed) return;

    const { error } = await supabase
      .from("viewing_slots")
      .delete()
      .eq("id", slot.id);

    if (error) {
      alert(error.message);
      return;
    }

    await loadData();
  }

  const daysInMonth = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    const firstDay = new Date(year, month, 1).getDay();
    const lastDay = new Date(year, month + 1, 0).getDate();

    const blanks = Array.from({ length: firstDay }, (_, index) => ({
      key: `blank-${index}`,
      date: "",
      dayNumber: null as number | null,
    }));

    const days = Array.from({ length: lastDay }, (_, index) => {
      const day = index + 1;
      const date = formatLocalDate(new Date(year, month, day));

      return {
        key: date,
        date,
        dayNumber: day,
      };
    });

    return [...blanks, ...days];
  }, [currentMonth]);

  const slotsForSelectedDate = slots.filter(
    (slot) => slot.slot_date === selectedDate
  );

  function previousMonth() {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1)
    );
  }

  function nextMonth() {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1)
    );
  }

  function getSlotCount(date: string) {
    const daySlots = slots.filter((slot) => slot.slot_date === date);

    return {
      available: daySlots.filter((slot) => !slot.is_booked).length,
      booked: daySlots.filter((slot) => slot.is_booked).length,
    };
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black px-6 py-10 text-white">
        Loading calendar...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-6 py-10 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="mb-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              Availability Calendar
            </h1>

            <p className="mt-3 text-base text-zinc-400 sm:text-lg">
              Manage your viewing schedule with a calendar-style booking system.
            </p>
          </div>

          <Link
            href="/viewings"
            className="w-fit rounded-2xl border border-zinc-700 px-6 py-4 font-semibold transition hover:bg-zinc-900"
          >
            View Bookings
          </Link>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1.7fr_0.8fr]">
          <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6">
            <div className="mb-8 flex items-center justify-between">
              <button
                type="button"
                onClick={previousMonth}
                className="rounded-2xl border border-zinc-800 p-4 transition hover:bg-zinc-900"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>

              <div className="text-center">
                <h2 className="text-3xl font-bold sm:text-4xl">
                  {currentMonth.toLocaleString("default", {
                    month: "long",
                    year: "numeric",
                  })}
                </h2>

                <p className="mt-2 text-zinc-500">
                  Click a date to manage slots
                </p>
              </div>

              <button
                type="button"
                onClick={nextMonth}
                className="rounded-2xl border border-zinc-800 p-4 transition hover:bg-zinc-900"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-6 grid grid-cols-7 gap-4 text-center text-sm font-semibold text-zinc-500">
              <div>SUN</div>
              <div>MON</div>
              <div>TUE</div>
              <div>WED</div>
              <div>THU</div>
              <div>FRI</div>
              <div>SAT</div>
            </div>

            <div className="grid grid-cols-7 gap-4">
              {daysInMonth.map((day) => {
                if (!day.dayNumber) {
                  return <div key={day.key} className="min-h-[120px]" />;
                }

                const isSelected = selectedDate === day.date;
                const count = getSlotCount(day.date);

                return (
                  <button
                    type="button"
                    key={day.key}
                    onClick={() => setSelectedDate(day.date)}
                    className={`min-h-[120px] rounded-3xl border p-4 text-left transition ${
                      isSelected
                        ? "border-white bg-white text-black"
                        : "border-zinc-800 bg-black hover:bg-zinc-900"
                    }`}
                  >
                    <div className="flex h-full flex-col justify-between">
                      <span className="text-xl font-bold">{day.dayNumber}</span>

                      <div className="space-y-2">
                        {count.available > 0 && (
                          <div
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${
                              isSelected
                                ? "bg-black text-white"
                                : "bg-emerald-500/20 text-emerald-400"
                            }`}
                          >
                            {count.available} available
                          </div>
                        )}

                        {count.booked > 0 && (
                          <div
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${
                              isSelected
                                ? "bg-blue-200 text-blue-900"
                                : "bg-blue-500/20 text-blue-300"
                            }`}
                          >
                            {count.booked} booked
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6">
              <div className="mb-6 flex items-center gap-3">
                <div className="rounded-2xl bg-zinc-900 p-3">
                  <Calendar className="h-6 w-6" />
                </div>

                <div>
                  <h3 className="text-3xl font-bold">Selected Date</h3>
                  <p className="text-zinc-400">{selectedDate}</p>
                </div>
              </div>

              <div className="space-y-4">
                <select
                  value={selectedListing}
                  onChange={(e) => setSelectedListing(e.target.value)}
                  className="w-full rounded-2xl border border-zinc-800 bg-black px-4 py-4 outline-none"
                >
                  {listings.length === 0 ? (
                    <option value="">No listings found</option>
                  ) : (
                    listings.map((listing) => (
                      <option key={listing.id} value={listing.id}>
                        {listing.title}
                      </option>
                    ))
                  )}
                </select>

                <div className="grid grid-cols-2 gap-4">
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="rounded-2xl border border-zinc-800 bg-black px-4 py-4 outline-none"
                  />

                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="rounded-2xl border border-zinc-800 bg-black px-4 py-4 outline-none"
                  />
                </div>

                <button
                  type="button"
                  onClick={createSlot}
                  disabled={saving || listings.length === 0}
                  className="flex w-full items-center justify-center gap-3 rounded-2xl bg-white px-6 py-5 text-lg font-bold text-black transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Plus className="h-5 w-5" />
                  {saving ? "Adding..." : "Add Slot"}
                </button>
              </div>
            </div>

            <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6">
              <h3 className="mb-5 text-3xl font-bold">Slots on this date</h3>

              {slotsForSelectedDate.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-zinc-800 p-10 text-center text-zinc-500">
                  No slots for this date.
                </div>
              ) : (
                <div className="space-y-4">
                  {slotsForSelectedDate.map((slot) => (
                    <div
                      key={slot.id}
                      className="rounded-2xl border border-zinc-800 bg-black p-5"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2 text-lg font-semibold">
                            <Clock className="h-5 w-5" />
                            {slot.start_time.slice(0, 5)} -{" "}
                            {slot.end_time.slice(0, 5)}
                          </div>

                          <p className="mt-2 text-sm text-zinc-400">
                            {slot.is_booked
                              ? "Booked by student"
                              : "Available"}
                          </p>
                        </div>

                        {!slot.is_booked && (
                          <button
                            type="button"
                            onClick={() => deleteSlot(slot)}
                            className="rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-red-400 transition hover:bg-red-500/20"
                          >
                            <Trash2 className="h-5 w-5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}