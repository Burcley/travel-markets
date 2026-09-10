"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Building2, GraduationCap, MapPin, Search } from "lucide-react";
import {
  getCampusDiscoveryOptions,
  getProminentCampusCards,
  type CampusDiscoveryOption,
} from "@/lib/campus-discovery";

type Props = {
  brockAvailableCount: number | null;
  placement?: "hero" | "section";
};

function trackCampusEvent(
  event: "campus_search_opened" | "campus_selected" | "campus_card_clicked",
  campus: Pick<CampusDiscoveryOption, "displayName" | "destination"> | null,
  sourcePage: string
) {
  const payload = JSON.stringify({
    event,
    source: "homepage",
    sessionId:
      typeof window !== "undefined"
        ? window.sessionStorage.getItem("tm_brock_attribution")
        : null,
    landingPage:
      typeof window !== "undefined"
        ? `${window.location.pathname}${window.location.search}`
        : "/",
    metadata: {
      campus_name: campus?.displayName || null,
      source_page: sourcePage,
      destination: campus?.destination || null,
    },
  });

  const sent = navigator.sendBeacon?.(
    "/api/analytics/brock",
    new Blob([payload], { type: "application/json" })
  );

  if (!sent) {
    fetch("/api/analytics/brock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
    }).catch(() => undefined);
  }
}

export default function CampusDiscovery({
  brockAvailableCount,
  placement = "section",
}: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const options = useMemo(() => getCampusDiscoveryOptions(), []);
  const cards = useMemo(() => getProminentCampusCards(), []);
  const sourcePage = placement === "hero" ? "homepage_hero" : "homepage_campus_section";

  const filteredOptions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const sorted = [...options].sort((a, b) => {
      if (a.institutionId === "brock-university") return -1;
      if (b.institutionId === "brock-university") return 1;
      return a.displayName.localeCompare(b.displayName);
    });

    if (!normalized) return sorted.slice(0, 8);

    return sorted
      .filter((campus) =>
        [
          campus.displayName,
          campus.institutionName,
          campus.campusName,
          campus.city,
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalized)
      )
      .slice(0, 10);
  }, [options, query]);

  function selectCampus(campus: CampusDiscoveryOption) {
    trackCampusEvent("campus_selected", campus, sourcePage);
    setOpen(false);
    router.push(campus.destination);
  }

  if (placement === "hero") {
    return (
      <div className="mt-8 max-w-2xl rounded-[1.6rem] border border-white/10 bg-black/50 p-3 shadow-2xl shadow-black/30 backdrop-blur">
        <CampusSearchInput
          query={query}
          setQuery={setQuery}
          open={open}
          setOpen={setOpen}
          options={filteredOptions}
          onSelect={selectCampus}
          sourcePage={sourcePage}
        />
      </div>
    );
  }

  return (
    <section id="campuses" className="px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.16em] text-pink-200">
              Campus discovery
            </p>
            <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
              Explore housing by campus
            </h2>
            <p className="mt-3 max-w-2xl text-zinc-400">
              Choose your school to discover available student housing nearby.
            </p>
          </div>

          <div className="w-full max-w-xl rounded-[1.6rem] border border-white/10 bg-white/[0.04] p-3">
            <CampusSearchInput
              query={query}
              setQuery={setQuery}
              open={open}
              setOpen={setOpen}
              options={filteredOptions}
              onSelect={selectCampus}
              sourcePage={sourcePage}
            />
          </div>
        </div>

        <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {cards.map((campus) => (
            <Link
              key={campus.id}
              href={campus.destination}
              onClick={() => trackCampusEvent("campus_card_clicked", campus, sourcePage)}
              className={`group rounded-[1.6rem] border p-5 transition hover:-translate-y-0.5 ${
                campus.institutionId === "brock-university"
                  ? "border-pink-300/30 bg-pink-500/10 shadow-xl shadow-pink-950/20"
                  : "border-white/10 bg-zinc-950 hover:border-white/20"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-black">
                  <GraduationCap className="h-5 w-5" />
                </div>
                {campus.institutionId === "brock-university" && (
                  <span className="rounded-full bg-pink-500 px-3 py-1 text-xs font-black text-white">
                    Featured
                  </span>
                )}
              </div>
              <h3 className="mt-5 text-xl font-black">{campus.institutionName}</h3>
              <p className="mt-2 text-sm text-zinc-400">
                {campus.city}, {campus.province}
              </p>
              {campus.institutionId === "brock-university" &&
                brockAvailableCount != null &&
                brockAvailableCount > 0 && (
                  <p className="mt-4 text-sm font-bold text-pink-100">
                    {brockAvailableCount} available rental
                    {brockAvailableCount === 1 ? "" : "s"}
                  </p>
                )}
              <span className="mt-5 inline-flex items-center gap-2 text-sm font-black text-white group-hover:text-pink-100">
                View housing
                <ArrowRight className="h-4 w-4" />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function CampusSearchInput({
  query,
  setQuery,
  open,
  setOpen,
  options,
  onSelect,
  sourcePage,
}: {
  query: string;
  setQuery: (value: string) => void;
  open: boolean;
  setOpen: (value: boolean) => void;
  options: CampusDiscoveryOption[];
  onSelect: (campus: CampusDiscoveryOption) => void;
  sourcePage: string;
}) {
  return (
    <div className="relative">
      <label className="sr-only" htmlFor={`campus-discovery-${sourcePage}`}>
        Find housing near your school
      </label>
      <div className="flex min-h-16 items-center gap-3 rounded-[1.25rem] border border-white/10 bg-white px-4 text-black shadow-lg">
        <Search className="h-5 w-5 shrink-0 text-black/45" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-black uppercase tracking-[0.13em] text-black/45">
            Find housing near your school
          </p>
          <input
            id={`campus-discovery-${sourcePage}`}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
            }}
            onFocus={() => {
              setOpen(true);
              trackCampusEvent("campus_search_opened", null, sourcePage);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && options[0]) {
                event.preventDefault();
                onSelect(options[0]);
              }
              if (event.key === "Escape") setOpen(false);
            }}
            placeholder="Search university or campus"
            className="mt-0.5 w-full bg-transparent text-base font-semibold outline-none placeholder:text-black/35"
          />
        </div>
      </div>

      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+10px)] z-[10000] max-h-80 overflow-y-auto rounded-[1.35rem] border border-white/10 bg-zinc-950 p-2 shadow-2xl shadow-black/40">
          {options.length === 0 ? (
            <div className="px-4 py-5">
              <p className="font-bold text-white">No campuses found</p>
              <p className="mt-1 text-sm text-zinc-400">
                Try another university, campus, or city.
              </p>
            </div>
          ) : (
            options.map((campus) => (
              <button
                key={campus.id}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => onSelect(campus)}
                className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition hover:bg-white/10 focus:bg-white/10 focus:outline-none"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-pink-100">
                  <Building2 className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold text-white">
                    {campus.displayName}
                  </span>
                  <span className="mt-0.5 block truncate text-sm text-zinc-400">
                    {campus.city}, {campus.province}
                  </span>
                </span>
                {campus.dedicatedPage && (
                  <span className="rounded-full bg-pink-500/15 px-3 py-1 text-xs font-black text-pink-100">
                    Brock page
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      )}

      <div className="mt-2 flex items-center gap-2 px-2 text-xs text-zinc-400">
        <MapPin className="h-3.5 w-3.5" />
        Choose your school to see rentals near campus.
      </div>
    </div>
  );
}
