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

function getString(sp: ReturnType<typeof useSearchParams>, key: string): string {
  return sp.get(key) ?? "";
}

function buildQueryString(state: { q: string; tech: string }): string {
  const params = new URLSearchParams();

  const q = state.q.trim();
  const tech = state.tech.trim();

  if (q) params.set("q", q);
  if (tech) params.set("tech", tech);

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

  const urlQ = React.useMemo(() => getString(searchParams, "q"), [searchParams]);
  const urlTech = React.useMemo(() => getString(searchParams, "tech"), [searchParams]);

  const [q, setQ] = React.useState<string>(urlQ);
  const [techFilter, setTechFilter] = React.useState<string>(urlTech);

  React.useEffect(() => {
    setQ((prev) => (prev === urlQ ? prev : urlQ));
    setTechFilter((prev) => (prev === urlTech ? prev : urlTech));
  }, [urlQ, urlTech]);

  const normalizedQ = q.trim().toLowerCase();
  const filtersOn = normalizedQ.length > 0 || techFilter.trim().length > 0;

  const lastWrittenUrlRef = React.useRef<string>("");

  function clearAll() {
    setQ("");
    setTechFilter("");

    const nextQs = buildQueryString({ q: "", tech: "" });
    const next = canonicalUrl(pathname, nextQs);
    lastWrittenUrlRef.current = next;
    router.replace(next);
  }

  React.useEffect(() => {
    const t = setTimeout(() => {
      const nextQs = buildQueryString({ q, tech: techFilter });
      const nextUrl = canonicalUrl(pathname, nextQs);

      const currentQs = buildQueryString({ q: urlQ, tech: urlTech });
      const currentUrl = canonicalUrl(pathname, currentQs);

      if (nextUrl === currentUrl) return;
      if (lastWrittenUrlRef.current === nextUrl) return;

      lastWrittenUrlRef.current = nextUrl;
      router.replace(nextUrl);
    }, 250);

    return () => clearTimeout(t);
  }, [q, techFilter, pathname, router, urlQ, urlTech]);

  const filtered = (rows ?? []).filter((r) => {
    const hay = [r.name, r.brand, r.model, r.power, r.action, r.line, r.notes]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    const matchesText = normalizedQ.length === 0 || hay.includes(normalizedQ);

    const techniques = coerceTechniques(r.rod_techniques);
    const tf = techFilter.trim();
    const matchesTech = tf.length === 0 || techniques.includes(tf);

    return matchesText && matchesTech;
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
          title="Technique"
        >
          <option value="">All techniques</option>
          {ROD_TECHNIQUES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>

        <button
          type="button"
          className="rounded-md border px-3 py-2 text-sm"
          onClick={clearAll}
          title="Reset search + technique"
        >
          Clear
        </button>

        <div className="text-sm opacity-70 sm:ml-auto">
          {filtered.length} / {(rows ?? []).length}
          {filtersOn ? <span className="ml-2">(filtered)</span> : null}
        </div>
      </div>

      {techFilter.trim().length > 0 && (
        <div className="mb-4 flex items-center gap-2 text-sm">
          <span className="opacity-70">Technique:</span>
          <button
            type="button"
            className="text-xs px-2 py-0.5 rounded bg-gray-200 text-gray-800 border border-gray-300 hover:bg-gray-300"
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
