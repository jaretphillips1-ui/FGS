"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { normalizeGearRatio } from "@/lib/reelSpecs";

type AnyRecord = Record<string, unknown>;

type BulkReel = {
  name: string;
  status: "owned" | "wishlist";
  brand: string;
  model: string;

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
};

function clean(s: unknown) {
  return String(s ?? "").trim().replace(/\s+/g, " ");
}

function numOrNull(s: string): number | null {
  const t = clean(s);
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function normalizeStatus(s: string): "owned" | "wishlist" {
  const v = clean(s).toLowerCase();
  if (v === "owned") return "owned";
  if (v === "wishlist" || v === "wish list" || v === "wish" || v === "planned") return "wishlist";
  return "owned";
}

function buildName(brand: string, model: string) {
  const b = clean(brand);
  const m = clean(model);
  return [b, m].filter(Boolean).join(" ").trim();
}

// Brand | Model | Status | Type | Hand | Ratio | IPT | WeightOz | DragLb | Bearings | LineCap | Brake | Notes | Storage
function parseLines(raw: string): { rows: BulkReel[]; errors: string[] } {
  const lines = raw
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter((x) => x && !x.startsWith("#"));

  const errors: string[] = [];
  const rows: BulkReel[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const parts =
      line.includes("|")
        ? line.split("|").map((p) => p.trim())
        : line.includes("\t")
        ? line.split("\t").map((p) => p.trim())
        : line.split(",").map((p) => p.trim());

    if (parts.length < 2) {
      errors.push(`Line ${i + 1}: needs at least Brand + Model`);
      continue;
    }

    const brand = clean(parts[0]);
    const model = clean(parts[1]);
    const status = normalizeStatus(parts[2] ?? "owned");

    const reel_type = clean(parts[3] ?? "baitcaster") || "baitcaster";
    const reel_hand = clean(parts[4] ?? "right") || "right";
    const reel_gear_ratio = normalizeGearRatio(clean(parts[5] ?? "")) || "";

    const reel_ipt_in = numOrNull(parts[6] ?? "");
    const reel_weight_oz = numOrNull(parts[7] ?? "");
    const reel_max_drag_lb = numOrNull(parts[8] ?? "");

    const reel_bearings = clean(parts[9] ?? "");
    const reel_line_capacity = clean(parts[10] ?? "");
    const reel_brake_system = clean(parts[11] ?? "");

    const notes = clean(parts[12] ?? "");
    const storage_note = clean(parts[13] ?? "");

    const name = buildName(brand, model);
    if (!name) {
      errors.push(`Line ${i + 1}: Brand/Model produced empty name`);
      continue;
    }

    rows.push({
      name,
      status,
      brand,
      model,
      reel_type,
      reel_hand,
      reel_gear_ratio,
      reel_ipt_in,
      reel_weight_oz,
      reel_max_drag_lb,
      reel_bearings,
      reel_line_capacity,
      reel_brake_system,
      notes,
      storage_note,
    });
  }

  return { rows, errors };
}

function toTitle(s: string) {
  return String(s ?? "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

export default function Apollo3Page() {
  const [ownerOk, setOwnerOk] = useState(false);
  const [loading, setLoading] = useState(true);

  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [parseErrs, setParseErrs] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      setLoading(true);
      setErr(null);

      try {
        const sessionRes = await supabase.auth.getSession();
        const user = sessionRes.data.session?.user;
        if (!user) {
          window.location.href = "/login";
          return;
        }
        if (!cancelled) setOwnerOk(true);
      } catch (e: unknown) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Failed to load session.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    boot();
    return () => {
      cancelled = true;
    };
  }, []);

  const parsed = useMemo(() => parseLines(text), [text]);

  useEffect(() => {
    setParseErrs(parsed.errors);
  }, [parsed.errors]);

  async function insertAll() {
    setErr(null);
    setSavedMsg(null);

    if (!ownerOk) return;
    if (parsed.rows.length === 0) {
      setErr("Nothing to insert yet.");
      return;
    }
    if (parsed.errors.length) {
      setErr("Fix parse errors first (or remove those lines).");
      return;
    }

    setSaving(true);

    try {
      const sessionRes = await supabase.auth.getSession();
      const user = sessionRes.data.session?.user;
      if (!user) throw new Error("Not signed in.");

      const payload: AnyRecord[] = parsed.rows.map((r) => ({
        owner_id: user.id,
        gear_type: "reel",
        name: r.name,
        status: r.status,
        brand: r.brand || null,
        model: r.model || null,

        reel_type: r.reel_type || null,
        reel_hand: r.reel_hand || null,
        reel_gear_ratio: r.reel_gear_ratio || null,

        reel_ipt_in: r.reel_ipt_in,
        reel_weight_oz: r.reel_weight_oz,
        reel_max_drag_lb: r.reel_max_drag_lb,

        reel_bearings: r.reel_bearings || null,
        reel_line_capacity: r.reel_line_capacity || null,
        reel_brake_system: r.reel_brake_system || null,

        notes: r.notes || null,
        storage_note: r.storage_note || null,
      }));

      const res = await supabase.from("gear_items").insert(payload).select("id");
      if (res.error) throw res.error;

      setSavedMsg(`Inserted ${payload.length} reel(s).`);
      setText("");
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Insert failed.");
    } finally {
      setSaving(false);
      setTimeout(() => setSavedMsg(null), 1800);
    }
  }

  if (loading) return <main className="p-6">Loading…</main>;

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Apollo 3</h1>
          <div className="text-sm text-gray-500">Bulk add reels (paste → preview → insert)</div>
        </div>

        <div className="flex items-center gap-2">
          <Link className="px-4 py-2 rounded border" href="/reels">
            Reels
          </Link>
          <Link className="px-4 py-2 rounded border" href="/combos">
            Combos
          </Link>
          <Link className="px-4 py-2 rounded border" href="/terminal">
            Terminal
          </Link>
        </div>
      </div>

      <div className="border rounded p-4 space-y-2 bg-gray-50">
        <div className="text-sm font-medium">Paste format</div>
        <div className="text-xs text-gray-600 whitespace-pre-wrap">
{`Brand | Model | Status | Type | Hand | Ratio | IPT | WeightOz | DragLb | Bearings | LineCap | Brake | Notes | Storage
- Use | OR TAB OR commas
- Status: owned / wishlist
- You can omit trailing columns

Example:
Shimano | Curado DC 150HG | owned | baitcaster | right | 7.4:1 | 30 | 7.8 | 11 | 6+1 | 12/120 | DC | JDM spool | In black case`}
        </div>
      </div>

      {err && <div className="border rounded p-3 bg-red-50 text-red-800">{err}</div>}
      {savedMsg && <div className="border rounded p-3 bg-green-50 text-green-800">{savedMsg}</div>}

      <textarea
        className="border rounded p-3 w-full min-h-[220px] font-mono text-sm"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste your Apollo 3 list here…"
      />

      {parseErrs.length ? (
        <div className="border rounded p-3 bg-amber-50 text-amber-900">
          <div className="font-medium">Parse errors</div>
          <ul className="list-disc pl-5 text-sm mt-2 space-y-1">
            {parseErrs.slice(0, 20).map((m, idx) => (
              <li key={idx}>{m}</li>
            ))}
          </ul>
          {parseErrs.length > 20 ? <div className="text-xs mt-2">(+ {parseErrs.length - 20} more)</div> : null}
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-sm text-gray-600">
          Preview: <span className="font-medium">{parsed.rows.length}</span> reel(s)
        </div>

        <button
          className="px-4 py-2 rounded bg-black text-white disabled:opacity-50"
          disabled={saving || parsed.rows.length === 0 || parsed.errors.length > 0}
          onClick={insertAll}
        >
          {saving ? "Inserting…" : "Insert All"}
        </button>
      </div>

      {parsed.rows.length ? (
        <div className="border rounded overflow-hidden">
          <div className="grid grid-cols-12 gap-0 text-xs bg-gray-100 border-b">
            <div className="col-span-4 p-2 font-medium">Name</div>
            <div className="col-span-2 p-2 font-medium">Status</div>
            <div className="col-span-2 p-2 font-medium">Type</div>
            <div className="col-span-2 p-2 font-medium">Hand</div>
            <div className="col-span-2 p-2 font-medium">Ratio</div>
          </div>
          <div className="divide-y">
            {parsed.rows.slice(0, 50).map((r, idx) => (
              <div key={idx} className="grid grid-cols-12 text-sm">
                <div className="col-span-4 p-2 truncate">{r.name}</div>
                <div className="col-span-2 p-2">{r.status === "wishlist" ? "Wishlist" : "Owned"}</div>
                <div className="col-span-2 p-2">{toTitle(r.reel_type)}</div>
                <div className="col-span-2 p-2">{toTitle(r.reel_hand)}</div>
                <div className="col-span-2 p-2">{r.reel_gear_ratio || "—"}</div>
              </div>
            ))}
          </div>
          {parsed.rows.length > 50 ? <div className="p-2 text-xs text-gray-500">Showing first 50…</div> : null}
        </div>
      ) : null}
    </main>
  );
}
