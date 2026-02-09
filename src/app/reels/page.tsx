"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { reelHandLabel, reelTypeLabel } from "@/lib/reelSpecs";
import { SpecChip } from "@/components/SpecChip";

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

function toNum(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function formatFixed(n: number, digits: number) {
  // avoid 6.30000000004 style noise
  const rounded = Math.round(n * Math.pow(10, digits)) / Math.pow(10, digits);
  return rounded.toFixed(digits).replace(/\.0$/, "");
}

function formatOz(v: unknown) {
  const n = toNum(v);
  if (n == null) return "—";
  // one decimal max for ounces
  return `${formatFixed(n, 1)} oz`;
}

function formatLb(v: unknown) {
  const n = toNum(v);
  if (n == null) return "—";
  // one decimal max for drag (usually whole, but 0.5 exists)
  return `${formatFixed(n, 1)} lb`;
}

function formatBrandModel(brand: unknown, model: unknown): string | null {
  const b = String(brand ?? "").trim();
  const m = String(model ?? "").trim();
  if (b && m) return `${b} • ${m}`;
  if (b) return b;
  if (m) return m;
  return null;
}

function shortId(id: string): string {
  const s = String(id ?? "");
  if (s.length <= 12) return s;
  return `${s.slice(0, 4)}…${s.slice(-4)}`;
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through
  }

  try {
    const el = document.createElement("textarea");
    el.value = text;
    el.setAttribute("readonly", "true");
    el.style.position = "absolute";
    el.style.left = "-9999px";
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
}

function normalizeRatio(v: unknown): string {
  // Hide blanks and placeholders
  const s = String(v ?? "").trim();
  if (!s) return "—";

  // If user types "7.4" normalize to "7.4:1"
  if (/^\d+(\.\d+)?$/.test(s)) return `${s}:1`;

  return s;
}

export default function ReelsPage() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [rows, setRows] = useState<AnyRecord[]>([]);

  const [copiedId, setCopiedId] = useState<string | null>(null);

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

            const brandModel = formatBrandModel(r.brand, r.model);

            const reelType = toText(r.reel_type);
            const hand = toText(r.reel_hand);

            const ratio = normalizeRatio(r.reel_gear_ratio);
            const ipt = toNum(r.reel_ipt_in);
            const wt = formatOz(r.reel_weight_oz);
            const drag = formatLb(r.reel_max_drag_lb);

            const idShort = shortId(id);
            const wasCopied = copiedId === id;

            return (
              <Link
                key={id}
                href={`/reels/${id}`}
                className="border rounded p-4 hover:bg-gray-50 block"
                title={id}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{name}</div>

                    {brandModel ? (
                      <div className="text-sm text-gray-600 truncate">{brandModel}</div>
                    ) : null}

                    <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                      <span className="select-none">ID: {idShort}</span>

                      <button
                        type="button"
                        className="px-2 py-0.5 rounded border bg-white hover:bg-gray-100"
                        onClick={async (e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const ok = await copyToClipboard(id);
                          if (!ok) return;

                          setCopiedId(id);
                          window.setTimeout(() => setCopiedId((cur) => (cur === id ? null : cur)), 900);
                        }}
                        title="Copy full ID"
                        aria-label="Copy full reel ID"
                      >
                        {wasCopied ? "Copied" : "Copy ID"}
                      </button>
                    </div>
                  </div>

                  <div className="text-xs text-gray-600 text-right">
                    <div>{reelTypeLabel(reelType)}</div>
                    <div>{reelHandLabel(hand)}</div>
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <SpecChip label="Ratio" value={ratio} />
                  <SpecChip label="IPT" value={ipt} />
                  <SpecChip label="Drag" value={drag} />
                  <SpecChip label="Weight" value={wt} />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
