"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type AnyRecord = Record<string, any>;

const TABLE = "gear_items";

// Starter technique set (easy to expand later)
const TECHNIQUES = [
  "Crankbait",
  "Spinnerbait",
  "Chatterbait",
  "Swimbait",
  "Jerkbait",
  "Topwater",
  "Frog",
  "Flipping/Pitching",
  "Texas Rig",
  "Jig",
  "Ned Rig",
  "Drop Shot",
  "Wacky",
  "Carolina Rig",
  "Tube",
  "Spoon",
] as const;

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) =>
      setTimeout(() => rej(new Error(`${label} timed out after ${ms}ms`)), ms)
    ),
  ]);
}

const BLOCKED_KEYS = new Set<string>([
  "id",
  "created_at",
  "updated_at",
  "deleted_at",
  "user_id",
  "owner_id",

  // classification / foreign keys: keep stable unless you explicitly build editors for them
  "gear_type",
  "brand_id",
  "product_id",
]);

function isEditableKey(k: string) {
  if (BLOCKED_KEYS.has(k)) return false;
  if (k.startsWith("_")) return false;
  return true;
}

function stableStringify(v: any): string {
  try {
    return JSON.stringify(v, Object.keys(v || {}).sort(), 2);
  } catch {
    return String(v);
  }
}

function deepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a && b && typeof a === "object") {
    return stableStringify(a) === stableStringify(b);
  }
  return false;
}

function coerceInputValue(value: any): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function parseMaybeJson(s: string): any {
  const t = s.trim();
  if (!t) return null;
  if (t === "true") return true;
  if (t === "false") return false;
  if (!Number.isNaN(Number(t)) && t.match(/^-?\d+(\.\d+)?$/)) return Number(t);
  if ((t.startsWith("{") && t.endsWith("}")) || (t.startsWith("[") && t.endsWith("]"))) {
    try {
      return JSON.parse(t);
    } catch {
      return s;
    }
  }
  return s;
}

