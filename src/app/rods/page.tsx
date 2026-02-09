"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import RodsListClient from "./RodsListClient";
import { normalizeTechniques, sortTechniques, techniqueChipClass } from "@/lib/rodTechniques";

type RodRow = {
  id: string;
  name: string;
  brand?: string | null;
  model?: string | null;
  status?: string | null;
  created_at?: string | null;
  rod_techniques?: string[] | string | null;
};

type AuthState = "unknown" | "signed_out" | "signed_in";

type StatusFilter = "all" | "owned" | "wishlist";
type SortKey = "brand" | "name" | "created_desc" | "status_owned_first";

function hardTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) =>
      setTimeout(() => rej(new Error(`${label} timed out after ${ms}ms`)), ms)
    ),
  ]);
}

// Soft timeout: returns { timedOut: true } ONLY if our timer fires.
// (Fixes false "Auth check is taking longer..." when simply signed out.)
async function getSessionSoft(ms: number): Promise<{
  timedOut: boolean;
  session: Session | null;
  error?: string;
}> {
  try {
    const timeoutP = new Promise<{ __timedOut: true }>((resolve) =>
      setTimeout(() => resolve({ __timedOut: true }), ms)
    );

    const sessionP = supabase.auth.getSession().then((res) => ({ res }));

    const raced = await Promise.race([sessionP, timeoutP]);

    if ("__timedOut" in raced) {
      return { timedOut: true, session: null };
    }

    const session = raced.res.data.session ?? null;
    return { timedOut: false, session };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Auth session error.";
    return { timedOut: false, session: null, error: msg };
  }
}

function normalizeStatus(status?: string | null): string {
  return String(status ?? "").trim().toLowerCase();
}

function isOwnedStatus(status?: string | null): boolean {
  const s = normalizeStatus(status);
  return s === "owned" || s === "active"; // legacy
}

function isWishListStatus(status?: string | null): boolean {
  const s = normalizeStatus(status);
  // DB enum currently uses planned; accept wishlist too if any old rows exist
  return s === "planned" || s === "wishlist" || s === "wish list" || s === "wish";
}

function statusLabel(status?: string | null): "Owned" | "Wish list" | string | null {
  const s = normalizeStatus(status);
  if (!s) return null;

  if (isOwnedStatus(s)) return "Owned";
  if (isWishListStatus(s)) return "Wish list";

  // Future-proof: show other statuses as Title Case (neutral styling)
  const pretty = s
    .split(/[\s_-]+/g)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  return pretty || null;
}

function toggleStatusValue(current?: string | null): "owned" | "planned" | null {
  const s = normalizeStatus(current);
  if (!s) return null;

  if (isOwnedStatus(s)) return "planned";
  if (isWishListStatus(s)) return "owned";

  // Unknown status: don't toggle automatically
  return null;
}

function StatusBadge({
  status,
  onToggle,
  disabled,
}: {
  status?: string | null;
  onToggle?: () => void;
  disabled?: boolean;
}) {
  const label = statusLabel(status);
  if (!label) return null;

  const s = normalizeStatus(status);

  const isOwned = isOwnedStatus(s);
  const isWish = isWishListStatus(s);

  const base =
    isOwned
      ? "text-xs px-2 py-0.5 rounded bg-gray-900 text-white border border-gray-900"
      : isWish
      ? "text-xs px-2 py-0.5 rounded bg-purple-600 text-white border border-purple-700"
      : "text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700 border";

  const clickable = onToggle ? "cursor-pointer hover:opacity-90 active:opacity-80" : "";
  const disabledCls = disabled ? "opacity-60 cursor-not-allowed" : "";

  const cls = `${base} ${clickable} ${disabledCls}`.trim();

  if (!onToggle) return <span className={cls}>{label}</span>;

  return (
    <button
      type="button"
      className={cls}
      disabled={!!disabled}
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) onToggle();
      }}
      title="Click to toggle Owned ↔ Wish list"
      aria-label="Toggle rod status"
    >
      {label}
    </button>
  );
}

