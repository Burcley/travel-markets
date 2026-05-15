"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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

export default function AdminDashboardPage() {
  const router = useRouter();
  const supabase = createClient();

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [reportFilter, setReportFilter] = useState<"pending" | "resolved">(
    "pending"
  );
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);

  const filteredReports = useMemo(() => {
    return reports.filter((report) => report.status === reportFilter);
  }, [reports, reportFilter]);

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

      setProfiles((profilesData || []) as Profile[]);
      setListings((listingsData || []) as Listing[]);
      setReviews((reviewsData || []) as Review[]);
      setReports((reportsData || []) as Report[]);
    } catch (error) {
      console.error("Admin dashboard error:", error);
      router.push("/");
    } finally {
      setLoading(false);
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
    if (!confirm("Ban this user?")) return;

    try {
      setWorkingId(userId);

      const { error } = await supabase
        .from("profiles")
        .update({ role: "banned" })
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

  function formatDate(date: string) {
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
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold">Admin Dashboard</h1>
              <p className="mt-2 text-gray-400">
                Manage users, listings, reviews, reports, and moderation.
              </p>
            </div>

            <Link
              href="/"
              className="rounded-xl bg-white px-5 py-3 font-semibold text-black"
            >
              Back to App
            </Link>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-4">
            <Stat label="Users" value={profiles.length} />
            <Stat label="Listings" value={listings.length} />
            <Stat label="Reviews" value={reviews.length} />
            <Stat label="Reports" value={reports.length} />
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

                      {report.target_type === "user" && report.target_user_id && (
                        <>
                          <Link
                            href={`/users/${report.target_user_id}`}
                            className="rounded-xl border border-gray-700 bg-white/5 px-5 py-3 font-semibold text-white"
                          >
                            View User
                          </Link>

                          <button
                            onClick={() => banUser(report.target_user_id as string)}
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
          <h2 className="text-2xl font-bold">Users</h2>

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

                      <div className="mt-2 flex gap-2">
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

                        {profile.role === "banned" && (
                          <span className="rounded-full bg-red-500/10 px-2 py-1 text-xs text-red-300">
                            Banned
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <select
                      value={profile.role || "student"}
                      onChange={(e) => changeRole(profile, e.target.value)}
                      disabled={workingId === profile.id}
                      className="rounded-xl border border-gray-700 bg-black px-4 py-3 text-white"
                    >
                      <option value="student">student</option>
                      <option value="owner">owner</option>
                      <option value="banned">banned</option>
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

                  <div className="flex gap-3">
                    <Link
                      href={`/listings/${listing.id}`}
                      className="rounded-xl border border-gray-700 bg-white/5 px-5 py-3 font-semibold text-white"
                    >
                      View
                    </Link>

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