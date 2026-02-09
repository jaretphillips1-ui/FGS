"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type AnyRow = Record<string, unknown>;

function formatBrandModel(brand: unknown, model: unknown): string | null {
  const b = String(brand ?? "").trim();
  const m = String(model ?? "").trim();
  if (b && m) return `${b} • ${m}`;
  if (b) return b;
  if (m) return m;
  return null;
}

function labelRow(r: AnyRow, fallback: string) {
  const name = String(r.name ?? "").trim() || fallback;
  const bm = formatBrandModel(r.brand, r.model);
  return bm ? `${name} — ${bm}` : name;
}

export default function CombosPage() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [rods, setRods] = useState<AnyRow[]>([]);
  const [reels, setReels] = useState<AnyRow[]>([]);

  const [rodId, setRodId] = useState<string>("");
  const [reelId, setReelId] = useState<string>("");

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
          supabase
            .from("gear_items")
            .select("id,name,brand,model,status,created_at")
            .eq("gear_type", "rod")
            .eq("owner_id", user.id)
            .order("created_at", { ascending: false }),
          supabase
            .from("gear_items")
            .select("id,name,brand,model,status,created_at")
            .eq("gear_type", "reel")
            .eq("owner_id", user.id)
            .order("created_at", { ascending: false }),
        ]);

        if (rodRes.error) throw rodRes.error;
        if (reelRes.error) throw reelRes.error;

        if (!cancelled) {
          const rodRows = (rodRes.data ?? []) as AnyRow[];
          const reelRows = (reelRes.data ?? []) as AnyRow[];
          setRods(rodRows);
          setReels(reelRows);

          // keep selections valid if lists changed
          if (rodId && !rodRows.some((r) => String(r.id) === rodId)) setRodId("");
          if (reelId && !reelRows.some((r) => String(r.id) === reelId)) setReelId("");
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Failed to load combos data.";
        if (!cancelled) setErr(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedRod = useMemo(
    () => rods.find((r) => String(r.id ?? "") === rodId) ?? null,
    [rods, rodId]
  );

  const selectedReel = useMemo(
    () => reels.find((r) => String(r.id ?? "") === reelId) ?? null,
    [reels, reelId]
  );

  const preview = useMemo(() => {
    if (!selectedRod && !selectedReel) return null;
    const rodLabel = selectedRod ? labelRow(selectedRod, "Rod") : "—";
    const reelLabel = selectedReel ? labelRow(selectedReel, "Reel") : "—";
    return `${rodLabel}  +  ${reelLabel}`;
  }, [selectedRod, selectedReel]);

  if (loading) return <main className="p-6">Loading…</main>;

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Combos</h1>
          <div className="text-sm text-gray-500">
            {rods.length} rod{rods.length === 1 ? "" : "s"} • {reels.length} reel
            {reels.length === 1 ? "" : "s"}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link className="px-4 py-2 rounded border" href="/rods">
            Rods
          </Link>
          <Link className="px-4 py-2 rounded border" href="/reels">
            Reels
          </Link>
        </div>
      </div>

      {err && <div className="border rounded p-3 bg-red-50 text-red-800">{err}</div>}

      <div className="border rounded p-4 space-y-3">
        <div className="text-sm text-gray-700">
          This is a **read-only** builder (no saving yet). Next step is adding a combos table + save.
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          <label className="block">
            <div className="text-sm text-gray-600 mb-1">Rod</div>
            <select
              className="w-full border rounded px-2 py-2 text-sm"
              value={rodId}
              onChange={(e) => setRodId(e.target.value)}
              aria-label="Select rod"
            >
              <option value="">— Select a rod —</option>
              {rods.map((r) => {
                const id = String(r.id ?? "");
                return (
                  <option key={id} value={id}>
                    {labelRow(r, "Rod")}
                  </option>
                );
              })}
            </select>
          </label>

          <label className="block">
            <div className="text-sm text-gray-600 mb-1">Reel</div>
            <select
              className="w-full border rounded px-2 py-2 text-sm"
              value={reelId}
              onChange={(e) => setReelId(e.target.value)}
              aria-label="Select reel"
            >
              <option value="">— Select a reel —</option>
              {reels.map((r) => {
                const id = String(r.id ?? "");
                return (
                  <option key={id} value={id}>
                    {labelRow(r, "Reel")}
                  </option>
                );
              })}
            </select>
          </label>
        </div>

        {preview ? (
          <div className="mt-2 text-sm">
            <div className="text-gray-500">Preview</div>
            <div className="font-medium">{preview}</div>
          </div>
        ) : null}

        <div className="pt-2 flex items-center gap-2">
          <button
            type="button"
            className="px-4 py-2 rounded bg-black text-white opacity-60 cursor-not-allowed"
            disabled
            title="Coming next: combos table + save"
          >
            Save Combo (coming soon)
          </button>
          <button
            type="button"
            className="px-4 py-2 rounded border"
            onClick={() => {
              setRodId("");
              setReelId("");
            }}
            title="Clear selections"
          >
            Clear
          </button>
        </div>
      </div>
    </main>
  );
}
