"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle, XCircle, Loader2, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Verification = {
  id: string;
  user_id: string;
  full_legal_name: string;
  document_type: string;
  document_url: string;
  selfie_url: string | null;
  status: "pending" | "approved" | "rejected";
  rejection_reason: string | null;
  created_at: string;
};

export default function AdminVerificationsPage() {
  const supabase = createClient();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [verifications, setVerifications] = useState<Verification[]>([]);
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");

  const filtered = useMemo(() => {
    if (filter === "all") return verifications;
    return verifications.filter((item) => item.status === filter);
  }, [verifications, filter]);

  useEffect(() => {
    loadVerifications();
  }, []);

  async function loadVerifications() {
    try {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/auth");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .maybeSingle();

      if (!profile?.is_admin) {
        router.push("/");
        return;
      }

      const { data, error } = await supabase
        .from("identity_verifications")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      setVerifications((data || []) as Verification[]);
    } catch (error) {
      console.error("LOAD VERIFICATIONS ERROR:", error);
      alert("Failed to load verifications.");
    } finally {
      setLoading(false);
    }
  }

  async function approveVerification(item: Verification) {
    if (!confirm(`Approve verification for ${item.full_legal_name}?`)) return;

    try {
      setWorkingId(item.id);

      const { data: { user } } = await supabase.auth.getUser();

      const { error: verificationError } = await supabase
        .from("identity_verifications")
        .update({
          status: "approved",
          rejection_reason: null,
          reviewed_by: user?.id || null,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", item.id);

      if (verificationError) throw verificationError;

      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          identity_verified: true,
          identity_verification_status: "approved",
          is_verified: true,
        })
        .eq("id", item.user_id);

      if (profileError) throw profileError;

      await supabase.from("notifications").insert({
        user_id: item.user_id,
        title: "Identity verification approved",
        body: "Your Travel Markets identity verification has been approved.",
        type: "identity_verification_approved",
        is_read: false,
        link: "/profile",
      });

      await loadVerifications();
    } catch (error) {
      console.error("APPROVE VERIFICATION ERROR:", error);
      alert("Failed to approve verification.");
    } finally {
      setWorkingId(null);
    }
  }

  async function rejectVerification(item: Verification) {
    const reason = prompt("Reason for rejection?") || "Verification could not be approved.";

    try {
      setWorkingId(item.id);

      const { data: { user } } = await supabase.auth.getUser();

      const { error: verificationError } = await supabase
        .from("identity_verifications")
        .update({
          status: "rejected",
          rejection_reason: reason,
          reviewed_by: user?.id || null,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", item.id);

      if (verificationError) throw verificationError;

      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          identity_verified: false,
          identity_verification_status: "rejected",
          is_verified: false,
        })
        .eq("id", item.user_id);

      if (profileError) throw profileError;

      await supabase.from("notifications").insert({
        user_id: item.user_id,
        title: "Identity verification rejected",
        body: reason,
        type: "identity_verification_rejected",
        is_read: false,
        link: "/verify-identity",
      });

      await loadVerifications();
    } catch (error) {
      console.error("REJECT VERIFICATION ERROR:", error);
      alert("Failed to reject verification.");
    } finally {
      setWorkingId(null);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black p-10 text-white">
        Loading verifications...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-4 py-8 text-white">
      <div className="mx-auto max-w-7xl space-y-8">
        <section className="rounded-3xl border border-white/10 bg-zinc-950 p-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-300">
                <ShieldCheck className="h-4 w-4" />
                Trust & Safety
              </div>

              <h1 className="text-4xl font-bold">Identity Verifications</h1>

              <p className="mt-2 text-zinc-400">
                Review uploaded ID documents and approve verified users.
              </p>
            </div>

            <Link
              href="/admin"
              className="rounded-xl bg-white px-5 py-3 font-semibold text-black"
            >
              Back to Admin
            </Link>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-4">
            <Stat label="Pending" value={verifications.filter((v) => v.status === "pending").length} />
            <Stat label="Approved" value={verifications.filter((v) => v.status === "approved").length} />
            <Stat label="Rejected" value={verifications.filter((v) => v.status === "rejected").length} />
            <Stat label="Total" value={verifications.length} />
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-zinc-950 p-6">
          <div className="mb-5 flex justify-end">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              className="rounded-xl border border-white/10 bg-black px-4 py-3 text-white"
            >
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="all">All</option>
            </select>
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 p-8 text-zinc-400">
              No {filter} verification requests.
            </div>
          ) : (
            <div className="space-y-4">
              {filtered.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-white/10 bg-black p-5"
                >
                  <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <h2 className="text-xl font-bold">{item.full_legal_name}</h2>

                      <p className="mt-2 text-sm text-zinc-400">
                        Document: {item.document_type}
                      </p>

                      <p className="mt-1 text-xs text-zinc-500">
                        User ID: {item.user_id}
                      </p>

                      <p className="mt-1 text-xs text-zinc-500">
                        Submitted: {new Date(item.created_at).toLocaleString()}
                      </p>

                      <span
                        className={`mt-4 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                          item.status === "approved"
                            ? "bg-emerald-500/10 text-emerald-300"
                            : item.status === "rejected"
                            ? "bg-red-500/10 text-red-300"
                            : "bg-yellow-500/10 text-yellow-300"
                        }`}
                      >
                        {item.status}
                      </span>

                      {item.rejection_reason && (
                        <p className="mt-3 text-sm text-red-300">
                          Reason: {item.rejection_reason}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <a
                        href={item.document_url}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-xl bg-white px-5 py-3 font-semibold text-black"
                      >
                        View Document
                      </a>

                      {item.selfie_url && (
                        <a
                          href={item.selfie_url}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-xl border border-white/10 px-5 py-3 font-semibold text-white"
                        >
                          View Selfie
                        </a>
                      )}

                      {item.status === "pending" && (
                        <>
                          <button
                            onClick={() => approveVerification(item)}
                            disabled={workingId === item.id}
                            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white disabled:opacity-50"
                          >
                            {workingId === item.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <CheckCircle className="h-4 w-4" />
                            )}
                            Approve
                          </button>

                          <button
                            onClick={() => rejectVerification(item)}
                            disabled={workingId === item.id}
                            className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-5 py-3 font-semibold text-white disabled:opacity-50"
                          >
                            {workingId === item.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <XCircle className="h-4 w-4" />
                            )}
                            Reject
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black p-5">
      <p className="text-sm uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-2 text-3xl font-bold">{value}</p>
    </div>
  );
}