function getString(draft: AnyRecord | null, k: string) {
  const v = draft?.[k];
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function getBool(draft: AnyRecord | null, k: string) {
  const v = draft?.[k];
  return v === true;
}

function getStringArray(draft: AnyRecord | null, k: string) {
  const v = draft?.[k];
  return Array.isArray(v) ? (v as string[]) : [];
}

export default function RodDetailClient({ id }: { id: string }) {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [row, setRow] = useState<AnyRecord | null>(null);
  const [draft, setDraft] = useState<AnyRecord | null>(null);
  const originalRef = useRef<AnyRecord | null>(null);

  const allKeys = useMemo(() => (row ? Object.keys(row).sort((a, b) => a.localeCompare(b)) : []), [row]);

  const editableKeys = useMemo(() => {
    if (!row) return [];
    return Object.keys(row)
      .filter(isEditableKey)
      .sort((a, b) => a.localeCompare(b));
  }, [row]);

  const isDirty = useMemo(() => {
    if (!draft || !originalRef.current) return false;
    for (const k of editableKeys) {
      if (!deepEqual(draft[k], originalRef.current[k])) return true;
    }
    return false;
  }, [draft, editableKeys]);

  async function load() {
    setLoading(true);
    setErr(null);

    try {
      const res = await withTimeout(
        supabase
          .from(TABLE)
          .select("*")
          .eq("id", id)
          .eq("gear_type", "rod")
          .maybeSingle<AnyRecord>(),
        8000,
        `select ${TABLE}`
      );

      if (res.error) throw res.error;
      if (!res.data) throw new Error("Rod not found.");

      setRow(res.data);
      setDraft({ ...res.data });
      originalRef.current = { ...res.data };
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function onSave() {
    if (!draft) return;
    setSaving(true);
    setErr(null);

    try {
      const payload: AnyRecord = {};
      for (const k of editableKeys) payload[k] = draft[k] ?? null;

      const res = await withTimeout(
        supabase.from(TABLE).update(payload).eq("id", id),
        8000,
        `update ${TABLE}`
      );
      if (res.error) throw res.error;

      originalRef.current = { ...(originalRef.current ?? {}), ...payload };
      setRow((r) => ({ ...(r ?? {}), ...payload }));
      setDraft((d) => ({ ...(d ?? {}), ...payload }));
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  }

  function onCancel() {
    if (!originalRef.current) return;
    setDraft({ ...originalRef.current });
    setErr(null);
  }

  if (loading) return <div className="p-4 text-sm text-gray-500">Loading…</div>;

  // Curated fields (only show if the key exists on this row)
  const has = (k: string) => Object.prototype.hasOwnProperty.call(row ?? {}, k);

  const statusOptions = ["owned", "planned", "sold", "retired"];

  return (
    <main className="p-4 space-y-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <button className="text-sm underline" onClick={() => router.push("/rods")}>
          ← Back to rods
        </button>

        <div className="flex gap-2">
          <button
            className="px-3 py-1 rounded border disabled:opacity-50"
            onClick={onCancel}
            disabled={!isDirty || saving}
          >
            Cancel
          </button>
          <button
            className="px-3 py-1 rounded border disabled:opacity-50"
            onClick={onSave}
            disabled={!isDirty || saving}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      <div className="flex items-baseline justify-between">
        <h1 className="text-xl font-semibold">Rod Detail</h1>
        <div className="text-xs text-gray-500">ID: {id}</div>
      </div>

      {err && (
        <div className="rounded border p-3 text-sm">
          <div className="font-medium">Error</div>
          <div className="text-gray-600">{err}</div>
        </div>
      )}

      {/* Curated Rod Form */}
      <section className="rounded border p-4 space-y-4">
        <div className="grid gap-3">
          {has("name") && (
            <label className="grid gap-1">
              <span className="text-sm text-gray-600">Name</span>
              <input
                className="border rounded px-3 py-2"
                value={getString(draft, "name")}
                onChange={(e) => setDraft((d) => ({ ...(d ?? {}), name: e.target.value }))}
              />
            </label>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {has("status") && (
              <label className="grid gap-1">
                <span className="text-sm text-gray-600">Status</span>
                <select
                  className="border rounded px-3 py-2"
                  value={getString(draft, "status")}
                  onChange={(e) => setDraft((d) => ({ ...(d ?? {}), status: e.target.value }))}
                >
                  {statusOptions.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                  {/* keep whatever existing status might be */}
                  {!statusOptions.includes(getString(draft, "status")) && (
                    <option value={getString(draft, "status")}>{getString(draft, "status")}</option>
                  )}
                </select>
              </label>
            )}

            {has("saltwater_ok") && (
              <label className="flex items-center gap-2 mt-6 md:mt-7">
                <input
                  type="checkbox"
                  checked={getBool(draft, "saltwater_ok")}
                  onChange={(e) =>
                    setDraft((d) => ({ ...(d ?? {}), saltwater_ok: e.target.checked }))
                  }
                />
                <span className="text-sm text-gray-700">Saltwater OK</span>
              </label>
            )}
          </div>

          {/* Notes */}
          {has("notes") && (
            <label className="grid gap-1">
              <span className="text-sm text-gray-600">Notes</span>
              <textarea
                className="border rounded px-3 py-2 min-h-[120px]"
                value={getString(draft, "notes")}
                onChange={(e) => setDraft((d) => ({ ...(d ?? {}), notes: e.target.value }))}
              />
            </label>
          )}

          {has("storage_note") && (
            <label className="grid gap-1">
              <span className="text-sm text-gray-600">Storage note</span>
              <input
                className="border rounded px-3 py-2"
                value={getString(draft, "storage_note")}
                onChange={(e) =>
                  setDraft((d) => ({ ...(d ?? {}), storage_note: e.target.value }))
                }
              />
            </label>
          )}

                    {/* Rod Specs */}
          <section className="rounded border p-4 space-y-4">
            <h2 className="text-sm font-medium text-gray-700">Rod Specs</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {has("rod_length_in") && (() => {
  const totalIn =
    typeof draft?.rod_length_in === "number"
      ? (draft.rod_length_in as number)
      : draft?.rod_length_in == null
        ? null
        : Number(draft.rod_length_in);

  const safeTotal = Number.isFinite(totalIn as any) ? (totalIn as number) : null;

  const feet = safeTotal == null ? "" : Math.floor(safeTotal / 12);
  const inches = safeTotal == null ? "" : Math.round((safeTotal - (Number(feet) || 0) * 12) * 10) / 10;

  const setLen = (nextFeetRaw: string, nextInchesRaw: string) => {
    const f = nextFeetRaw.trim() === "" ? 0 : Number(nextFeetRaw);
    const i = nextInchesRaw.trim() === "" ? 0 : Number(nextInchesRaw);

    const fOk = Number.isFinite(f) && f >= 0;
    const iOk = Number.isFinite(i) && i >= 0;

    if (!fOk || !iOk) return;    // Normalize inches by carrying over into feet, then clamp to 0–11.5 (0.5" steps)
    const carry = Math.floor(i / 12);
    let normFeet = f + carry;
    let normInches = i - carry * 12;

    // clamp inches to 0–11.5, and carry if it somehow hits 12
    if (normInches < 0) normInches = 0;
    if (normInches > 11.5) normInches = 11.5;

    // if clamp forced inches to 12 (shouldn't), carry to feet
    if (normInches >= 12) {
      normFeet += Math.floor(normInches / 12);
      normInches = normInches % 12;
    }

    const total = normFeet * 12 + normInches;

    setDraft((d) => ({
      ...(d ?? {}),
      rod_length_in:
        total === 0 && nextFeetRaw.trim() === "" && nextInchesRaw.trim() === ""
          ? null
          : total,
    }));};

  return (
    <div className="grid gap-1">
      <span className="text-sm text-gray-600">Length</span>

      <div className="flex gap-2">
        <div className="grid gap-1 w-28">
          <span className="text-xs text-gray-500">Feet</span>
          <input
            type="number"
            min="0"
            className="border rounded px-3 py-2"
            value={feet}
            onChange={(e) => setLen(e.target.value, String(inches))}
          />
        </div>

        <div className="grid gap-1 w-28">
          <span className="text-xs text-gray-500">Inches</span>
          <input
            type="number"
            min="0"
            step="0.5"
            className="border rounded px-3 py-2"
            value={inches}
            onChange={(e) => setLen(String(feet), e.target.value)}
          />
        </div>

        <div className="flex items-end pb-2 text-sm text-gray-600">
          {safeTotal == null ? "" : `(${Math.floor(safeTotal / 12)}' ${Math.round((safeTotal % 12) * 10) / 10}")`}
        </div>
      </div>
    </div>
  );
})()}

              {has("rod_pieces") && (
                <label className="grid gap-1">
                  <span className="text-sm text-gray-600">Pieces</span>
                  <input
                    type="number"
                    className="border rounded px-3 py-2"
                    value={draft?.rod_pieces ?? ""}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...(d ?? {}),
                        rod_pieces: e.target.value === "" ? null : Number(e.target.value),
                      }))
                    }
                  />
                </label>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {has("rod_power") && (
                <label className="grid gap-1">
                  <span className="text-sm text-gray-600">Power</span>
                  <select
                    className="border rounded px-3 py-2"
                    value={draft?.rod_power ?? ""}
                    onChange={(e) =>
                      setDraft((d) => ({ ...(d ?? {}), rod_power: e.target.value || null }))
                    }
                  >
                    <option value="">—</option>
                    {["UL", "L", "ML", "M", "MH", "H", "XH"].map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {has("rod_action") && (
                <label className="grid gap-1">
                  <span className="text-sm text-gray-600">Action</span>
                  <select
                    className="border rounded px-3 py-2"
                    value={draft?.rod_action ?? ""}
                    onChange={(e) =>
                      setDraft((d) => ({ ...(d ?? {}), rod_action: e.target.value || null }))
                    }
                  >
                    <option value="">—</option>
                    {["Slow", "Moderate", "Fast", "Extra Fast"].map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {has("rod_line_min_lb") && has("rod_line_max_lb") && (
                <label className="grid gap-1">
                  <span className="text-sm text-gray-600">Line Rating (lb)</span>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      className="border rounded px-3 py-2 w-full"
                      placeholder="Min"
                      value={draft?.rod_line_min_lb ?? ""}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...(d ?? {}),
                          rod_line_min_lb: e.target.value === "" ? null : Number(e.target.value),
                        }))
                      }
                    />
                    <input
                      type="number"
                      className="border rounded px-3 py-2 w-full"
                      placeholder="Max"
                      value={draft?.rod_line_max_lb ?? ""}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...(d ?? {}),
                          rod_line_max_lb: e.target.value === "" ? null : Number(e.target.value),
                        }))
                      }
                    />
                  </div>
                </label>
              )}

              {has("rod_lure_min_oz") && has("rod_lure_max_oz") && (
                <label className="grid gap-1">
                  <span className="text-sm text-gray-600">Lure Rating (oz)</span>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      step="0.01"
                      className="border rounded px-3 py-2 w-full"
                      placeholder="Min"
                      value={draft?.rod_lure_min_oz ?? ""}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...(d ?? {}),
                          rod_lure_min_oz: e.target.value === "" ? null : Number(e.target.value),
                        }))
                      }
                    />
                    <input
                      type="number"
                      step="0.01"
                      className="border rounded px-3 py-2 w-full"
                      placeholder="Max"
                      value={draft?.rod_lure_max_oz ?? ""}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...(d ?? {}),
                          rod_lure_max_oz: e.target.value === "" ? null : Number(e.target.value),
                        }))
                      }
                    />
                  </div>
                </label>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {has("rod_handle") && (
                <label className="grid gap-1">
                  <span className="text-sm text-gray-600">Handle</span>
                  <input
                    className="border rounded px-3 py-2"
                    value={draft?.rod_handle ?? ""}
                    onChange={(e) =>
                      setDraft((d) => ({ ...(d ?? {}), rod_handle: e.target.value || null }))
                    }
                  />
                </label>
              )}

              {has("rod_blank") && (
                <label className="grid gap-1">
                  <span className="text-sm text-gray-600">Blank</span>
                  <input
                    className="border rounded px-3 py-2"
                    value={draft?.rod_blank ?? ""}
                    onChange={(e) =>
                      setDraft((d) => ({ ...(d ?? {}), rod_blank: e.target.value || null }))
                    }
                  />
                </label>
              )}

              {has("rod_guides") && (
                <label className="grid gap-1">
                  <span className="text-sm text-gray-600">Guides</span>
                  <input
                    className="border rounded px-3 py-2"
                    value={draft?.rod_guides ?? ""}
                    onChange={(e) =>
                      setDraft((d) => ({ ...(d ?? {}), rod_guides: e.target.value || null }))
                    }
                  />
                </label>
              )}
            </div>
          </section>

