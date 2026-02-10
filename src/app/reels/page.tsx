"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { reelHandLabel, reelTypeLabel } from "@/lib/reelSpecs";
import { SpecChip } from "@/components/SpecChip";

type AnyRecord = Record<string, unknown>;
const TABLE = "gear_items";

type StatusFilter = "all" | "owned" | "wishlist" | "other";

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
  const rounded = Math.round(n * Math.pow(10, digits)) / Math.pow(10, digits);
  return rounded.toFixed(digits).replace(/\.0$/, "");
}

function formatOz(v: unknown) {
  const n = toNum(v);
  if (n == null) return "—";
  return `${formatFixed(n, 1)} oz`;
}

function formatLb(v: unknown) {
  const n = toNum(v);
  if (n == null) return "—";
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
  const s = String(v ?? "").trim();
  if (!s) return "—";
  if (/^\d+(\.\d+)?$/.test(s)) return `${s}:1`;
  return s;
}

function statusOf(r: AnyRecord): string {
  return String(r.status ?? "").trim().toLowerCase();
}

function statusBadge(st: string) {
  if (st === "owned") return { label: "Owned", cls: "bg-black text-white" };
  if (st === "wishlist") return { label: "Wishlist", cls: "bg-purple-600 text-white" };
  if (!st) return { label: "Other", cls: "bg-gray-200 text-gray-800" };
  return { label: st, cls: "bg-gray-200 text-gray-800" };
}

type SortKey = "created_desc" | "name_asc" | "brand_asc" | "model_asc" | "status_asc";

function cmpText(a: unknown, b: unknown) {
  const as = String(a ?? "").trim().toLowerCase();
  const bs = String(b ?? "").trim().toLowerCase();
  if (as < bs) return -1;
  if (as > bs) return 1;
  return 0;
}

