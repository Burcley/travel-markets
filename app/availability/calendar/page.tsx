"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Home,
  Plus,
  Trash2,
  CheckCircle2,
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
  listings?: { title: string } | null;
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function localToday() {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function buildDate(year: number, monthIndex: number, day: number) {
  return `${year}-${pad(monthIndex + 1)}-${pad(day)}`;
}

export default function AvailabilityCalendarPage() {
  const t = useTranslations("finalBatchD.availabilityCalendar");
  const supabase = createClient();
  const today = localToday();

  const now = new Date();

  const [calendarYear, setCalendarYear] = useState(now.getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState(today);

  const [userId, setUserId] = useState("");
  const [listings, setListings] = useState<Listing[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [listingId, setListingId] = useState("");
  const [startTime, setStartTime] = useState("10:00");
  const [endTime, setEndTime] = useState("10:30");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
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

    setUserId(user.id);

    const { data: ownerListings } = await supabase
      .from("listings")
      .select("id,title")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    const { data: ownerSlots } = await supabase
      .from("viewing_slots")
      .select("id,listing_id,slot_date,start_time,end_time,is_booked,listings(title)")
      .eq("owner_id", user.id)
      .order("slot_date", { ascending: true })
      .order("start_time", { ascending: true });

    setListings(ownerListings || []);
    setSlots((ownerSlots || []) as unknown as Slot[]);

    if (ownerListings && ownerListings.length > 0) {
      setListingId(ownerListings[0].id);
    }

    setLoading(false);
  }

  async function addSlot() {
    if (!userId || !listingId || !selectedDate || !startTime || !endTime) {
      alert(t("fillAllFields"));
      return;
    }

    if (selectedDate < today) {
      alert(t("pastSlotError"));
      return;
    }

    if (endTime <= startTime) {
      alert(t("endTimeError"));
      return;
    }

    setSaving(true);

    const { error } = await supabase.from("viewing_slots").insert({
      listing_id: listingId,
      owner_id: userId,
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
      alert(t("bookedDeleteError"));
      return;
    }

    if (!confirm(t("deleteConfirm"))) return;

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

  const monthLabel = new Date(calendarYear, calendarMonth, 1).toLocaleDateString(
    "en-CA",
    {
      month: "long",
      year: "numeric",
    }
  );

  const calendarDays = useMemo(() => {
    const firstDay = new Date(calendarYear, calendarMonth, 1).getDay();
    const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();

    const days: Array<{ date: string; day: number } | null> = [];

    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      days.push({
        day,
        date: buildDate(calendarYear, calendarMonth, day),
      });
    }

    return days;
  }, [calendarYear, calendarMonth]);

  const selectedSlots = slots.filter((slot) => slot.slot_date === selectedDate);

  function getSlotsForDate(date: string) {
    return slots.filter((slot) => slot.slot_date === date);
  }

  function goPreviousMonth() {
    if (calendarMonth === 0) {
      setCalendarYear(calendarYear - 1);
      setCalendarMonth(11);
    } else {
      setCalendarMonth(calendarMonth - 1);
    }
  }

  function goNextMonth() {
    if (calendarMonth === 11) {
      setCalendarYear(calendarYear + 1);
      setCalendarMonth(0);
    } else {
      setCalendarMonth(calendarMonth + 1);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black px-6 py-10 text-white">
        {t("loading")}
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-4 py-8 text-white">
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">
              {t("title")}
            </h1>
            <p className="mt-2 text-zinc-400">
              {t("subtitle")}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/availability"
              className="rounded-2xl border border-zinc-700 px-5 py-3 text-sm font-semibold hover:bg-white/10"
            >
              {t("classicView")}
            </Link>

            <Link
              href="/viewings"
              className="rounded-2xl border border-zinc-700 px-5 py-3 text-sm font-semibold hover:bg-white/10"
            >
              {t("viewBookings")}
            </Link>
          </div>
        </div>

        <section className="grid gap-6 lg:grid-cols-[1fr_420px]">
          <div className="rounded-3xl border border-white/10 bg-zinc-950 p-6 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <button
                onClick={goPreviousMonth}
                className="rounded-2xl border border-white/10 bg-black p-3 hover:bg-white/10"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>

              <div className="text-center">
                <h2 className="text-2xl font-bold">{monthLabel}</h2>
                <p className="text-sm text-zinc-500">
                  {t("clickDate")}
                </p>
              </div>

              <button
                onClick={goNextMonth}
                className="rounded-2xl border border-white/10 bg-black p-3 hover:bg-white/10"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500">
              {[
                t("weekdays.sun"),
                t("weekdays.mon"),
                t("weekdays.tue"),
                t("weekdays.wed"),
                t("weekdays.thu"),
                t("weekdays.fri"),
                t("weekdays.sat"),
              ].map((day) => (
                <div key={day} className="py-2">
                  {day}
                </div>
              ))}
            </div>

            <div className="mt-2 grid grid-cols-7 gap-2">
              {calendarDays.map((item, index) => {
                if (!item) {
                  return <div key={`empty-${index}`} className="h-28" />;
                }

                const daySlots = getSlotsForDate(item.date);
                const booked = daySlots.filter((slot) => slot.is_booked).length;
                const available = daySlots.filter((slot) => !slot.is_booked).length;
                const isSelected = selectedDate === item.date;
                const isPast = item.date < today;

                return (
                  <button
                    key={item.date}
                    onClick={() => setSelectedDate(item.date)}
                    className={`h-28 rounded-2xl border p-3 text-left transition ${
                      isSelected
                        ? "border-white bg-white text-black"
                        : isPast
                        ? "border-white/5 bg-zinc-950 text-zinc-600"
                        : "border-white/10 bg-black hover:border-white/30"
                    }`}
                  >
                    <div className="font-bold">{item.day}</div>

                    <div className="mt-3 space-y-1">
                      {available > 0 && (
                        <p
                          className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                            isSelected
                              ? "bg-emerald-200 text-emerald-900"
                              : "bg-emerald-500/10 text-emerald-300"
                          }`}
                        >
                          {t("availableCount", { count: available })}
                        </p>
                      )}

                      {booked > 0 && (
                        <p
                          className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                            isSelected
                              ? "bg-blue-200 text-blue-900"
                              : "bg-blue-500/10 text-blue-300"
                          }`}
                        >
                          {t("bookedCount", { count: booked })}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <aside className="space-y-6">
            <div className="rounded-3xl border border-white/10 bg-zinc-950 p-6 shadow-2xl">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-white/10 p-3">
                  <CalendarDays className="h-5 w-5" />
                </div>

                <div>
                  <h2 className="text-xl font-bold">{t("selectedDate")}</h2>
                  <p className="text-sm text-zinc-400">{selectedDate}</p>
                </div>
              </div>

              <div className="mt-6 space-y-4">
                <select
                  value={listingId}
                  onChange={(e) => setListingId(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 outline-none"
                >
                  {listings.length === 0 ? (
                    <option value="">{t("noListings")}</option>
                  ) : (
                    listings.map((listing) => (
                      <option key={listing.id} value={listing.id}>
                        {listing.title}
                      </option>
                    ))
                  )}
                </select>

                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="rounded-2xl border border-white/10 bg-black px-4 py-3 outline-none"
                  />

                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="rounded-2xl border border-white/10 bg-black px-4 py-3 outline-none"
                  />
                </div>

                <button
                  onClick={addSlot}
                  disabled={saving || listings.length === 0}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-5 py-4 font-semibold text-black hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Plus className="h-5 w-5" />
                  {saving ? t("adding") : t("addSlot")}
                </button>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-zinc-950 p-6 shadow-2xl">
              <h2 className="text-xl font-bold">{t("slotsTitle")}</h2>

              {selectedSlots.length === 0 ? (
                <div className="mt-5 rounded-2xl border border-dashed border-white/10 p-6 text-center text-zinc-500">
                  {t("noSlots")}
                </div>
              ) : (
                <div className="mt-5 space-y-3">
                  {selectedSlots.map((slot) => (
                    <div
                      key={slot.id}
                      className="rounded-2xl border border-white/10 bg-black p-4"
                    >
                      <p className="flex items-center gap-2 text-sm text-zinc-400">
                        <Home className="h-4 w-4" />
                        {slot.listings?.title || t("listingFallback")}
                      </p>

                      <p className="mt-3 flex items-center gap-2 font-semibold">
                        <Clock className="h-4 w-4" />
                        {slot.start_time.slice(0, 5)} -{" "}
                        {slot.end_time.slice(0, 5)}
                      </p>

                      <div className="mt-4 flex items-center justify-between gap-3">
                        <span
                          className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
                            slot.is_booked
                              ? "bg-blue-500/10 text-blue-300"
                              : "bg-emerald-500/10 text-emerald-300"
                          }`}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          {slot.is_booked ? t("booked") : t("available")}
                        </span>

                        {!slot.is_booked && (
                          <button
                            onClick={() => deleteSlot(slot)}
                            className="rounded-xl border border-red-500/30 bg-red-500/10 p-2 text-red-300 hover:bg-red-500/20"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
