"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Home,
  Mail,
  MessageCircle,
  CalendarDays,
  PlusCircle,
  User,
  ShieldCheck,
  ArrowRight,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Stats = {
  listings: number;
  inquiries: number;
  chats: number;
  viewings: number;
};

export default function DashboardPage() {
  const supabase = useMemo(() => createClient(), []);

  const [stats, setStats] = useState<Stats>({
    listings: 0,
    inquiries: 0,
    chats: 0,
    viewings: 0,
  });

  const [name, setName] = useState("User");
  const [role, setRole] = useState("student");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/auth";
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, role")
      .eq("id", user.id)
      .maybeSingle();

    setName(profile?.full_name || user.email || "User");
    setRole(profile?.role || "student");

    const { count: listings } = await supabase
      .from("listings")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);

    const { count: inquiries } = await supabase
      .from("inquiries")
      .select("*", { count: "exact", head: true })
      .or(`owner_id.eq.${user.id},requester_id.eq.${user.id}`);

    const { count: chats } = await supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`);

    const { count: viewings } = await supabase
      .from("viewings")
      .select("*", { count: "exact", head: true })
      .or(`owner_id.eq.${user.id},requester_id.eq.${user.id}`);

    setStats({
      listings: listings || 0,
      inquiries: inquiries || 0,
      chats: chats || 0,
      viewings: viewings || 0,
    });

    setLoading(false);
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black text-white">
        <p className="text-zinc-400">Loading dashboard...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-4 py-8 text-white md:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-zinc-900 via-black to-zinc-950 p-6 shadow-2xl md:p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-medium text-blue-400">
                Travel Markets Control Center
              </p>

              <h1 className="mt-3 text-4xl font-bold tracking-tight md:text-6xl">
                Welcome back, {name}
              </h1>

              <p className="mt-4 max-w-2xl text-zinc-400">
                Manage listings, inquiries, messages, viewing appointments, and
                owner activity from one professional workspace.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href="/post"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 font-semibold text-black transition hover:bg-zinc-200"
              >
                <PlusCircle size={18} />
                Post Listing
              </Link>

              <Link
                href="/profile"
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-semibold text-white transition hover:bg-white/10"
              >
                <User size={18} />
                Edit Profile
              </Link>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Total Listings"
            value={stats.listings}
            icon={<Home size={22} />}
            href="/my-listings"
          />

          <StatCard
            title="Total Inquiries"
            value={stats.inquiries}
            icon={<Mail size={22} />}
            href="/inquiries/received"
          />

          <StatCard
            title="Active Chats"
            value={stats.chats}
            icon={<MessageCircle size={22} />}
            href="/messages"
          />

          <StatCard
            title="Viewings"
            value={stats.viewings}
            icon={<CalendarDays size={22} />}
            href="/viewings"
          />
        </section>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
          <div className="rounded-[2rem] border border-white/10 bg-[#080808] p-6 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">Quick Actions</h2>
                <p className="mt-2 text-sm text-zinc-400">
                  Jump into the most important parts of your marketplace.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <ActionCard
                href="/post"
                title="Create Listing"
                description="Post a new room, apartment, or student housing space."
                icon={<PlusCircle size={20} />}
              />

              <ActionCard
                href="/my-listings"
                title="My Listings"
                description="Edit, delete, and manage your posted listings."
                icon={<Home size={20} />}
              />

              <ActionCard
                href="/inquiries/received"
                title="Received Inquiries"
                description="Accept or decline student housing requests."
                icon={<Mail size={20} />}
              />

              <ActionCard
                href="/inquiries/sent"
                title="Sent Inquiries"
                description="Track requests you sent to owners."
                icon={<ArrowRight size={20} />}
              />

              <ActionCard
                href="/viewings"
                title="Manage Viewings"
                description="Approve viewing requests and unlock addresses."
                icon={<CalendarDays size={20} />}
              />

              <ActionCard
                href="/messages"
                title="Messages"
                description="Open chats and continue conversations."
                icon={<MessageCircle size={20} />}
              />
            </div>
          </div>

          <aside className="space-y-6">
            <div className="rounded-[2rem] border border-white/10 bg-[#080808] p-6 shadow-2xl">
              <h2 className="text-2xl font-bold">Account Status</h2>

              <div className="mt-6 space-y-4">
                <InfoBox label="Role" value={role} />
                <InfoBox label="Profile" value="Active" />
                <InfoBox label="Security" value="RLS Protected" />
              </div>
            </div>

            <div className="rounded-[2rem] border border-emerald-500/20 bg-emerald-500/10 p-6">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-1 text-emerald-300" size={24} />
                <div>
                  <h3 className="font-bold text-emerald-300">
                    Secure address flow active
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-emerald-100/80">
                    Exact addresses stay protected until a viewing request is
                    accepted by the owner.
                  </p>
                </div>
              </div>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

function StatCard({
  title,
  value,
  icon,
  href,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-[1.75rem] border border-white/10 bg-[#080808] p-6 shadow-xl transition hover:-translate-y-1 hover:border-blue-500/60 hover:bg-white/[0.03]"
    >
      <div className="flex items-center justify-between">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-blue-300">
          {icon}
        </div>

        <ArrowRight
          size={18}
          className="text-zinc-600 transition group-hover:text-white"
        />
      </div>

      <p className="mt-6 text-sm text-zinc-400">{title}</p>
      <p className="mt-2 text-4xl font-bold">{value}</p>
    </Link>
  );
}

function ActionCard({
  href,
  title,
  description,
  icon,
}: {
  href: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group rounded-3xl border border-white/10 bg-black p-5 transition hover:-translate-y-1 hover:border-blue-500/70 hover:bg-white/[0.03]"
    >
      <div className="mb-5 flex items-center justify-between">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-blue-300">
          {icon}
        </div>

        <ArrowRight
          size={18}
          className="text-zinc-600 transition group-hover:text-white"
        />
      </div>

      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-zinc-400">{description}</p>
    </Link>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black p-5">
      <p className="text-sm text-zinc-400">{label}</p>
      <p className="mt-2 text-xl font-semibold capitalize">{value}</p>
    </div>
  );
}