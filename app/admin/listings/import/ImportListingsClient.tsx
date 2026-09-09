"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Image as ImageIcon,
  Loader2,
  MoveRight,
  Plus,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import {
  appendImageUploads,
  suggestImageAssignmentsForRows,
  type ImportImageUpload,
} from "@/lib/admin/listing-importer-images.mjs";
import type { NormalizedImportRow } from "@/lib/admin/listing-importer-core.mjs";

export type ImportLandlordOption = {
  id: string;
  fullName: string | null;
  email: string | null;
  role: string | null;
  accountStatus: string | null;
  verificationStatus: string;
};

type SkippedRow = {
  row: NormalizedImportRow;
  reason: string;
};

type PreviewResponse = {
  sourceFilename: string;
  importFormat: "legacy-template" | "legacy-header" | "enriched";
  summary: {
    rowsDetected: number;
    uniqueRows: number;
    skippedRows: number;
    duplicateRows: number;
    incompleteDuplicateRows: number;
    warningRows: number;
  };
  uniqueRows: NormalizedImportRow[];
  skippedRows: SkippedRow[];
  imageSuggestions: Record<string, string[]>;
};

type ImportResponse = {
  batchId: string;
  importedCount: number;
  skippedCount: number;
  failedCount: number;
  warningCount: number;
  results: Array<{
    listing_id?: string | null;
    source_fingerprint: string;
    status: string;
    reason?: string | null;
  }>;
};

function displayName(landlord: ImportLandlordOption) {
  return landlord.fullName || landlord.email || landlord.id;
}

function money(value: number | null) {
  if (value == null) return "Missing";
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(value);
}

