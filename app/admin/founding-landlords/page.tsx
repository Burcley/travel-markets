"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BadgeCheck, Download, RefreshCcw, ShieldAlert } from "lucide-react";

type FoundingProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
  account_status: string | null;
  is_founding_landlord: boolean | null;
  founding_landlord_number: number | null;
  founding_status: string | null;
  founding_reserved_at: string | null;
  founding_reservation_expires_at: string | null;
  founding_confirmed_at: string | null;
  founding_free_fee_period_ends_at: string | null;
  founding_discount_percentage: number | null;
  founding_referral_code: string | null;
  founding_benefits_disabled: boolean | null;
  founding_benefits_disabled_reason: string | null;
};

type FoundingAdminResponse = {
  stats: {
    maxPositions: number;
    confirmedCount: number;
    reservedCount: number;
    availablePositions: number;
  };
  profiles: FoundingProfile[];
  assistanceRequests: Array<{
    id: string;
    owner_id: string;
    status: string;
    message: string | null;
    created_at: string;
  }>;
  feedbackItems: Array<{
    id: string;
    owner_id: string;
    category: string;
    status: string;
    message: string | null;
    created_at: string;
  }>;
};

export default function AdminFoundingLandlordsPage() {
  const [data, setData] = useState<FoundingAdminResponse | null>(null);
  const [status, setStatus] = useState("all");
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const profiles = useMemo(() => data?.profiles || [], [data]);

  useEffect(() => {
    loadRecords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  async function loadRecords() {
    setLoading(true);
    const response = await fetch(
      `/api/admin/founding-landlords?status=${encodeURIComponent(status)}`,
      { cache: "no-store" }
    );
    const payload = await response.json().catch(() => null);
    if (response.ok) setData(payload as FoundingAdminResponse);
    setLoading(false);
  }

  async function runAction(profileId: string, action: string) {
    setWorkingId(profileId);
    await fetch("/api/admin/founding-landlords", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profileId, action }),
    });
    await loadRecords();
    setWorkingId(null);
  }

  return (
    <main className="min-h-screen bg-black px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <Link href="/admin" className="text-sm font-semibold text-pink-200">
              Back to admin
            </Link>
            <h1 className="mt-3 text-4xl font-black">Founding Landlords</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
              Manage founder reservations, confirmations, benefits, support
              priority, and export the first 30 landlord cohort.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <a
              href="/api/admin/founding-landlords?export=csv"
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold"
            >
              <Download size={16} />
              Export CSV
            </a>
            <button
              type="button"
              onClick={loadRecords}
              className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-bold text-black"
            >
              <RefreshCcw size={16} />
              Refresh
            </button>
          </div>
        </div>

        {data && (
          <section className="grid gap-4 md:grid-cols-4">
            <Stat label="Confirmed" value={data.stats.confirmedCount} />
            <Stat label="Reserved" value={data.stats.reservedCount} />
            <Stat label="Available" value={data.stats.availablePositions} />
            <Stat label="Capacity" value={data.stats.maxPositions} />
          </section>
        )}

        <section className="rounded-[2rem] border border-white/10 bg-[#080808] p-5">
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <h2 className="text-2xl font-black">Founder queue</h2>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm font-bold outline-none"
            >
              <option value="all">All statuses</option>
              <option value="reserved">Reserved</option>
              <option value="pending_verification">Pending verification</option>
              <option value="pending_listing">Pending listing</option>
              <option value="confirmed">Confirmed</option>
              <option value="disqualified">Disqualified</option>
            </select>
          </div>

          {loading ? (
            <p className="rounded-3xl border border-white/10 bg-black p-8 text-zinc-400">
              Loading Founding Landlord records...
            </p>
          ) : profiles.length === 0 ? (
            <p className="rounded-3xl border border-white/10 bg-black p-8 text-zinc-400">
              No records for this filter.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-y-3 text-sm">
                <thead className="text-left text-xs uppercase tracking-[0.16em] text-zinc-500">
                  <tr>
                    <th className="px-4">Founder</th>
                    <th className="px-4">Status</th>
                    <th className="px-4">Dates</th>
                    <th className="px-4">Benefits</th>
                    <th className="px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {profiles.map((profile) => (
                    <tr key={profile.id} className="bg-black">
                      <td className="rounded-l-3xl border-y border-l border-white/10 px-4 py-4">
                        <div className="flex items-start gap-3">
                          <div className="rounded-2xl border border-pink-300/30 bg-pink-500/20 p-2 text-pink-100">
                            <BadgeCheck size={18} />
                          </div>
                          <div>
                            <p className="font-bold">
                              {profile.full_name || "Unnamed landlord"}
                            </p>
                            <p className="mt-1 text-xs text-zinc-500">
                              {profile.email || "No email"}
                            </p>
                            <p className="mt-1 text-xs capitalize text-zinc-400">
                              {profile.role || "No role"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="border-y border-white/10 px-4 py-4">
                        <p className="font-bold capitalize">
                          {(profile.founding_status || "not_eligible").replaceAll("_", " ")}
                        </p>
                        <p className="mt-1 text-xs text-pink-200">
                          {profile.founding_landlord_number
                            ? `#${profile.founding_landlord_number} of 30`
                            : "No number"}
                        </p>
                      </td>
                      <td className="border-y border-white/10 px-4 py-4 text-xs text-zinc-400">
                        <p>Reserved: {dateLabel(profile.founding_reserved_at)}</p>
                        <p>Expires: {dateLabel(profile.founding_reservation_expires_at)}</p>
                        <p>Confirmed: {dateLabel(profile.founding_confirmed_at)}</p>
                      </td>
                      <td className="border-y border-white/10 px-4 py-4 text-xs text-zinc-400">
                        <p>Free fees until: {dateLabel(profile.founding_free_fee_period_ends_at)}</p>
                        <p>Discount: {profile.founding_discount_percentage || 0}%</p>
                        <p>Code: {profile.founding_referral_code || "Pending"}</p>
                        {profile.founding_benefits_disabled && (
                          <p className="mt-1 flex items-center gap-1 text-red-300">
                            <ShieldAlert size={13} />
                            Benefits disabled
                          </p>
                        )}
                      </td>
                      <td className="rounded-r-3xl border-y border-r border-white/10 px-4 py-4">
                        <div className="flex justify-end gap-2">
                          <ActionButton
                            disabled={workingId === profile.id}
                            onClick={() => runAction(profile.id, "reserve")}
                          >
                            Reserve
                          </ActionButton>
                          <ActionButton
                            disabled={workingId === profile.id}
                            onClick={() => runAction(profile.id, "evaluate")}
                          >
                            Evaluate
                          </ActionButton>
                          <ActionButton
                            disabled={workingId === profile.id}
                            onClick={() =>
                              runAction(
                                profile.id,
                                profile.founding_benefits_disabled
                                  ? "enable_benefits"
                                  : "disable_benefits"
                              )
                            }
                          >
                            {profile.founding_benefits_disabled ? "Enable" : "Disable"}
                          </ActionButton>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {data && (
          <section className="grid gap-6 lg:grid-cols-2">
            <QueueCard title="Setup assistance" count={data.assistanceRequests.length} />
            <QueueCard title="Founder feedback" count={data.feedbackItems.length} />
          </section>
        )}
      </div>
    </main>
  );
}

function dateLabel(value?: string | null) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-[#080808] p-5">
      <p className="text-sm text-zinc-400">{label}</p>
      <p className="mt-2 text-4xl font-black">{value}</p>
    </div>
  );
}

function ActionButton({
  children,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function QueueCard({ title, count }: { title: string; count: number }) {
  return (
    <div className="rounded-[2rem] border border-white/10 bg-[#080808] p-5">
      <p className="text-sm text-zinc-400">{title}</p>
      <p className="mt-2 text-3xl font-black">{count}</p>
    </div>
  );
}
