"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

import { ROD_TECHNIQUES } from "@/lib/rodTechniques";

const TECHNIQUES = ROD_TECHNIQUES as readonly string[];
const POWER_OPTIONS = ["—", "UL", "L", "ML", "M", "MH", "H", "XH"] as const;
const ACTION_OPTIONS = ["—", "Slow", "Mod", "Mod-Fast", "Fast", "X-Fast"] as const;

// Canonical statuses
const STATUS_OPTIONS = ["owned", "wishlist"] as const;
type StatusOption = (typeof STATUS_OPTIONS)[number];

// Water type (dropdown)
const WATER_OPTIONS = ["fresh", "salt", "ice"] as const;
type WaterOption = (typeof WATER_OPTIONS)[number];

type FormState = {
  name: string; // optional now (auto-built if blank)
  brand: string;
  model: string;

  status: StatusOption;
  water_type: WaterOption;

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

type SuggestionRow = {
  brand: string | null;
  model: string | null;
  rod_blank_text: string | null;
  rod_guides_text: string | null;
  rod_handle_text: string | null;
};

function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message || "Unknown error.";
  if (typeof e === "string") return e || "Unknown error.";
  try {
    return JSON.stringify(e);
  } catch {
    return "Unknown error.";
  }
}

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

  const feet = Number.isFinite(f as number) ? (f as number) : 0;
  const inches = Number.isFinite(i as number) ? (i as number) : 0;

  if (feet < 0 || inches < 0) return null;

  const carry = Math.floor(inches / 12);
  const normFeet = feet + carry;
  const normInches = clampInchesToHalfSteps(inches - carry * 12);

  return normFeet * 12 + normInches;
}

function statusLabel(s: StatusOption): string {
  return s === "owned" ? "Owned" : "Wish list";
}

function waterLabel(w: WaterOption): string {
  if (w === "fresh") return "Fresh water";
  if (w === "salt") return "Salt water";
  return "Ice";
}

function formatLengthFromTotalInches(total: number | null): string {
  if (total == null) return "";
  const f = Math.floor(total / 12);
  const i = Math.round((total - f * 12) * 2) / 2;
  return `${f}' ${i}"`;
}

function buildRodName(form: FormState): string {
  const brand = form.brand.trim();
  const model = form.model.trim();
  const length = formatLengthFromTotalInches(form.rod_length_in);
  const power = (form.rod_power ?? "").trim();
  const action = (form.rod_action ?? "").trim();

  const parts: string[] = [];

  const brandModel = [brand, model].filter(Boolean).join(" ");
  if (brandModel) parts.push(brandModel);

  if (length) parts.push(length);

  if (power && power !== "—") parts.push(power);
  if (action && action !== "—") parts.push(action);

  return parts.join(" ").replace(/\s+/g, " ").trim();
}

