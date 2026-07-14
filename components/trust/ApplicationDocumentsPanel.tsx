"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  CheckCircle2,
  ExternalLink,
  FileText,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Upload,
  XCircle,
} from "lucide-react";
import {
  documentTypes,
  getDocumentTypeLabel,
  isHighRiskDocumentType,
  requirementLevels,
  validateSecureDocumentFile,
} from "@/lib/trust/document-types";
import {
  FairHousingNotice,
  PersonalInformationNotice,
} from "@/components/trust/TrustDisclaimers";

type DocumentSubmission = {
  id: string;
  original_filename: string | null;
  applicant_note: string | null;
  status: string;
  created_at: string;
  rejection_reason: string | null;
};

type DocumentRequest = {
  id: string;
  document_type: string;
  custom_title: string | null;
  purpose: string;
  requirement_level: string;
  alternative_documents: string[] | null;
  status: string;
  due_at: string | null;
  created_at: string;
  rental_document_submissions?: DocumentSubmission[];
};

export default function ApplicationDocumentsPanel({
  inquiryId,
  isOwner,
}: {
  inquiryId: string;
  isOwner: boolean;
}) {
  const [requests, setRequests] = useState<DocumentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [openingSubmissionId, setOpeningSubmissionId] = useState<string | null>(
    null
  );
  const [updatingSubmission, setUpdatingSubmission] = useState<{
    id: string;
    action: "accept" | "request_replacement" | "withdraw";
  } | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const [documentType, setDocumentType] = useState("proof_of_enrolment");
  const [customTitle, setCustomTitle] = useState("");
  const [purpose, setPurpose] = useState("");
  const [requirementLevel, setRequirementLevel] = useState("required");
  const [dueAt, setDueAt] = useState("");
  const [alternatives, setAlternatives] = useState("");

  const highRisk = useMemo(
    () => isHighRiskDocumentType(documentType),
    [documentType]
  );

  async function loadRequests() {
    setLoading(true);
    setError("");

    const response = await fetch(
      `/api/rental-documents/requests?inquiryId=${encodeURIComponent(inquiryId)}`
    );
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      setError(data?.error || "Could not load application document requests.");
      setLoading(false);
      return;
    }

    setRequests(data?.requests || []);
    setLoading(false);
  }

  useEffect(() => {
    loadRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inquiryId]);

  async function createRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setNotice("");

    const response = await fetch("/api/rental-documents/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        inquiryId,
        documentType,
        customTitle,
        purpose,
        requirementLevel,
        dueAt: dueAt || null,
        alternativeDocuments: alternatives
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      }),
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      setError(data?.error || "Could not send document request.");
      setSubmitting(false);
      return;
    }

    setCustomTitle("");
    setPurpose("");
    setDueAt("");
    setAlternatives("");
    setNotice("Document request sent securely.");
    await loadRequests();
    setSubmitting(false);
  }

  async function uploadSubmission(
    requestId: string,
    file: File | null,
    note: string,
    acknowledged: boolean
  ) {
    setError("");
    setNotice("");

    if (!file) {
      setError("Choose a file before uploading.");
      return;
    }

    const validationError = validateSecureDocumentFile(file);

    if (validationError) {
      setError(validationError);
      return;
    }

    const formData = new FormData();
    formData.set("requestId", requestId);
    formData.set("file", file);
    formData.set("applicantNote", note);
    formData.set("acknowledged", String(acknowledged));

    const response = await fetch("/api/rental-documents/submissions", {
      method: "POST",
      body: formData,
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      setError(data?.error || "Could not upload document.");
      return;
    }

    setNotice("Document uploaded securely.");
    await loadRequests();
  }

  async function openSubmission(submissionId: string) {
    setError("");
    setNotice("");
    setOpeningSubmissionId(submissionId);

    const previewWindow = window.open("", "_blank");

    try {
      const response = await fetch(
        `/api/rental-documents/submissions/${submissionId}/signed-url`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ inquiryId }),
        }
      );
      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.success || !data?.signedUrl) {
        previewWindow?.close();
        setError(data?.error || "We could not open this document.");
        return;
      }

      if (previewWindow) {
        previewWindow.opener = null;
        previewWindow.location.href = data.signedUrl;
      } else {
        window.location.href = data.signedUrl;
      }
    } catch (error) {
      console.error("RENTAL DOCUMENT PREVIEW ERROR:", error);
      previewWindow?.close();
      setError("We could not open this document.");
    } finally {
      setOpeningSubmissionId(null);
    }
  }

  async function updateSubmission(
    submissionId: string,
    action: "accept" | "request_replacement" | "withdraw",
    reason = ""
  ) {
    setError("");
    setNotice("");
    setUpdatingSubmission({ id: submissionId, action });

    try {
      const response = await fetch(
        `/api/rental-documents/submissions/${submissionId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, reason }),
        }
      );
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setError(data?.error || "Could not update document.");
        return;
      }

      setNotice(
        action === "accept"
          ? "Document accepted."
          : action === "request_replacement"
            ? "Replacement requested."
            : "Document withdrawn."
      );
      await loadRequests();
    } catch (error) {
      console.error("RENTAL DOCUMENT ACTION ERROR:", error);
      setError("Could not update document.");
    } finally {
      setUpdatingSubmission(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-white/10 bg-zinc-950 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-pink-300">
              Secure application documents
            </p>
            <h2 className="mt-2 text-2xl font-black text-white">
              Application documents
            </h2>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              Request, submit, and review documents using private storage and
              short-lived preview links.
            </p>
          </div>
          <button
            type="button"
            onClick={loadRequests}
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white hover:bg-white/10"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
      </div>

      {notice && (
        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4 text-sm font-semibold text-emerald-200">
          {notice}
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm font-semibold text-red-200">
          {error}
        </div>
      )}

      {isOwner && (
        <form
          onSubmit={createRequest}
          className="space-y-4 rounded-3xl border border-white/10 bg-black p-5"
        >
          <FairHousingNotice />
          <div className="grid gap-4 md:grid-cols-2">
            <Label title="Document type">
              <select
                value={documentType}
                onChange={(event) => setDocumentType(event.target.value)}
                className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 p-3 text-white outline-none focus:border-pink-400"
              >
                {documentTypes.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </Label>

            <Label title="Requirement level">
              <select
                value={requirementLevel}
                onChange={(event) => setRequirementLevel(event.target.value)}
                className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 p-3 text-white outline-none focus:border-pink-400"
              >
                {requirementLevels.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </Label>
          </div>

          {highRisk && (
            <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4 text-sm leading-6 text-amber-100">
              This document type can contain sensitive personal information. Do
              not request a Social Insurance Number and accept reasonable
              alternatives where appropriate.
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <Label title="Custom title">
              <input
                value={customTitle}
                onChange={(event) => setCustomTitle(event.target.value)}
                placeholder="Optional display title"
                className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 p-3 text-white outline-none focus:border-pink-400"
              />
            </Label>
            <Label title="Due date">
              <input
                type="date"
                value={dueAt}
                onChange={(event) => setDueAt(event.target.value)}
                className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 p-3 text-white outline-none focus:border-pink-400"
              />
            </Label>
          </div>

          <Label title="Purpose">
            <textarea
              required
              value={purpose}
              onChange={(event) => setPurpose(event.target.value)}
              rows={3}
              placeholder="Explain why this document is reasonably needed for the rental application."
              className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 p-3 text-white outline-none focus:border-pink-400"
            />
          </Label>

          <Label title="Acceptable alternatives">
            <input
              value={alternatives}
              onChange={(event) => setAlternatives(event.target.value)}
              placeholder="Comma-separated, optional"
              className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 p-3 text-white outline-none focus:border-pink-400"
            />
          </Label>

          <button
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 font-black text-black hover:bg-zinc-200 disabled:opacity-50"
          >
            {submitting ? <Loader2 className="animate-spin" size={16} /> : <FileText size={16} />}
            Send document request
          </button>
        </form>
      )}

      <PersonalInformationNotice />

      {loading ? (
        <div className="rounded-3xl border border-white/10 bg-zinc-950 p-5 text-zinc-400">
          Loading document requests...
        </div>
      ) : requests.length === 0 ? (
        <div className="rounded-3xl border border-white/10 bg-zinc-950 p-6 text-center">
          <FileText className="mx-auto text-zinc-500" size={28} />
          <p className="mt-3 font-bold text-white">No document requests yet</p>
          <p className="mt-2 text-sm text-zinc-500">
            Application document requests will appear here after the inquiry is accepted.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((item) => (
            <DocumentRequestCard
              key={item.id}
              request={item}
              isOwner={isOwner}
              openingSubmissionId={openingSubmissionId}
              updatingSubmission={updatingSubmission}
              onUpload={uploadSubmission}
              onOpen={openSubmission}
              onUpdate={updateSubmission}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DocumentRequestCard({
  request,
  isOwner,
  openingSubmissionId,
  updatingSubmission,
  onUpload,
  onOpen,
  onUpdate,
}: {
  request: DocumentRequest;
  isOwner: boolean;
  openingSubmissionId: string | null;
  updatingSubmission: {
    id: string;
    action: "accept" | "request_replacement" | "withdraw";
  } | null;
  onUpload: (
    requestId: string,
    file: File | null,
    note: string,
    acknowledged: boolean
  ) => void | Promise<void>;
  onOpen: (submissionId: string) => void | Promise<void>;
  onUpdate: (
    submissionId: string,
    action: "accept" | "request_replacement" | "withdraw",
    reason?: string
  ) => void | Promise<void>;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const latestSubmission = request.rental_document_submissions?.[0];
  const isOpening = latestSubmission?.id === openingSubmissionId;
  const isUpdating = latestSubmission?.id === updatingSubmission?.id;
  const isAccepted = latestSubmission?.status === "accepted";
  const isReplacementRequested = request.status === "replacement_requested";

  return (
    <div className="rounded-3xl border border-white/10 bg-zinc-950 p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-bold uppercase text-zinc-300">
              {request.requirement_level.replaceAll("_", " ")}
            </span>
            <span className="rounded-full border border-pink-400/20 bg-pink-500/10 px-3 py-1 text-xs font-bold uppercase text-pink-200">
              {request.status.replaceAll("_", " ")}
            </span>
          </div>
          <h3 className="mt-3 text-xl font-black text-white">
            {request.custom_title || getDocumentTypeLabel(request.document_type)}
          </h3>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            {request.purpose}
          </p>
          {request.alternative_documents?.length ? (
            <p className="mt-2 text-sm text-zinc-500">
              Alternatives: {request.alternative_documents.join(", ")}
            </p>
          ) : null}
        </div>

        {request.due_at && (
          <p className="rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm font-semibold text-zinc-300">
            Due {new Date(request.due_at).toLocaleDateString("en-CA")}
          </p>
        )}
      </div>

      {isHighRiskDocumentType(request.document_type) && (
        <div className="mt-4 flex gap-3 rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4 text-sm leading-6 text-amber-100">
          <ShieldAlert className="mt-0.5 shrink-0" size={18} />
          Redact full account numbers, Social Insurance Numbers, passport
          numbers, unrelated transactions, and unnecessary personal details.
        </div>
      )}

      {latestSubmission && (
        <div className="mt-4 rounded-2xl border border-white/10 bg-black p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-bold text-white">
                {latestSubmission.original_filename || "Submitted document"}
              </p>
              <p className="mt-1 text-sm text-zinc-500">
                Status: {latestSubmission.status.replaceAll("_", " ")}
              </p>
              {latestSubmission.rejection_reason && (
                <p className="mt-2 text-sm text-amber-200">
                  {latestSubmission.rejection_reason}
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onOpen(latestSubmission.id)}
                disabled={isOpening || isUpdating}
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-white hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isOpening ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <ExternalLink size={15} />
                )}
                {isOpening ? "Opening..." : "Preview"}
              </button>
              {isOwner ? (
                <>
                  <button
                    type="button"
                    onClick={() => onUpdate(latestSubmission.id, "accept")}
                    disabled={isOpening || isUpdating || isAccepted}
                    className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-2 text-sm font-bold text-emerald-200 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isUpdating && updatingSubmission?.action === "accept" ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <CheckCircle2 size={15} />
                    )}
                    {isUpdating && updatingSubmission?.action === "accept"
                      ? "Accepting..."
                      : isAccepted
                        ? "Accepted ✓"
                        : "Accept"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const reason = window.prompt("Reason for replacement request");
                      if (reason !== null) {
                        onUpdate(latestSubmission.id, "request_replacement", reason);
                      }
                    }}
                    disabled={isOpening || isUpdating || isReplacementRequested}
                    className="inline-flex items-center gap-2 rounded-xl border border-amber-400/20 bg-amber-500/10 px-4 py-2 text-sm font-bold text-amber-200 hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isUpdating &&
                    updatingSubmission?.action === "request_replacement" ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <RefreshCw size={15} />
                    )}
                    {isUpdating &&
                    updatingSubmission?.action === "request_replacement"
                      ? "Requesting..."
                      : isReplacementRequested
                        ? "Replacement requested"
                        : "Replace"}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm("Withdraw this submitted document?")) {
                      onUpdate(latestSubmission.id, "withdraw");
                    }
                  }}
                  disabled={isOpening || isUpdating || latestSubmission.status === "withdrawn"}
                  className="inline-flex items-center gap-2 rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-2 text-sm font-bold text-red-200 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isUpdating && updatingSubmission?.action === "withdraw" ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <XCircle size={15} />
                  )}
                  {isUpdating && updatingSubmission?.action === "withdraw"
                    ? "Withdrawing..."
                    : "Withdraw"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {!isOwner && ["requested", "replacement_requested"].includes(request.status) && (
        <div className="mt-4 space-y-3 rounded-2xl border border-white/10 bg-black p-4">
          <input
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp"
            onChange={(event) => setFile(event.target.files?.[0] || null)}
            className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-sm text-white"
          />
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Optional note"
            rows={3}
            className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-sm text-white outline-none focus:border-pink-400"
          />
          <label className="flex items-start gap-3 text-sm leading-6 text-zinc-300">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(event) => setAcknowledged(event.target.checked)}
              className="mt-1 h-4 w-4 accent-pink-500"
            />
            <span>
              I understand who will receive this document and why it was requested.
            </span>
          </label>
          <button
            type="button"
            onClick={() => onUpload(request.id, file, note, acknowledged)}
            className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-black text-black hover:bg-zinc-200"
          >
            <Upload size={15} />
            Upload securely
          </button>
        </div>
      )}
    </div>
  );
}

function Label({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-zinc-300">
        {title}
      </span>
      {children}
    </label>
  );
}