function numericValue(value: string) {
  if (!value.trim()) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function booleanSelectValue(value: boolean | null) {
  if (value === true) return "true";
  if (value === false) return "false";
  return "";
}

function formatImportBadge(importFormat: PreviewResponse["importFormat"]) {
  return importFormat === "enriched"
    ? "ENRICHED FORMAT DETECTED"
    : "LEGACY TEMPLATE FORMAT DETECTED";
}

function statusClass(status: string) {
  const normalized = status.toLowerCase();
  if (["approved", "verified", "active"].includes(normalized)) {
    return "border-emerald-400/25 bg-emerald-400/10 text-emerald-200";
  }
  if (["pending", "submitted", "in_review"].includes(normalized)) {
    return "border-yellow-400/25 bg-yellow-400/10 text-yellow-100";
  }
  return "border-white/10 bg-white/5 text-zinc-300";
}

export default function ImportListingsClient({
  landlords,
}: {
  landlords: ImportLandlordOption[];
}) {
  const [query, setQuery] = useState("");
  const [selectedLandlordId, setSelectedLandlordId] = useState("");
  const [spreadsheet, setSpreadsheet] = useState<File | null>(null);
  const [imageFiles, setImageFiles] = useState<Array<ImportImageUpload<File>>>([]);
  const [useTemplateOrder, setUseTemplateOrder] = useState(false);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [rows, setRows] = useState<NormalizedImportRow[]>([]);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [imageAssignments, setImageAssignments] = useState<Record<string, string[]>>({});
  const [draggedImageName, setDraggedImageName] = useState<string | null>(null);
  const [city, setCity] = useState("");
  const [province, setProvince] = useState("Ontario");
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [report, setReport] = useState<ImportResponse | null>(null);
  const imagePickerRef = useRef<HTMLInputElement | null>(null);

  const selectedLandlord = landlords.find((landlord) => landlord.id === selectedLandlordId);
  const imageFileNames = useMemo(() => imageFiles.map((image) => image.name), [imageFiles]);
  const assignedImageNames = useMemo(
    () => new Set(Object.values(imageAssignments).flat()),
    [imageAssignments]
  );
  const unassignedImageNames = useMemo(
    () => imageFileNames.filter((name) => !assignedImageNames.has(name)),
    [assignedImageNames, imageFileNames]
  );
  const imagePreviewUrls = useMemo(
    () =>
      Object.fromEntries(
        imageFiles.map((image) => [
          image.name,
          URL.createObjectURL(image.file),
        ])
      ),
    [imageFiles]
  );
  const filteredLandlords = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return landlords.slice(0, 40);
    return landlords
      .filter((landlord) =>
        [landlord.fullName, landlord.email, landlord.role, landlord.id]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalized))
      )
      .slice(0, 40);
  }, [landlords, query]);

  useEffect(() => {
    return () => {
      Object.values(imagePreviewUrls).forEach((url) => URL.revokeObjectURL(url));
    };
  }, [imagePreviewUrls]);

  function addUploadedImages(files: File[]) {
    const nextUploads = appendImageUploads(imageFiles, files);

    if (!nextUploads.addedImages.length) {
      if (nextUploads.duplicateCount > 0) {
        setError("Those images are already selected.");
      }
      return;
    }

    setImageFiles(nextUploads.images);
    setReport(null);
    setError("");

    if (rows.length > 0) {
      const addedNames = nextUploads.addedImages.map((image) => image.name);
      setImageAssignments((current) =>
        suggestImageAssignmentsForRows(rows, addedNames, current)
      );
    }
  }

  function removeAllImages() {
    const confirmed = window.confirm(
      "Remove all selected images and clear image assignments for this preview?"
    );
    if (!confirmed) return;

    setImageFiles([]);
    setImageAssignments({});
    setReport(null);
  }

  function assignImageToRow(fingerprint: string, imageName: string) {
    if (!imageName) return;

    setImageAssignments((current) => {
      const next = Object.fromEntries(
        Object.entries(current).map(([key, names]) => [
          key,
          names.filter((name) => name !== imageName),
        ])
      );
      const rowImages = next[fingerprint] || [];
      next[fingerprint] = rowImages.includes(imageName)
        ? rowImages
        : [...rowImages, imageName];
      return next;
    });
  }

  function removeImageFromRow(fingerprint: string, imageName: string) {
    setImageAssignments((current) => ({
      ...current,
      [fingerprint]: (current[fingerprint] || []).filter((name) => name !== imageName),
    }));
  }

  function makeCoverImage(fingerprint: string, imageName: string) {
    setImageAssignments((current) => {
      const rowImages = current[fingerprint] || [];
      return {
        ...current,
        [fingerprint]: [
          imageName,
          ...rowImages.filter((name) => name !== imageName),
        ],
      };
    });
  }

  async function generatePreview() {
    if (!spreadsheet) {
      setError("Upload a spreadsheet first.");
      return;
    }

    setLoading(true);
    setError("");
    setReport(null);

    const formData = new FormData();
    formData.set("spreadsheet", spreadsheet);
    formData.set("useTemplateOrder", String(useTemplateOrder));
    imageFileNames.forEach((imageName) => formData.append("imageNames", imageName));

    const response = await fetch("/api/admin/listings/import/preview", {
      method: "POST",
      body: formData,
    });
    const data = await response.json().catch(() => null);
    setLoading(false);

    if (!response.ok) {
      setError(data?.error || "The spreadsheet could not be parsed.");
      return;
    }

    setPreview(data as PreviewResponse);
    setRows((data as PreviewResponse).uniqueRows);
    setImageAssignments((data as PreviewResponse).imageSuggestions || {});
    setSelectedRows(
      new Set(
        (data as PreviewResponse).uniqueRows
          .filter((row) => row.property && row.rent)
          .map((row) => row.fingerprint)
      )
    );
  }

  function updateRow(fingerprint: string, patch: Partial<NormalizedImportRow>) {
    setRows((current) =>
      current.map((row) =>
        row.fingerprint === fingerprint
          ? { ...row, ...patch, warnings: patch.warnings || row.warnings }
          : row
      )
    );
  }

  function toggleRow(fingerprint: string) {
    setSelectedRows((current) => {
      const next = new Set(current);
      if (next.has(fingerprint)) next.delete(fingerprint);
      else next.add(fingerprint);
      return next;
    });
  }

  async function importDrafts() {
    if (!selectedLandlord) {
      setError("Select a landlord before importing.");
      return;
    }

    const selected = rows
      .filter((row) => selectedRows.has(row.fingerprint))
      .map((row) => ({
        ...row,
        city: row.city || city,
        province: row.province || province,
      }));

    if (!selected.length) {
      setError("Select at least one row to import.");
      return;
    }

    const confirmed = window.confirm(
      `Create ${selected.length} draft listing${selected.length === 1 ? "" : "s"} for ${displayName(selectedLandlord)}? These will not be published.`
    );
    if (!confirmed) return;

    setImporting(true);
    setError("");

    const formData = new FormData();
    formData.set(
      "payload",
      JSON.stringify({
        ownerId: selectedLandlord.id,
        sourceFilename: preview?.sourceFilename || spreadsheet?.name || null,
        rows: selected,
        imageAssignments,
      })
    );
    imageFiles.forEach((image) => formData.append("images", image.file, image.name));

    const response = await fetch("/api/admin/listings/import/commit", {
      method: "POST",
      body: formData,
    });
    const data = await response.json().catch(() => null);
    setImporting(false);

    if (!response.ok) {
      setError(data?.error || "The import could not be completed.");
      return;
    }

    setReport(data as ImportResponse);
  }

  return (
    <main className="min-h-screen bg-black px-4 py-8 text-white">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="rounded-3xl border border-white/10 bg-[#070707] p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-pink-300">
                Travel Markets Admin
              </p>
              <h1 className="mt-3 text-4xl font-black tracking-tight">
                Bulk Listing Import
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-400">
                Upload landlord inventory, validate every row, resolve warnings,
                and create normal draft listings owned by the selected landlord.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <a
                href="/api/admin/listings/import/template"
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold text-white hover:bg-white/10"
              >
                <Download className="h-4 w-4" />
                Template CSV
              </a>
              <Link
                href="/admin"
                className="rounded-2xl bg-white px-5 py-3 text-sm font-bold text-black"
              >
                Back to Admin
              </Link>
            </div>
          </div>
        </header>

        {error && (
          <div className="rounded-2xl border border-red-500/25 bg-red-500/10 p-4 text-sm font-bold text-red-100">
            {error}
          </div>
        )}

        <section className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-3xl border border-white/10 bg-zinc-950 p-6">
            <div className="flex items-center gap-3">
              <Search className="h-5 w-5 text-pink-200" />
              <h2 className="text-xl font-black">1. Select Landlord</h2>
            </div>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search landlord name or email"
              className="mt-5 w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm outline-none transition focus:border-pink-400"
            />
            <div className="mt-4 max-h-80 overflow-y-auto rounded-2xl border border-white/10">
              {filteredLandlords.map((landlord) => (
                <button
                  key={landlord.id}
                  type="button"
                  onClick={() => setSelectedLandlordId(landlord.id)}
                  className={`block w-full border-b border-white/10 p-4 text-left transition last:border-b-0 hover:bg-white/5 ${
                    selectedLandlordId === landlord.id ? "bg-pink-500/10" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold">{displayName(landlord)}</p>
                      <p className="mt-1 text-xs text-zinc-500">{landlord.email || landlord.id}</p>
                      <p className="mt-1 text-xs text-zinc-500">ID: {landlord.id}</p>
                    </div>
                    <span className={`rounded-full border px-2 py-1 text-xs font-bold ${statusClass(landlord.verificationStatus)}`}>
                      {landlord.verificationStatus.replaceAll("_", " ")}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-zinc-950 p-6">
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="h-5 w-5 text-pink-200" />
              <h2 className="text-xl font-black">2. Upload Spreadsheet</h2>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="rounded-2xl border border-dashed border-white/15 bg-black p-5">
                <Upload className="h-6 w-6 text-pink-200" />
                <span className="mt-3 block text-sm font-bold">XLSX, XLS, or CSV</span>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={(event) => {
                    setSpreadsheet(event.target.files?.[0] || null);
                    setPreview(null);
                    setRows([]);
                    setReport(null);
                  }}
                  className="mt-4 w-full text-sm text-zinc-400 file:mr-3 file:rounded-xl file:border-0 file:bg-white file:px-3 file:py-2 file:text-sm file:font-bold file:text-black"
                />
                {spreadsheet && <p className="mt-3 text-xs text-zinc-500">{spreadsheet.name}</p>}
              </label>

              <label
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  addUploadedImages(Array.from(event.dataTransfer.files || []));
                }}
                className="rounded-2xl border border-dashed border-white/15 bg-black p-5"
              >
                <ImageIcon className="h-6 w-6 text-pink-200" />
                <span className="mt-3 block text-sm font-bold">Optional property images</span>
                <span className="mt-1 block text-xs text-zinc-500">
                  Drag and drop a batch or select multiple images.
                </span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  ref={imagePickerRef}
                  onChange={(event) => {
                    addUploadedImages(Array.from(event.target.files || []));
                    event.currentTarget.value = "";
                  }}
                  className="mt-4 w-full text-sm text-zinc-400 file:mr-3 file:rounded-xl file:border-0 file:bg-white file:px-3 file:py-2 file:text-sm file:font-bold file:text-black"
                />
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {imageFiles.length > 0 && (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        imagePickerRef.current?.click();
                      }}
                      className="rounded-xl border border-white/10 bg-white px-3 py-2 text-xs font-black text-black transition hover:bg-zinc-200"
                    >
                      Add More Images
                    </button>
                  )}
                  {imageFiles.length > 0 && (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        removeAllImages();
                      }}
                      className="rounded-xl border border-red-400/25 bg-red-500/10 px-3 py-2 text-xs font-black text-red-100 transition hover:bg-red-500/20"
                    >
                      Remove All Images
                    </button>
                  )}
                </div>
                <p className="mt-3 text-xs text-zinc-500">
                  {imageFiles.length} images selected
                </p>
              </label>
            </div>

            <label className="mt-4 flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-zinc-300">
              <input
                type="checkbox"
                checked={useTemplateOrder}
                onChange={(event) => setUseTemplateOrder(event.target.checked)}
                className="mt-1"
              />
              <span>
                Use Travel Markets landlord template column order when this file
                has no headers.
              </span>
            </label>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <input
                value={city}
                onChange={(event) => setCity(event.target.value)}
                placeholder="Default city for draft rows"
                className="rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm outline-none focus:border-pink-400"
              />
              <input
                value={province}
                onChange={(event) => setProvince(event.target.value)}
                placeholder="Province"
                className="rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm outline-none focus:border-pink-400"
              />
            </div>

            <button
              type="button"
              onClick={generatePreview}
              disabled={loading}
              className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-pink-500 px-5 py-3 text-sm font-black text-white transition hover:bg-pink-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              Parse and Preview
            </button>
          </div>
        </section>

        {preview && (
          <section className="space-y-5 rounded-3xl border border-white/10 bg-zinc-950 p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="text-2xl font-black">3. Validate Preview</h2>
                <p className="mt-2 text-sm text-zinc-400">
                  No listings have been created yet. Review warnings, edit
                  fields, assign images, and create drafts only after
                  confirmation.
                </p>
                <p className="mt-2 text-xs font-bold uppercase tracking-[0.2em] text-pink-200">
                  {formatImportBadge(preview.importFormat)}
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
                <Stat label="Rows" value={preview.summary.rowsDetected} />
                <Stat label="Unique" value={preview.summary.uniqueRows} />
                <Stat label="Skipped" value={preview.summary.skippedRows} />
                <Stat label="Duplicates" value={preview.summary.duplicateRows} />
                <Stat label="Incomplete" value={preview.summary.incompleteDuplicateRows} />
                <Stat label="Warnings" value={preview.summary.warningRows} />
              </div>
            </div>

            {imageFiles.length > 0 && (
              <ImageAssignmentBoard
                rows={rows}
                imageAssignments={imageAssignments}
                imageFileNames={imageFileNames}
                unassignedImageNames={unassignedImageNames}
                imagePreviewUrls={imagePreviewUrls}
                draggedImageName={draggedImageName}
                onDragImage={setDraggedImageName}
                onAssignImage={assignImageToRow}
                onRemoveImage={removeImageFromRow}
                onMakeCover={makeCoverImage}
              />
            )}

            <div className="overflow-x-auto rounded-2xl border border-white/10">
              <table className="min-w-[2200px] w-full text-left text-sm">
                <thead className="bg-white/5 text-xs uppercase tracking-wide text-zinc-400">
                  <tr>
                    <th className="p-3">Import</th>
                    <th className="p-3">Property</th>
                    <th className="p-3">Street address</th>
                    <th className="p-3">City</th>
                    <th className="p-3">Province</th>
                    <th className="p-3">Postal code</th>
                    <th className="p-3">Title</th>
                    <th className="p-3">Description</th>
                    <th className="p-3">Rooms available</th>
                    <th className="p-3">Unit</th>
                    <th className="p-3">Rent</th>
                    <th className="p-3">Arrangement</th>
                    <th className="p-3">Gender</th>
                    <th className="p-3">Utilities</th>
                    <th className="p-3">Internet</th>
                    <th className="p-3">Available</th>
                    <th className="p-3">Total rooms</th>
                    <th className="p-3">Baths</th>
                    <th className="p-3">Images</th>
                    <th className="p-3">Admin source notes</th>
                    <th className="p-3">Source URL</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.fingerprint} className="border-t border-white/10 align-top">
                      <td className="p-3">
                        <input
                          type="checkbox"
                          checked={selectedRows.has(row.fingerprint)}
                          onChange={() => toggleRow(row.fingerprint)}
                        />
                      </td>
                      <td className="p-3">
                        <input
                          value={row.property || ""}
                          onChange={(event) =>
                            updateRow(row.fingerprint, { property: event.target.value })
                          }
                          className="w-56 rounded-xl border border-white/10 bg-black px-3 py-2 outline-none focus:border-pink-400"
                        />
                      </td>
                      <EditableCell
                        value={row.streetAddress || ""}
                        onChange={(value) =>
                          updateRow(row.fingerprint, { streetAddress: value || null })
                        }
                      />
                      <EditableCell
                        value={row.city || ""}
                        onChange={(value) => updateRow(row.fingerprint, { city: value || null })}
                      />
                      <EditableCell
                        value={row.province || ""}
                        onChange={(value) =>
                          updateRow(row.fingerprint, { province: value || null })
                        }
                      />
                      <EditableCell
                        value={row.postalCode || ""}
                        onChange={(value) =>
                          updateRow(row.fingerprint, { postalCode: value || null })
                        }
                      />
                      <EditableCell
                        value={row.listingTitle || ""}
                        onChange={(value) =>
                          updateRow(row.fingerprint, { listingTitle: value || null })
                        }
                      />
                      <EditableTextAreaCell
                        value={row.description || ""}
                        onChange={(value) =>
                          updateRow(row.fingerprint, { description: value || null })
                        }
                      />
                      <NumberCell
                        value={row.roomsAvailable}
                        onChange={(value) =>
                          updateRow(row.fingerprint, { roomsAvailable: value })
                        }
                      />
                      <EditableCell
                        value={row.unit || ""}
                        onChange={(value) => updateRow(row.fingerprint, { unit: value || null })}
                      />
                      <NumberCell
                        value={row.rent}
                        onChange={(value) => updateRow(row.fingerprint, { rent: value })}
                      />
                      <EditableCell
                        value={row.arrangement || ""}
                        onChange={(value) =>
                          updateRow(row.fingerprint, { arrangement: value || null })
                        }
                      />
                      <EditableCell
                        value={row.genderPreference || ""}
                        onChange={(value) =>
                          updateRow(row.fingerprint, { genderPreference: value || null })
                        }
                      />
                      <BooleanCell
                        value={row.utilitiesIncluded}
                        onChange={(value) =>
                          updateRow(row.fingerprint, { utilitiesIncluded: value })
                        }
                      />
                      <BooleanCell
                        value={row.internetIncluded}
                        onChange={(value) =>
                          updateRow(row.fingerprint, { internetIncluded: value })
                        }
                      />
                      <EditableCell
                        value={row.availability || ""}
                        onChange={(value) =>
                          updateRow(row.fingerprint, { availability: value || null })
                        }
                      />
                      <NumberCell
                        value={row.totalRooms}
                        onChange={(value) => updateRow(row.fingerprint, { totalRooms: value })}
                      />
                      <NumberCell
                        value={row.bathrooms}
                        onChange={(value) => updateRow(row.fingerprint, { bathrooms: value })}
                      />
                      <td className="p-3">
                        <p className="text-xs font-bold text-zinc-300">
                          {(imageAssignments[row.fingerprint] || []).length} assigned
                        </p>
                        <p className="mt-1 text-xs text-zinc-500">
                          Manage images in the preview board above.
                        </p>
                      </td>
                      <EditableTextAreaCell
                        value={row.sourceVerificationNotes || ""}
                        onChange={(value) =>
                          updateRow(row.fingerprint, {
                            sourceVerificationNotes: value || null,
                          })
                        }
                      />
                      <EditableCell
                        value={row.sourceUrl || ""}
                        onChange={(value) =>
                          updateRow(row.fingerprint, { sourceUrl: value || null })
                        }
                      />
                      <td className="p-3">
                        {row.warnings.length ? (
                          <div className="flex max-w-xs items-start gap-2 text-yellow-100">
                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                            <span>{row.warnings.join(" ")}</span>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-2 text-emerald-200">
                            <CheckCircle2 className="h-4 w-4" />
                            Valid draft row
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {preview.skippedRows.length > 0 && (
              <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-4">
                <h3 className="font-black text-yellow-100">Skipped Rows</h3>
                <div className="mt-3 space-y-2 text-sm text-yellow-50/80">
                  {preview.skippedRows.map((item) => (
                    <p key={`${item.row.fingerprint}-${item.row.rowNumber}`}>
                      Row {item.row.rowNumber || "unknown"}: {item.reason}
                    </p>
                  ))}
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={importDrafts}
              disabled={importing || !selectedLandlord || selectedRows.size === 0}
              className="inline-flex items-center gap-2 rounded-2xl bg-pink-500 px-6 py-4 font-black text-white transition hover:bg-pink-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {importing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
              Import Valid Listings as Drafts
            </button>
          </section>
        )}

        {report && (
          <section className="rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-6 text-emerald-50">
            <h2 className="text-2xl font-black">Import Report</h2>
            <p className="mt-2 text-sm">Batch ID: {report.batchId}</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-4">
              <Stat label="Imported" value={report.importedCount} />
              <Stat label="Skipped" value={report.skippedCount} />
              <Stat label="Failed" value={report.failedCount} />
              <Stat label="Warnings" value={report.warningCount} />
            </div>
            <div className="mt-5 space-y-2 text-sm">
              {report.results.map((result) => (
                <p key={`${result.source_fingerprint}-${result.listing_id || result.status}`}>
                  {result.status}
                  {result.listing_id ? ` - listing ${result.listing_id}` : ""}
                  {result.reason ? ` - ${result.reason}` : ""}
                </p>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/40 p-3">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-xl font-black">{value}</p>
    </div>
  );
}

function EditableCell({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <td className="p-3">
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-48 rounded-xl border border-white/10 bg-black px-3 py-2 outline-none focus:border-pink-400"
      />
    </td>
  );
}

function EditableTextAreaCell({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <td className="p-3">
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-24 w-72 rounded-xl border border-white/10 bg-black px-3 py-2 outline-none focus:border-pink-400"
      />
    </td>
  );
}

function NumberCell({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  return (
    <td className="p-3">
      <input
        type="number"
        value={value ?? ""}
        onChange={(event) => onChange(numericValue(event.target.value))}
        className="w-28 rounded-xl border border-white/10 bg-black px-3 py-2 outline-none focus:border-pink-400"
      />
    </td>
  );
}

function BooleanCell({
  value,
  onChange,
}: {
  value: boolean | null;
  onChange: (value: boolean | null) => void;
}) {
  return (
    <td className="p-3">
      <select
        value={booleanSelectValue(value)}
        onChange={(event) =>
          onChange(
            event.target.value === ""
              ? null
              : event.target.value === "true"
          )
        }
        className="w-28 rounded-xl border border-white/10 bg-black px-3 py-2 outline-none focus:border-pink-400"
      >
        <option value="">N/A</option>
        <option value="true">Yes</option>
        <option value="false">No</option>
      </select>
    </td>
  );
}

function ImageAssignmentBoard({
  rows,
  imageAssignments,
  imageFileNames,
  unassignedImageNames,
  imagePreviewUrls,
  draggedImageName,
  onDragImage,
  onAssignImage,
  onRemoveImage,
  onMakeCover,
}: {
  rows: NormalizedImportRow[];
  imageAssignments: Record<string, string[]>;
  imageFileNames: string[];
  unassignedImageNames: string[];
  imagePreviewUrls: Record<string, string>;
  draggedImageName: string | null;
  onDragImage: (imageName: string | null) => void;
  onAssignImage: (fingerprint: string, imageName: string) => void;
  onRemoveImage: (fingerprint: string, imageName: string) => void;
  onMakeCover: (fingerprint: string, imageName: string) => void;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-black/50 p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h3 className="text-xl font-black">Image Assignments</h3>
          <p className="mt-1 max-w-2xl text-sm text-zinc-400">
            Automatic filename matches are pre-filled. Drag images between
            properties or use Add image to confirm the final draft gallery.
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-zinc-300">
          {imageFileNames.length} uploaded · {unassignedImageNames.length} unassigned
        </div>
      </div>

      {unassignedImageNames.length > 0 && (
        <div className="mt-5 rounded-2xl border border-dashed border-white/15 bg-zinc-950 p-4">
          <p className="text-sm font-bold text-zinc-200">Unassigned images</p>
          <div className="mt-3 flex gap-3 overflow-x-auto pb-2">
            {unassignedImageNames.map((imageName) => (
              <ImageThumb
                key={imageName}
                imageName={imageName}
                imageUrl={imagePreviewUrls[imageName]}
                onDragImage={onDragImage}
              />
            ))}
          </div>
        </div>
      )}

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {rows.map((row) => {
          const assigned = imageAssignments[row.fingerprint] || [];
          return (
            <div
              key={row.fingerprint}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                if (draggedImageName) {
                  onAssignImage(row.fingerprint, draggedImageName);
                  onDragImage(null);
                }
              }}
              className="rounded-2xl border border-white/10 bg-zinc-950 p-4 transition hover:border-pink-300/30"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-black">{row.property || "Untitled property"}</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {row.unit || "Unit not specified"} · {money(row.rent)}
                  </p>
                </div>
                <span className="rounded-full bg-pink-500/15 px-3 py-1 text-xs font-bold text-pink-100">
                  {assigned.length} image{assigned.length === 1 ? "" : "s"}
                </span>
              </div>

              <div className="mt-4 grid min-h-32 grid-cols-2 gap-3 sm:grid-cols-3">
                {assigned.map((imageName, index) => (
                  <div key={imageName} className="group relative">
                    <ImageThumb
                      imageName={imageName}
                      imageUrl={imagePreviewUrls[imageName]}
                      onDragImage={onDragImage}
                    />
                    <div className="absolute inset-x-1 bottom-1 flex gap-1 opacity-0 transition group-hover:opacity-100">
                      {index > 0 && (
                        <button
                          type="button"
                          onClick={() => onMakeCover(row.fingerprint, imageName)}
                          className="flex-1 rounded-lg bg-black/80 px-2 py-1 text-[10px] font-bold text-white"
                        >
                          Cover
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onRemoveImage(row.fingerprint, imageName)}
                        className="rounded-lg bg-red-500/90 px-2 py-1 text-white"
                        aria-label={`Remove ${imageName}`}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                    {index === 0 && (
                      <span className="absolute left-1 top-1 rounded-full bg-black/80 px-2 py-1 text-[10px] font-bold text-white">
                        Cover
                      </span>
                    )}
                  </div>
                ))}
                {assigned.length === 0 && (
                  <div className="col-span-full flex min-h-32 items-center justify-center rounded-2xl border border-dashed border-white/10 text-center text-sm text-zinc-500">
                    Drop images here
                  </div>
                )}
              </div>

              <label className="mt-4 flex items-center gap-2 rounded-xl border border-white/10 bg-black px-3 py-2 text-sm text-zinc-300">
                <Plus className="h-4 w-4 text-pink-200" />
                <select
                  value=""
                  onChange={(event) => {
                    onAssignImage(row.fingerprint, event.target.value);
                    event.target.value = "";
                  }}
                  className="w-full bg-transparent outline-none"
                >
                  <option value="" className="bg-black">
                    Add image
                  </option>
                  {imageFileNames.map((imageName) => (
                    <option key={imageName} value={imageName} className="bg-black">
                      {imageName}
                    </option>
                  ))}
                </select>
                <MoveRight className="h-4 w-4 text-zinc-500" />
              </label>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ImageThumb({
  imageName,
  imageUrl,
  onDragImage,
}: {
  imageName: string;
  imageUrl?: string;
  onDragImage: (imageName: string | null) => void;
}) {
  return (
    <div
      draggable
      onDragStart={() => onDragImage(imageName)}
      onDragEnd={() => onDragImage(null)}
      className="relative aspect-[4/3] min-w-32 cursor-grab overflow-hidden rounded-2xl border border-white/10 bg-black active:cursor-grabbing"
      title={imageName}
    >
      {imageUrl ? (
        <img src={imageUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full items-center justify-center text-xs text-zinc-500">
          Preview unavailable
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-2">
        <p className="truncate text-[10px] font-bold text-white">{imageName}</p>
      </div>
    </div>
  );
}
