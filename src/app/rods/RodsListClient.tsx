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

// URL filter values (keep stable even if UI labels change)
type StatusFilter = "all" | "owned" | "planned";

// Your requested defaults:
const DEFAULT_SORT: SortKey = "brand";
const DEFAULT_STATUS: StatusFilter = "all";

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

function normalizeStatus(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase();
}

function isOwned(status: string | null | undefined): boolean {
  const s = normalizeStatus(status);
  return s === "owned" || s === "active"; // accept legacy "active"
}

// "planned" becomes "wish list" in UI
function isWishList(status: string | null | undefined): boolean {
  const s = normalizeStatus(status);
  return s === "planned" || s === "wishlist";
}

/**
 * UI display status:
 * - owned/active -> "owned"
 * - planned/wishlist -> "wish list"
 * - sold/retired/anything else -> "" (hide it)
 */
function displayStatus(status: string | null | undefined): "" | "owned" | "wish list" {
  if (isOwned(status)) return "owned";
  if (isWishList(status)) return "wish list";
  return "";
}

function cmp(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: "base" });
}

function getString(sp: ReturnType<typeof useSearchParams>, key: string): string {
  return sp.get(key) ?? "";
}

function normalizeSort(raw: string): SortKey {
  const s = (raw ?? "").trim().toLowerCase();
  if (s === "brand" || s === "status" || s === "name") return s;
  return DEFAULT_SORT;
}

// Accept old "planned" and new "wishlist" in URL, normalize to "planned" internally for now
function normalizeStatusFilter(raw: string): StatusFilter {
  const s = (raw ?? "").trim().toLowerCase();
  if (s === "owned" || s === "planned" || s === "all") return s as StatusFilter;
  if (s === "wishlist") return "planned";
  return DEFAULT_STATUS;
}

/**
 * Build a normalized querystring from state.
 * - Omits defaults (keeps URLs clean)
 * - Trims strings
 * - Stable ordering
 */
function buildQueryString(state: {
  q: string;
  tech: string;
  sort: SortKey;
  status: StatusFilter;
}): string {
  const params = new URLSearchParams();

  const q = state.q.trim();
  const tech = state.tech.trim();

  if (q) params.set("q", q);
  if (tech) params.set("tech", tech);
  if (state.sort !== DEFAULT_SORT) params.set("sort", state.sort);
  if (state.status !== DEFAULT_STATUS) params.set("status", state.status);

  return params.toString();
}

function canonicalUrl(pathname: string, qs: string): string {
  return qs ? `${pathname}?${qs}` : pathname;
}

