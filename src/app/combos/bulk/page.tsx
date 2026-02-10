"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type AnyRow = Record<string, unknown>;

function clean(s: unknown) {
  return String(s ?? "").trim().replace(/\s+/g, " ");
}

function keyName(r: AnyRow) {
  // match on name first; fall back to Brand Model
  const n = clean(r.name);
  if (n) return n.toLowerCase();
  const brand = clean(r.brand);
  const model = clean(r.model);
  return [brand, model].filter(Boolean).join(" ").toLowerCase();
}

// Paste format: Rod Name | Reel Name
function parsePairs(raw: string): { pairs: Array<{ rod: string; reel: string }>; errors: string[] } {
  const lines = raw
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter((x) => x && !x.startsWith("#"));

  const errors: string[] = [];
  const pairs: Array<{ rod: string; reel: string }> = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const parts = line.includes("|") ? line.split("|").map((p) => p.trim()) : line.split("\t").map((p) => p.trim());
    if (parts.length < 2) {
      errors.push(`Line ${i + 1}: use "Rod | Reel"`);
      continue;
    }
    const rod = clean(parts[0]);
    const reel = clean(parts[1]);
    if (!rod || !reel) {
      errors.push(`Line ${i + 1}: missing rod or reel`);
      continue;
    }
    pairs.push({ rod, reel });
  }

  return { pairs, errors };
}

export default function CombosBulkPage() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [rods, setRods] = useState<AnyRow[]>([]);
  const [reels, setReels] = useState<AnyRow[]>([]);

  const [text, setText] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setErr(null);

      try {
        const sessionRes = await supabase.auth.getSession();
        const user = sessionRes.data.session?.user;
        if (!user) {
          window.location.href = "/login";
          return;
        }

        const [rodRes, reelRes] = await Promise.all([
          supabase.from("gear_items").select("id,name,brand,model").eq("gear_type", "rod").eq("owner_id", user.id).order("created_at", { ascending: false }),
          supabase.from("gear_items").select("id,name,brand,model").eq("gear_type", "reel").eq("owner_id", user.id).order("created_at", { ascending: false }),
        ]);

        if (rodRes.error) throw rodRes.error;
        if (reelRes.error) throw reelRes.error;

        if (!cancelled) {
          setRods((rodRes.data ?? []) as AnyRow[]);
          setReels((reelRes.data ?? []) as AnyRow[]);
        }
      } catch (e: unknown) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Failed to load rods/reels.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const parsed = useMemo(() => parsePairs(text), [text]);

  const rodByName = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of rods) m.set(keyName(r), String(r.id));
    return m;
  }, [rods]);

  const reelByName = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of reels) m.set(keyName(r), String(r.id));
    return m;
  }, [reels]);

  const preview = useMemo(() => {
    const rows = parsed.pairs.map((p) => {
      const rodId = rodByName.get(p.rod.toLowerCase()) ?? null;
      const reelId = reelByName.get(p.reel.toLowerCase()) ?? null;
      return { ...p, rodId, reelId };
    });

    const missing = rows.filter((x) => !x.rodId || !x.reelId).length;
    return { rows, missing };
  }, [parsed.pairs, rodByName, reelByName]);

  async function insertCombos() {
    setErr(null);
    setMsg(null);

    if (parsed.errors.length) {
      setErr("Fix parse errors first.");
      return;
    }
    if (!preview.rows.length) {
      setErr("Nothing to insert yet.");
      return;
    }
    if (preview.missing) {
      setErr("Some lines did not match a rod/reel by name. Fix those first.");
      return;
    }

    setSaving(true);

    try {
      const sessionRes = await supabase.auth.getSession();
      const user = sessionRes.data.session?.user;
      if (!user) throw new Error("Not signed in.");

      const payload = preview.rows.map((r) => ({
        owner_id: user.id,
        rod_id: r.rodId,
        reel_id: r.reelId,
      }));

      const res = await supabase.from("combos").insert(payload);
      if (res.error) throw res.error;

      setMsg(`Inserted ${payload.length} combo(s).`);
      setText("");
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Insert failed.");
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(null), 1800);
    }
  }

  if (loading) return <main className="p-6">Loading…</main>;

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Bulk Add Combos</h1>
          <div className="text-sm text-gray-500">Paste Rod | Reel pairs</div>
        </div>

        <div className="flex items-center gap-2">
          <Link className="px-4 py-2 rounded border" href="/combos">
            Combos
          </Link>
          <Link className="px-4 py-2 rounded border" href="/rods">
            Rods
          </Link>
          <Link className="px-4 py-2 rounded border" href="/reels">
            Reels
          </Link>
        </div>
      </div>

      <div className="border rounded p-4 bg-gray-50 space-y-1">
        <div className="text-sm font-medium">Paste format</div>
        <div className="text-xs text-gray-600 whitespace-pre-wrap">
{`Rod Name | Reel Name
- Names must match existing items (exact text, case-insensitive).
- Tip: use the main Name field, not the short ID.

Example:
St Croix Jig Rod | Shimano Curado DC 150HG`}
        </div>
      </div>

      {err && <div className="border rounded p-3 bg-red-50 text-red-800">{err}</div>}
      {msg && <div className="border rounded p-3 bg-green-50 text-green-800">{msg}</div>}

      <textarea
        className="border rounded p-3 w-full min-h-[220px] font-mono text-sm"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste your combo pairs here…"
      />

      {parsed.errors.length ? (
        <div className="border rounded p-3 bg-amber-50 text-amber-900">
          <div className="font-medium">Parse errors</div>
          <ul className="list-disc pl-5 text-sm mt-2 space-y-1">
            {parsed.errors.map((m, idx) => (
              <li key={idx}>{m}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-sm text-gray-600">
          Preview: <span className="font-medium">{preview.rows.length}</span> pair(s) • Missing matches:{" "}
          <span className="font-medium">{preview.missing}</span>
        </div>

        <button
          className="px-4 py-2 rounded bg-black text-white disabled:opacity-50"
          disabled={saving || preview.rows.length === 0 || preview.missing > 0 || parsed.errors.length > 0}
          onClick={insertCombos}
        >
          {saving ? "Inserting…" : "Insert Combos"}
        </button>
      </div>

      {preview.rows.length ? (
        <div className="border rounded overflow-hidden">
          <div className="grid grid-cols-12 gap-0 text-xs bg-gray-100 border-b">
            <div className="col-span-5 p-2 font-medium">Rod</div>
            <div className="col-span-5 p-2 font-medium">Reel</div>
            <div className="col-span-2 p-2 font-medium">Match</div>
          </div>
          <div className="divide-y">
            {preview.rows.slice(0, 60).map((r, idx) => (
              <div key={idx} className="grid grid-cols-12 text-sm">
                <div className="col-span-5 p-2 truncate">{r.rod}</div>
                <div className="col-span-5 p-2 truncate">{r.reel}</div>
                <div className="col-span-2 p-2">
                  {r.rodId && r.reelId ? "OK" : "Missing"}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </main>
  );
}
