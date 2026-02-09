"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { reelHandLabel, reelTypeLabel } from "@/lib/reelSpecs";

type AnyRecord = Record<string, unknown>;
const TABLE = "gear_items";

function errMsg(e: unknown, fallback: string) {
  if (e instanceof Error) return e.message || fallback;
  if (typeof e === "string") return e || fallback;
  try {
    return JSON.stringify(e);
  } catch {
    return fallback;
  }
}

function toText(v: unknown) {
  const s = String(v ?? "").trim();
  return s ? s : "—";
}

function formatOz(v: unknown) {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return "—";
  return `${n} oz`;
}

function formatLb(v: unknown) {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return "—";
  return `${n} lb`;
}

export default function ReelsPage() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [rows, setRows] = useState<AnyRecord[]>([]);

  const count = rows.length;

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

        const res = await supabase
          .from(TABLE)
          .select("*")
          .eq("gear_type", "reel")
          .eq("owner_id", user.id)
          .order("created_at", { ascending: false });

        if (res.error) throw res.error;

        if (!cancelled) setRows((res.data ?? []) as AnyRecord[]);
      } catch (e: unknown) {
        if (!cancelled) setErr(errMsg(e, "Failed to load reels."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const header = useMemo(() => {
    return `${count} reel${count === 1 ? "" : "s"}`;
  }, [count]);

  if (loading) return <main className="p-6">Loading…</main>;

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Reels</h1>
          <div className="text-sm text-gray-500">{header}</div>
        </div>

        <div className="flex items-center gap-2">
          <Link className="px-4 py-2 rounded border" href="/rods">
            Rods
          </Link>
          <Link className="px-4 py-2 rounded bg-black text-white" href="/reels/new">
            New Reel
          </Link>
        </div>
      </div>

      {err && <div className="border rounded p-3 bg-red-50 text-red-800">{err}</div>}

      {rows.length === 0 ? (
        <div className="border rounded p-4 text-sm text-gray-600">No reels yet.</div>
      ) : (
        <div className="grid gap-3">
          {rows.map((r) => {
            const id = String(r.id ?? "");
            const name = String(r.name ?? "").trim() || "Reel";

            const reelType = toText(r.reel_type);
            const hand = toText(r.reel_hand);
            const ratio = toText(r.reel_gear_ratio);
            const ipt = toText(r.reel_ipt_in);
            const wt = formatOz(r.reel_weight_oz);
            const drag = formatLb(r.reel_max_drag_lb);

            return (
              <Link
                key={id}
                href={`/reels/${id}`}
                className="border rounded p-4 hover:bg-gray-50 block"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">{name}</div>
                    <div className="text-xs text-gray-500 break-all">{id}</div>
                  </div>

                  <div className="text-xs text-gray-600 text-right">
                    <div>{reelTypeLabel(reelType)}</div>
                    <div>{reelHandLabel(hand)}</div>
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <span className="px-2 py-1 rounded border bg-white">Ratio: {ratio}</span>
                  <span className="px-2 py-1 rounded border bg-white">IPT: {ipt}</span>
                  <span className="px-2 py-1 rounded border bg-white">Drag: {drag}</span>
                  <span className="px-2 py-1 rounded border bg-white">Weight: {wt}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}