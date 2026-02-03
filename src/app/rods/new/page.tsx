"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

import { ROD_TECHNIQUES } from '@/lib/rodTechniques';
const TECHNIQUES = ROD_TECHNIQUES as readonly string[];
const POWER_OPTIONS = ["—", "UL", "L", "ML", "M", "MH", "H", "XH"] as const;
const ACTION_OPTIONS = ["—", "Slow", "Mod", "Mod-Fast", "Fast", "X-Fast"] as const;
const STATUS_OPTIONS = ["owned", "planned", "sold", "retired"] as const;

type FormState = {
  name: string;
  status: string;
  saltwater_ok: boolean;

  notes: string;
  storage_note: string;

  // store in DB as inches (numeric)
  rod_length_in: number | null;

  rod_pieces: number | null;
  rod_power: string;
  rod_action: string;

  rod_line_min_lb: number | null;
  rod_line_max_lb: number | null;

  rod_lure_min_oz: number | null;
  rod_lure_max_oz: number | null;

  rod_handle_text: string;
  rod_blank_text: string;
  rod_guides_text: string;

  techniques: string[];
};

function numOrNull(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function clampInchesToHalfSteps(i: number) {
  // 0.5" steps, clamp 0..11.5
  const rounded = Math.round(i * 2) / 2;
  return Math.min(11.5, Math.max(0, rounded));
}

function makeTotalInches(feetRaw: string, inchesRaw: string): number | null {
  const f = feetRaw.trim() === "" ? null : Number(feetRaw);
  const i = inchesRaw.trim() === "" ? null : Number(inchesRaw);

  if (f == null && i == null) return null;

  const feet = Number.isFinite(f as unknown) ? (f as number) : 0;
  const inches = Number.isFinite(i as unknown) ? (i as number) : 0;

  if (feet < 0 || inches < 0) return null;

  const carry = Math.floor(inches / 12);
  const normFeet = feet + carry;
  const normInches = clampInchesToHalfSteps(inches - carry * 12);

  return normFeet * 12 + normInches;
}

export default function NewRodPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [lenFeet, setLenFeet] = useState("");
  const [lenInches, setLenInches] = useState("");

  const [form, setForm] = useState<FormState>({
    name: "",
    status: "owned",
    saltwater_ok: false,

    notes: "",
    storage_note: "",

    rod_length_in: null,

    rod_pieces: null,
    rod_power: "—",
    rod_action: "—",

    rod_line_min_lb: null,
    rod_line_max_lb: null,

    rod_lure_min_oz: null,
    rod_lure_max_oz: null,

    rod_handle_text: "",
    rod_blank_text: "",
    rod_guides_text: "",

    techniques: [],
  });

  const isDirty = useMemo(() => {
    return (
      form.name.trim() !== "" ||
      form.notes.trim() !== "" ||
      form.storage_note.trim() !== "" ||
      form.saltwater_ok ||
      form.status !== "owned" ||
      form.rod_length_in != null ||
      form.rod_pieces != null ||
      (form.rod_power && form.rod_power !== "—") ||
      (form.rod_action && form.rod_action !== "—") ||
      form.rod_line_min_lb != null ||
      form.rod_line_max_lb != null ||
      form.rod_lure_min_oz != null ||
      form.rod_lure_max_oz != null ||
      form.rod_handle_text.trim() !== "" ||
      form.rod_blank_text.trim() !== "" ||
      form.rod_guides_text.trim() !== "" ||
      form.techniques.length > 0
    );
  }, [form]);

  function setLength(nextFeet: string, nextInches: string) {
    const total = makeTotalInches(nextFeet, nextInches);

    // If user clears both boxes, keep them cleared and null out length
    if (total == null) {
      setLenFeet(nextFeet);
      setLenInches(nextInches);
      setForm((s) => ({ ...s, rod_length_in: null }));
      return;
    }

    // Normalize display so inches never stays > 11.5
    const f = Math.floor(total / 12);
    const i = Math.round((total - f * 12) * 2) / 2; // half-inch steps

    setLenFeet(String(f));
    setLenInches(String(i));
    setForm((s) => ({ ...s, rod_length_in: total }));
  }


  function toggleTechnique(name: string) {
    setForm((s) => {
      const cur = Array.isArray(s.techniques) ? s.techniques : []
      const next = cur.includes(name) ? cur.filter((x) => x !== name) : [...cur, name]
      return { ...s, techniques: next }
    })
  }
  function validate(): string | null {
    if (!form.name.trim()) return "Name is required.";
    if (
      form.rod_line_min_lb != null &&
      form.rod_line_max_lb != null &&
      form.rod_line_min_lb > form.rod_line_max_lb
    )
      return "Line rating: Min cannot be greater than Max.";

    if (
      form.rod_lure_min_oz != null &&
      form.rod_lure_max_oz != null &&
      form.rod_lure_min_oz > form.rod_lure_max_oz
    )
      return "Lure rating: Min cannot be greater than Max.";

    if (form.rod_pieces != null && form.rod_pieces < 1) return "Pieces must be 1 or more.";
    if (form.rod_length_in != null && form.rod_length_in < 0) return "Length must be positive.";

    return null;
  }

  async function onSave() {
    setErr(null);

    const v = validate();
    if (v) return setErr(v);

    setSaving(true);
    try {
      const sessionRes = await supabase.auth.getSession();
      const user = sessionRes.data.session?.user;
      if (!user) throw new Error("Not signed in.");

      const payload: Record<string, unknown> = {
        owner_id: user.id,
        gear_type: "rod",
        name: form.name.trim(),
        status: form.status,
        saltwater_ok: form.saltwater_ok,

        notes: form.notes.trim() || null,
        storage_note: form.storage_note.trim() || null,
        rod_techniques: form.techniques,
        rod_length_in: form.rod_length_in,

        rod_pieces: form.rod_pieces,
        rod_power: form.rod_power === "—" ? null : form.rod_power,
        rod_action: form.rod_action === "—" ? null : form.rod_action,

        rod_line_min_lb: form.rod_line_min_lb,
        rod_line_max_lb: form.rod_line_max_lb,

        rod_lure_min_oz: form.rod_lure_min_oz,
        rod_lure_max_oz: form.rod_lure_max_oz,

        rod_handle_text: form.rod_handle_text.trim() || null,
        rod_blank_text: form.rod_blank_text.trim() || null,
        rod_guides_text: form.rod_guides_text.trim() || null,
      };

      const { data, error } = await supabase
        .from("gear_items")
        .insert(payload)
        .select("id")
        .maybeSingle();

      if (error) throw error;
      if (!data?.id) throw new Error("Insert succeeded but no id returned.");

      router.push(`/rods/${data.id}`);
    } catch (e: unknown) {
      setErr(e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  }

  function onCancel() {
    router.push("/rods");
  }

  const lenPreview = useMemo(() => {
    const total = form.rod_length_in;
    if (total == null) return "";
    const f = Math.floor(total / 12);
    const i = Math.round((total - f * 12) * 2) / 2;
    return `(${f}' ${i}")`;
  }, [form.rod_length_in]);

  return (
    <main className="p-6 space-y-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <Link className="text-sm underline" href="/rods">
          ← Back to rods
        </Link>

        <div className="flex gap-2">
          <button className="px-3 py-1 rounded border disabled:opacity-50" onClick={onCancel} disabled={saving}>
            Cancel
          </button>
          <button className="px-3 py-1 rounded border disabled:opacity-50" onClick={onSave} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      <div className="flex items-baseline justify-between">
        <h1 className="text-xl font-semibold">New Rod</h1>
        <div className="text-xs text-gray-500">{isDirty ? "Unsaved changes" : "Ready"}</div>
      </div>

      {err && (
        <div className="rounded border p-3 text-sm">
          <div className="font-medium">Error</div>
          <div className="text-gray-600">{err}</div>
        </div>
      )}

      <section className="rounded border p-4 space-y-4">
        <div className="grid gap-3">
          <label className="grid gap-1">
            <span className="text-sm text-gray-600">Name</span>
            <input
              className="border rounded px-3 py-2"
              value={form.name}
              onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
              placeholder='e.g., 7&apos;2&quot; Heavy Fast'
            />
          </label>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="grid gap-1">
              <span className="text-sm text-gray-600">Status</span>
              <select
                className="border rounded px-3 py-2"
                value={form.status}
                onChange={(e) => setForm((s) => ({ ...s, status: e.target.value }))}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex items-center gap-2 mt-6 md:mt-7">
              <input
                type="checkbox"
                checked={form.saltwater_ok}
                onChange={(e) => setForm((s) => ({ ...s, saltwater_ok: e.target.checked }))}
              />
              <span className="text-sm text-gray-700">Saltwater OK</span>
            </label>
          </div>

          <label className="grid gap-1">
            <span className="text-sm text-gray-600">Notes</span>
            <textarea
              className="border rounded px-3 py-2 min-h-[120px]"
              value={form.notes}
              onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))}
              placeholder="Anything important about this rod…"
            />
          </label>

          <label className="grid gap-1">
            <span className="text-sm text-gray-600">Storage note</span>
            <input
              className="border rounded px-3 py-2"
              value={form.storage_note}
              onChange={(e) => setForm((s) => ({ ...s, storage_note: e.target.value }))}
              placeholder="Where it lives (rack, locker, tube, etc.)"
            />
          </label>
        </div>
      </section>

      <section className="rounded border p-4 space-y-4">
      <section className="rounded border p-4 space-y-3">
        <div className="text-sm font-medium">Rod Techniques</div>

        <div className="flex flex-wrap gap-2">
          {TECHNIQUES.map((t) => {
            const active = form.techniques.includes(t)
            return (
              <button
                key={t}
                type="button"
                onClick={() => toggleTechnique(t)}
                className={
                  "px-3 py-1 rounded border text-sm " +
                  (active ? "bg-black text-white border-black" : "bg-white text-black")
                }
                aria-pressed={active}
              >
                {t}
              </button>
            )
          })}
        </div>

        <div className="text-xs text-gray-500">
          Selected: {form.techniques.length ? form.techniques.join(", ") : "none"}
        </div>
      </section>
        <div className="text-sm font-medium">Rod Specs</div>

        <div className="grid gap-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="grid gap-1">
              <span className="text-sm text-gray-600">Length</span>
              <div className="flex gap-2">
                <div className="grid gap-1 w-28">
                  <span className="text-xs text-gray-500">Feet</span>
                  <input
                    type="number"
                    min="0"
                    className="border rounded px-3 py-2"
                    value={lenFeet}
                    onChange={(e) => setLength(e.target.value, lenInches)}
                  />
                </div>

                <div className="grid gap-1 w-28">
                  <span className="text-xs text-gray-500">Inches</span>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    className="border rounded px-3 py-2"
                    value={lenInches}
                    onChange={(e) => setLength(lenFeet, e.target.value)}
                  />
                </div>

                <div className="flex items-end pb-2 text-sm text-gray-600">{lenPreview}</div>
              </div>
            </div>

            <label className="grid gap-1">
              <span className="text-sm text-gray-600">Pieces</span>
              <input
                type="number"
                min="1"
                step="1"
                className="border rounded px-3 py-2"
                value={form.rod_pieces ?? ""}
                onChange={(e) => setForm((s) => ({ ...s, rod_pieces: numOrNull(e.target.value) }))}
              />
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="grid gap-1">
              <span className="text-sm text-gray-600">Power</span>
              <select
                className="border rounded px-3 py-2"
                value={form.rod_power}
                onChange={(e) => setForm((s) => ({ ...s, rod_power: e.target.value }))}
              >
                {POWER_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-1">
              <span className="text-sm text-gray-600">Action</span>
              <select
                className="border rounded px-3 py-2"
                value={form.rod_action}
                onChange={(e) => setForm((s) => ({ ...s, rod_action: e.target.value }))}
              >
                {ACTION_OPTIONS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="grid gap-1">
              <span className="text-sm text-gray-600">Line Rating (lb)</span>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  min="0"
                  step="1"
                  className="border rounded px-3 py-2"
                  placeholder="Min"
                  value={form.rod_line_min_lb ?? ""}
                  onChange={(e) => setForm((s) => ({ ...s, rod_line_min_lb: numOrNull(e.target.value) }))}
                />
                <input
                  type="number"
                  min="0"
                  step="1"
                  className="border rounded px-3 py-2"
                  placeholder="Max"
                  value={form.rod_line_max_lb ?? ""}
                  onChange={(e) => setForm((s) => ({ ...s, rod_line_max_lb: numOrNull(e.target.value) }))}
                />
              </div>
            </div>

            <div className="grid gap-1">
              <span className="text-sm text-gray-600">Lure Rating (oz)</span>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  min="0"
                  step="0.0625"
                  className="border rounded px-3 py-2"
                  placeholder="Min"
                  value={form.rod_lure_min_oz ?? ""}
                  onChange={(e) => setForm((s) => ({ ...s, rod_lure_min_oz: numOrNull(e.target.value) }))}
                />
                <input
                  type="number"
                  min="0"
                  step="0.0625"
                  className="border rounded px-3 py-2"
                  placeholder="Max"
                  value={form.rod_lure_max_oz ?? ""}
                  onChange={(e) => setForm((s) => ({ ...s, rod_lure_max_oz: numOrNull(e.target.value) }))}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="grid gap-1">
              <span className="text-sm text-gray-600">Handle</span>
              <input
                className="border rounded px-3 py-2"
                value={form.rod_handle_text}
                onChange={(e) => setForm((s) => ({ ...s, rod_handle_text: e.target.value }))}
                placeholder="e.g., split grip cork"
              />
            </label>

            <label className="grid gap-1">
              <span className="text-sm text-gray-600">Blank</span>
              <input
                className="border rounded px-3 py-2"
                value={form.rod_blank_text}
                onChange={(e) => setForm((s) => ({ ...s, rod_blank_text: e.target.value }))}
                placeholder="e.g., SCV graphite"
              />
            </label>

            <label className="grid gap-1">
              <span className="text-sm text-gray-600">Guides</span>
              <input
                className="border rounded px-3 py-2"
                value={form.rod_guides_text}
                onChange={(e) => setForm((s) => ({ ...s, rod_guides_text: e.target.value }))}
                placeholder="e.g., Fuji K"
              />
            </label>
          </div>
        </div>
      </section>
</main>
  );
}





