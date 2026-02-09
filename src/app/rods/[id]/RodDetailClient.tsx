"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { InputHTMLAttributes } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  ROD_TECHNIQUES,
  normalizeTechniquesWithPrimary,
  buildTechniquesForStore,
  techniqueChipClass,
} from "@/lib/rodTechniques";
import {
  ROD_POWER_VALUES,
  ROD_ACTION_VALUES,
  rodPowerLabel,
  rodActionLabel,
  valueToOption,
  optionToNullableValue,
} from "@/lib/rodPowerAction";

type AnyRecord = Record<string, unknown>;
const TABLE = "gear_items";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// ======================
// STATUS (Owned / Wish list)
// UI:   owned | wishlist
// DB:   owned | planned   (enum gear_status)
// Read: planned -> wishlist (UI)
// Write: wishlist -> planned (DB)
// ======================
type UiStatus = "owned" | "wishlist";
type DbStatus = "owned" | "planned";

type WaterType = "fresh" | "salt" | "ice";
const WATER_TYPES: { value: WaterType; label: string }[] = [
  { value: "fresh", label: "Fresh water" },
  { value: "salt", label: "Salt water" },
  { value: "ice", label: "Ice" },
];

const TECHNIQUE_KEYS = new Set([
  "rod_techniques",
  "techniques",
  "technique_list",
  "technique",
  "rod_technique",
  "techniques_json",
]);

type LureOption = { label: string; value: number | null };
const LURE_OZ_OPTIONS: readonly LureOption[] = [
  { label: "—", value: null },

  { label: "1/32", value: 1 / 32 },
  { label: "1/16", value: 1 / 16 },
  { label: "3/32", value: 3 / 32 },
  { label: "1/8", value: 1 / 8 },
  { label: "3/16", value: 3 / 16 },
  { label: "1/4", value: 1 / 4 },
  { label: "5/16", value: 5 / 16 },
  { label: "3/8", value: 3 / 8 },
  { label: "7/16", value: 7 / 16 },
  { label: "1/2", value: 1 / 2 },
  { label: "5/8", value: 5 / 8 },
  { label: "3/4", value: 3 / 4 },
  { label: "7/8", value: 7 / 8 },

  { label: "1", value: 1 },
  { label: "1 1/8", value: 1 + 1 / 8 },
  { label: "1 1/4", value: 1 + 1 / 4 },
  { label: "1 3/8", value: 1 + 3 / 8 },
  { label: "1 1/2", value: 1 + 1 / 2 },
  { label: "1 5/8", value: 1 + 5 / 8 },
  { label: "1 3/4", value: 1 + 3 / 4 },
  { label: "2", value: 2 },
  { label: "2 1/2", value: 2 + 1 / 2 },
  { label: "3", value: 3 },
] as const;

function lureValueToKey(v: number | null): string {
  return v == null ? "" : String(v);
}
function lureKeyToValue(k: string): number | null {
  if (!k) return null;
  const n = Number(k);
  return Number.isFinite(n) ? n : null;
}

function errMsg(e: unknown, fallback: string) {
  if (e instanceof Error) return e.message || fallback;
  if (typeof e === "string") return e || fallback;
  try {
    return JSON.stringify(e);
  } catch {
    return fallback;
  }
}

function normalizeRodStatusDb(v: unknown): string {
  const s = String(v ?? "").trim().toLowerCase();
  if (s === "active") return "owned"; // legacy
  if (s === "planned") return "planned";
  if (s === "wishlist" || s === "wish list") return "planned"; // legacy safety
  return s;
}

function dbToUiStatus(v: unknown): UiStatus {
  const s = normalizeRodStatusDb(v);
  return s === "owned" ? "owned" : "wishlist";
}

function uiToDbStatus(ui: UiStatus): DbStatus {
  return ui === "owned" ? "owned" : "planned";
}

function shouldIncludeKeyInPatch(key: string, value: unknown): boolean {
  // Prevent accidental writes to UUID foreign keys like brand_id/product_id unless the value is a real UUID.
  if (key.endsWith("_id")) {
    if (value == null) return false;
    if (typeof value !== "string") return false;
    const s = value.trim();
    if (!s) return false;
    return UUID_RE.test(s);
  }
  return true;
}

