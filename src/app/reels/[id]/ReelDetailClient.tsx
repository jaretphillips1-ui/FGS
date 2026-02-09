"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { InputHTMLAttributes } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { REEL_HAND_VALUES, REEL_TYPE_VALUES } from "@/lib/reelSpecs";

type AnyRecord = Record<string, unknown>;
const TABLE = "gear_items";

const READONLY_KEYS = new Set(["id", "created_at", "updated_at", "owner_id", "gear_type"]);
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function errMsg(e: unknown, fallback: string) {
  if (e instanceof Error) return e.message || fallback;
  if (typeof e === "string") return e || fallback;
  try {
    return JSON.stringify(e);
  } catch {
    return fallback;
  }
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

function numOrNullFromDraft(v: unknown): number | null {
  if (typeof v !== "number") return null;
  return Number.isFinite(v) ? v : null;
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

function toTitle(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) =>
      setTimeout(() => rej(new Error(label + " timed out after " + ms + "ms")), ms)
    ),
  ]);
}

/** Always-visible steppers: input + dedicated up/down control on the right. */
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

export default function ReelDetailClient(props: { id?: string }) {
  const router = useRouter();

  // useParams() typing can be awkward; avoid `any` but still safely read "id"
  const params = useParams() as unknown as Record<string, string | string[] | undefined>;

  // Pull id from URL as the source of truth; fall back to prop if present.
  const routeIdRaw = params["id"];
  const routeId = Array.isArray(routeIdRaw) ? routeIdRaw[0] : routeIdRaw;
  const id = String(props.id ?? routeId ?? "").trim();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [err, setErr] = useState<string | null>(null);
  const [validationErr, setValidationErr] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const [original, setOriginal] = useState<AnyRecord | null>(null);
  const [draft, setDraft] = useState<AnyRecord | null>(null);

  const loadSeq = useRef(0);

  const editableKeys = useMemo(() => {
    if (!original) return [];
    return Object.keys(original)
      .filter((k) => !READONLY_KEYS.has(k))
      .sort();
  }, [original]);

  const renderedKeys = new Set<string>([
    "name",
    "status",
    "reel_type",
    "reel_hand",
    "reel_gear_ratio",
    "reel_ipt_in",
    "reel_weight_oz",
    "reel_max_drag_lb",
    "reel_bearings",
    "reel_line_capacity",
    "reel_brake_system",
    "notes",
    "storage_note",
    "catalog_product_id",
  ]);

  const otherKeys = editableKeys.filter((k) => !renderedKeys.has(k));

  const isDirty = useMemo(() => {
    if (!original || !draft) return false;
    for (const k of editableKeys) {
      if (!deepEqual(original[k], draft[k])) return true;
    }
    return false;
  }, [original, draft, editableKeys]);

  useEffect(() => {
    const seq = ++loadSeq.current;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setErr(null);
      setValidationErr(null);
      setSavedMsg(null);

      // Guard: never hit Supabase with undefined/invalid UUID
      if (!id || !UUID_RE.test(id)) {
        setOriginal(null);
        setDraft(null);
        setErr(`Invalid reel id in URL: "${id || "(empty)"}"`);
        setLoading(false);
        return;
      }

      try {
        const sessionRes = await withTimeout(supabase.auth.getSession(), 6000, "auth.getSession()");
        const user = sessionRes.data.session?.user;
        if (!user) {
          router.push("/login");
          return;
        }

        const res = await withTimeout(
          supabase.from(TABLE).select("*").eq("id", id).eq("gear_type", "reel").maybeSingle(),
          8000,
          "gear_items select"
        );

        if (res.error) throw res.error;

        const row = (res.data ?? null) as AnyRecord | null;

        if (!cancelled && seq === loadSeq.current) {
          setOriginal(row);
          setDraft(row);
        }
      } catch (e: unknown) {
        console.error("[ReelDetailClient] load error:", e);
        if (!cancelled && seq === loadSeq.current) {
          setErr(errMsg(e, "Failed to load reel."));
          setOriginal(null);
          setDraft(null);
        }
      } finally {
        if (!cancelled && seq === loadSeq.current) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [id, router]);

  async function deleteReel() {
    if (!original) return;

    const name = String(original.name ?? "").trim() || "this reel";
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

      router.push("/reels");
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
      const sessionRes = await withTimeout(supabase.auth.getSession(), 6000, "auth.getSession()");
      const user = sessionRes.data.session?.user;
      if (!user) {
        router.push("/login");
        return;
      }

      const patch: AnyRecord = {};
      for (const k of editableKeys) {
        const before = original[k];
        const after = draft[k];
        if (!deepEqual(before, after)) patch[k] = after;
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
      setSavedMsg("Saved.");
    } catch (e: unknown) {
      setErr(errMsg(e, "Failed to save."));
    } finally {
      setSaving(false);
      setTimeout(() => setSavedMsg(null), 1500);
    }
  }

  if (loading) return <main className="p-6">Loading…</main>;

  if (err) {
    return (
      <main className="max-w-3xl mx-auto p-6 space-y-3">
        <div className="border rounded p-3 bg-red-50 text-red-800 whitespace-pre-wrap">{err}</div>
        <button className="px-4 py-2 rounded border" onClick={() => router.push("/reels")}>
          Back to reels
        </button>
      </main>
    );
  }

  if (!draft || !original) {
    return (
      <main className="max-w-3xl mx-auto p-6 space-y-3">
        <div className="text-lg font-semibold">Not found.</div>
        <div className="text-sm text-gray-600">
          This reel either doesn’t exist, isn’t a reel, or you don’t have access to it.
        </div>
        <button className="px-4 py-2 rounded border" onClick={() => router.push("/reels")}>
          Back to reels
        </button>
      </main>
    );
  }

  const title = String(draft.name ?? "").trim() || "Reel";

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{title}</h1>
          <div className="text-sm text-gray-500 break-all">ID: {id}</div>
        </div>

        <div className="flex items-center gap-2">
          {isDirty && <span className="text-sm text-amber-600">Unsaved changes</span>}

          <button className="px-4 py-2 rounded border" onClick={() => router.push("/reels")}>
            Back
          </button>

          <button
            className="px-4 py-2 rounded border border-red-300 text-red-700 disabled:opacity-50"
            onClick={deleteReel}
            disabled={saving}
            title="Delete this reel"
          >
            Delete
          </button>

          <button
            className="px-4 py-2 rounded bg-black text-white disabled:opacity-50"
            onClick={save}
            disabled={saving || !isDirty}
            title={!isDirty ? "No changes" : "Save changes"}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {validationErr && <div className="border rounded p-3 bg-red-50 text-red-800">{validationErr}</div>}
      {savedMsg && <div className="border rounded p-3 bg-green-50 text-green-800">{savedMsg}</div>}

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

        {"status" in draft && (
          <label className="grid gap-1">
            <div className="text-sm font-medium">Status</div>
            <select
              className="border rounded px-3 py-2"
              value={String((draft as AnyRecord).status ?? "owned")}
              onChange={(e) => setDraft((d) => ({ ...(d ?? {}), status: e.target.value }))}
            >
              <option value="owned">Owned</option>
              <option value="planned">Wishlist</option>
            </select>
          </label>
        )}
      </section>

      <section className="border rounded p-4 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700">Reel Specs</h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="grid gap-1">
            <div className="text-sm font-medium">Type</div>
            <select
              className="border rounded px-3 py-2"
              value={String((draft as AnyRecord).reel_type ?? "baitcaster")}
              onChange={(e) => setDraft((d) => ({ ...(d ?? {}), reel_type: e.target.value }))}
            >
              {REEL_TYPE_VALUES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1">
            <div className="text-sm font-medium">Hand</div>
            <select
              className="border rounded px-3 py-2"
              value={String((draft as AnyRecord).reel_hand ?? "right")}
              onChange={(e) => setDraft((d) => ({ ...(d ?? {}), reel_hand: e.target.value }))}
            >
              {REEL_HAND_VALUES.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1">
            <div className="text-sm font-medium">Gear ratio</div>
            <input
              className="border rounded px-3 py-2"
              value={String((draft as AnyRecord).reel_gear_ratio ?? "")}
              onChange={(e) => setDraft((d) => ({ ...(d ?? {}), reel_gear_ratio: e.target.value }))}
              placeholder="e.g., 7.4:1"
            />
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="grid gap-1">
            <div className="text-sm font-medium">IPT (in)</div>
            <StepperNumber
              value={numOrNullFromDraft((draft as AnyRecord).reel_ipt_in)}
              onChange={(v) => setDraft((d) => ({ ...(d ?? {}), reel_ipt_in: v }))}
              min={0}
              max={60}
              step={0.5}
              inputMode="decimal"
              placeholder="e.g. 30"
            />
          </div>

          <div className="grid gap-1">
            <div className="text-sm font-medium">Weight (oz)</div>
            <StepperNumber
              value={numOrNullFromDraft((draft as AnyRecord).reel_weight_oz)}
              onChange={(v) => setDraft((d) => ({ ...(d ?? {}), reel_weight_oz: v }))}
              min={0}
              max={40}
              step={0.1}
              inputMode="decimal"
              placeholder="e.g. 7.8"
            />
          </div>

          <div className="grid gap-1">
            <div className="text-sm font-medium">Max drag (lb)</div>
            <StepperNumber
              value={numOrNullFromDraft((draft as AnyRecord).reel_max_drag_lb)}
              onChange={(v) => setDraft((d) => ({ ...(d ?? {}), reel_max_drag_lb: v }))}
              min={0}
              max={60}
              step={0.5}
              inputMode="decimal"
              placeholder="e.g. 12"
            />
          </div>
        </div>

        <label className="grid gap-1">
          <div className="text-sm font-medium">Bearings</div>
          <input
            className="border rounded px-3 py-2"
            value={String((draft as AnyRecord).reel_bearings ?? "")}
            onChange={(e) => setDraft((d) => ({ ...(d ?? {}), reel_bearings: e.target.value }))}
            placeholder="e.g., 6+1"
          />
        </label>

        <label className="grid gap-1">
          <div className="text-sm font-medium">Line capacity</div>
          <input
            className="border rounded px-3 py-2"
            value={String((draft as AnyRecord).reel_line_capacity ?? "")}
            onChange={(e) => setDraft((d) => ({ ...(d ?? {}), reel_line_capacity: e.target.value }))}
            placeholder="e.g., 12/120, 14/110, 30B/150"
          />
        </label>

        <label className="grid gap-1">
          <div className="text-sm font-medium">Brake system</div>
          <input
            className="border rounded px-3 py-2"
            value={String((draft as AnyRecord).reel_brake_system ?? "")}
            onChange={(e) =>
              setDraft((d) => ({ ...(d ?? {}), reel_brake_system: e.target.value }))
            }
            placeholder="e.g., DC, SV, Magnetic, Centrifugal"
          />
        </label>
      </section>

      <section className="border rounded p-4 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700">Notes</h2>

        <label className="grid gap-1">
          <div className="text-sm font-medium">Notes</div>
          <textarea
            className="border rounded px-3 py-2 min-h-[120px]"
            value={String((draft as AnyRecord).notes ?? "")}
            onChange={(e) => setDraft((d) => ({ ...(d ?? {}), notes: e.target.value }))}
            placeholder="Notes…"
          />
        </label>

        <label className="grid gap-1">
          <div className="text-sm font-medium">Storage note</div>
          <textarea
            className="border rounded px-3 py-2 min-h-[90px]"
            value={String((draft as AnyRecord).storage_note ?? "")}
            onChange={(e) => setDraft((d) => ({ ...(d ?? {}), storage_note: e.target.value }))}
            placeholder="Where it lives…"
          />
        </label>
      </section>

      {otherKeys.length > 0 && (
        <section className="border rounded p-4 space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">Other Fields</h2>

          <div className="grid gap-3">
            {otherKeys.map((k) => {
              const v = (draft as AnyRecord)[k];

              if (typeof v === "boolean") {
                return (
                  <label key={k} className="flex items-center justify-between gap-3">
                    <div className="text-sm font-medium">{toTitle(k)}</div>
                    <input
                      type="checkbox"
                      checked={!!v}
                      onChange={(e) => setDraft((d) => ({ ...(d ?? {}), [k]: e.target.checked }))}
                    />
                  </label>
                );
              }

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
                        setDraft((d) => ({ ...(d ?? {}), [k]: Number.isFinite(n) ? n : null }));
                      }}
                    />
                  </label>
                );
              }

              return (
                <label key={k} className="grid gap-1">
                  <div className="text-sm font-medium">{toTitle(k)}</div>
                  <input
                    className="border rounded px-3 py-2"
                    value={v == null ? "" : String(v)}
                    onChange={(e) => setDraft((d) => ({ ...(d ?? {}), [k]: e.target.value }))}
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