function uniqSorted(values: Array<string | null | undefined>): string[] {
  const set = new Set<string>();
  for (const v of values) {
    const s = String(v ?? "").trim();
    if (!s) continue;
    set.add(s);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

export default function NewRodPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [lenFeet, setLenFeet] = useState("");
  const [lenInches, setLenInches] = useState("");

  const [brandOptions, setBrandOptions] = useState<string[]>([]);
  const [modelOptions, setModelOptions] = useState<string[]>([]);
  const [blankOptions, setBlankOptions] = useState<string[]>([]);
  const [guidesOptions, setGuidesOptions] = useState<string[]>([]);
  const [handleOptions, setHandleOptions] = useState<string[]>([]);

  const [form, setForm] = useState<FormState>({
    name: "",
    brand: "",
    model: "",

    status: "owned",
    water_type: "fresh",

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

  // Pull suggestion values from your existing rods (simple + safe for now)
  useEffect(() => {
    let cancelled = false;

    async function loadSuggestions() {
      try {
        const sessionRes = await supabase.auth.getSession();
        const user = sessionRes.data.session?.user;
        if (!user) return;

        const { data, error } = await supabase
          .from("gear_items")
          .select("brand,model,rod_blank_text,rod_guides_text,rod_handle_text")
          .eq("gear_type", "rod")
          .eq("owner_id", user.id)
          .order("created_at", { ascending: false })
          .limit(500);

        if (error) return;

        const rows = (data ?? []) as SuggestionRow[];

        if (cancelled) return;

        setBrandOptions(uniqSorted(rows.map((r) => r.brand)));
        setModelOptions(uniqSorted(rows.map((r) => r.model)));
        setBlankOptions(uniqSorted(rows.map((r) => r.rod_blank_text)));
        setGuidesOptions(uniqSorted(rows.map((r) => r.rod_guides_text)));
        setHandleOptions(uniqSorted(rows.map((r) => r.rod_handle_text)));
      } catch {
        // Suggestions are optional; ignore failures silently.
      }
    }

    loadSuggestions();
    return () => {
      cancelled = true;
    };
  }, []);

  const builtNamePreview = useMemo(() => buildRodName(form), [form]);

  const isDirty = useMemo(() => {
    return (
      form.name.trim() !== "" ||
      form.brand.trim() !== "" ||
      form.model.trim() !== "" ||
      form.status !== "owned" ||
      form.water_type !== "fresh" ||
      form.notes.trim() !== "" ||
      form.storage_note.trim() !== "" ||
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

    if (total == null) {
      setLenFeet(nextFeet);
      setLenInches(nextInches);
      setForm((s) => ({ ...s, rod_length_in: null }));
      return;
    }

    const f = Math.floor(total / 12);
    const i = Math.round((total - f * 12) * 2) / 2;

    setLenFeet(String(f));
    setLenInches(String(i));
    setForm((s) => ({ ...s, rod_length_in: total }));
  }

  function toggleTechnique(name: string) {
    setForm((s) => {
      const cur = Array.isArray(s.techniques) ? s.techniques : [];
      const next = cur.includes(name) ? cur.filter((x) => x !== name) : [...cur, name];
      return { ...s, techniques: next };
    });
  }

  function validate(): string | null {
    const typedName = form.name.trim();
    const built = buildRodName(form);

    if (!typedName && !built) {
      return "Enter Brand/Model/Length/Power/Action (or type a Name) so the rod name can be built.";
    }

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

      const finalName = form.name.trim() || buildRodName(form);

      const payload: Record<string, unknown> = {
        owner_id: user.id,
        gear_type: "rod",

        name: finalName,
        brand: form.brand.trim() || null,
        model: form.model.trim() || null,

        status: form.status,

        water_type: form.water_type,
        saltwater_ok: form.water_type === "salt",

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
      setErr(errMsg(e));
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
          <button
            className="px-3 py-1 rounded border disabled:opacity-50"
            onClick={onCancel}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            className="px-3 py-1 rounded border disabled:opacity-50"
            onClick={onSave}
            disabled={saving}
          >
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

      {/* Basics */}
      <section className="rounded border p-4 space-y-4">
        <div className="grid gap-3">
          <label className="grid gap-1">
            <span className="text-sm text-gray-600">Name (optional — auto-built if blank)</span>
            <input
              className="border rounded px-3 py-2"
              value={form.name}
              onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
              placeholder="Leave blank to auto-build from specs"
            />
            {form.name.trim() === "" && builtNamePreview ? (
              <div className="text-xs text-gray-500">Built name preview: {builtNamePreview}</div>
            ) : null}
          </label>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="grid gap-1">
              <span className="text-sm text-gray-600">Brand</span>
              <input
                className="border rounded px-3 py-2"
                value={form.brand}
                onChange={(e) => setForm((s) => ({ ...s, brand: e.target.value }))}
                placeholder="e.g., Shimano"
                list="brand-suggestions"
              />
              <datalist id="brand-suggestions">
                {brandOptions.map((v) => (
                  <option key={v} value={v} />
                ))}
              </datalist>
            </label>

            <label className="grid gap-1">
              <span className="text-sm text-gray-600">Model</span>
              <input
                className="border rounded px-3 py-2"
                value={form.model}
                onChange={(e) => setForm((s) => ({ ...s, model: e.target.value }))}
                placeholder="e.g., Expride B"
                list="model-suggestions"
              />
              <datalist id="model-suggestions">
                {modelOptions.map((v) => (
                  <option key={v} value={v} />
                ))}
              </datalist>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="grid gap-1">
              <span className="text-sm text-gray-600">Status</span>
              <select
                className="border rounded px-3 py-2"
                value={form.status}
                onChange={(e) => setForm((s) => ({ ...s, status: e.target.value as StatusOption }))}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {statusLabel(s)}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-1">
              <span className="text-sm text-gray-600">Water type</span>
              <select
                className="border rounded px-3 py-2"
                value={form.water_type}
                onChange={(e) =>
                  setForm((s) => ({ ...s, water_type: e.target.value as WaterOption }))
                }
              >
                {WATER_OPTIONS.map((w) => (
                  <option key={w} value={w}>
                    {waterLabel(w)}
                  </option>
                ))}
              </select>
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

      {/* Techniques */}
      <section className="rounded border p-4 space-y-3">
        <div className="text-sm font-medium">Rod Techniques</div>

        <div className="flex flex-wrap gap-2">
          {TECHNIQUES.map((t) => {
            const active = form.techniques.includes(t);
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
            );
          })}
        </div>

        <div className="text-xs text-gray-500">
          Selected: {form.techniques.length ? form.techniques.join(", ") : "none"}
        </div>
      </section>

      {/* Rod Specs */}
      <section className="rounded border p-4 space-y-4">
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
                  onChange={(e) =>
                    setForm((s) => ({ ...s, rod_line_min_lb: numOrNull(e.target.value) }))
                  }
                />
                <input
                  type="number"
                  min="0"
                  step="1"
                  className="border rounded px-3 py-2"
                  placeholder="Max"
                  value={form.rod_line_max_lb ?? ""}
                  onChange={(e) =>
                    setForm((s) => ({ ...s, rod_line_max_lb: numOrNull(e.target.value) }))
                  }
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
                  onChange={(e) =>
                    setForm((s) => ({ ...s, rod_lure_min_oz: numOrNull(e.target.value) }))
                  }
                />
                <input
                  type="number"
                  min="0"
                  step="0.0625"
                  className="border rounded px-3 py-2"
                  placeholder="Max"
                  value={form.rod_lure_max_oz ?? ""}
                  onChange={(e) =>
                    setForm((s) => ({ ...s, rod_lure_max_oz: numOrNull(e.target.value) }))
                  }
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
                list="handle-suggestions"
              />
              <datalist id="handle-suggestions">
                {handleOptions.map((v) => (
                  <option key={v} value={v} />
                ))}
              </datalist>
            </label>

            <label className="grid gap-1">
              <span className="text-sm text-gray-600">Blank</span>
              <input
                className="border rounded px-3 py-2"
                value={form.rod_blank_text}
                onChange={(e) => setForm((s) => ({ ...s, rod_blank_text: e.target.value }))}
                placeholder="e.g., SVC Graphite"
                list="blank-suggestions"
              />
              <datalist id="blank-suggestions">
                {blankOptions.map((v) => (
                  <option key={v} value={v} />
                ))}
              </datalist>
            </label>

            <label className="grid gap-1">
              <span className="text-sm text-gray-600">Guides</span>
              <input
                className="border rounded px-3 py-2"
                value={form.rod_guides_text}
                onChange={(e) => setForm((s) => ({ ...s, rod_guides_text: e.target.value }))}
                placeholder="e.g., Fuji K"
                list="guides-suggestions"
              />
              <datalist id="guides-suggestions">
                {guidesOptions.map((v) => (
                  <option key={v} value={v} />
                ))}
              </datalist>
            </label>
          </div>
        </div>
      </section>
    </main>
  );
}