function extractTechniques(row: AnyRecord | null | undefined): string[] {
  if (!row) return [];
  const v =
    row.rod_techniques ??
    row.techniques ??
    row.technique_list ??
    row.technique ??
    row.rod_technique ??
    row.techniques_json;

  if (Array.isArray(v)) return v.filter(Boolean).map(String);

  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return [];
    try {
      const j: unknown = JSON.parse(s);
      if (Array.isArray(j)) return j.filter(Boolean).map(String);
    } catch {
      // fall through
    }
    return s
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
  }

  return [];
}

// Keys we never want to edit/save from the UI
const READONLY_KEYS = new Set(["id", "created_at", "updated_at", "owner_id", "gear_type"]);

// Keys we never want to show/edit in the generic editor section
const HIDE_KEYS = new Set([
  ...Array.from(TECHNIQUE_KEYS),

  // We render these in nicer dedicated sections:
  "saltwater_ok",
  "water_type",
  "rod_water_type",
  "rod_line_min_lb",
  "rod_line_max_lb",
  "rod_lure_min_oz",
  "rod_lure_max_oz",
  "rod_length_in",
  "length_in",
  "rod_pieces",
  "pieces",
  "rod_power",
  "power",
  "rod_action",
  "action",
  "rod_notes",
  "notes",
  "rod_storage_note",
  "storage_note",
]);

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) =>
      setTimeout(() => rej(new Error(label + " timed out after " + ms + "ms")), ms)
    ),
  ]);
}

function isPlainObject(v: unknown) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function deepEqual(a: unknown, b: unknown) {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) return JSON.stringify(a) === JSON.stringify(b);
  if (isPlainObject(a) && isPlainObject(b)) return JSON.stringify(a) === JSON.stringify(b);
  return false;
}

