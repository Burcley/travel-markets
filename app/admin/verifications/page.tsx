"use client";

import Link from "next/link";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  getPropertyVerificationDocumentTypeLabel,
  propertyVerificationDocumentTypes,
  relationshipClaimDescriptions,
  relationshipTypes,
} from "@/lib/trust/document-types";

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

type PropertyVerification = {
  id: string;
  listing_id: string;
  owner_id: string;
  status: string;
  relationship_type: string | null;
  submitted_at: string | null;
  expires_at: string | null;
  admin_notes: string | null;
  owner_visible_reason: string | null;
  other_relationship_explanation?: string | null;
  reviewed_at?: string | null;
  listings?: {
    title: string | null;
    city: string | null;
    campus: string | null;
    address?: string | null;
    address_line?: string | null;
    location?: string | null;
  } | null;
  reviewer?: {
    full_name: string | null;
  } | null;
  owner_profile?: {
    full_name: string | null;
    is_verified: boolean | null;
    identity_verification_status?: string | null;
  } | null;
  listing_verification_documents?: {
    id: string;
    original_filename: string | null;
    document_type: string | null;
    file_size: number | null;
    mime_type: string | null;
    review_status: string;
    rejection_reason?: string | null;
    reviewed_at?: string | null;
    uploader?: {
      full_name: string | null;
    } | null;
    reviewer?: {
      full_name: string | null;
    } | null;
    created_at: string;
  }[];
  listing_verification_audit_events?: {
    id: string;
    event_type: string;
    metadata: Record<string, unknown>;
    created_at: string;
  }[];
};

