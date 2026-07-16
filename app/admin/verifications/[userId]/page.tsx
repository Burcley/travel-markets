"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  ExternalLink,
  FileText,
  Loader2,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import {
  groupVerificationRecords,
  isManualVerification,
  statusLabel,
  type UnifiedVerificationRecord,
  type UserVerificationProfile,
  type VerificationStatus,
  verificationTypeLabel,
} from "@/lib/admin-verification-profiles";

function statusClass(status: VerificationStatus | string) {
  if (status === "approved" || status === "verified" || status === "fully_verified") {
    return "border-emerald-500/25 bg-emerald-500/10 text-emerald-200";
  }
  if (status === "pending" || status === "needs_review") {
    return "border-amber-500/25 bg-amber-500/10 text-amber-200";
  }
  if (status === "rejected") return "border-red-500/25 bg-red-500/10 text-red-200";
  if (status === "resubmission_required" || status === "more_information_required") {
    return "border-blue-500/25 bg-blue-500/10 text-blue-200";
  }
  if (status === "expired") return "border-red-900/40 bg-red-950/40 text-red-200";
  return "border-white/10 bg-white/5 text-zinc-400";
}

function formatDate(value?: string | null) {
  if (!value) return "Not recorded";
  return new Date(value).toLocaleString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function documentLabel(path: string) {
  if (path.startsWith("listing-document:")) {
    return path.split(":").slice(2).join(":") || "Property document";
  }

  const cleanPath = path.startsWith("identity-document:")
    ? path.replace("identity-document:", "")
    : path;

  if (cleanPath.startsWith("http")) return "Identity document";
  return cleanPath.split("/").at(-1) || "Verification document";
}

function metadataEntries(record: UnifiedVerificationRecord) {
  return Object.entries(record.metadata || {}).filter(([, value]) => {
    if (value == null) return false;
    if (Array.isArray(value) && value.length === 0) return false;
    if (typeof value === "object") return false;
    return String(value).trim().length > 0;
  });
}

export default function AdminVerificationProfilePage() {
  const params = useParams<{ userId: string }>();
  const userId = params.userId;
  const [profile, setProfile] = useState<UserVerificationProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [workingId, setWorkingId] = useState("");
  const [reasonByRecord, setReasonByRecord] = useState<Record<string, string>>({});

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError("");

    const response = await fetch("/api/admin/verifications", {
      cache: "no-store",
    });
    const data = await response.json().catch(() => null);
    setLoading(false);

    if (!response.ok) {
      setError(data?.error || "We could not load this verification profile.");
      return;
    }

    const grouped =
      data?.profiles ||
      groupVerificationRecords((data?.records || []) as UnifiedVerificationRecord[]);
    const match = (grouped as UserVerificationProfile[]).find(
      (item) => item.userId === userId
    );

    if (!match) {
      setError("Verification profile not found.");
      return;
    }

    setProfile(match);
  }, [userId]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadProfile();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [loadProfile]);

  const sectionTypes = useMemo(
    () => profile?.applicableTypes || [],
    [profile?.applicableTypes]
  );

  async function openDocument(path: string) {
    if (path.startsWith("listing-document:")) {
      const [, documentId] = path.split(":");
      const response = await fetch(
        `/api/listing-verifications/documents/${documentId}/signed-url`,
        { method: "POST" }
      );
      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.signedUrl) {
        setMessage(data?.error || "We could not open that document.");
        return;
      }

      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
      return;
    }

    const identityPath = path.startsWith("identity-document:")
      ? path.replace("identity-document:", "")
      : "";

    if (identityPath.startsWith("http")) {
      window.open(identityPath, "_blank", "noopener,noreferrer");
      return;
    }

    const response = await fetch("/api/admin/verifications/signed-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: identityPath || path,
        bucket: identityPath ? "verification-documents" : "verification-submissions",
      }),
    });
    const data = await response.json().catch(() => null);

    if (!response.ok || !data?.signedUrl) {
      setMessage(data?.error || "We could not open that document.");
      return;
    }

    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function review(
    record: UnifiedVerificationRecord,
    action: "approve" | "reject" | "resubmission"
  ) {
    const reason = (reasonByRecord[record.id] || "").trim();
    if ((action === "reject" || action === "resubmission") && !reason) {
      setMessage("Enter a user-facing reason before continuing.");
      return;
    }

    setWorkingId(record.id);
    setMessage("");

    const response = await fetch("/api/admin/verifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: record.id,
        source: record.source,
        action,
        reason,
      }),
    });
    const data = await response.json().catch(() => null);

    setWorkingId("");

    if (!response.ok) {
      setMessage(data?.error || "We could not update this verification.");
      return;
    }

    setReasonByRecord((previous) => ({ ...previous, [record.id]: "" }));
    setMessage("Verification updated.");
    await loadProfile();
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black text-white">
        <Loader2 className="h-8 w-8 animate-spin text-pink-300" />
      </main>
    );
  }

  if (error || !profile) {
    return (
      <main className="min-h-screen bg-black px-4 py-10 text-white">
        <div className="mx-auto max-w-4xl rounded-3xl border border-red-500/20 bg-red-500/10 p-6 text-red-100">
          {error || "Verification profile not found."}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-4 py-10 text-white sm:px-6">
      <div className="mx-auto max-w-6xl space-y-8">
        <Link
          href="/admin/verifications"
          className="inline-flex items-center gap-2 text-sm font-bold text-zinc-400 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to verification profiles
        </Link>

        <header className="rounded-[2rem] border border-white/10 bg-zinc-950 p-6 shadow-2xl">
          <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-start">
            <div className="flex gap-5">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-3xl border border-white/10 bg-black">
                {profile.avatarUrl ? (
                  <img src={profile.avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <UserRound className="h-8 w-8 text-zinc-500" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-black uppercase tracking-[0.2em] text-pink-300">
                  Verification profile
                </p>
                <h1 className="mt-2 text-4xl font-black tracking-tight">
                  {profile.fullName || "Unnamed user"}
                </h1>
                <p className="mt-2 text-sm text-zinc-400">
                  {profile.email || "No email"} · {profile.role || "No role"}
                </p>
                <p className="mt-3 text-sm font-semibold text-zinc-200">
                  {profile.institution || profile.hostInfo || "No institution or host info recorded"}
                </p>
              </div>
            </div>

            <div className="space-y-3 lg:text-right">
              <span
                className={`inline-flex rounded-full border px-4 py-2 text-xs font-black uppercase ${statusClass(profile.overallStatus)}`}
              >
                {statusLabel(profile.overallStatus)}
              </span>
              <p className="text-sm text-zinc-400">
                {profile.pendingCount > 0
                  ? `${profile.pendingCount} manual review action${profile.pendingCount === 1 ? "" : "s"} pending`
                  : "No manual review actions pending"}
              </p>
              <Link
                href={`/users/${profile.userId}`}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold hover:bg-white/10"
              >
                Public profile
                <ExternalLink className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </header>

        {message && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-zinc-200">
            {message}
          </div>
        )}

        <section className="grid gap-4">
          {sectionTypes.map((type) => {
            const record = profile.records[type];
            const status = record?.status || "not_started";
            const canReview =
              record &&
              record.source === "verification_submissions" &&
              isManualVerification(type);

            return (
              <article
                key={type}
                className="rounded-[2rem] border border-white/10 bg-zinc-950 p-6"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-pink-500/10 text-pink-200">
                        {status === "approved" ? (
                          <BadgeCheck className="h-5 w-5" />
                        ) : (
                          <ShieldCheck className="h-5 w-5" />
                        )}
                      </div>
                      <div>
                        <h2 className="text-xl font-black">
                          {verificationTypeLabel(type)}
                        </h2>
                        <p className="mt-1 text-sm text-zinc-500">
                          {isManualVerification(type)
                            ? "Manual trust review"
                            : "Automatic account verification"}
                        </p>
                      </div>
                    </div>
                  </div>
                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-black uppercase ${statusClass(status)}`}
                  >
                    {statusLabel(status)}
                  </span>
                </div>

                <div className="mt-6 grid gap-3 md:grid-cols-4">
                  <Info label="Submitted" value={formatDate(record?.submittedAt)} />
                  <Info
                    label="Verified / reviewed"
                    value={formatDate(record?.reviewedAt || record?.verifiedAt)}
                  />
                  <Info label="Reviewer" value={record?.reviewerName || "Not reviewed"} />
                  <Info
                    label={type === "phone" ? "Phone" : "Source"}
                    value={type === "phone" ? record?.phoneMasked || "Not recorded" : record?.source?.replaceAll("_", " ") || "No record"}
                  />
                </div>

                {record?.rejectionReason && (
                  <div className="mt-5 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-100">
                    {record.rejectionReason}
                  </div>
                )}

                {record && metadataEntries(record).length > 0 && (
                  <div className="mt-5 rounded-2xl border border-white/10 bg-black/40 p-4">
                    <p className="text-sm font-black text-white">Metadata</p>
                    <div className="mt-3 grid gap-2 md:grid-cols-2">
                      {metadataEntries(record).map(([key, value]) => (
                        <Info key={key} label={key.replaceAll("_", " ")} value={String(value)} />
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-5 rounded-2xl border border-white/10 bg-black/40 p-4">
                  <p className="font-black text-white">Documents</p>
                  {!record || record.documentPaths.length === 0 ? (
                    <p className="mt-3 text-sm text-zinc-500">
                      No private documents are attached to this section.
                    </p>
                  ) : (
                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      {record.documentPaths.map((path, index) => (
                        <button
                          key={path}
                          type="button"
                          onClick={() => openDocument(path)}
                          className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left transition hover:border-pink-400/40 hover:bg-white/10"
                        >
                          <div className="flex h-24 items-center justify-center rounded-xl border border-white/10 bg-black text-zinc-500">
                            <FileText className="h-8 w-8" />
                          </div>
                          <p className="mt-3 text-sm font-black text-white">
                            {documentLabel(path)}
                          </p>
                          <p className="mt-1 text-xs text-zinc-500">
                            {verificationTypeLabel(type)} document {index + 1}
                          </p>
                          <p className="mt-3 text-xs font-bold text-pink-200">
                            View full size
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {canReview && (
                  <div className="mt-5 rounded-2xl border border-pink-500/20 bg-pink-500/10 p-4">
                    <p className="font-black text-pink-100">Review action</p>
                    <textarea
                      value={reasonByRecord[record.id] || ""}
                      onChange={(event) =>
                        setReasonByRecord((previous) => ({
                          ...previous,
                          [record.id]: event.target.value,
                        }))
                      }
                      placeholder="Required for rejection or more information requests"
                      rows={3}
                      className="mt-3 w-full rounded-2xl border border-white/10 bg-black p-4 text-white outline-none placeholder:text-zinc-600 focus:border-pink-400"
                    />
                    <div className="mt-4 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => review(record, "approve")}
                        disabled={workingId === record.id}
                        className="rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-black text-black disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => review(record, "resubmission")}
                        disabled={workingId === record.id}
                        className="rounded-2xl border border-blue-500/25 bg-blue-500/10 px-5 py-3 text-sm font-bold text-blue-100 disabled:opacity-50"
                      >
                        Request more information
                      </button>
                      <button
                        type="button"
                        onClick={() => review(record, "reject")}
                        disabled={workingId === record.id}
                        className="rounded-2xl border border-red-500/25 bg-red-500/10 px-5 py-3 text-sm font-bold text-red-100 disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-zinc-950 p-6">
          <h2 className="text-xl font-black">Audit history</h2>
          <div className="mt-4 space-y-3">
            {profile.allRecords.length === 0 ? (
              <p className="text-sm text-zinc-500">No verification history yet.</p>
            ) : (
              profile.allRecords
                .slice()
                .sort((a, b) =>
                  String(b.submittedAt || b.reviewedAt || b.verifiedAt || "").localeCompare(
                    String(a.submittedAt || a.reviewedAt || a.verifiedAt || "")
                  )
                )
                .map((record) => (
                  <div
                    key={`${record.source}:${record.id}`}
                    className="rounded-2xl border border-white/10 bg-black/40 p-4"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <p className="font-bold text-white">
                        {verificationTypeLabel(record.verificationType)}
                      </p>
                      <span
                        className={`w-fit rounded-full border px-3 py-1 text-xs font-black uppercase ${statusClass(record.status)}`}
                      >
                        {statusLabel(record.status)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-zinc-500">
                      {record.source.replaceAll("_", " ")} · Submitted{" "}
                      {formatDate(record.submittedAt)} · Reviewed{" "}
                      {formatDate(record.reviewedAt || record.verifiedAt)}
                    </p>
                  </div>
                ))
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-zinc-500">
        {label}
      </p>
      <p className="mt-2 break-words text-sm font-semibold text-zinc-200">
        {value}
      </p>
    </div>
  );
}