{/* Techniques */}
          {has("techniques") && (
            <div className="grid gap-2">
              <div className="text-sm text-gray-600">Techniques</div>
              <div className="flex flex-wrap gap-2">
                {TECHNIQUES.map((t) => {
                  const selected = getStringArray(draft, "techniques");
                  const on = selected.includes(t);
                  return (
                    <button
                      key={t}
                      type="button"
                      className="px-2 py-1 rounded border text-sm"
                      onClick={() => {
                        const next = on ? selected.filter((x) => x !== t) : [...selected, t];
                        setDraft((d) => ({ ...(d ?? {}), techniques: next }));
                      }}
                    >
                      {on ? `✓ ${t}` : t}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Advanced: everything else editable (excluding blocked keys) */}
      <details className="rounded border p-4">
        <summary className="cursor-pointer text-sm font-medium">Advanced fields</summary>
        <div className="mt-4 grid gap-3">
          {editableKeys
            .filter(
              (k) =>
                !["name", "status", "saltwater_ok", "notes", "storage_note", "techniques"].includes(k)
            )
            .map((k) => {
              const v = draft?.[k];
              const s = coerceInputValue(v);

              return (
                <label key={k} className="grid gap-1">
                  <span className="text-sm text-gray-600">{k}</span>
                  <input
                    className="border rounded px-3 py-2"
                    value={s}
                    onChange={(e) =>
                      setDraft((d) => ({ ...(d ?? {}), [k]: parseMaybeJson(e.target.value) }))
                    }
                  />
                </label>
              );
            })}

          <div className="text-xs text-gray-500">
            {isDirty ? "Unsaved changes" : "All changes saved"}
          </div>

          <div className="text-xs text-gray-500">
            Non-editable keys (blocked): {Array.from(BLOCKED_KEYS).join(", ")}
          </div>

          {/* Helpful: quick peek at all keys for schema discovery */}
          <details className="mt-2">
            <summary className="cursor-pointer text-xs text-gray-600">Show all keys</summary>
            <pre className="mt-2 text-xs bg-gray-50 border rounded p-2 overflow-auto">
{allKeys.join("\n")}
            </pre>
          </details>
        </div>
      </details>
    </main>
  );
}