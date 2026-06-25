"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Verification = {
  id: string;
  user_id: string;
  full_legal_name: string | null;
  document_type: string | null;
  document_url: string | null;
  selfie_url: string | null;
  proof_url: string | null;
  status: "pending" | "approved" | "rejected";
  rejection_reason: string | null;
  created_at: string;
};

export default function AdminVerificationsPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [items, setItems] = useState<Verification[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);

  useEffect(() => {
    loadVerifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadVerifications() {
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
      .select("role, is_admin")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.role !== "admin" && !profile?.is_admin) {
      router.push("/dashboard");
      return;
    }

    const { data, error } = await supabase
      .from("identity_verifications")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      setItems([]);
    } else {
      setItems((data || []) as Verification[]);
    }

    setLoading(false);
  }

  async function sendIdentityApprovedEmail(userId: string) {
    try {
      await fetch("/api/emails/identity-approved", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId }),
      });
    } catch (error) {
      console.error("IDENTITY APPROVED EMAIL ERROR:", error);
    }
  }

  async function sendIdentityRejectedEmail(userId: string, reason: string) {
    try {
      await fetch("/api/emails/identity-rejected", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId, reason }),
      });
    } catch (error) {
      console.error("IDENTITY REJECTED EMAIL ERROR:", error);
    }
  }

  async function approveVerification(item: Verification) {
    try {
      setWorkingId(item.id);

      const { error: verificationError } = await supabase
        .from("identity_verifications")
        .update({
          status: "approved",
          rejection_reason: null,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", item.id);

      if (verificationError) {
        alert(verificationError.message);
        return;
      }

      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          is_verified: true,
          verified_at: new Date().toISOString(),
        })
        .eq("id", item.user_id);

      if (profileError) {
        alert(profileError.message);
        return;
      }

      await supabase.from("notifications").insert({
        user_id: item.user_id,
        title: "Identity verification approved",
        body: "Your Travel Markets identity verification has been approved.",
        message: "Your Travel Markets identity verification has been approved.",
        type: "identity_verification_approved",
        is_read: false,
        link: "/profile",
      });

      await sendIdentityApprovedEmail(item.user_id);

      await loadVerifications();
      router.refresh();
    } finally {
      setWorkingId(null);
    }
  }

  async function rejectVerification(item: Verification) {
    const reason = window.prompt(
      "Enter rejection reason:",
      "Your submitted information could not be verified."
    );

    if (!reason) return;

    try {
      setWorkingId(item.id);

      const { error: verificationError } = await supabase
        .from("identity_verifications")
        .update({
          status: "rejected",
          rejection_reason: reason,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", item.id);

      if (verificationError) {
        alert(verificationError.message);
        return;
      }

      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          is_verified: false,
        })
        .eq("id", item.user_id);

      if (profileError) {
        alert(profileError.message);
        return;
      }

      await supabase.from("notifications").insert({
        user_id: item.user_id,
        title: "Identity verification rejected",
        body: reason,
        message: reason,
        type: "identity_verification_rejected",
        is_read: false,
        link: "/verify-identity",
      });

      await sendIdentityRejectedEmail(item.user_id, reason);

      await loadVerifications();
      router.refresh();
    } finally {
      setWorkingId(null);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black px-6 py-10 text-white">
        Loading verification requests...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-6 py-10 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <p className="text-sm text-white/50">Travel Markets Admin</p>
            <h1 className="text-3xl font-bold">Identity Verifications</h1>
          </div>

          <Link
            href="/admin"
            className="rounded-full border border-white/10 px-5 py-2 text-sm text-white/70 hover:bg-white/10"
          >
            Back to Admin
          </Link>
        </div>

        {items.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center text-white/50">
            No verification requests found.
          </div>
        ) : (
          <div className="space-y-5">
            {items.map((item) => (
              <div
                key={item.id}
                className="rounded-3xl border border-white/10 bg-zinc-950 p-6"
              >
                <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap gap-2">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold ${
                          item.status === "approved"
                            ? "bg-emerald-500/10 text-emerald-300"
                            : item.status === "rejected"
                            ? "bg-red-500/10 text-red-300"
                            : "bg-yellow-500/10 text-yellow-300"
                        }`}
                      >
                        {item.status}
                      </span>

                      <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/60">
                        {item.document_type || "document"}
                      </span>
                    </div>

                    <h2 className="mt-4 text-2xl font-bold">
                      {item.full_legal_name || "Unnamed user"}
                    </h2>

                    <p className="mt-2 text-sm text-zinc-500">
                      User ID: {item.user_id}
                    </p>

                    <p className="mt-1 text-sm text-zinc-500">
                      Submitted:{" "}
                      {item.created_at
                        ? new Date(item.created_at).toLocaleString()
                        : "Unknown"}
                    </p>

                    {item.rejection_reason && (
                      <p className="mt-3 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">
                        {item.rejection_reason}
                      </p>
                    )}

                    <div className="mt-5 flex flex-wrap gap-3">
                      {item.document_url && (
                        <a
                          href={item.document_url}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-xl border border-white/10 px-4 py-2 text-sm hover:bg-white/10"
                        >
                          View Document
                        </a>
                      )}

                      {item.selfie_url && (
                        <a
                          href={item.selfie_url}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-xl border border-white/10 px-4 py-2 text-sm hover:bg-white/10"
                        >
                          View Selfie
                        </a>
                      )}

                      {item.proof_url && (
                        <a
                          href={item.proof_url}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-xl border border-white/10 px-4 py-2 text-sm hover:bg-white/10"
                        >
                          View Proof
                        </a>
                      )}
                    </div>
                  </div>

                  {item.status === "pending" && (
                    <div className="flex min-w-[220px] flex-col gap-3">
                      <button
                        onClick={() => approveVerification(item)}
                        disabled={workingId === item.id}
                        className="rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                      >
                        {workingId === item.id ? "Approving..." : "Approve"}
                      </button>

                      <button
                        onClick={() => rejectVerification(item)}
                        disabled={workingId === item.id}
                        className="rounded-xl bg-red-600 px-5 py-3 font-semibold text-white hover:bg-red-500 disabled:opacity-50"
                      >
                        {workingId === item.id ? "Rejecting..." : "Reject"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}