"use client";

import { Search } from "lucide-react";
import {
  CANADIAN_INSTITUTIONS,
  OTHER_CAMPUS_ID,
  UNLISTED_INSTITUTION_ID,
  getCampusById,
  getCampusesForInstitution,
  getInstitutionById,
  type InstitutionType,
} from "@/lib/data/canadian-institutions";

type InstitutionCampusSelectorProps = {
  institutionId: string;
  institutionSearch: string;
  campusId: string;
  unlistedInstitutionName?: string;
  unlistedCampusName?: string;
  institutionLabel?: string;
  campusLabel?: string;
  institutionPlaceholder?: string;
  province?: string;
  type?: InstitutionType | "all";
  onInstitutionSearchChange: (value: string) => void;
  onInstitutionChange: (value: string) => void;
  onCampusChange: (value: string) => void;
  onUnlistedInstitutionNameChange?: (value: string) => void;
  onUnlistedCampusNameChange?: (value: string) => void;
};

export {
  OTHER_CAMPUS_ID,
  UNLISTED_INSTITUTION_ID,
} from "@/lib/data/canadian-institutions";

export default function InstitutionCampusSelector({
  institutionId,
  institutionSearch,
  campusId,
  unlistedInstitutionName = "",
  unlistedCampusName = "",
  institutionLabel = "Select your university",
  campusLabel = "Select your campus",
  institutionPlaceholder = "Search Ontario universities...",
  province = "Ontario",
  type = "university",
  onInstitutionSearchChange,
  onInstitutionChange,
  onCampusChange,
  onUnlistedInstitutionNameChange,
  onUnlistedCampusNameChange,
}: InstitutionCampusSelectorProps) {
  const query = institutionSearch.trim().toLowerCase();
  const selectedInstitution =
    institutionId && institutionId !== UNLISTED_INSTITUTION_ID
      ? getInstitutionById(institutionId)
      : null;
  const campuses = selectedInstitution ? getCampusesForInstitution(institutionId) : [];
  const selectedCampus =
    campusId && campusId !== OTHER_CAMPUS_ID ? getCampusById(campusId) : null;
  const institutions = CANADIAN_INSTITUTIONS.filter((institution) => {
    if (!institution.active) return false;
    if (province !== "all" && institution.province !== province) return false;
    if (type !== "all" && institution.type !== type) return false;

    if (!query) return true;

    const searchable = [
      institution.name,
      institution.city,
      institution.province,
      institution.domain || "",
      ...institution.aliases,
    ]
      .join(" ")
      .toLowerCase();

    return searchable.includes(query);
  }).slice(0, 40);

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-2 block text-sm font-bold text-zinc-200">
          {institutionLabel}
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            value={institutionSearch}
            onChange={(event) => onInstitutionSearchChange(event.target.value)}
            placeholder={institutionPlaceholder}
            className="w-full rounded-2xl border border-white/10 bg-black/60 py-3 pl-11 pr-4 text-sm text-white outline-none transition focus:border-pink-400/60"
          />
        </div>

        <div className="mt-3 max-h-64 space-y-2 overflow-y-auto rounded-2xl border border-white/10 bg-black/55 p-2">
          {institutions.map((institution) => (
            <button
              key={institution.id}
              type="button"
              onClick={() => onInstitutionChange(institution.id)}
              className={`w-full rounded-xl px-4 py-3 text-left transition ${
                institutionId === institution.id
                  ? "border border-pink-400/40 bg-pink-500/15 text-white"
                  : "border border-transparent text-zinc-300 hover:bg-white/10 hover:text-white"
              }`}
            >
              <span className="block text-sm font-bold">{institution.name}</span>
              <span className="mt-1 block text-xs text-zinc-500">
                {institution.city}, {institution.province}
              </span>
            </button>
          ))}

          <button
            type="button"
            onClick={() => onInstitutionChange(UNLISTED_INSTITUTION_ID)}
            className={`w-full rounded-xl px-4 py-3 text-left transition ${
              institutionId === UNLISTED_INSTITUTION_ID
                ? "border border-pink-400/40 bg-pink-500/15 text-white"
                : "border border-dashed border-white/10 text-zinc-300 hover:bg-white/10 hover:text-white"
            }`}
          >
            <span className="block text-sm font-bold">Other Ontario university</span>
            <span className="mt-1 block text-xs text-zinc-500">
              We will review the institution name with your student documents.
            </span>
          </button>
        </div>
      </div>

      {institutionId === UNLISTED_INSTITUTION_ID && (
        <Field
          label="University name"
          value={unlistedInstitutionName}
          onChange={(value) => onUnlistedInstitutionNameChange?.(value)}
          placeholder="Enter your Ontario university"
        />
      )}

      {selectedInstitution && campuses.length > 0 && (
        <div>
          <label className="mb-2 block text-sm font-bold text-zinc-200">
            {campusLabel}
          </label>
          <div className="grid gap-2 sm:grid-cols-2">
            {campuses.map((campus) => (
              <button
                key={campus.id}
                type="button"
                onClick={() => onCampusChange(campus.id)}
                className={`rounded-2xl border px-4 py-3 text-left text-sm transition ${
                  campusId === campus.id
                    ? "border-pink-400/50 bg-pink-500/15 text-white"
                    : "border-white/10 bg-black/45 text-zinc-300 hover:bg-white/10 hover:text-white"
                }`}
              >
                <span className="block font-bold">{campus.name}</span>
                <span className="mt-1 block text-xs text-zinc-500">
                  {campus.city}, {campus.province}
                </span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => onCampusChange(OTHER_CAMPUS_ID)}
              className={`rounded-2xl border px-4 py-3 text-left text-sm transition ${
                campusId === OTHER_CAMPUS_ID
                  ? "border-pink-400/50 bg-pink-500/15 text-white"
                  : "border-dashed border-white/10 bg-black/45 text-zinc-300 hover:bg-white/10 hover:text-white"
              }`}
            >
              <span className="block font-bold">Other campus / campus not listed</span>
              <span className="mt-1 block text-xs text-zinc-500">
                Add a campus name for review.
              </span>
            </button>
          </div>
        </div>
      )}

      {selectedCampus && (
        <p className="rounded-2xl border border-emerald-400/15 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          Selected: {selectedInstitution?.name} - {selectedCampus.name}
        </p>
      )}

      {campusId === OTHER_CAMPUS_ID && (
        <Field
          label="Campus name"
          value={unlistedCampusName}
          onChange={(value) => onUnlistedCampusNameChange?.(value)}
          placeholder="Enter your campus"
        />
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-zinc-200">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-white/10 bg-black/60 px-4 py-3 text-sm text-white outline-none transition focus:border-pink-400/60"
      />
    </label>
  );
}