export default function AdminVerificationsPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [items, setItems] = useState<Verification[]>([]);
  const [propertyItems, setPropertyItems] = useState<PropertyVerification[]>([]);
  const [propertyFilter, setPropertyFilter] = useState("pending");
  const [propertyError, setPropertyError] = useState("");
  const [propertyActionError, setPropertyActionError] = useState("");
  const [propertySuccessMessage, setPropertySuccessMessage] = useState("");
  const [previewingDocumentId, setPreviewingDocumentId] = useState<string | null>(
    null
  );
  const [documentAction, setDocumentAction] = useState<{
    id: string;
    action: "accepted" | "rejected" | "pending";
  } | null>(null);
  const [rejectingDocumentId, setRejectingDocumentId] = useState<string | null>(
    null
  );
  const [rejectionReasons, setRejectionReasons] = useState<
    Record<string, string>
  >({});
  const [approvalAcknowledgements, setApprovalAcknowledgements] = useState<
    Record<string, boolean>
  >({});
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

    await loadPropertyVerifications(propertyFilter);

    setLoading(false);
  }

  async function loadPropertyVerifications(statusFilter = propertyFilter) {
    setPropertyError("");

    let query = supabase
      .from("listing_verifications")
      .select(
        `
        id,
        listing_id,
        owner_id,
        status,
        relationship_type,
        submitted_at,
        expires_at,
        admin_notes,
        owner_visible_reason,
        other_relationship_explanation,
        reviewed_at,
        listings (
          title,
          city,
          campus,
          address,
          address_line,
          location
        ),
        reviewer:profiles!listing_verifications_reviewed_by_fkey (
          full_name
        ),
        owner_profile:profiles!listing_verifications_owner_id_fkey (
          full_name,
          is_verified,
          identity_verification_status
        ),
        listing_verification_documents (
          id,
          original_filename,
          document_type,
          file_size,
          mime_type,
          review_status,
          rejection_reason,
          reviewed_at,
          uploader:profiles!listing_verification_documents_uploader_id_fkey (
            full_name
          ),
          reviewer:profiles!listing_verification_documents_reviewed_by_fkey (
            full_name
          ),
          created_at
        ),
        listing_verification_audit_events (
          id,
          event_type,
          metadata,
          created_at
        )
      `
      )
      .order("submitted_at", { ascending: false });

    if (statusFilter !== "all") {
      query = query.eq("status", statusFilter);
    }

    const { data, error } = await query;

    if (error) {
      console.error("PROPERTY VERIFICATIONS ERROR:", error);
      setPropertyError("We could not load property-verification submissions.");
      setPropertyItems([]);
      return;
    }

    setPropertyItems((data || []) as unknown as PropertyVerification[]);
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

  async function updatePropertyVerification(
    item: PropertyVerification,
    status: "verified" | "more_information_required" | "declined",
    reason?: string
  ) {
    try {
      setPropertyActionError("");
      setPropertySuccessMessage("");
      setWorkingId(item.id);
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (
        status === "verified" &&
        !item.listing_verification_documents?.some(
          (document) => document.review_status === "accepted"
        )
      ) {
        setPropertyActionError(
          "Accept at least one verification document before approving the listing verification."
        );
        return;
      }

      if (status === "verified" && !approvalAcknowledgements[item.id]) {
        setPropertyActionError(
          "Confirm that you reviewed the submitted documents and relationship claim before approving."
        );
        return;
      }

      const adminNotes = window.prompt("Private admin notes:", item.admin_notes || "");

      const expiresAt =
        status === "verified"
          ? window.prompt("Expiration date (YYYY-MM-DD):", "")
          : null;

      if (status === "verified" && expiresAt === null) return;

      const { error } = await supabase
        .from("listing_verifications")
        .update({
          status,
          reviewed_at: new Date().toISOString(),
          reviewed_by: user?.id || null,
          admin_notes: adminNotes || item.admin_notes || null,
          owner_visible_reason: reason || null,
          expires_at: expiresAt || null,
        })
        .eq("id", item.id);

      if (error) {
        alert(error.message);
        return;
      }

      await supabase.from("listing_verification_audit_events").insert({
        listing_id: item.listing_id,
        verification_id: item.id,
        actor_id: user?.id || null,
        event_type:
          status === "verified"
            ? "verification_approved"
            : status === "more_information_required"
              ? "verification_more_information_requested"
              : "verification_declined",
        metadata: {
          action: status,
        },
      });

      await supabase.from("notifications").insert({
        user_id: item.owner_id,
        title:
          status === "verified"
            ? "Listing verification approved"
            : status === "declined"
              ? "Listing verification declined"
              : "More information required",
        body:
          reason ||
          "Your listing verification status was updated by Travel Markets.",
        message:
          reason ||
          "Your listing verification status was updated by Travel Markets.",
        type: `listing_verification_${status}`,
        is_read: false,
        link: `/listings/${item.listing_id}`,
      });

      await loadPropertyVerifications();
      setPropertySuccessMessage(
        status === "verified"
          ? "Verification approved."
          : "Verification status updated."
      );
      router.refresh();
    } finally {
      setWorkingId(null);
    }
  }

  async function reviewPropertyDocument(
    documentId: string,
    reviewStatus: "accepted" | "rejected"
  ) {
    const rejectionReason =
      reviewStatus === "rejected" ? rejectionReasons[documentId]?.trim() : "";

    if (reviewStatus === "rejected" && !rejectionReason) return;

    setPropertyActionError("");
    setPropertySuccessMessage("");
    setDocumentAction({ id: documentId, action: reviewStatus });

    try {
      const response = await fetch(
        `/api/listing-verifications/documents/${documentId}/review`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reviewStatus,
            rejectionReason,
          }),
        }
      );
      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.success) {
        setPropertyActionError(
          reviewStatus === "accepted"
            ? "We could not accept this document."
            : "We could not reject this document."
        );
        return;
      }

      if (reviewStatus === "rejected") {
        setRejectingDocumentId(null);
        setRejectionReasons((current) => ({ ...current, [documentId]: "" }));
      }

      setPropertySuccessMessage(
        reviewStatus === "accepted"
          ? "Document accepted."
          : "Document rejected."
      );
      await loadPropertyVerifications();
      router.refresh();
    } catch (error) {
      console.error("PROPERTY VERIFICATION DOCUMENT REVIEW ERROR:", error);
      setPropertyActionError(
        reviewStatus === "accepted"
          ? "We could not accept this document."
          : "We could not reject this document."
      );
    } finally {
      setDocumentAction(null);
    }
  }

  async function previewPropertyDocument(documentId: string) {
    setPropertyActionError("");
    setPreviewingDocumentId(documentId);

    const previewWindow = window.open("", "_blank");

    try {
      const response = await fetch(
        `/api/listing-verifications/documents/${documentId}/signed-url`,
        { method: "POST" }
      );
      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.success || !data?.signedUrl) {
        previewWindow?.close();
        setPropertyActionError(
          data?.error || "We could not open this verification document."
        );
        return;
      }

      if (previewWindow) {
        previewWindow.opener = null;
        previewWindow.location.href = data.signedUrl;
      } else {
        window.location.href = data.signedUrl;
      }
    } catch (error) {
      console.error("PROPERTY VERIFICATION PREVIEW ERROR:", error);
      previewWindow?.close();
      setPropertyActionError("We could not open this verification document.");
    } finally {
      setPreviewingDocumentId(null);
    }
  }

  function formatFileSize(size: number | null) {
    if (!size) return "Unknown size";
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / 1024 / 1024).toFixed(2)} MB`;
  }

  function formatDateTime(date: string | null | undefined) {
    if (!date) return "Not recorded";

    return new Date(date).toLocaleString("en-CA", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function getRelationshipLabel(value: string | null) {
    return (
      relationshipTypes.find((item) => item.value === value)?.label ||
      "Relationship not set"
    );
  }

  function getDocumentCounts(item: PropertyVerification) {
    const documents = item.listing_verification_documents || [];

    return {
      total: documents.length,
      accepted: documents.filter((document) => document.review_status === "accepted")
        .length,
      rejected: documents.filter((document) => document.review_status === "rejected")
        .length,
      pending: documents.filter((document) => document.review_status === "pending")
        .length,
    };
  }

  function getStatusBadgeClass(status: string) {
    if (status === "accepted" || status === "verified") {
      return "border-emerald-500/20 bg-emerald-500/10 text-emerald-200";
    }

    if (status === "rejected" || status === "declined") {
      return "border-red-500/20 bg-red-500/10 text-red-200";
    }

    if (status === "more_information_required") {
      return "border-blue-500/20 bg-blue-500/10 text-blue-200";
    }

    return "border-yellow-500/20 bg-yellow-500/10 text-yellow-200";
  }

  function getFileFormat(mimeType: string | null) {
    if (!mimeType) return "Unknown format";
    if (mimeType === "application/pdf") return "PDF";
    if (mimeType.includes("jpeg")) return "JPG image";
    if (mimeType.includes("png")) return "PNG image";
    if (mimeType.includes("webp")) return "WEBP image";
    return mimeType;
  }

  function getAdminDocumentTypeLabel(
    documentType: string | null,
    relationshipType: string | null
  ) {
    if (
      propertyVerificationDocumentTypes.some(
        (item) => item.value === documentType
      )
    ) {
      return getPropertyVerificationDocumentTypeLabel(documentType);
    }

    if (relationshipTypes.some((item) => item.value === documentType)) {
      return `Legacy supporting document for ${getRelationshipLabel(documentType)}`;
    }

    return `Supporting document for ${getRelationshipLabel(relationshipType)}`;
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
            <h1 className="text-3xl font-bold">Verifications</h1>
          </div>

          <Link
            href="/admin"
            className="rounded-full border border-white/10 px-5 py-2 text-sm text-white/70 hover:bg-white/10"
          >
            Back to Admin
          </Link>
        </div>

        <section className="mb-10 rounded-3xl border border-pink-500/20 bg-pink-500/5 p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-pink-300">
                Property verification
              </p>
              <h2 className="mt-2 text-2xl font-black">
                Listing relationship reviews
              </h2>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                Review documents connecting an account to a property or
                authorized management. Approval does not imply property
                inspection or legal compliance.
              </p>
            </div>
            <select
              value={propertyFilter}
              onChange={async (event) => {
                setPropertyFilter(event.target.value);
                await loadPropertyVerifications(event.target.value);
              }}
              className="rounded-2xl border border-white/10 bg-black px-4 py-3 text-white"
            >
              {[
                "pending",
                "verified",
                "more_information_required",
                "declined",
                "expired",
                "all",
              ].map((status) => (
                <option key={status} value={status}>
                  {status.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-6 space-y-4">
            {propertyActionError && (
              <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-4 text-sm font-semibold text-yellow-100">
                {propertyActionError}
              </div>
            )}
            {propertySuccessMessage && (
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm font-semibold text-emerald-100">
                {propertySuccessMessage}
              </div>
            )}

            {propertyError ? (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-6 text-center text-red-200">
                {propertyError}
              </div>
            ) : propertyItems.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-zinc-500">
                {propertyFilter === "pending"
                  ? "No property-verification submissions are waiting for review."
                  : "No property verification submissions found."}
              </div>
            ) : (
              propertyItems.map((item) => {
                const counts = getDocumentCounts(item);
                const isVerified = item.status === "verified";
                const approvalReady =
                  counts.accepted > 0 && approvalAcknowledgements[item.id];
                const publicAddress =
                  item.listings?.address_line ||
                  item.listings?.address ||
                  item.listings?.location ||
                  "No public address recorded";

                return (
                <div
                  key={item.id}
                  className="rounded-3xl border border-white/10 bg-zinc-950 p-5"
                >
                  <div className="grid gap-5 lg:grid-cols-[1fr_260px]">
                    <div className="space-y-5">
                      <div>
                        <div className="flex flex-wrap gap-2">
                          <span
                            className={`rounded-full border px-3 py-1 text-xs font-bold uppercase ${getStatusBadgeClass(
                              item.status
                            )}`}
                          >
                            {item.status.replaceAll("_", " ")}
                          </span>
                          <span className="rounded-full border border-pink-400/20 bg-pink-500/10 px-3 py-1 text-xs font-bold uppercase text-pink-200">
                            {getRelationshipLabel(item.relationship_type)}
                          </span>
                        </div>
                        <h3 className="mt-4 text-xl font-bold">
                          {item.listings?.title || "Untitled listing"}
                        </h3>
                        <div className="mt-4 grid gap-3 rounded-2xl border border-white/10 bg-black/40 p-4 text-sm md:grid-cols-2">
                          <SummaryField label="City / campus">
                            {item.listings?.city || "Unknown city"}
                            {item.listings?.campus
                              ? ` • ${item.listings.campus}`
                              : ""}
                          </SummaryField>
                          <SummaryField label="Public address">
                            {publicAddress}
                          </SummaryField>
                          <SummaryField label="Landlord">
                            {item.owner_profile?.full_name || item.owner_id}
                          </SummaryField>
                          <SummaryField label="Identity status">
                            {item.owner_profile?.identity_verification_status ||
                              (item.owner_profile?.is_verified
                                ? "Identity verified"
                                : "Not verified")}
                          </SummaryField>
                          <SummaryField label="Submitted">
                            {formatDateTime(item.submitted_at)}
                          </SummaryField>
                          <SummaryField label="Documents">
                            {counts.total} total • {counts.accepted} accepted •{" "}
                            {counts.rejected} rejected • {counts.pending} pending
                          </SummaryField>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-pink-500/20 bg-pink-500/10 p-4">
                        <p className="text-sm font-bold text-pink-100">
                          What the landlord is claiming
                        </p>
                        <p className="mt-2 text-sm leading-6 text-pink-50/80">
                          {relationshipClaimDescriptions[
                            item.relationship_type || ""
                          ] || "The landlord has not selected a relationship type."}
                        </p>
                        {item.relationship_type === "other" &&
                          item.other_relationship_explanation && (
                            <p className="mt-3 rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-white">
                              {item.other_relationship_explanation}
                            </p>
                          )}
                      </div>

                      <div className="flex flex-wrap gap-3">
                        <Link
                          href={`/listings/${item.listing_id}`}
                          className="rounded-xl border border-white/10 px-4 py-2 text-sm hover:bg-white/10"
                        >
                          View listing
                        </Link>
                        <Link
                          href={`/users/${item.owner_id}`}
                          className="rounded-xl border border-white/10 px-4 py-2 text-sm hover:bg-white/10"
                        >
                          View landlord profile
                        </Link>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-zinc-300">
                        Preview the document and confirm that it reasonably
                        supports the selected property relationship before
                        accepting it.
                      </div>

                      <div className="grid gap-3">
                        {item.listing_verification_documents?.map((document) => {
                          const isAccepted =
                            document.review_status === "accepted";
                          const isRejected =
                            document.review_status === "rejected";
                          const isWorking =
                            documentAction?.id === document.id ||
                            previewingDocumentId === document.id;

                          return (
                            <div
                              key={document.id}
                              className="rounded-2xl border border-white/10 bg-black p-4"
                            >
                              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold text-white">
                                    {document.original_filename ||
                                      "Uploaded verification document"}
                                  </p>
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    <span
                                      className={`rounded-full border px-3 py-1 text-xs font-bold uppercase ${getStatusBadgeClass(
                                        document.review_status
                                      )}`}
                                    >
                                      {document.review_status}
                                    </span>
                                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300">
                                      {getAdminDocumentTypeLabel(
                                        document.document_type,
                                        item.relationship_type
                                      )}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="mt-4 grid gap-3 text-xs text-zinc-400 md:grid-cols-2">
                                <SummaryField label="File format">
                                  {getFileFormat(document.mime_type)}
                                </SummaryField>
                                <SummaryField label="File size">
                                  {formatFileSize(document.file_size)}
                                </SummaryField>
                                <SummaryField label="Uploaded">
                                  {formatDateTime(document.created_at)}
                                </SummaryField>
                                <SummaryField label="Uploaded by">
                                  {document.uploader?.full_name || item.owner_id}
                                </SummaryField>
                                <SummaryField label="Supports">
                                  {getRelationshipLabel(item.relationship_type)}
                                </SummaryField>
                                <SummaryField label="Reviewed">
                                  {document.reviewed_at
                                    ? `${formatDateTime(document.reviewed_at)}${
                                        document.reviewer?.full_name
                                          ? ` by ${document.reviewer.full_name}`
                                          : ""
                                      }`
                                    : "Not reviewed"}
                                </SummaryField>
                              </div>

                              {document.rejection_reason && (
                                <p className="mt-3 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-200">
                                  {document.rejection_reason}
                                </p>
                              )}

                              {rejectingDocumentId === document.id && (
                                <div className="mt-3 rounded-xl border border-red-500/20 bg-red-500/10 p-3">
                                  <label className="text-xs font-semibold text-red-100">
                                    Rejection reason
                                  </label>
                                  <textarea
                                    value={rejectionReasons[document.id] || ""}
                                    onChange={(event) =>
                                      setRejectionReasons((current) => ({
                                        ...current,
                                        [document.id]: event.target.value,
                                      }))
                                    }
                                    rows={3}
                                    className="mt-2 w-full rounded-xl border border-red-500/20 bg-black p-3 text-sm text-white outline-none focus:border-red-300"
                                  />
                                </div>
                              )}

                              <div className="mt-4 flex flex-wrap gap-2">
                                <button
                                  onClick={() =>
                                    previewPropertyDocument(document.id)
                                  }
                                  disabled={isWorking}
                                  className="rounded-xl border border-white/10 px-3 py-2 text-xs hover:bg-white/10 disabled:opacity-50"
                                >
                                  {previewingDocumentId === document.id
                                    ? "Opening..."
                                    : "Preview"}
                                </button>
                                <button
                                  onClick={() =>
                                    reviewPropertyDocument(document.id, "accepted")
                                  }
                                  disabled={isWorking || isAccepted}
                                  className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {documentAction?.id === document.id &&
                                  documentAction.action === "accepted"
                                    ? "Accepting..."
                                    : isAccepted
                                      ? "Accepted ✓"
                                      : "Accept"}
                                </button>
                                {isRejected ? (
                                  <button
                                    disabled
                                    className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200 opacity-60"
                                  >
                                    Rejected
                                  </button>
                                ) : rejectingDocumentId === document.id ? (
                                  <button
                                    onClick={() =>
                                      reviewPropertyDocument(
                                        document.id,
                                        "rejected"
                                      )
                                    }
                                    disabled={
                                      isWorking ||
                                      !rejectionReasons[document.id]?.trim()
                                    }
                                    className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200 disabled:opacity-50"
                                  >
                                    {documentAction?.id === document.id &&
                                    documentAction.action === "rejected"
                                      ? "Rejecting..."
                                      : "Confirm reject"}
                                  </button>
                                ) : (
                                  <button
                                    onClick={() =>
                                      setRejectingDocumentId(document.id)
                                    }
                                    disabled={isWorking}
                                    className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200 disabled:opacity-50"
                                  >
                                    Reject
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {item.listing_verification_audit_events?.length ? (
                        <div className="mt-4 rounded-2xl border border-white/10 bg-black p-4">
                          <p className="text-sm font-bold text-white">
                            Audit history
                          </p>
                          <div className="mt-3 space-y-2 text-xs text-zinc-500">
                            {item.listing_verification_audit_events.map((event) => (
                              <p key={event.id}>
                                {new Date(event.created_at).toLocaleString()} •{" "}
                                {event.event_type.replaceAll("_", " ")}
                              </p>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <div className="flex min-w-[230px] flex-col gap-3">
                      <div className="rounded-2xl border border-white/10 bg-black/40 p-4 text-sm">
                        <p className="font-bold text-white">Final review</p>
                        <p className="mt-2 text-xs leading-5 text-zinc-400">
                          Final approval should only happen after at least one
                          document is accepted and the relationship claim has
                          been reviewed.
                        </p>
                        {isVerified && (
                          <div className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-100">
                            <p className="font-bold">Verification approved</p>
                            <p className="mt-1">
                              Reviewed: {formatDateTime(item.reviewed_at)}
                            </p>
                            {item.reviewer?.full_name && (
                              <p className="mt-1">
                                Reviewed by: {item.reviewer.full_name}
                              </p>
                            )}
                          </div>
                        )}
                        {!isVerified && (
                          <label className="mt-3 flex items-start gap-2 text-xs leading-5 text-zinc-300">
                            <input
                              type="checkbox"
                              checked={Boolean(
                                approvalAcknowledgements[item.id]
                              )}
                              onChange={(event) =>
                                setApprovalAcknowledgements((current) => ({
                                  ...current,
                                  [item.id]: event.target.checked,
                                }))
                              }
                              className="mt-1 h-4 w-4 accent-pink-500"
                            />
                            <span>
                              I reviewed the submitted documents and the
                              landlord’s stated relationship to the property.
                            </span>
                          </label>
                        )}
                      </div>
                      <button
                        onClick={() =>
                          updatePropertyVerification(item, "verified")
                        }
                        disabled={
                          workingId === item.id || isVerified || !approvalReady
                        }
                        className="rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                      >
                        {isVerified ? "Verification approved ✓" : "Approve verification"}
                      </button>
                      <button
                        onClick={() => {
                          const reason = window.prompt(
                            "Landlord-visible reason:",
                            "Please provide additional information about your relationship to this property."
                          );
                          if (reason) {
                            updatePropertyVerification(
                              item,
                              "more_information_required",
                              reason
                            );
                          }
                        }}
                        disabled={workingId === item.id || isVerified}
                        className="rounded-xl bg-yellow-500 px-5 py-3 font-semibold text-black hover:bg-yellow-400 disabled:opacity-50"
                      >
                        Request more info
                      </button>
                      <button
                        onClick={() => {
                          const reason = window.prompt(
                            "Landlord-visible decline reason:",
                            "Travel Markets could not verify the submitted property relationship documents."
                          );
                          if (reason) {
                            updatePropertyVerification(item, "declined", reason);
                          }
                        }}
                        disabled={workingId === item.id || isVerified}
                        className="rounded-xl bg-red-600 px-5 py-3 font-semibold text-white hover:bg-red-500 disabled:opacity-50"
                      >
                        Decline verification
                      </button>
                    </div>
                  </div>
                </div>
                );
              })
            )}
          </div>
        </section>

        <h2 className="mb-5 text-2xl font-bold">Identity verifications</h2>

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

function SummaryField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">
        {label}
      </p>
      <div className="mt-1 text-sm text-zinc-200">{children}</div>
    </div>
  );
}
