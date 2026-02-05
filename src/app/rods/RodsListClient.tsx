"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ROD_TECHNIQUES } from "@/lib/rodTechniques";

export type RodRowLike = {
  id: string;
  name?: string | null;
  brand?: string | null;
  model?: string | null;
  power?: string | null;
  action?: string | null;
  line?: string | null;
  notes?: string | null;
  status?: string | null;
  rod_techniques?: unknown; // string | string[] | JSON string
};

type SortKey = "name" | "brand" | "status";

function coerceTechniques(input: unknown): string[] {
  if (input == null) return [];
  if (Array.isArray(input)) return input.map((v) => String(v)).filter(Boolean);

  if (typeof input === "string") {
    const s = input.trim();
    if (!s) return [];

    if (s.startsWith("[") && s.endsWith("]")) {
      try {
        const parsed: unknown = JSON.parse(s);
        if (Array.isArray(parsed)) return parsed.map((v) => String(v)).filter(Boolean);
      } catch {
        // fall through
      }
    }

    if (s.includes(",")) return s.split(",").map((x) => x.trim()).filter(Boolean);
    return [s];
  }

  return [];
}

function setOrDeleteParam(params: URLSearchParams, key: string, value: string) {
  const v = value.trim();
  if (v.length === 0) params.delete(key);
  else params.set(key, v);
}

function setOrDeleteFlag(params: URLSearchParams, key: string, on: boolean) {
  if (!on) params.delete(key);
  else params.set(key, "1");
}

function getString(sp: ReturnType<typeof useSearchParams>, key: string): string {
  return sp.get(key) ?? "";
}

function getBool(sp: ReturnType<typeof useSearchParams>, key: string): boolean {
  const v = sp.get(key);
  return v === "1" || v === "true" || v === "yes";
}

function normalizeStatus(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase();
}

function isActiveStatus(status: string | null | undefined): boolean {
  // Keep this intentionally simple + predictable:
  // Active-only means status must be exactly "active" (case-insensitive).
  return normalizeStatus(status) === "active";
}

function cmp(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: "base" });
}

export default function RodsListClient<T extends RodRowLike>({
  rows,
  children,
}: {
  rows: T[];
  children: (filteredRows: T[], setTechniqueFilter: React.Dispatch<React.SetStateAction<string>>) => React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // URL -> initial state
  const initialQ = React.useMemo(() => getString(searchParams, "q"), [searchParams]);
  const initialTech = React.useMemo(() => getString(searchParams, "tech"), [searchParams]);
  const initialSort = React.useMemo(() => (getString(searchParams, "sort") as SortKey) || "name", [searchParams]);
  const initialActiveOnly = React.useMemo(() => getBool(searchParams, "active"), [searchParams]);

  const [q, setQ] = React.useState(initialQ);
  const [techFilter, setTechFilter] = React.useState<string>(initialTech);
  const [sortKey, setSortKey] = React.useState<SortKey>(initialSort);
  const [activeOnly, setActiveOnly] = React.useState<boolean>(initialActiveOnly);

  // Keep state in sync for back/forward navigation
  React.useEffect(() => {
    const urlQ = getString(searchParams, "q");
    const urlTech = getString(searchParams, "tech");
    const urlSort = (getString(searchParams, "sort") as SortKey) || "name";
    const urlActive = getBool(searchParams, "active");

    if (urlQ !== q) setQ(urlQ);
    if (urlTech !== techFilter) setTechFilter(urlTech);
    if (urlSort !== sortKey) setSortKey(urlSort);
    if (urlActive !== activeOnly) setActiveOnly(urlActive);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Write to URL (debounced for q)
  React.useEffect(() => {
    const t = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());

      setOrDeleteParam(params, "q", q);
      setOrDeleteParam(params, "tech", techFilter);
      setOrDeleteParam(params, "sort", sortKey);
      setOrDeleteFlag(params, "active", activeOnly);

      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    }, 250);

    return () => clearTimeout(t);
  }, [q, techFilter, sortKey, activeOnly, router, pathname, searchParams]);

  const normalizedQ = q.trim().toLowerCase();

  const filtered = (rows ?? [])
    .filter((r) => {
      const hay = [
        r.name,
        r.brand,
        r.model,
        r.power,
        r.action,
        r.line,
        r.notes,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesText = normalizedQ.length === 0 || hay.includes(normalizedQ);

      const techniques = coerceTechniques(r.rod_techniques);
      const matchesTech = techFilter.length === 0 || techniques.includes(techFilter);

      const matchesActive = !activeOnly || isActiveStatus(r.status);

      return matchesText && matchesTech && matchesActive;
    })
    .sort((a, b) => {
      if (sortKey === "name") return cmp(a.name ?? "", b.name ?? "");
      if (sortKey === "brand") return cmp(a.brand ?? "", b.brand ?? "");
      return cmp(a.status ?? "", b.status ?? "");
    });

  return (
    <div>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          className="w-full rounded-md border px-3 py-2 text-sm"
          placeholder="Search rods…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />

        <select
          className="w-full rounded-md border px-3 py-2 text-sm sm:w-64"
          value={techFilter}
          onChange={(e) => setTechFilter(e.target.value)}
        >
          <option value="">All techniques</option>
          {ROD_TECHNIQUES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>

        <select
          className="w-full rounded-md border px-3 py-2 text-sm sm:w-48"
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
          title="Sort"
        >
          <option value="name">Sort: Name</option>
          <option value="brand">Sort: Brand</option>
          <option value="status">Sort: Status</option>
        </select>

        <label className="flex items-center gap-2 text-sm select-none">
          <input
            type="checkbox"
            checked={activeOnly}
            onChange={(e) => setActiveOnly(e.target.checked)}
          />
          Active only
        </label>

        <button
          type="button"
          className="rounded-md border px-3 py-2 text-sm"
          onClick={() => {
            setQ("");
            setTechFilter("");
            setSortKey("name");
            setActiveOnly(false);
          }}
        >
          Clear
        </button>

        <div className="text-sm opacity-70 sm:ml-auto">
          {filtered.length} / {(rows ?? []).length}
        </div>
      </div>

      {techFilter.length > 0 && (
        <div className="mb-4 flex items-center gap-2 text-sm">
          <span className="opacity-70">Active technique:</span>
          <button
            type="button"
            className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700 border hover:bg-gray-200"
            onClick={() => setTechFilter("")}
            title="Clear technique filter"
          >
            {techFilter} ✕
          </button>
        </div>
      )}

      {children(filtered, setTechFilter)}
    </div>
  );
}