export default function RodsListClient<T extends RodRowLike>({
  rows,
  children,
}: {
  rows: T[];
  children: (
    filteredRows: T[],
    setTechniqueFilter: React.Dispatch<React.SetStateAction<string>>
  ) => React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // --- URL -> state (supports back/forward) ---
  const urlQ = React.useMemo(() => getString(searchParams, "q"), [searchParams]);
  const urlTech = React.useMemo(() => getString(searchParams, "tech"), [searchParams]);
  const urlSort = React.useMemo(
    () => normalizeSort(getString(searchParams, "sort")),
    [searchParams]
  );
  const urlStatus = React.useMemo(
    () => normalizeStatusFilter(getString(searchParams, "status")),
    [searchParams]
  );

  const [q, setQ] = React.useState<string>(urlQ);
  const [techFilter, setTechFilter] = React.useState<string>(urlTech);
  const [sortKey, setSortKey] = React.useState<SortKey>(urlSort);
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>(urlStatus);

  React.useEffect(() => {
    if (urlQ !== q) setQ(urlQ);
    if (urlTech !== techFilter) setTechFilter(urlTech);
    if (urlSort !== sortKey) setSortKey(urlSort);
    if (urlStatus !== statusFilter) setStatusFilter(urlStatus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlQ, urlTech, urlSort, urlStatus]);

  const normalizedQ = q.trim().toLowerCase();
  const filtersOn =
    normalizedQ.length > 0 ||
    techFilter.trim().length > 0 ||
    sortKey !== DEFAULT_SORT ||
    statusFilter !== DEFAULT_STATUS;

  const lastWrittenUrlRef = React.useRef<string>("");

  function clearAll() {
    setQ("");
    setTechFilter("");
    setSortKey(DEFAULT_SORT);
    setStatusFilter(DEFAULT_STATUS);

    const nextQs = buildQueryString({
      q: "",
      tech: "",
      sort: DEFAULT_SORT,
      status: DEFAULT_STATUS,
    });
    const next = canonicalUrl(pathname, nextQs);
    lastWrittenUrlRef.current = next;
    router.replace(next);
  }

  React.useEffect(() => {
    const t = setTimeout(() => {
      const nextQs = buildQueryString({
        q,
        tech: techFilter,
        sort: sortKey,
        status: statusFilter,
      });
      const nextUrl = canonicalUrl(pathname, nextQs);

      const currentQs = buildQueryString({
        q: urlQ,
        tech: urlTech,
        sort: urlSort,
        status: urlStatus,
      });
      const currentUrl = canonicalUrl(pathname, currentQs);

      if (nextUrl === currentUrl) return;
      if (lastWrittenUrlRef.current === nextUrl) return;

      lastWrittenUrlRef.current = nextUrl;
      router.replace(nextUrl);
    }, 250);

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, techFilter, sortKey, statusFilter, pathname, router, urlQ, urlTech, urlSort, urlStatus]);

  const filtered = (rows ?? [])
    .filter((r) => {
      const hay = [r.name, r.brand, r.model, r.power, r.action, r.line, r.notes]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesText = normalizedQ.length === 0 || hay.includes(normalizedQ);

      const techniques = coerceTechniques(r.rod_techniques);
      const tf = techFilter.trim();
      const matchesTech = tf.length === 0 || techniques.includes(tf);

      const matchesStatus =
        statusFilter === "all"
          ? true
          : statusFilter === "owned"
          ? isOwned(r.status)
          : isWishList(r.status);

      return matchesText && matchesTech && matchesStatus;
    })
    .sort((a, b) => {
      if (sortKey === "name") return cmp(a.name ?? "", b.name ?? "");
      if (sortKey === "brand") return cmp(a.brand ?? "", b.brand ?? "");
      return cmp(displayStatus(a.status), displayStatus(b.status));
    });

  const ownedCount = React.useMemo(() => filtered.filter((r) => isOwned(r.status)).length, [filtered]);
  const wishListCount = React.useMemo(
    () => filtered.filter((r) => isWishList(r.status)).length,
    [filtered]
  );

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
          title="Technique"
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
          <option value="brand">Sort: Brand</option>
          <option value="name">Sort: Name</option>
          <option value="status">Sort: Status</option>
        </select>

        <select
          className="w-full rounded-md border px-3 py-2 text-sm sm:w-44"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          title="Status"
        >
          <option value="all">All</option>
          <option value="owned">Owned</option>
          <option value="planned">Wish list</option>
        </select>

        <button
          type="button"
          className="rounded-md border px-3 py-2 text-sm"
          onClick={clearAll}
          title="Reset to defaults"
        >
          Clear
        </button>

        <div className="text-sm opacity-70 sm:ml-auto">
          {filtered.length} / {(rows ?? []).length}
          {filtersOn ? <span className="ml-2">(filtered)</span> : null}
          <span className="ml-2">•</span>
          <span className="ml-2">Owned: {ownedCount}</span>
          <span className="ml-2">•</span>
          <span className="ml-2">Wish list: {wishListCount}</span>
        </div>
      </div>

      {techFilter.trim().length > 0 && (
        <div className="mb-4 flex items-center gap-2 text-sm">
          <span className="opacity-70">Technique:</span>
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

      {filtered.length === 0 && (rows ?? []).length > 0 && filtersOn && (
        <div className="mb-4 text-sm text-gray-700">
          No rods match these filters.{" "}
          <button className="underline" type="button" onClick={clearAll}>
            Reset filters
          </button>
        </div>
      )}

      {children(filtered, setTechFilter)}
    </div>
  );
}
