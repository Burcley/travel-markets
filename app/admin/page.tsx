"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type UserVerificationProfile,
  type VerificationType,
  verificationTypeLabel,
} from "@/lib/admin-verification-profiles";
import { createClient } from "@/lib/supabase/client";

type Profile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  bio: string | null;
  role: string | null;
  avatar_url: string | null;
  is_verified: boolean | null;
  is_admin: boolean | null;
  account_status: "active" | "suspended" | "banned" | null;
  created_at: string | null;
};

type Listing = {
  id: string;
  user_id: string;
  title: string;
  price: number | null;
  city: string | null;
  address: string | null;
  created_at: string;
};

type Review = {
  id: string;
  listing_id: string;
  owner_id: string;
  reviewer_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
};

type Report = {
  id: string;
  reporter_id: string;
  target_type: "listing" | "user";
  target_listing_id: string | null;
  target_user_id: string | null;
  reason: string;
  description: string | null;
  status: "pending" | "resolved";
  created_at: string;
};

type SupportTicket = {
  id: string;
  user_id: string | null;
  name: string | null;
  email: string | null;
  category: string | null;
  subject: string | null;
  message: string | null;
  status: string | null;
  admin_note: string | null;
  created_at: string;
};

export default function AdminDashboardPage() {
  const router = useRouter();
  const supabase = createClient();

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);
  const [verificationProfiles, setVerificationProfiles] = useState<
    UserVerificationProfile[]
  >([]);
  const [reportFilter, setReportFilter] = useState<"pending" | "resolved">(
    "pending"
  );
  const [ticketFilter, setTicketFilter] = useState<
    "open" | "reviewing" | "resolved"
  >("open");
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);

  const filteredReports = useMemo(() => {
    return reports.filter((report) => report.status === reportFilter);
  }, [reports, reportFilter]);

  const filteredSupportTickets = useMemo(() => {
    return supportTickets.filter(
      (ticket) => (ticket.status || "open") === ticketFilter
    );
  }, [supportTickets, ticketFilter]);

  const verificationPreview = useMemo(
    () => verificationProfiles.filter((profile) => profile.pendingCount > 0).slice(0, 5),
    [verificationProfiles]
  );
  const pendingTypeCount = useCallback(
    (type: VerificationType) =>
      verificationProfiles.filter(
        (profile) => profile.records[type]?.status === "pending"
      ).length,
    [verificationProfiles]
  );

  useEffect(() => {
    loadAdminDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadAdminDashboard() {
    try {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/auth");
        return;
      }

      setCurrentUserId(user.id);

      const { data: myProfile, error: myProfileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (myProfileError || !myProfile || !myProfile.is_admin) {
        router.push("/");
        return;
      }

      setCurrentProfile(myProfile as Profile);

      const { data: profilesData } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      const { data: listingsData } = await supabase
        .from("listings")
        .select("*")
        .order("created_at", { ascending: false });

      const { data: reviewsData } = await supabase
        .from("reviews")
        .select("*")
        .order("created_at", { ascending: false });

      const { data: reportsData } = await supabase
        .from("reports")
        .select("*")
        .order("created_at", { ascending: false });

      const { data: ticketsData } = await supabase
        .from("support_tickets")
        .select("*")
        .order("created_at", { ascending: false });

      setProfiles((profilesData || []) as Profile[]);
      setListings((listingsData || []) as Listing[]);
      setReviews((reviewsData || []) as Review[]);
      setReports((reportsData || []) as Report[]);
      setSupportTickets((ticketsData || []) as SupportTicket[]);

      const verificationResponse = await fetch("/api/admin/verifications", {
        cache: "no-store",
      });
      const verificationData = await verificationResponse.json().catch(() => null);
      if (verificationResponse.ok) {
        setVerificationProfiles(
          (verificationData?.profiles || []) as UserVerificationProfile[]
        );
      }
    } catch (error) {
      console.error("Admin dashboard error:", error);
      router.push("/");
    } finally {
      setLoading(false);
    }
  }

  async function updateTicketStatus(ticketId: string, status: string) {
    try {
      setWorkingId(ticketId);

      const { error } = await supabase
        .from("support_tickets")
        .update({ status })
        .eq("id", ticketId);

      if (error) {
        alert(error.message);
        return;
      }

      await loadAdminDashboard();
    } finally {
      setWorkingId(null);
    }
  }

  async function toggleVerification(profile: Profile) {
    try {
      setWorkingId(profile.id);

      const { error } = await supabase
        .from("profiles")
        .update({ is_verified: !profile.is_verified })
        .eq("id", profile.id);

      if (error) {
        alert(error.message);
        return;
      }

      await loadAdminDashboard();
    } finally {
      setWorkingId(null);
    }
  }

  async function changeRole(profile: Profile, role: string) {
    if (profile.is_admin) {
      alert("You cannot change an admin role from here.");
      return;
    }

    try {
      setWorkingId(profile.id);

      const { error } = await supabase
        .from("profiles")
        .update({ role })
        .eq("id", profile.id);

      if (error) {
        alert(error.message);
        return;
      }

      await loadAdminDashboard();
    } finally {
      setWorkingId(null);
    }
  }

  async function deleteListing(listingId: string) {
    if (!confirm("Delete this listing?")) return;

    try {
      setWorkingId(listingId);

      const { error } = await supabase
        .from("listings")
        .delete()
        .eq("id", listingId);

      if (error) {
        alert(error.message);
        return;
      }

      await loadAdminDashboard();
    } finally {
      setWorkingId(null);
    }
  }

  async function repairListingLocation(listingId: string) {
    if (!confirm("Repair this listing location and recalculate routes?")) return;

    try {
      setWorkingId(listingId);

      const response = await fetch(`/api/listings/${listingId}/repair-location`, {
        method: "POST",
      });
      const result = await response.json();

      if (!response.ok) {
        alert(result.error || "Location repair failed.");
        return;
      }

      alert(
        `Location repaired. Old coordinate difference: ${
          result.oldVsGeocodedDifferenceMeters ?? "unknown"
        }m.`
      );
      await loadAdminDashboard();
    } finally {
      setWorkingId(null);
    }
  }

  async function deleteReview(reviewId: string) {
    if (!confirm("Delete this review?")) return;

    try {
      setWorkingId(reviewId);

      const { error } = await supabase
        .from("reviews")
        .delete()
        .eq("id", reviewId);

      if (error) {
        alert(error.message);
        return;
      }

      await loadAdminDashboard();
    } finally {
      setWorkingId(null);
    }
  }

  async function resolveReport(reportId: string) {
    try {
      setWorkingId(reportId);

      const { error } = await supabase
        .from("reports")
        .update({
          status: "resolved",
          resolved_at: new Date().toISOString(),
          resolved_by: currentUserId,
        })
        .eq("id", reportId);

      if (error) {
        alert(error.message);
        return;
      }

      await loadAdminDashboard();
    } finally {
      setWorkingId(null);
    }
  }

  async function banUser(userId: string) {
    const targetProfile = profiles.find((profile) => profile.id === userId);

    if (targetProfile?.is_admin) {
      alert("You cannot ban an admin account.");
      return;
    }

    if (!confirm("Ban this user?")) return;

    try {
      setWorkingId(userId);

      const { error } = await supabase
        .from("profiles")
        .update({
          account_status: "banned",
          banned_at: new Date().toISOString(),
          suspended_at: null,
          moderation_reason: "Banned by admin from report moderation",
        })
        .eq("id", userId);

      if (error) {
        alert(error.message);
        return;
      }

      await loadAdminDashboard();
    } finally {
      setWorkingId(null);
    }
  }

  function getProfileName(id: string | null) {
    if (!id) return "Unknown user";
    const profile = profiles.find((p) => p.id === id);
    return profile?.full_name || "Unknown user";
  }

  function getListingTitle(id: string | null) {
    if (!id) return "Unknown listing";
    const listing = listings.find((l) => l.id === id);
    return listing?.title || "Unknown listing";
  }

  function formatDate(date: string | null) {
    if (!date) return "Unknown date";

    return new Date(date).toLocaleString("en-CA", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black p-10 text-white">
        Loading admin dashboard...
      </main>
    );
  }

  if (!currentProfile?.is_admin) {
    return (
      <main className="min-h-screen bg-black p-10 text-white">
        Access denied.
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-4 py-8 text-white">
      <div className="mx-auto max-w-7xl space-y-8">
        <section className="rounded-3xl border border-gray-800 bg-[#070707] p-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-4xl font-bold">Admin Dashboard</h1>
              <p className="mt-2 text-gray-400">
                Manage users, listings, reviews, reports, support,
                verification, and moderation.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/admin/users"
                className="rounded-xl bg-red-600 px-5 py-3 font-semibold text-white hover:bg-red-500"
              >
                Manage Users
              </Link>
              <Link
                href="/admin/audit-logs"
                className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 font-semibold text-white hover:bg-white/10"
              >
                Audit Logs
              </Link>
              <Link
                href="/admin/founding-landlords"
                className="rounded-xl border border-pink-300/30 bg-pink-500/15 px-5 py-3 font-semibold text-pink-100 hover:bg-pink-500/25"
              >
                Founding Landlords
              </Link>

              <Link
                href="/"
                className="rounded-xl bg-white px-5 py-3 font-semibold text-black"
              >
                Back to App
              </Link>
            </div>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-6">
            <Stat label="Users" value={profiles.length} />
            <Stat label="Listings" value={listings.length} />
            <Stat label="Reviews" value={reviews.length} />
            <Stat label="Reports" value={reports.length} />
            <Stat label="Support" value={supportTickets.length} />
            <Stat
              label="Verification Reviews"
              value={
                verificationProfiles.filter((profile) => profile.pendingCount > 0)
                  .length
              }
            />
          </div>
        </section>

        <section className="rounded-3xl border border-red-500/20 bg-red-500/5 p-6">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="mb-3 inline-flex rounded-full bg-red-500/10 px-3 py-1 text-xs font-bold text-red-300">
                ACCOUNT MODERATION
              </div>
              <h2 className="text-2xl font-bold">Suspend, Ban & Delete Users</h2>
              <p className="mt-1 text-sm text-gray-400">
                Use the full user management page for account suspension,
                reactivation, bans, and protected deletion.
              </p>
            </div>

            <Link
              href="/admin/users"
              className="rounded-xl bg-red-600 px-5 py-3 font-bold text-white hover:bg-red-500"
            >
              Open User Management
            </Link>
          </div>
        </section>

        <section className="rounded-3xl border border-cyan-500/20 bg-cyan-500/5 p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="mb-3 inline-flex rounded-full bg-cyan-500/10 px-3 py-1 text-xs font-bold text-cyan-300">
                SUPPORT CENTER
              </div>
              <h2 className="text-2xl font-bold">Support Tickets</h2>
              <p className="mt-1 text-sm text-gray-400">
                Review messages submitted through Contact Support.
              </p>
            </div>

            <select
              value={ticketFilter}
              onChange={(e) =>
                setTicketFilter(
                  e.target.value as "open" | "reviewing" | "resolved"
                )
              }
              className="rounded-xl border border-gray-700 bg-black px-4 py-3 text-white"
            >
              <option value="open">Open</option>
              <option value="reviewing">Reviewing</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>

          <div className="mt-5 space-y-4">
            {filteredSupportTickets.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-cyan-500/20 p-6 text-gray-400">
                No {ticketFilter} support tickets.
              </div>
            ) : (
              filteredSupportTickets.map((ticket) => (
                <div
                  key={ticket.id}
                  className="rounded-2xl border border-gray-800 bg-black p-5"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-300">
                          {ticket.category || "support"}
                        </span>

                        <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-gray-300">
                          {ticket.status || "open"}
                        </span>
                      </div>

                      <h3 className="mt-3 text-lg font-bold">
                        {ticket.subject || "No subject"}
                      </h3>

                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-300">
                        {ticket.message || "No message provided."}
                      </p>

                      <p className="mt-3 text-xs text-gray-500">
                        From: {ticket.name || "Unknown"} •{" "}
                        {ticket.email || "No email"}
                      </p>

                      <p className="mt-1 text-xs text-gray-500">
                        Created: {formatDate(ticket.created_at)}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={() => updateTicketStatus(ticket.id, "reviewing")}
                        disabled={workingId === ticket.id}
                        className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-sm font-bold text-cyan-300 disabled:opacity-50"
                      >
                        Reviewing
                      </button>

                      <button
                        onClick={() => updateTicketStatus(ticket.id, "resolved")}
                        disabled={workingId === ticket.id}
                        className="rounded-xl bg-green-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
                      >
                        Resolve
                      </button>

                      <a
                        href={`mailto:${
                          ticket.email || ""
                        }?subject=Travel Markets Support: ${
                          ticket.subject || "Support Ticket"
                        }`}
                        className="rounded-xl bg-white px-4 py-3 text-sm font-bold text-black"
                      >
                        Email User
                      </a>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-pink-500/20 bg-pink-500/5 p-6">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="mb-3 inline-flex rounded-full bg-pink-500/10 px-3 py-1 text-xs font-bold text-pink-300">
                TRUST & VERIFICATION
              </div>
              <h2 className="text-2xl font-bold">Trust & Verification</h2>
              <p className="mt-1 text-sm text-gray-400">
                Review users with pending identity, student status, and property
                relationship checks from one central queue.
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full bg-yellow-500/10 px-3 py-1 text-xs font-semibold text-yellow-300">
                  Users requiring review: {verificationPreview.length}
                </span>
                <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                  Recently approved:{" "}
                  {
                    verificationProfiles.filter(
                      (profile) => profile.overallStatus === "fully_verified"
                    ).length
                  }
                </span>
                <span className="rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-300">
                  Pending identity: {pendingTypeCount("identity")}
                </span>
                <span className="rounded-full bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-300">
                  Pending student: {pendingTypeCount("student_status")}
                </span>
                <span className="rounded-full bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-300">
                  Pending property: {pendingTypeCount("property_relationship")}
                </span>
              </div>
            </div>

            <Link
              href="/admin/verifications"
              className="rounded-xl bg-pink-500 px-5 py-3 font-bold text-white hover:bg-pink-400"
            >
              Open Verification Center
            </Link>
          </div>

          <div className="mt-5 rounded-2xl border border-white/10 bg-black p-5">
            {verificationPreview.length === 0 ? (
              <p className="text-sm text-gray-400">
                No users currently require verification review.
              </p>
            ) : (
              <div className="space-y-3">
                {verificationPreview.map((profile) => {
                  const pendingTypes = profile.applicableTypes.filter(
                    (type) => profile.records[type]?.status === "pending"
                  );

                  return (
                  <div
                    key={profile.userId}
                    className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 md:flex-row md:items-center md:justify-between"
                  >
                    <div className="flex gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-black">
                        {profile.avatarUrl ? (
                          <img
                            src={profile.avatarUrl}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="text-xs font-black text-zinc-500">
                            {(profile.fullName || profile.email || "?").slice(0, 1)}
                          </span>
                        )}
                      </div>
                      <div>
                        <p className="font-semibold">
                          {profile.fullName || profile.email || "Unnamed user"}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          {profile.role || "No role"} ·{" "}
                          {pendingTypes.map(verificationTypeLabel).join(", ")}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 md:items-end">
                      <p className="mt-1 text-xs text-gray-500">
                        Submitted {formatDate(profile.lastActivityAt || "")}
                      </p>
                      <Link
                        href={`/admin/verifications/${profile.userId}`}
                        className="rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/10"
                      >
                        Review
                      </Link>
                    </div>
                  </div>
                  );
                })}

                <Link
                  href="/admin/verifications"
                  className="inline-flex text-sm font-bold text-pink-200 hover:text-pink-100"
                >
                  View all verification profiles
                </Link>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-gray-800 bg-[#070707] p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-bold">Reports & Moderation</h2>
              <p className="mt-1 text-sm text-gray-400">
                Review reported listings and users.
              </p>
            </div>

            <select
              value={reportFilter}
              onChange={(e) =>
                setReportFilter(e.target.value as "pending" | "resolved")
              }
              className="rounded-xl border border-gray-700 bg-black px-4 py-3 text-white"
            >
              <option value="pending">Pending</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>

          <div className="mt-5 space-y-4">
            {filteredReports.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-700 p-6 text-gray-400">
                No {reportFilter} reports.
              </div>
            ) : (
              filteredReports.map((report) => (
                <div
                  key={report.id}
                  className="rounded-2xl border border-gray-800 bg-black p-5"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-300">
                          {report.status}
                        </span>

                        <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-gray-300">
                          {report.target_type}
                        </span>
                      </div>

                      <h3 className="mt-3 text-lg font-bold">
                        {report.reason}
                      </h3>

                      <p className="mt-2 text-sm leading-6 text-gray-300">
                        {report.description || "No description provided."}
                      </p>

                      <p className="mt-3 text-xs text-gray-500">
                        Reporter: {getProfileName(report.reporter_id)}
                      </p>

                      <p className="mt-1 text-xs text-gray-500">
                        Target:{" "}
                        {report.target_type === "listing"
                          ? getListingTitle(report.target_listing_id)
                          : getProfileName(report.target_user_id)}
                      </p>

                      <p className="mt-1 text-xs text-gray-500">
                        Created: {formatDate(report.created_at)}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      {report.target_type === "listing" &&
                        report.target_listing_id && (
                          <>
                            <Link
                              href={`/listings/${report.target_listing_id}`}
                              className="rounded-xl border border-gray-700 bg-white/5 px-5 py-3 font-semibold text-white"
                            >
                              View Listing
                            </Link>

                            <button
                              onClick={() =>
                                deleteListing(report.target_listing_id as string)
                              }
                              disabled={workingId === report.target_listing_id}
                              className="rounded-xl bg-red-600 px-5 py-3 font-semibold text-white disabled:bg-gray-600"
                            >
                              Delete Listing
                            </button>
                          </>
                        )}

                      {report.target_type === "user" &&
                        report.target_user_id && (
                          <>
                            <Link
                              href={`/users/${report.target_user_id}`}
                              className="rounded-xl border border-gray-700 bg-white/5 px-5 py-3 font-semibold text-white"
                            >
                              View User
                            </Link>

                            <button
                              onClick={() =>
                                banUser(report.target_user_id as string)
                              }
                              disabled={workingId === report.target_user_id}
                              className="rounded-xl bg-orange-600 px-5 py-3 font-semibold text-white disabled:bg-gray-600"
                            >
                              Ban User
                            </button>
                          </>
                        )}

                      {report.status === "pending" && (
                        <button
                          onClick={() => resolveReport(report.id)}
                          disabled={workingId === report.id}
                          className="rounded-xl bg-green-600 px-5 py-3 font-semibold text-white disabled:bg-gray-600"
                        >
                          Mark Resolved
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-gray-800 bg-[#070707] p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Users</h2>

            <Link
              href="/admin/users"
              className="rounded-xl bg-white px-5 py-3 font-semibold text-black"
            >
              Manage Users
            </Link>
          </div>

          <div className="mt-5 space-y-4">
            {profiles.map((profile) => (
              <div
                key={profile.id}
                className="rounded-2xl border border-gray-800 bg-black p-5"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 overflow-hidden rounded-full bg-gray-800">
                      {profile.avatar_url ? (
                        <img
                          src={profile.avatar_url}
                          alt={profile.full_name || "User"}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center font-bold">
                          {(profile.full_name || "U").charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>

                    <div>
                      <p className="font-semibold">
                        {profile.full_name || "Unnamed user"}
                      </p>
                      <p className="text-xs text-gray-500">{profile.id}</p>

                      <div className="mt-2 flex flex-wrap gap-2">
                        {profile.is_verified && (
                          <span className="rounded-full bg-blue-500/10 px-2 py-1 text-xs text-blue-300">
                            Verified
                          </span>
                        )}

                        {profile.is_admin && (
                          <span className="rounded-full bg-purple-500/10 px-2 py-1 text-xs text-purple-300">
                            Admin
                          </span>
                        )}

                        <span
                          className={`rounded-full px-2 py-1 text-xs ${
                            (profile.account_status || "active") === "active"
                              ? "bg-emerald-500/10 text-emerald-300"
                              : (profile.account_status || "active") ===
                                "suspended"
                              ? "bg-yellow-500/10 text-yellow-300"
                              : "bg-red-500/10 text-red-300"
                          }`}
                        >
                          {profile.account_status || "active"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <select
                      value={profile.role || "student"}
                      onChange={(e) => changeRole(profile, e.target.value)}
                      disabled={workingId === profile.id || !!profile.is_admin}
                      className="rounded-xl border border-gray-700 bg-black px-4 py-3 text-white disabled:opacity-50"
                    >
                      <option value="student">student</option>
                      <option value="owner">owner</option>
                    </select>

                    <button
                      onClick={() => toggleVerification(profile)}
                      disabled={workingId === profile.id}
                      className="rounded-xl bg-white px-5 py-3 font-semibold text-black disabled:bg-gray-600"
                    >
                      {profile.is_verified ? "Unverify" : "Verify"}
                    </button>

                    <Link
                      href={`/users/${profile.id}`}
                      className="rounded-xl border border-gray-700 bg-white/5 px-5 py-3 font-semibold text-white"
                    >
                      View
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-gray-800 bg-[#070707] p-6">
          <h2 className="text-2xl font-bold">Listings</h2>

          <div className="mt-5 space-y-4">
            {listings.map((listing) => (
              <div
                key={listing.id}
                className="rounded-2xl border border-gray-800 bg-black p-5"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h3 className="text-lg font-bold">{listing.title}</h3>
                    <p className="mt-1 text-sm text-gray-400">
                      Owner: {getProfileName(listing.user_id)}
                    </p>
                    <p className="mt-1 text-sm text-gray-400">
                      {[listing.city, listing.address].filter(Boolean).join(", ") ||
                        "No location"}{" "}
                      · ${listing.price || 0}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Link
                      href={`/listings/${listing.id}`}
                      className="rounded-xl border border-gray-700 bg-white/5 px-5 py-3 font-semibold text-white"
                    >
                      View
                    </Link>

                    <button
                      onClick={() => repairListingLocation(listing.id)}
                      disabled={workingId === listing.id}
                      className="rounded-xl border border-pink-500/30 bg-pink-500/10 px-5 py-3 font-semibold text-pink-200 disabled:bg-gray-600 disabled:text-white"
                    >
                      Repair listing location
                    </button>

                    <button
                      onClick={() => deleteListing(listing.id)}
                      disabled={workingId === listing.id}
                      className="rounded-xl bg-red-600 px-5 py-3 font-semibold text-white disabled:bg-gray-600"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-gray-800 bg-[#070707] p-6">
          <h2 className="text-2xl font-bold">Reviews</h2>

          <div className="mt-5 space-y-4">
            {reviews.map((review) => (
              <div
                key={review.id}
                className="rounded-2xl border border-gray-800 bg-black p-5"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-yellow-400">
                      {"★".repeat(review.rating)}
                      <span className="text-gray-700">
                        {"★".repeat(5 - review.rating)}
                      </span>
                    </p>

                    <p className="mt-3 text-gray-300">
                      {review.comment || "No comment"}
                    </p>

                    <p className="mt-3 text-xs text-gray-500">
                      Reviewer: {getProfileName(review.reviewer_id)} · Owner:{" "}
                      {getProfileName(review.owner_id)}
                    </p>
                  </div>

                  <button
                    onClick={() => deleteReview(review.id)}
                    disabled={workingId === review.id}
                    className="rounded-xl bg-red-600 px-5 py-3 font-semibold text-white disabled:bg-gray-600"
                  >
                    Delete Review
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-gray-800 bg-black p-5">
      <p className="text-sm uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-2 text-3xl font-bold">{value}</p>
    </div>
  );
}
