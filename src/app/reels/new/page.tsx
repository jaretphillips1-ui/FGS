"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  REEL_HAND_VALUES,
  REEL_TYPE_VALUES,
  normalizeGearRatio,
  numOrNullFromInput,
} from "@/lib/reelSpecs";

type AnyRecord = Record<string, unknown>;

type CatalogRow = {
  id: string;
  product_type: string;
  brand: string | null;
  model: string | null;
  variant: string | null;

  reel_type: string | null;
  reel_hand: string | null;
  reel_gear_ratio: string | null;
  reel_ipt_in: number | null;
  reel_weight_oz: number | null;
  reel_max_drag_lb: number | null;
  reel_bearings: string | null;
  reel_line_capacity: string | null;
  reel_brake_system: string | null;
};

type FormState = {
  name: string;

  catalog_product_id: string | null;

  reel_type: string;
  reel_hand: string;
  reel_gear_ratio: string;

  reel_ipt_in: number | null;
  reel_weight_oz: number | null;
  reel_max_drag_lb: number | null;

  reel_bearings: string;
  reel_line_capacity: string;
  reel_brake_system: string;

  notes: string;
  storage_note: string;

  status: "owned" | "planned";
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

function labelCatalog(r: CatalogRow) {
  const brand = String(r.brand ?? "").trim();
  const model = String(r.model ?? "").trim();
  const variant = String(r.variant ?? "").trim();
  return [brand, model, variant].filter(Boolean).join(" ").trim() || r.id;
}

export default function NewReelPage() {
  const router = useRouter();

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [catalog, setCatalog] = useState<CatalogRow[]>([]);
  const [catalogErr, setCatalogErr] = useState<string | null>(null);

  const [form, setForm] = useState<FormState>({
    name: "",

    catalog_product_id: null,

    reel_type: "baitcaster",
    reel_hand: "right",
    reel_gear_ratio: "",

    reel_ipt_in: null,
    reel_weight_oz: null,
    reel_max_drag_lb: null,

    reel_bearings: "",
    reel_line_capacity: "",
    reel_brake_system: "",

    notes: "",
    storage_note: "",

    status: "owned",
  });

  useEffect(() => {
    let cancelled = false;

    async function loadCatalog() {
      setCatalogErr(null);

      try {
        const sessionRes = await supabase.auth.getSession();
        const user = sessionRes.data.session?.user;
        if (!user) return;

        const res = await supabase
          .from("catalog_products")
          .select(
            "id,product_type,brand,model,variant,reel_type,reel_hand,reel_gear_ratio,reel_ipt_in,reel_weight_oz,reel_max_drag_lb,reel_bearings,reel_line_capacity,reel_brake_system,owner_id"
          )
          .eq("product_type", "reel")
          .or(`owner_id.is.null,owner_id.eq.${user.id}`)
          .order("brand", { ascending: true })
          .order("model", { ascending: true })
          .limit(500);

        if (res.error) throw res.error;

        if (!cancelled) setCatalog((res.data ?? []) as CatalogRow[]);
      } catch (e: unknown) {
        if (!cancelled) setCatalogErr(errMsg(e));
      }
    }

    loadCatalog();
    return () => {
      cancelled = true;
    };
  }, []);

  const catalogLabelById = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of catalog) m.set(r.id, labelCatalog(r));
    return m;
  }, [catalog]);

  function applyCatalog(id: string) {
    const row = catalog.find((r) => r.id === id);
    if (!row) return;

    setForm((s) => ({
      ...s,
      catalog_product_id: row.id,

      // If user hasn't typed a name, suggest a name from catalog
      name: s.name.trim() ? s.name : labelCatalog(row),

      reel_type: String(row.reel_type ?? s.reel_type),
      reel_hand: String(row.reel_hand ?? s.reel_hand),
      reel_gear_ratio: String(row.reel_gear_ratio ?? s.reel_gear_ratio),

      reel_ipt_in: row.reel_ipt_in ?? s.reel_ipt_in,
      reel_weight_oz: row.reel_weight_oz ?? s.reel_weight_oz,
      reel_max_drag_lb: row.reel_max_drag_lb ?? s.reel_max_drag_lb,

      reel_bearings: String(row.reel_bearings ?? s.reel_bearings),
      reel_line_capacity: String(row.reel_line_capacity ?? s.reel_line_capacity),
      reel_brake_system: String(row.reel_brake_system ?? s.reel_brake_system),
    }));
  }

  function validate(): string | null {
    const name = form.name.trim();
    if (!name) return "Name is required.";
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

      const payload: AnyRecord = {
        owner_id: user.id,
        gear_type: "reel",

        name: form.name.trim(),

        status: form.status, // keep enum mapping consistent with your DB choices
        catalog_product_id: form.catalog_product_id,

        reel_type: form.reel_type || null,
        reel_hand: form.reel_hand || null,
        reel_gear_ratio: normalizeGearRatio(form.reel_gear_ratio) || null,

        reel_ipt_in: form.reel_ipt_in,
        reel_weight_oz: form.reel_weight_oz,
        reel_max_drag_lb: form.reel_max_drag_lb,

        reel_bearings: form.reel_bearings.trim() || null,
        reel_line_capacity: form.reel_line_capacity.trim() || null,
        reel_brake_system: form.reel_brake_system.trim() || null,

        notes: form.notes.trim() || null,
        storage_note: form.storage_note.trim() || null,
      };

      const res = await supabase.from("gear_items").insert(payload).select("id").maybeSingle();
      if (res.error) throw res.error;
      if (!res.data?.id) throw new Error("Insert succeeded but no id returned.");

      router.push(`/reels/${res.data.id}`);
    } catch (e: unknown) {
      setErr(errMsg(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Link className="text-sm underline" href="/reels">
          ← Back to reels
        </Link>

        <div className="flex gap-2">
          <button
            className="px-3 py-1 rounded border disabled:opacity-50"
            onClick={() => router.push("/reels")}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            className="px-3 py-1 rounded bg-black text-white disabled:opacity-50"
            onClick={onSave}
            disabled={saving}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      <h1 className="text-xl font-semibold">New Reel</h1>

      {err && (
        <div className="border rounded p-3 bg-red-50 text-red-800">
          <div className="font-medium">Error</div>
          <div>{err}</div>
        </div>
      )}

      <section className="border rounded p-4 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700">Catalog (optional)</h2>

        {catalogErr && <div className="text-sm text-red-700">Catalog load failed: {catalogErr}</div>}

        <label className="grid gap-1">
          <div className="text-sm font-medium">Pick from catalog</div>
          <select
            className="border rounded px-3 py-2"
            value={form.catalog_product_id ?? ""}
            onChange={(e) => {
              const id = String(e.target.value ?? "");
              setForm((s) => ({ ...s, catalog_product_id: id || null }));
              if (id) applyCatalog(id);
            }}
          >
            <option value="">—</option>
            {catalog.map((r) => (
              <option key={r.id} value={r.id}>
                {catalogLabelById.get(r.id)}
              </option>
            ))}
          </select>
          <div className="text-xs text-gray-500">
            Catalog is meant to be manufacturer-first specs. Selecting a catalog item prefills the form.
          </div>
        </label>
      </section>

      <section className="border rounded p-4 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700">Basics</h2>

        <label className="grid gap-1">
          <div className="text-sm font-medium">Name</div>
          <input
            className="border rounded px-3 py-2"
            value={form.name}
            onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
            placeholder="e.g., Shimano Curado DC 150HG"
          />
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="grid gap-1">
            <div className="text-sm font-medium">Status</div>
            <select
              className="border rounded px-3 py-2"
              value={form.status}
              onChange={(e) => {
                const v = String(e.target.value ?? "owned");
                setForm((s) => ({ ...s, status: v === "planned" ? "planned" : "owned" }));
              }}
            >
              <option value="owned">Owned</option>
              <option value="planned">Planned</option>
            </select>
          </label>

          <label className="grid gap-1">
            <div className="text-sm font-medium">Type</div>
            <select
              className="border rounded px-3 py-2"
              value={form.reel_type}
              onChange={(e) => setForm((s) => ({ ...s, reel_type: String(e.target.value ?? "baitcaster") }))}
            >
              {REEL_TYPE_VALUES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="grid gap-1">
            <div className="text-sm font-medium">Hand</div>
            <select
              className="border rounded px-3 py-2"
              value={form.reel_hand}
              onChange={(e) => setForm((s) => ({ ...s, reel_hand: String(e.target.value ?? "right") }))}
            >
              {REEL_HAND_VALUES.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1 sm:col-span-2">
            <div className="text-sm font-medium">Gear ratio</div>
            <input
              className="border rounded px-3 py-2"
              value={form.reel_gear_ratio}
              onChange={(e) => setForm((s) => ({ ...s, reel_gear_ratio: e.target.value }))}
              placeholder='e.g., 7.4:1'
            />
          </label>
        </div>
      </section>

      <section className="border rounded p-4 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700">Reel Specs</h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="grid gap-1">
            <div className="text-sm font-medium">IPT (in)</div>
            <input
              className="border rounded px-3 py-2"
              value={form.reel_ipt_in == null ? "" : String(form.reel_ipt_in)}
              inputMode="decimal"
              onChange={(e) => setForm((s) => ({ ...s, reel_ipt_in: numOrNullFromInput(e.target.value) }))}
              placeholder="e.g., 30"
            />
          </label>

          <label className="grid gap-1">
            <div className="text-sm font-medium">Weight (oz)</div>
            <input
              className="border rounded px-3 py-2"
              value={form.reel_weight_oz == null ? "" : String(form.reel_weight_oz)}
              inputMode="decimal"
              onChange={(e) => setForm((s) => ({ ...s, reel_weight_oz: numOrNullFromInput(e.target.value) }))}
              placeholder="e.g., 7.8"
            />
          </label>

          <label className="grid gap-1">
            <div className="text-sm font-medium">Max drag (lb)</div>
            <input
              className="border rounded px-3 py-2"
              value={form.reel_max_drag_lb == null ? "" : String(form.reel_max_drag_lb)}
              inputMode="decimal"
              onChange={(e) => setForm((s) => ({ ...s, reel_max_drag_lb: numOrNullFromInput(e.target.value) }))}
              placeholder="e.g., 12"
            />
          </label>
        </div>

        <label className="grid gap-1">
          <div className="text-sm font-medium">Bearings</div>
          <input
            className="border rounded px-3 py-2"
            value={form.reel_bearings}
            onChange={(e) => setForm((s) => ({ ...s, reel_bearings: e.target.value }))}
            placeholder='e.g., 6+1'
          />
        </label>

        <label className="grid gap-1">
          <div className="text-sm font-medium">Line capacity</div>
          <input
            className="border rounded px-3 py-2"
            value={form.reel_line_capacity}
            onChange={(e) => setForm((s) => ({ ...s, reel_line_capacity: e.target.value }))}
            placeholder='e.g., 12/120, 14/110, 30B/150'
          />
          <div className="text-xs text-gray-500">
            Flexible string for now. We can normalize to a structured format once you’re happy with the UI.
          </div>
        </label>

        <label className="grid gap-1">
          <div className="text-sm font-medium">Brake system</div>
          <input
            className="border rounded px-3 py-2"
            value={form.reel_brake_system}
            onChange={(e) => setForm((s) => ({ ...s, reel_brake_system: e.target.value }))}
            placeholder="e.g., DC, SV, Magnetic, Centrifugal"
          />
        </label>
      </section>

      <section className="border rounded p-4 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700">Notes</h2>

        <label className="grid gap-1">
          <div className="text-sm font-medium">Notes</div>
          <textarea
            className="border rounded px-3 py-2 min-h-[110px]"
            value={form.notes}
            onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))}
            placeholder="Anything important…"
          />
        </label>

        <label className="grid gap-1">
          <div className="text-sm font-medium">Storage note</div>
          <input
            className="border rounded px-3 py-2"
            value={form.storage_note}
            onChange={(e) => setForm((s) => ({ ...s, storage_note: e.target.value }))}
            placeholder="Where it lives…"
          />
        </label>
      </section>
    </main>
  );
}