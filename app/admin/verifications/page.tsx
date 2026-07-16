"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  Clock3,
  Filter,
  Loader2,
  Search,
  ShieldAlert,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import {
  groupVerificationRecords,
  statusLabel,
  type OverallVerificationStatus,
  type UnifiedVerificationRecord,
  type UserVerificationProfile,
  type VerificationStatus,
  type VerificationType,
  verificationTypeLabel,
} from "@/lib/admin-verification-profiles";

type UserFilter =
  | "needs_review"
  | "fully_verified"
  | "all"
  | "pending_identity"
  | "pending_student_status"
  | "pending_property_relationship";

type SortMode =
  | "newest_pending"
  | "oldest_pending"
  | "name_asc"
  | "most_pending"
  | "recently_verified";

const typeOptions: Array<{ value: "all" | VerificationType; label: string }> = [
  { value: "all", label: "All types" },
  { value: "identity", label: "Identity" },
  { value: "student_status", label: "Student status" },
  { value: "property_relationship", label: "Property relationship" },
  { value: "phone", label: "Phone" },
  { value: "email", label: "Email" },
];

const statusOptions: Array<{ value: "all" | VerificationStatus; label: string }> = [
  { value: "all", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Verified" },
  { value: "rejected", label: "Rejected" },
  { value: "resubmission_required", label: "More info required" },
  { value: "expired", label: "Expired" },
  { value: "not_started", label: "Not started" },
];

function statusClass(status: VerificationStatus | OverallVerificationStatus) {
  if (status === "approved" || status === "verified" || status === "fully_verified") {
    return "border-emerald-500/25 bg-emerald-500/10 text-emerald-200";
  }
  if (status === "pending" || status === "needs_review") {
    return "border-amber-500/25 bg-amber-500/10 text-amber-200";
  }
  if (status === "rejected") {
    return "border-red-500/25 bg-red-500/10 text-red-200";
  }
  if (status === "resubmission_required" || status === "more_information_required") {
    return "border-blue-500/25 bg-blue-500/10 text-blue-200";
  }
  if (status === "expired") {
    return "border-red-900/40 bg-red-950/40 text-red-200";
  }
  if (status === "partially_verified") {
    return "border-pink-500/25 bg-pink-500/10 text-pink-100";
  }
  return "border-white/10 bg-white/5 text-zinc-400";
}

function formatDate(value?: string | null) {
  if (!value) return "No activity yet";
  return new Date(value).toLocaleString("en-CA", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function sortDate(profile: UserVerificationProfile) {
  return profile.lastActivityAt ? new Date(profile.lastActivityAt).getTime() : 0;
}

export default function AdminVerificationsPage() {
  const [profiles, setProfiles] = useState<UserVerificationProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<UserFilter>("needs_review");
  const [roleFilter, setRoleFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState<"all" | VerificationType>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | VerificationStatus>("all");
  const [sortMode, setSortMode] = useState<SortMode>("newest_pending");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const loadProfiles = useCallback(async () => {
    setLoading(true);
    setError("");

    const response = await fetch("/api/admin/verifications", {
      cache: "no-store",
    });
    const data = await response.json().catch(() => null);

    setLoading(false);

    if (!response.ok) {
      setError(data?.error || "We could not load verification profiles.");
      return;
    }

    setProfiles(
      data?.profiles ||
        groupVerificationRecords((data?.records || []) as UnifiedVerificationRecord[])
    );
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadProfiles();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [loadProfiles]);

  const counters = useMemo(() => {
    const pendingType = (type: VerificationType) =>
      profiles.filter((profile) => profile.records[type]?.status === "pending").length;

    return [
      {
        label: "Users requiring review",
        value: "needs_review" as UserFilter,
        count: profiles.filter((profile) => profile.overallStatus === "needs_review").length,
        icon: ShieldAlert,
      },
      {
        label: "Fully verified users",
        value: "fully_verified" as UserFilter,
        count: profiles.filter((profile) => profile.overallStatus === "fully_verified").length,
        icon: BadgeCheck,
      },
      {
        label: "Pending identity",
        value: "pending_identity" as UserFilter,
        count: pendingType("identity"),
        icon: ShieldCheck,
      },
      {
        label: "Pending student status",
        value: "pending_student_status" as UserFilter,
        count: pendingType("student_status"),
        icon: Clock3,
      },
      {
        label: "Pending property verification",
        value: "pending_property_relationship" as UserFilter,
        count: pendingType("property_relationship"),
        icon: ShieldCheck,
      },
    ];
  }, [profiles]);

  const roles = useMemo(
    () =>
      Array.from(new Set(profiles.map((profile) => profile.role).filter(Boolean)))
        .sort() as string[],
    [profiles]
  );

  const filteredProfiles = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return profiles
      .filter((profile) => {
        if (activeFilter === "needs_review" && profile.overallStatus !== "needs_review") {
          return false;
        }
        if (activeFilter === "fully_verified" && profile.overallStatus !== "fully_verified") {
          return false;
        }
        if (
          activeFilter === "pending_identity" &&
          profile.records.identity?.status !== "pending"
        ) {
          return false;
        }
        if (
          activeFilter === "pending_student_status" &&
          profile.records.student_status?.status !== "pending"
        ) {
          return false;
        }
        if (
          activeFilter === "pending_property_relationship" &&
          profile.records.property_relationship?.status !== "pending"
        ) {
          return false;
        }
        if (roleFilter !== "all" && profile.role !== roleFilter) return false;
        if (typeFilter !== "all" && !profile.records[typeFilter]) return false;
        if (
          statusFilter !== "all" &&
          !profile.allRecords.some((record) => record.status === statusFilter)
        ) {
          return false;
        }

        if (!normalizedQuery) return true;

        return [
          profile.fullName,
          profile.email,
          profile.role,
          profile.institution,
          profile.hostInfo,
          profile.userId,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);
      })
      .sort((a, b) => {
        if (sortMode === "oldest_pending") return sortDate(a) - sortDate(b);
        if (sortMode === "name_asc") {
          return String(a.fullName || a.email || "").localeCompare(
            String(b.fullName || b.email || "")
          );
        }
        if (sortMode === "most_pending") return b.pendingCount - a.pendingCount;
        if (sortMode === "recently_verified") {
          const aVerified = Math.max(
            ...a.allRecords
              .filter((record) => record.status === "approved")
              .map((record) => new Date(record.reviewedAt || record.verifiedAt || 0).getTime()),
            0
          );
          const bVerified = Math.max(
            ...b.allRecords
              .filter((record) => record.status === "approved")
              .map((record) => new Date(record.reviewedAt || record.verifiedAt || 0).getTime()),
            0
          );
          return bVerified - aVerified;
        }
        return sortDate(b) - sortDate(a);
      });
  }, [activeFilter, profiles, query, roleFilter, sortMode, statusFilter, typeFilter]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black text-white">
        <Loader2 className="h-8 w-8 animate-spin text-pink-300" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-4 py-10 text-white sm:px-6">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.2em] text-pink-300">
              Travel Markets Admin
            </p>
            <h1 className="mt-2 text-4xl font-black tracking-tight">
              Verification Profiles
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
              Review users once, with all email, phone, identity, student, and
              property verification context grouped into one profile.
            </p>
          </div>
          <Link
            href="/admin"
            className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold text-white hover:bg-white/10"
          >
            Back to Admin
          </Link>
        </header>

        {error && (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-red-200">
            {error}
          </div>
        )}

        <section className="grid gap-3 md:grid-cols-5">
          {counters.map((counter) => {
            const Icon = counter.icon;
            return (
              <button
                key={counter.value}
                type="button"
                onClick={() => setActiveFilter(counter.value)}
                className={`rounded-3xl border p-4 text-left transition hover:-translate-y-0.5 ${
                  activeFilter === counter.value
                    ? "border-pink-400 bg-pink-500/15"
                    : "border-white/10 bg-zinc-950"
                }`}
              >
                <Icon className="h-5 w-5 text-pink-200" />
                <p className="mt-4 text-2xl font-black">{counter.count}</p>
                <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-zinc-500">
                  {counter.label}
                </p>
              </button>
            );
          })}
        </section>

        <section className="rounded-3xl border border-white/10 bg-zinc-950 p-4">
          <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto] lg:items-center">
            <label className="relative">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search name, email, institution, property, company..."
                className="w-full rounded-2xl border border-white/10 bg-black py-3 pl-11 pr-4 text-white outline-none placeholder:text-zinc-600 focus:border-pink-400"
              />
            </label>
            <button
              type="button"
              onClick={() => setFiltersOpen((value) => !value)}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm font-bold text-white hover:bg-white/10 lg:hidden"
            >
              <Filter className="h-4 w-4" />
              Filters
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter("all")}
              className="rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm font-bold text-zinc-300 hover:bg-white/10"
            >
              Show all users
            </button>
          </div>

          <div
            className={`mt-4 grid gap-3 lg:grid-cols-4 ${
              filtersOpen ? "grid" : "hidden lg:grid"
            }`}
          >
            <select
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value)}
              className="rounded-2xl border border-white/10 bg-black px-4 py-3 text-white"
            >
              <option value="all">All roles</option>
              {roles.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value as "all" | VerificationType)}
              className="rounded-2xl border border-white/10 bg-black px-4 py-3 text-white"
            >
              {typeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as "all" | VerificationStatus)}
              className="rounded-2xl border border-white/10 bg-black px-4 py-3 text-white"
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              value={sortMode}
              onChange={(event) => setSortMode(event.target.value as SortMode)}
              className="rounded-2xl border border-white/10 bg-black px-4 py-3 text-white"
            >
              <option value="newest_pending">Newest pending activity first</option>
              <option value="oldest_pending">Oldest pending first</option>
              <option value="name_asc">Name A-Z</option>
              <option value="most_pending">Most pending items</option>
              <option value="recently_verified">Recently verified</option>
            </select>
          </div>
        </section>

        <section className="space-y-3">
          {filteredProfiles.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-white/10 p-10 text-center text-zinc-500">
              No verification profiles match the current view.
            </div>
          ) : (
            filteredProfiles.map((profile) => (
              <article
                key={profile.userId}
                className="rounded-3xl border border-white/10 bg-zinc-950 p-5 shadow-xl"
              >
                <div className="grid gap-5 xl:grid-cols-[minmax(260px,1fr)_minmax(320px,1.4fr)_220px] xl:items-center">
                  <div className="flex gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-black">
                      {profile.avatarUrl ? (
                        <img src={profile.avatarUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <UserRound className="h-6 w-6 text-zinc-500" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="truncate text-lg font-black">
                          {profile.fullName || "Unnamed user"}
                        </h2>
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-black uppercase text-zinc-300">
                          {profile.role || "No role"}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-sm text-zinc-500">
                        {profile.email || "No email"}
                      </p>
                      <p className="mt-2 text-sm font-semibold text-zinc-300">
                        {profile.institution || profile.hostInfo || "No institution or host info"}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {profile.applicableTypes.map((type) => {
                      const status = profile.records[type]?.status || "not_started";
                      return (
                        <span
                          key={type}
                          className={`rounded-full border px-3 py-1.5 text-xs font-black uppercase ${statusClass(status)}`}
                        >
                          {verificationTypeLabel(type)}: {statusLabel(status)}
                        </span>
                      );
                    })}
                  </div>

                  <div className="space-y-3 xl:text-right">
                    <span
                      className={`inline-flex rounded-full border px-3 py-1 text-xs font-black uppercase ${statusClass(profile.overallStatus)}`}
                    >
                      {profile.pendingCount > 0
                        ? `${profile.pendingCount} action${profile.pendingCount === 1 ? "" : "s"} required`
                        : statusLabel(profile.overallStatus)}
                    </span>
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                      Last activity
                    </p>
                    <p className="text-sm text-zinc-300">
                      {formatDate(profile.lastActivityAt)}
                    </p>
                    <Link
                      href={`/admin/verifications/${profile.userId}`}
                      className="inline-flex w-full justify-center rounded-2xl bg-white px-5 py-3 text-sm font-black text-black hover:bg-zinc-200 xl:w-auto"
                    >
                      {profile.pendingCount > 0 ? "Review Profile" : "View Profile"}
                    </Link>
                  </div>
                </div>
              </article>
            ))
          )}
        </section>
      </div>
    </main>
  );
}