function clampInt(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function toTitle(s: string) {
  return s
    .replace(/^rod_/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function pickFirstExistingKey(obj: AnyRecord | null, keys: string[]) {
  if (!obj) return null;
  for (const k of keys) if (k in obj) return k;
  return null;
}

function formatFeetInches(totalInches: number | null) {
  if (totalInches == null || !Number.isFinite(totalInches)) {
    return { ft: 0, inch: 0, total: null as number | null };
  }
  const t = clampInt(totalInches, 0, 5000);
  const ft = Math.floor(t / 12);
  const inch = t % 12;
  return { ft, inch, total: t };
}

function numOrNullFromInput(raw: string): number | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function clampNum(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function normalizeWaterType(v: unknown): WaterType {
  const s = String(v ?? "").trim().toLowerCase();
  if (s === "salt" || s === "saltwater" || s === "salt water") return "salt";
  if (s === "ice" || s === "ice fishing") return "ice";
  return "fresh";
}

function numOrNullFromDraft(v: unknown): number | null {
  if (typeof v !== "number") return null;
  return Number.isFinite(v) ? v : null;
}

/**
 * Always-visible steppers: input + a dedicated up/down control on the right.
 * (So we don't depend on browser hover spinners.)
 */
function StepperNumber({
  value,
  onChange,
  min,
  max,
  step = 1,
  disabled,
  placeholder,
  inputMode = "numeric",
}: {
  value: number | null;
  onChange: (next: number | null) => void;
  min: number;
  max: number;
  step?: number;
  disabled?: boolean;
  placeholder?: string;
  inputMode?: InputHTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  const vStr = value == null || !Number.isFinite(value) ? "" : String(value);

  function commitFromString(s: string) {
    const n = numOrNullFromInput(s);
    if (n == null) return onChange(null);
    const clamped = clampNum(n, min, max);
    onChange(clamped);
  }

  function bump(dir: 1 | -1) {
    const cur = value == null || !Number.isFinite(value) ? 0 : value;
    const next = clampNum(cur + dir * step, min, max);
    onChange(next);
  }

  return (
    <div
      className={
        "flex items-stretch rounded border overflow-hidden bg-white " +
        (disabled ? "opacity-60" : "")
      }
    >
      <input
        className="w-full px-3 py-2 text-sm outline-none text-right"
        type="text"
        inputMode={inputMode}
        value={vStr}
        onChange={(e) => commitFromString(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
      />
      <div className="flex flex-col border-l">
        <button
          type="button"
          className="px-2 h-full text-xs leading-none hover:bg-gray-100 disabled:opacity-50"
          onClick={() => bump(1)}
          disabled={disabled}
          aria-label="Increase"
          title="Increase"
        >
          ▲
        </button>
        <div className="h-px bg-gray-200" />
        <button
          type="button"
          className="px-2 h-full text-xs leading-none hover:bg-gray-100 disabled:opacity-50"
          onClick={() => bump(-1)}
          disabled={disabled}
          aria-label="Decrease"
          title="Decrease"
        >
          ▼
        </button>
      </div>
    </div>
  );
}

export default function RodDetailClient({
  id,
  initial,
}: {
  id: string;
  initial?: AnyRecord;
}) {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [err, setErr] = useState<string | null>(null);
  const [validationErr, setValidationErr] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const [original, setOriginal] = useState<AnyRecord | null>(null);
  const [draft, setDraft] = useState<AnyRecord | null>(null);

  // Techniques: single source of truth.
  // Stored order: [primary, ...secondaries]
  const [techniques, setTechniques] = useState<string[]>([]);
  const primaryTechnique = techniques[0] ?? "";

  // Local-only length editor state (feet+inches) -> saved into total inches column
  const [lenFeet, setLenFeet] = useState<number | null>(7);
  const [lenInches, setLenInches] = useState<number | null>(0);

  const loadSeq = useRef(0);

  // Detect which columns exist on this row (schema-safe mapping)
  const lengthKey = useMemo(
    () => pickFirstExistingKey(original, ["rod_length_in", "length_in"]),
    [original]
  );
  const piecesKey = useMemo(
    () => pickFirstExistingKey(original, ["rod_pieces", "pieces"]),
    [original]
  );
  const powerKey = useMemo(
    () => pickFirstExistingKey(original, ["rod_power", "power"]),
    [original]
  );
  const actionKey = useMemo(
    () => pickFirstExistingKey(original, ["rod_action", "action"]),
    [original]
  );
  const notesKey = useMemo(
    () => pickFirstExistingKey(original, ["rod_notes", "notes"]),
    [original]
  );
  const storageKey = useMemo(
    () => pickFirstExistingKey(original, ["rod_storage_note", "storage_note"]),
    [original]
  );

  const techniqueStoreKey = useMemo(
    () =>
      pickFirstExistingKey(original, [
        "rod_techniques",
        "techniques",
        "technique_list",
        "technique",
        "rod_technique",
        "techniques_json",
      ]) ?? "rod_techniques",
    [original]
  );

  const waterTypeKey = useMemo(
    () => pickFirstExistingKey(original, ["water_type", "rod_water_type"]) ?? null,
    [original]
  );

  const lineMinKey = useMemo(() => pickFirstExistingKey(original, ["rod_line_min_lb"]), [original]);
  const lineMaxKey = useMemo(() => pickFirstExistingKey(original, ["rod_line_max_lb"]), [original]);
  const lureMinKey = useMemo(() => pickFirstExistingKey(original, ["rod_lure_min_oz"]), [original]);
  const lureMaxKey = useMemo(() => pickFirstExistingKey(original, ["rod_lure_max_oz"]), [original]);

  // IMPORTANT: editableKeys should include hidden-but-editable keys
  const editableKeys = useMemo(() => {
    if (!original) return [];
    return Object.keys(original)
      .filter((k) => !READONLY_KEYS.has(k))
      .sort();
  }, [original]);

  function setTechniquesFromRow(row: AnyRecord) {
    const norm = normalizeTechniquesWithPrimary(extractTechniques(row));
    setTechniques(norm.techniques);
  }

  function setLengthFromRow(row: AnyRecord) {
    const lk = pickFirstExistingKey(row, ["rod_length_in", "length_in"]);
    if (!lk) return;
    const { ft, inch } = formatFeetInches(Number(row[lk] ?? 0));
    setLenFeet(ft);
    setLenInches(inch);
  }

  function toggleTechnique(t: string) {
    const canon = String(t ?? "").trim();
    if (!canon) return;

    setValidationErr(null);

    setTechniques((prev) => {
      const isOn = prev.includes(canon);
      const curPrimary = prev[0] ?? "";

      // If already selected:
      // - if NOT primary => make it primary (reorder) instead of removing
      // - if IS primary => remove it (and promote next)
      if (isOn) {
        if (curPrimary && curPrimary !== canon) {
          const rest = prev.filter((x) => x !== canon);
          return [canon, ...rest];
        }
        // remove primary
        return prev.filter((x) => x !== canon);
      }

      // ADD (append; if no primary, this becomes primary)
      if (prev.length === 0) return [canon];
      return [...prev, canon];
    });
  }

  function setMinMaxPair(next: {
    minKey: string | null;
    maxKey: string | null;
    changed: "min" | "max";
    value: number | null;
  }) {
    const { minKey, maxKey, changed, value } = next;
    if (!minKey && !maxKey) return;

    setDraft((d0) => {
      const d = { ...(d0 ?? {}) } as AnyRecord;

      const curMin = minKey ? numOrNullFromDraft(d[minKey]) : null;
      const curMax = maxKey ? numOrNullFromDraft(d[maxKey]) : null;

      let newMin = curMin;
      let newMax = curMax;

      if (changed === "min") newMin = value;
      if (changed === "max") newMax = value;

      // Guardrail: if both are set and min > max, adjust the *other* side to match.
      if (newMin != null && newMax != null && newMin > newMax) {
        if (changed === "min") newMax = newMin;
        else newMin = newMax;
      }

      if (minKey) d[minKey] = newMin;
      if (maxKey) d[maxKey] = newMax;

      return d;
    });
  }

  // Techniques dirty vs original row storage
  const techniquesDirty = useMemo(() => {
    if (!original) return false;
    const a = buildTechniquesForStore(primaryTechnique, techniques);
    const b = normalizeTechniquesWithPrimary(extractTechniques(original)).techniques;
    return JSON.stringify(a) !== JSON.stringify(b);
  }, [primaryTechnique, techniques, original]);

  const isDirty = useMemo(() => {
    if (!original || !draft) return false;

    for (const k of editableKeys) {
      if (k === lengthKey) continue;
      if (TECHNIQUE_KEYS.has(k)) continue; // techniques handled separately
      const before = original[k];
      const after = draft[k];
      if (!shouldIncludeKeyInPatch(k, after)) continue;
      if (!deepEqual(before, after)) return true;
    }

    if (lengthKey) {
      const base = clampInt(Number(original[lengthKey] ?? 0), 0, 5000);
      const curTotal =
        clampInt(Number(lenFeet ?? 0), 0, 20) * 12 + clampInt(Number(lenInches ?? 0), 0, 11);
      if (base !== curTotal) return true;
    }

    return false;
  }, [original, draft, editableKeys, lengthKey, lenFeet, lenInches]);

  useEffect(() => {
    const seq = ++loadSeq.current;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setErr(null);

      // Seed immediately from initial (if provided), but still fetch fresh.
      if (initial && !original) {
        setOriginal(initial);
        setDraft(initial);
        setTechniquesFromRow(initial);
        setLengthFromRow(initial);
      }

      try {
        const sessionRes = await withTimeout(supabase.auth.getSession(), 6000, "auth.getSession()");
        const user = sessionRes.data.session?.user;
        if (!user) {
          router.push("/login");
          return;
        }

        const res = await withTimeout(
          supabase.from(TABLE).select("*").eq("id", id).single(),
          8000,
          "gear_items select"
        );

        if (res.error) throw res.error;
        const row = res.data as AnyRecord;

        if (row?.gear_type !== "rod") {
          setErr(`Warning: gear_type is "${String(row?.gear_type ?? "")}".`);
        }

        if (!cancelled && seq === loadSeq.current) {
          setOriginal(row);
          setDraft(row);
          setTechniquesFromRow(row);
          setLengthFromRow(row);
        }
      } catch (e: unknown) {
        if (!cancelled && seq === loadSeq.current) {
          setErr(errMsg(e, "Failed to load rod."));
        }
      } finally {
        if (!cancelled && seq === loadSeq.current) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, router]);

  async function deleteRod() {
    if (!original) return;

    const name = String(original.name ?? "").trim() || "this rod";
    const ok = window.confirm(`Delete ${name}? This cannot be undone.`);
    if (!ok) return;

    setSaving(true);
    setErr(null);
    setValidationErr(null);
    setSavedMsg(null);

    try {
      const sessionRes = await withTimeout(supabase.auth.getSession(), 6000, "auth.getSession()");
      const user = sessionRes.data.session?.user;
      if (!user) {
        router.push("/login");
        return;
      }

      const res = await withTimeout(
        supabase.from(TABLE).delete().eq("id", id),
        8000,
        "gear_items delete"
      );
      if (res.error) throw res.error;

      router.push("/rods");
      router.refresh();
    } catch (e: unknown) {
      setErr(errMsg(e, "Failed to delete."));
    } finally {
      setSaving(false);
    }
  }

  async function save() {
    if (!original || !draft) return;

    setSaving(true);
    setErr(null);
    setValidationErr(null);
    setSavedMsg(null);

    const trimmedName = String(draft.name ?? "").trim();
    if (!trimmedName) {
      setSaving(false);
      setValidationErr("Name is required.");
      return;
    }

    try {
      // Re-check session before write
      const sessionRes = await withTimeout(supabase.auth.getSession(), 6000, "auth.getSession()");
      const user = sessionRes.data.session?.user;
      if (!user) {
        router.push("/login");
        return;
      }

      const patch: AnyRecord = {};

      if (String(original.name ?? "") !== trimmedName) patch.name = trimmedName;

      for (const k of editableKeys) {
        if (k === "name") continue;
        if (k === lengthKey) continue;
        if (TECHNIQUE_KEYS.has(k)) continue; // techniques handled separately
        const before = original[k];
        const after = draft[k];
        if (!shouldIncludeKeyInPatch(k, after)) continue;
        if (!deepEqual(before, after)) patch[k] = after;
      }

      // Normalize status to DB enum owned|planned (never wishlist)
      if ("status" in patch) {
        const s = normalizeRodStatusDb(patch.status);
        patch.status = s === "owned" ? "owned" : "planned";
      }

      if (lengthKey) {
        const curTotal =
          clampInt(Number(lenFeet ?? 0), 0, 20) * 12 + clampInt(Number(lenInches ?? 0), 0, 11);
        const base = clampInt(Number(original[lengthKey] ?? 0), 0, 5000);
        if (curTotal !== base) patch[lengthKey] = curTotal;
      }

      // Persist techniques from the techniques UI (only when changed)
      if (techniquesDirty) {
        patch[techniqueStoreKey] = buildTechniquesForStore(primaryTechnique, techniques);
      }

      if (Object.keys(patch).length === 0) {
        setSavedMsg("No changes to save.");
        return;
      }

      const res = await withTimeout(
        supabase.from(TABLE).update(patch).eq("id", id).eq("owner_id", user.id),
        8000,
        "gear_items update"
      );
      if (res.error) throw res.error;

      const next = { ...original, ...patch };
      setOriginal(next);
      setDraft(next);
      setTechniquesFromRow(next);
      setSavedMsg("Saved.");
    } catch (e: unknown) {
      setErr(errMsg(e, "Failed to save."));
    } finally {
      setSaving(false);
      setTimeout(() => setSavedMsg(null), 1500);
    }
  }

  if (loading) return <main className="p-6">Loading…</main>;
  if (!draft || !original) return <main className="p-6">Not found.</main>;

  const title = String(draft.name ?? "").trim() || "Rod";

  const renderedKeys = new Set<string>(
    [
      "name",
      "status",
      lengthKey ?? "",
      piecesKey ?? "",
      powerKey ?? "",
      actionKey ?? "",
      notesKey ?? "",
      storageKey ?? "",
      waterTypeKey ?? "",
      "saltwater_ok",
      lineMinKey ?? "",
      lineMaxKey ?? "",
      lureMinKey ?? "",
      lureMaxKey ?? "",
      techniqueStoreKey ?? "",
      "rod_techniques",
    ].filter(Boolean)
  );

  const otherKeys = editableKeys.filter((k) => !renderedKeys.has(k) && !HIDE_KEYS.has(k));

  const currentWaterType: WaterType = waterTypeKey
    ? normalizeWaterType((draft as AnyRecord)[waterTypeKey])
    : !!(draft as AnyRecord).saltwater_ok
    ? "salt"
    : "fresh";

  const currentPower =
    powerKey && String((draft as AnyRecord)[powerKey] ?? "").trim()
      ? String((draft as AnyRecord)[powerKey] ?? "").trim()
      : "—";

  const currentAction =
    actionKey && String((draft as AnyRecord)[actionKey] ?? "").trim()
      ? String((draft as AnyRecord)[actionKey] ?? "").trim()
      : "—";

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{title}</h1>
          <div className="text-sm text-gray-500 break-all">ID: {id}</div>
        </div>

        <div className="flex items-center gap-2">
          {(isDirty || techniquesDirty) && (
            <span className="text-sm text-amber-600">Unsaved changes</span>
          )}

          <button className="px-4 py-2 rounded border" onClick={() => router.push("/rods")}>
            Back
          </button>

          <button
            className="px-4 py-2 rounded border border-red-300 text-red-700 disabled:opacity-50"
            onClick={deleteRod}
            disabled={saving}
            title="Delete this rod"
          >
            Delete
          </button>

          <button
            className="px-4 py-2 rounded bg-black text-white disabled:opacity-50"
            onClick={save}
            disabled={saving || !(isDirty || techniquesDirty)}
            title={!(isDirty || techniquesDirty) ? "No changes" : "Save changes"}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {err && <div className="border rounded p-3 bg-red-50 text-red-800">{err}</div>}
      {validationErr && (
        <div className="border rounded p-3 bg-red-50 text-red-800">{validationErr}</div>
      )}
      {savedMsg && <div className="border rounded p-3 bg-green-50 text-green-800">{savedMsg}</div>}

      {/* Basics */}
      <section className="border rounded p-4 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700">Basics</h2>

        <label className="grid gap-1">
          <div className="text-sm font-medium">Name</div>
          <input
            className="border rounded px-3 py-2"
            value={String(draft.name ?? "")}
            onChange={(e) => setDraft((d) => ({ ...(d ?? {}), name: e.target.value }))}
          />
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {"status" in draft && (
            <label className="grid gap-1">
              <div className="text-sm font-medium">Status</div>
              <select
                className="border rounded px-3 py-2"
                value={dbToUiStatus((draft as AnyRecord).status)}
                onChange={(e) => {
                  const ui = (e.target.value as UiStatus) || "wishlist";
                  setDraft((d) => ({
                    ...(d ?? {}),
                    status: uiToDbStatus(ui),
                  }));
                }}
              >
                <option value="owned">Owned</option>
                <option value="wishlist">Wish list</option>
              </select>
            </label>
          )}

          <label className="grid gap-1 sm:col-span-2">
            <div className="text-sm font-medium">Water type</div>
            <select
              className="border rounded px-3 py-2"
              value={currentWaterType}
              onChange={(e) => {
                const next = normalizeWaterType(e.target.value);
                setDraft((d) => {
                  const cur = { ...(d ?? {}) } as AnyRecord;

                  if (waterTypeKey) {
                    cur[waterTypeKey] = next;
                  } else {
                    cur.saltwater_ok = next === "salt";
                  }

                  return cur;
                });
              }}
            >
              {WATER_TYPES.map((w) => (
                <option key={w.value} value={w.value}>
                  {w.label}
                </option>
              ))}
            </select>
            {!waterTypeKey && (
              <div className="text-xs text-gray-500">
                Stored as Saltwater OK (legacy). We can migrate to a proper water_type column later if you want.
              </div>
            )}
          </label>
        </div>
      </section>

      {/* Techniques */}
      <section className="border rounded p-4 space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-gray-700">Rod Techniques</h2>
          <div className="text-xs text-gray-500">
            Primary: <span className="font-medium">{primaryTechnique || "—"}</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {ROD_TECHNIQUES.map((t) => {
            const on = techniques.includes(t);
            const isPrimary = primaryTechnique === t;

            const cls = techniqueChipClass(
  isPrimary ? "primary" : on ? "selected" : "unselected",
  "sm"
);

            return (
              <button
                key={t}
                type="button"
                onClick={() => toggleTechnique(t)}
                className={cls}
                title={
                  on
                    ? isPrimary
                      ? "Primary (click to remove)"
                      : "Selected (click to make primary)"
                    : "Click to add"
                }
                aria-pressed={on}
              >
                {t}
              </button>
            );
          })}
        </div>

        <div className="text-xs text-gray-500">
          Selected: {techniques.length ? techniques.join(", ") : "none"}
        </div>
      </section>

      {/* Rod Specs */}
      <section className="border rounded p-4 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700">Rod Specs</h2>

        {/* Length + Pieces */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="grid gap-1 sm:col-span-2">
            <div className="text-sm font-medium">Length</div>
            <div className="grid grid-cols-2 gap-2">
              <StepperNumber
                value={lenFeet}
                onChange={(v) => setLenFeet(v)}
                min={0}
                max={20}
                step={1}
                placeholder="ft"
              />
              <StepperNumber
                value={lenInches}
                onChange={(v) => setLenInches(v)}
                min={0}
                max={11}
                step={1}
                placeholder="in"
              />
            </div>
            {!lengthKey && <div className="text-xs text-gray-500">Not saved (no length column)</div>}
          </div>

          <div className="grid gap-1">
            <div className="text-sm font-medium">Pieces</div>
            <StepperNumber
              value={piecesKey ? (numOrNullFromDraft((draft as AnyRecord)[piecesKey]) ?? null) : null}
              onChange={(v) => {
                if (!piecesKey) return;
                setDraft((d) => ({ ...(d ?? {}), [piecesKey]: v == null ? null : clampInt(v, 1, 8) }));
              }}
              min={1}
              max={8}
              step={1}
              disabled={!piecesKey}
              placeholder="1"
            />
            {!piecesKey && <div className="text-xs text-gray-500">Not saved (no pieces column)</div>}
          </div>
        </div>

        {/* Power + Action */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="grid gap-1">
            <div className="text-sm font-medium">Power</div>
            <select
              className="border rounded px-3 py-2"
              value={valueToOption(currentPower)}
              onChange={(e) => {
                if (!powerKey) return;
                const opt = String(e.target.value ?? "—");
                const v = optionToNullableValue(opt);
                setDraft((d) => ({
                  ...(d ?? {}),
                  [powerKey]: v,
                }));
              }}
              disabled={!powerKey}
            >
              <option value="—">—</option>
              {ROD_POWER_VALUES.map((p) => (
                <option key={p} value={p}>
                  {rodPowerLabel(p)}
                </option>
              ))}
            </select>
            {!powerKey && <div className="text-xs text-gray-500">Not saved (no power column)</div>}
          </label>

          <label className="grid gap-1">
            <div className="text-sm font-medium">Action</div>
            <select
              className="border rounded px-3 py-2"
              value={valueToOption(currentAction)}
              onChange={(e) => {
                if (!actionKey) return;
                const opt = String(e.target.value ?? "—");
                const v = optionToNullableValue(opt);
                setDraft((d) => ({
                  ...(d ?? {}),
                  [actionKey]: v,
                }));
              }}
              disabled={!actionKey}
            >
              <option value="—">—</option>
              {ROD_ACTION_VALUES.map((a) => (
                <option key={a} value={a}>
                  {rodActionLabel(a)}
                </option>
              ))}
            </select>
            {!actionKey && <div className="text-xs text-gray-500">Not saved (no action column)</div>}
          </label>
        </div>

        {/* Line + Lure min/max */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="grid gap-2">
            <div className="text-sm font-medium">Line rating (lb)</div>
            <div className="grid grid-cols-2 gap-2">
              <StepperNumber
                value={lineMinKey ? numOrNullFromDraft((draft as AnyRecord)[lineMinKey]) : null}
                onChange={(v) =>
                  setMinMaxPair({ minKey: lineMinKey, maxKey: lineMaxKey, changed: "min", value: v })
                }
                min={0}
                max={200}
                step={1}
                disabled={!lineMinKey && !lineMaxKey}
                placeholder="Min"
              />
              <StepperNumber
                value={lineMaxKey ? numOrNullFromDraft((draft as AnyRecord)[lineMaxKey]) : null}
                onChange={(v) =>
                  setMinMaxPair({ minKey: lineMinKey, maxKey: lineMaxKey, changed: "max", value: v })
                }
                min={0}
                max={200}
                step={1}
                disabled={!lineMinKey && !lineMaxKey}
                placeholder="Max"
              />
            </div>
            {!lineMinKey && !lineMaxKey && (
              <div className="text-xs text-gray-500">Not saved (no line rating columns)</div>
            )}
          </div>

          <div className="grid gap-2">
            <div className="text-sm font-medium">Lure rating (oz)</div>
            <div className="grid grid-cols-2 gap-2">
              <select
                className="border rounded px-3 py-2"
                value={lureValueToKey(lureMinKey ? ((draft as AnyRecord)[lureMinKey] as number | null) : null)}
                onChange={(e) => {
                  const v = lureKeyToValue(e.target.value);
                  setMinMaxPair({ minKey: lureMinKey, maxKey: lureMaxKey, changed: "min", value: v });
                }}
                disabled={!lureMinKey && !lureMaxKey}
              >
                {LURE_OZ_OPTIONS.map((o) => (
                  <option key={o.label} value={lureValueToKey(o.value)}>
                    {o.label}
                  </option>
                ))}
              </select>

              <select
                className="border rounded px-3 py-2"
                value={lureValueToKey(lureMaxKey ? ((draft as AnyRecord)[lureMaxKey] as number | null) : null)}
                onChange={(e) => {
                  const v = lureKeyToValue(e.target.value);
                  setMinMaxPair({ minKey: lureMinKey, maxKey: lureMaxKey, changed: "max", value: v });
                }}
                disabled={!lureMinKey && !lureMaxKey}
              >
                {LURE_OZ_OPTIONS.map((o) => (
                  <option key={o.label} value={lureValueToKey(o.value)}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            {!lureMinKey && !lureMaxKey && (
              <div className="text-xs text-gray-500">Not saved (no lure rating columns)</div>
            )}
          </div>
        </div>

        {/* Notes + Storage */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="grid gap-1">
            <div className="text-sm font-medium">Notes</div>
            <textarea
              className="border rounded px-3 py-2 min-h-[120px]"
              value={notesKey ? String((draft as AnyRecord)[notesKey] ?? "") : ""}
              onChange={(e) => {
                if (!notesKey) return;
                setDraft((d) => ({ ...(d ?? {}), [notesKey]: e.target.value }));
              }}
              disabled={!notesKey}
              placeholder={!notesKey ? "Not saved (no notes column)" : "Notes…"}
            />
          </label>

          <label className="grid gap-1">
            <div className="text-sm font-medium">Storage note</div>
            <textarea
              className="border rounded px-3 py-2 min-h-[120px]"
              value={storageKey ? String((draft as AnyRecord)[storageKey] ?? "") : ""}
              onChange={(e) => {
                if (!storageKey) return;
                setDraft((d) => ({ ...(d ?? {}), [storageKey]: e.target.value }));
              }}
              disabled={!storageKey}
              placeholder={!storageKey ? "Not saved (no storage column)" : "Where it lives…"}
            />
          </label>
        </div>
      </section>

      {/* Other Fields */}
      {otherKeys.length > 0 && (
        <section className="border rounded p-4 space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">Other Fields</h2>

          <div className="grid gap-3">
            {otherKeys.map((k) => {
              const v = (draft as AnyRecord)[k];

              // boolean
              if (typeof v === "boolean") {
                return (
                  <label key={k} className="flex items-center justify-between gap-3">
                    <div className="text-sm font-medium">{toTitle(k)}</div>
                    <input
                      type="checkbox"
                      checked={!!v}
                      onChange={(e) =>
                        setDraft((d) => ({ ...(d ?? {}), [k]: e.target.checked }))
                      }
                    />
                  </label>
                );
              }

              // number-ish fields
              if (typeof v === "number") {
                return (
                  <label key={k} className="grid gap-1">
                    <div className="text-sm font-medium">{toTitle(k)}</div>
                    <input
                      className="border rounded px-3 py-2"
                      value={String(v)}
                      inputMode="decimal"
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        setDraft((d) => ({
                          ...(d ?? {}),
                          [k]: Number.isFinite(n) ? n : null,
                        }));
                      }}
                    />
                  </label>
                );
              }

              // default string editor
              return (
                <label key={k} className="grid gap-1">
                  <div className="text-sm font-medium">{toTitle(k)}</div>
                  <input
                    className="border rounded px-3 py-2"
                    value={v == null ? "" : String(v)}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...(d ?? {}),
                        [k]: e.target.value,
                      }))
                    }
                  />
                </label>
              );
            })}
          </div>
        </section>
      )}
    </main>
  );
}