function formatBrandModel(brand?: string | null, model?: string | null): string | null {
  const b = String(brand ?? "").trim();
  const m = String(model ?? "").trim();

  if (b && m) return `${b} • ${m}`;
  if (b) return b;
  if (m) return m;
  return null;
}

function toSortText(v: unknown): string {
  return String(v ?? "").trim().toLowerCase();
}

function cmpText(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

function countByStatus(rows: RodRow[]): { owned: number; wish: number } {
  let owned = 0;
  let wish = 0;
  for (const r of rows) {
    if (isOwnedStatus(r.status)) owned++;
    else if (isWishListStatus(r.status)) wish++;
  }
  return { owned, wish };
}

function sortRows(base: RodRow[], sortKey: SortKey): RodRow[] {
  const sorted = [...base];

  sorted.sort((a, b) => {
    if (sortKey === "created_desc") {
      const ad = toSortText(a.created_at);
      const bd = toSortText(b.created_at);
      // ISO dates sort lexicographically
      return cmpText(bd, ad);
    }

    if (sortKey === "name") {
      return cmpText(toSortText(a.name), toSortText(b.name));
    }

    if (sortKey === "status_owned_first") {
      const ao = isOwnedStatus(a.status) ? 0 : isWishListStatus(a.status) ? 1 : 2;
      const bo = isOwnedStatus(b.status) ? 0 : isWishListStatus(b.status) ? 1 : 2;
      if (ao !== bo) return ao - bo;

      // tie-breaker: brand then name
      const ab = toSortText(a.brand);
      const bb = toSortText(b.brand);
      const byBrand = cmpText(ab, bb);
      if (byBrand !== 0) return byBrand;
      return cmpText(toSortText(a.name), toSortText(b.name));
    }

    // default: brand (then model, then name)
    const ab = toSortText(a.brand);
    const bb = toSortText(b.brand);
    const byBrand = cmpText(ab, bb);
    if (byBrand !== 0) return byBrand;

    const am = toSortText(a.model);
    const bm = toSortText(b.model);
    const byModel = cmpText(am, bm);
    if (byModel !== 0) return byModel;

    return cmpText(toSortText(a.name), toSortText(b.name));
  });

  return sorted;
}

export default function RodLockerPage() {
  const router = useRouter();

  const [authState, setAuthState] = useState<AuthState>("unknown");
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const [rows, setRows] = useState<RodRow[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Track which row IDs are currently being toggled (prevents double clicks)
  const [toggling, setToggling] = useState<Record<string, boolean>>({});

  // Display-only controls (client-side filter + sort)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("brand");

  const loadSeq = useRef(0);

  async function load() {
    const seq = ++loadSeq.current;

    if (initialLoading) setInitialLoading(true);
    else setRefreshing(true);

    setErr(null);

    try {
      const sessionRes = await getSessionSoft(6000);

      if (sessionRes.error) {
        if (seq === loadSeq.current) {
          setAuthState("unknown");
          setErr(sessionRes.error);
        }
        return;
      }

      const session = sessionRes.session;
      const user = session?.user ?? null;

      if (sessionRes.timedOut && !user && !userEmail) {
        if (seq === loadSeq.current) {
          setAuthState("unknown");
          setErr("Auth check is taking longer than expected. Click Retry.");
        }
        return;
      }

      if (!user) {
        if (seq === loadSeq.current) {
          setAuthState("signed_out");
          setUserEmail(null);
          setRows([]);
        }
        return;
      }

      if (seq === loadSeq.current) {
        setAuthState("signed_in");
        setUserEmail(user.email ?? null);
      }

      const queryRes = await hardTimeout(
        supabase
          .from("gear_items")
          .select("id,name,brand,model,status,created_at,rod_techniques")
          .eq("gear_type", "rod")
          .order("created_at", { ascending: false }),
        8000,
        "gear_items select"
      );

      if (queryRes.error) {
        if (seq === loadSeq.current) setErr(queryRes.error.message);
        return;
      }

      if (seq === loadSeq.current) {
        setRows((queryRes.data ?? []) as RodRow[]);
      }
    } catch (e: unknown) {
      if (seq === loadSeq.current) {
        setAuthState(userEmail ? "signed_in" : "unknown");
        setErr(e instanceof Error ? e.message : "Unknown error while loading rods.");
      }
    } finally {
      if (seq === loadSeq.current) {
        setInitialLoading(false);
        setRefreshing(false);
      }
    }
  }

  async function addTestRod() {
    setErr(null);

    const sessionRes = await supabase.auth.getSession();
    const user = sessionRes.data.session?.user;
    if (!user) return setErr("Not signed in.");

    const suffix = new Date().toISOString().slice(11, 19);
    const rodName = "Test Rod " + suffix;

    const { error } = await supabase.from("gear_items").insert({
      owner_id: user.id,
      gear_type: "rod",
      status: "owned",
      name: rodName,
      saltwater_ok: false,
    });

    if (error) setErr(error.message);
    await load();
  }

  async function signOut() {
    await supabase.auth.signOut();
    await load();
  }

  async function toggleRodStatus(row: RodRow) {
    const next = toggleStatusValue(row.status);
    if (!next) return;

    setToggling((m) => ({ ...m, [row.id]: true }));
    setErr(null);

    try {
      const { error } = await supabase.from("gear_items").update({ status: next }).eq("id", row.id);

      if (error) {
        setErr(error.message);
        return;
      }

      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, status: next } : r)));
    } finally {
      setToggling((m) => {
        const copy = { ...m };
        delete copy[row.id];
        return copy;
      });
    }
  }

  useEffect(() => {
    load();
    const { data: sub } = supabase.auth.onAuthStateChange(() => load());
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (initialLoading) return <main className="p-6">Loading…</main>;

  if (authState === "unknown") {
    return (
      <main className="p-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">Rod Locker</h1>
          <div className="flex items-center gap-2">
            <Link className="px-3 py-2 rounded border" href="/reels">
              Reels
            </Link>
            <Link className="px-3 py-2 rounded border" href="/combos">
              Combos
            </Link>
          </div>
        </div>

        {err && <p className="mt-3 text-sm text-red-600">{err}</p>}

        <p className="mt-2 text-gray-600">Checking your session… if this doesn’t clear, hit Retry.</p>

        <div className="mt-6 flex gap-3 flex-wrap">
          <button className="px-4 py-2 rounded border" onClick={() => load()}>
            Retry
          </button>
          <Link className="inline-block underline mt-2" href="/login">
            Go to login
          </Link>
        </div>
      </main>
    );
  }

  if (authState === "signed_out" || !userEmail) {
    return (
      <main className="p-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">Rod Locker</h1>
          <div className="flex items-center gap-2">
            <Link className="px-3 py-2 rounded border" href="/reels">
              Reels
            </Link>
            <Link className="px-3 py-2 rounded border" href="/combos">
              Combos
            </Link>
          </div>
        </div>

        {err && <p className="mt-3 text-sm text-red-600">{err}</p>}

        <p className="mt-2 text-gray-600">You need to sign in first.</p>
        <Link className="inline-block mt-4 underline" href="/login">
          Go to login
        </Link>

        <div className="mt-6">
          <button className="px-4 py-2 rounded border" onClick={() => load()}>
            Retry
          </button>
        </div>
      </main>
    );
  }

  const counts = countByStatus(rows);

  return (
    <main className="p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Rod Locker</h1>
          <p className="text-sm text-gray-600">
            Signed in as {userEmail}
            {refreshing ? <span className="ml-2 opacity-70">(refreshing…)</span> : null}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link className="px-3 py-2 rounded border" href="/reels">
            Reels
          </Link>
          <Link className="px-3 py-2 rounded border" href="/combos">
            Combos
          </Link>
          <button className="px-3 py-2 rounded border" onClick={signOut}>
            Sign out
          </button>
        </div>
      </div>

      <div className="mt-6 flex gap-3 flex-wrap">
        <button className="px-4 py-2 rounded bg-black text-white" onClick={addTestRod}>
          Add Test Rod
        </button>

        <button className="px-4 py-2 rounded border" onClick={() => router.push("/rods/new")}>
          New Rod
        </button>

        <button className="px-4 py-2 rounded border" onClick={() => load()}>
          Refresh
        </button>
      </div>

      {err && <p className="mt-4 text-sm text-red-600">{err}</p>}

      <RodsListClient rows={rows}>
        {(filteredRows, setTechniqueFilter) => {
          const statusFiltered = filteredRows.filter((r) => {
            if (statusFilter === "all") return true;
            if (statusFilter === "owned") return isOwnedStatus(r.status);
            if (statusFilter === "wishlist") return isWishListStatus(r.status);
            return true;
          });

          const displayRows = sortRows(statusFiltered, sortKey);

          return (
            <>
              <div className="mt-6 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <label className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">Status</span>
                    <select
                      className="border rounded px-2 py-1 text-sm"
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                      aria-label="Filter by status"
                      title="Filter by status"
                    >
                      <option value="all">All</option>
                      <option value="owned">Owned</option>
                      <option value="wishlist">Wish list</option>
                    </select>
                  </label>

                  <label className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">Sort</span>
                    <select
                      className="border rounded px-2 py-1 text-sm"
                      value={sortKey}
                      onChange={(e) => setSortKey(e.target.value as SortKey)}
                      aria-label="Sort rods"
                      title="Sort rods"
                    >
                      <option value="brand">Brand</option>
                      <option value="name">Name</option>
                      <option value="created_desc">Created (newest)</option>
                      <option value="status_owned_first">Status (Owned first)</option>
                    </select>
                  </label>

                  <button
                    type="button"
                    className="px-3 py-1.5 rounded border text-sm"
                    onClick={() => {
                      setStatusFilter("all");
                      setSortKey("brand");
                      setTechniqueFilter("");
                    }}
                    title="Reset list controls"
                  >
                    Clear
                  </button>
                </div>

                <div className="text-sm text-gray-600">
                  {displayRows.length} / {rows.length} • Owned: {counts.owned} • Wish list: {counts.wish}
                </div>
              </div>

              <ul className="mt-3 space-y-2">
                {displayRows.map((r) => {
                  const brandModel = formatBrandModel(r.brand, r.model);

                  return (
                    <li
                      key={r.id}
                      className="border rounded p-3 cursor-pointer hover:bg-gray-50"
                      onClick={() => router.push(`/rods/${r.id}`)}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-medium truncate">{r.name}</div>
                          {brandModel ? <div className="text-sm text-gray-600 truncate">{brandModel}</div> : null}
                        </div>

                        <StatusBadge status={r.status} disabled={!!toggling[r.id]} onToggle={() => toggleRodStatus(r)} />
                      </div>

                      {(() => {
                        const techs = normalizeTechniques(r.rod_techniques as unknown);
                        if (techs.length === 0) return null;

                        const primary = String(techs[0] ?? "").trim();
                        const secondarySorted = sortTechniques(techs).filter((t) => t !== primary);
                        const display = primary ? [primary, ...secondarySorted] : secondarySorted;

                        if (display.length === 0) return null;

                        return (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {display.map((t) => {
                              const isPrimary = primary && t === primary;

                              const cls = techniqueChipClass(isPrimary ? "primary" : "selected", "xs");

                              return (
                                <button
                                  type="button"
                                  key={t}
                                  className={cls}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setTechniqueFilter(t);
                                  }}
                                >
                                  {t}
                                </button>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </li>
                  );
                })}
              </ul>

              {displayRows.length === 0 && !err && <p className="mt-6 text-gray-600">No rods match your filters.</p>}
            </>
          );
        }}
      </RodsListClient>
    </main>
  );
}