export default function ReelsPage() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [rows, setRows] = useState<AnyRecord[]>([]);

  const [copiedId, setCopiedId] = useState<string | null>(null);

  // UI controls
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("created_desc");
  const [showIds, setShowIds] = useState(false);

  // combo awareness
  const [usedReelIds, setUsedReelIds] = useState<Set<string>>(new Set());

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

        const [reelsRes, combosRes] = await Promise.all([
          supabase
            .from(TABLE)
            .select("*")
            .eq("gear_type", "reel")
            .eq("owner_id", user.id)
            .order("created_at", { ascending: false }),
          supabase
            .from("combos")
            .select("reel_id")
            .eq("owner_id", user.id)
            .order("created_at", { ascending: false }),
        ]);

        if (reelsRes.error) throw reelsRes.error;
        if (combosRes.error) throw combosRes.error;

        const nextRows = (reelsRes.data ?? []) as AnyRecord[];
        const nextUsed = new Set<string>();
        for (const c of (combosRes.data ?? []) as AnyRecord[]) {
          const rid = String(c.reel_id ?? "");
          if (rid) nextUsed.add(rid);
        }

        if (!cancelled) {
          setRows(nextRows);
          setUsedReelIds(nextUsed);
        }
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

  const filteredSorted = useMemo(() => {
    const needle = q.trim().toLowerCase();

    let list = rows.filter((r) => {
      const st = statusOf(r);
      const isOther = st !== "owned" && st !== "wishlist";

      if (statusFilter === "owned" && st !== "owned") return false;
      if (statusFilter === "wishlist" && st !== "wishlist") return false;
      if (statusFilter === "other" && !isOther) return false;

      if (!needle) return true;

      const name = String(r.name ?? "");
      const brand = String(r.brand ?? "");
      const model = String(r.model ?? "");
      const type = String(r.reel_type ?? "");
      const hand = String(r.reel_hand ?? "");
      const ratio = String(r.reel_gear_ratio ?? "");
      const hay = `${name} ${brand} ${model} ${type} ${hand} ${ratio}`.toLowerCase();

      return hay.includes(needle);
    });

    const byCreatedDesc = (a: AnyRecord, b: AnyRecord) => {
      const ad = String(a.created_at ?? "");
      const bd = String(b.created_at ?? "");
      if (ad < bd) return 1;
      if (ad > bd) return -1;
      return 0;
    };

    list = [...list].sort((a, b) => {
      if (sortKey === "created_desc") return byCreatedDesc(a, b);
      if (sortKey === "name_asc") return cmpText(a.name, b.name);
      if (sortKey === "brand_asc")
        return cmpText(a.brand, b.brand) || cmpText(a.model, b.model) || cmpText(a.name, b.name);
      if (sortKey === "model_asc")
        return cmpText(a.model, b.model) || cmpText(a.brand, b.brand) || cmpText(a.name, b.name);
      if (sortKey === "status_asc")
        return cmpText(statusOf(a), statusOf(b)) || cmpText(a.brand, b.brand) || cmpText(a.model, b.model);
      return 0;
    });

    return list;
  }, [rows, q, statusFilter, sortKey]);

  const header = useMemo(() => {
    const n = filteredSorted.length;
    return `${n} reel${n === 1 ? "" : "s"}`;
  }, [filteredSorted.length]);

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
          <Link className="px-4 py-2 rounded border" href="/combos">
            Combos
          </Link>
          <Link className="px-4 py-2 rounded bg-black text-white" href="/reels/new">
            New Reel
          </Link>
        </div>
      </div>

      {err && <div className="border rounded p-3 bg-red-50 text-red-800">{err}</div>}

      <div className="border rounded p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="border rounded px-3 py-2 text-sm flex-1 min-w-[220px]"
            placeholder="Search reels (name, brand, model, type, ratio…)…"
            aria-label="Search reels"
          />

          <select
            className="border rounded px-2 py-2 text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            aria-label="Filter by status"
            title="Filter by status"
          >
            <option value="all">All Statuses</option>
            <option value="owned">Owned</option>
            <option value="wishlist">Wishlist</option>
            <option value="other">Other</option>
          </select>

          <select
            className="border rounded px-2 py-2 text-sm"
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            aria-label="Sort reels"
            title="Sort reels"
          >
            <option value="created_desc">Sort: Newest</option>
            <option value="name_asc">Sort: Name</option>
            <option value="brand_asc">Sort: Brand</option>
            <option value="model_asc">Sort: Model</option>
            <option value="status_asc">Sort: Status</option>
          </select>

          <label className="flex items-center gap-2 text-sm select-none">
            <input type="checkbox" checked={showIds} onChange={(e) => setShowIds(e.target.checked)} />
            Show IDs
          </label>
        </div>

        <div className="text-xs text-gray-500">
          Tip: you’ll see a <span className="font-medium">Combo</span> badge when a reel is already paired.
        </div>
      </div>

      {filteredSorted.length === 0 ? (
        <div className="border rounded p-4 text-sm text-gray-600">No reels match your filters.</div>
      ) : (
        <div className="grid gap-3">
          {filteredSorted.map((r) => {
            const id = String(r.id ?? "");
            const name = String(r.name ?? "").trim() || "Reel";
            const brandModel = formatBrandModel(r.brand, r.model);

            const reelType = toText(r.reel_type);
            const hand = toText(r.reel_hand);

            const ratio = normalizeRatio(r.reel_gear_ratio);
            const ipt = toNum(r.reel_ipt_in);
            const wt = formatOz(r.reel_weight_oz);
            const drag = formatLb(r.reel_max_drag_lb);

            const st = statusOf(r);
            const badge = statusBadge(st);

            const inCombo = usedReelIds.has(id);

            const idShort = shortId(id);
            const wasCopied = copiedId === id;

            return (
              <Link
                key={id}
                href={`/reels/${id}`}
                className={`border rounded p-4 hover:bg-gray-50 block ${inCombo ? "opacity-[0.92]" : ""}`}
                title={id}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="font-medium truncate">{name}</div>

                      <span className={`text-xs px-2 py-0.5 rounded ${badge.cls}`} title="Status">
                        {badge.label}
                      </span>

                      {inCombo ? (
                        <span
                          className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-200"
                          title="This reel is used in a combo"
                        >
                          Combo
                        </span>
                      ) : null}
                    </div>

                    {brandModel ? <div className="text-sm text-gray-600 truncate">{brandModel}</div> : null}

                    <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                      {showIds ? <span className="select-none">ID: {idShort}</span> : null}

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
