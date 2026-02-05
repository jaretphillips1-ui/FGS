"use client";

import * as React from "react";
import { ROD_TECHNIQUES } from "@/lib/rodTechniques";

type RodRowLike = {
  id: string;
  name?: string | null;
  brand?: string | null;
  model?: string | null;
  power?: string | null;
  action?: string | null;
  line?: string | null;
  notes?: string | null;
  rod_techniques?: any; // can be string | string[] | JSON string
};

// Best-effort technique coercion (mirrors what you've been doing on /rods)
function coerceTechniques(input: any): string[] {
  if (!input) return [];
  if (Array.isArray(input)) return input.map(String).filter(Boolean);

  if (typeof input === "string") {
    const s = input.trim();
    if (!s) return [];

    // JSON array string?
    if (s.startsWith("[") && s.endsWith("]")) {
      try {
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
      } catch {}
    }

    // Comma-separated fallback
    if (s.includes(",")) return s.split(",").map((x) => x.trim()).filter(Boolean);

    // Single technique
    return [s];
  }

  return [];
}

export default function RodsListClient<T extends RodRowLike>({ rows, children }: { rows: T[]; children: (filteredRows: T[]) => React.ReactNode }) {
  const [q, setQ] = React.useState("");
  const [techFilter, setTechFilter] = React.useState<string>("");

  const normalizedQ = q.trim().toLowerCase();

  const filtered = React.useMemo(() => {
    return (rows ?? []).filter((r) => {
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

      const techniques = coerceTechniques((r as any).rod_techniques);
      const matchesTech = techFilter.length === 0 || techniques.includes(techFilter);

      return matchesText && matchesTech;
    });
  }, [rods, normalizedQ, techFilter]);

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

        <button
          className="rounded-md border px-3 py-2 text-sm"
          onClick={() => {
            setQ("");
            setTechFilter("");
          }}
        >
          Clear
        </button>

        <div className="text-sm opacity-70 sm:ml-auto">
          {filtered.length} / {(rows ?? []).length}
        </div>
      </div>

      {/* We render whatever list JSX already exists in page.tsx via children */}
      {children(filtered) as any}
    </div>
  );
}

