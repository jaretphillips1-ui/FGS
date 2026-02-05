"use client";

import * as React from "react";
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
  rod_techniques?: unknown; // can be string | string[] | JSON string
};

function coerceTechniques(input: unknown): string[] {
  if (input == null) return [];

  if (Array.isArray(input)) {
    return input.map((v) => String(v)).filter(Boolean);
  }

  if (typeof input === "string") {
    const s = input.trim();
    if (!s) return [];

    // JSON array string?
    if (s.startsWith("[") && s.endsWith("]")) {
      try {
        const parsed: unknown = JSON.parse(s);
        if (Array.isArray(parsed)) return parsed.map((v) => String(v)).filter(Boolean);
      } catch {
        // fall through
      }
    }

    // Comma-separated fallback
    if (s.includes(",")) return s.split(",").map((x) => x.trim()).filter(Boolean);

    // Single technique
    return [s];
  }

  // Unknown object types -> ignore
  return [];
}

export default function RodsListClient<T extends RodRowLike>({
  rows,
  children,
}: {
  rows: T[];
  children: (filteredRows: T[], setTechniqueFilter: React.Dispatch<React.SetStateAction<string>>) => React.ReactNode;
}) {
  const [q, setQ] = React.useState("");
  const [techFilter, setTechFilter] = React.useState<string>("");

  const normalizedQ = q.trim().toLowerCase();

  const filtered = (rows ?? []).filter((r) => {
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
