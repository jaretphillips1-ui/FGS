"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type AnyRow = Record<string, unknown>;
type ComboRow = {
  id: string;
  rod_id: string;
  reel_id: string;
  name: string | null;
  created_at: string;
};

function normalizeStatus(v: unknown): "owned" | "wishlist" | "other" {
  const s = String(v ?? "").trim().toLowerCase();
  if (s === "owned") return "owned";
  if (s === "wishlist" || s === "wish list" || s === "wish" || s === "planned")
    return "wishlist"; // legacy accepted
  return "other";
}

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

function primaryName(r: AnyRow, fallback: string) {
  return String(r.name ?? "").trim() || fallback;
}

function secondaryName(r: AnyRow) {
  return formatBrandModel(r.brand, r.model);
}

function plural(n: number, one: string, many?: string) {
  return n === 1 ? one : many ?? `${one}s`;
}

function toSortText(v: unknown) {
  return String(v ?? "").trim().toLowerCase();
}

export default function CombosPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [rods, setRods] = useState<AnyRow[]>([]);
  const [reels, setReels] = useState<AnyRow[]>([]);
  const [combos, setCombos] = useState<ComboRow[]>([]);

  const [rodId, setRodId] = useState("");
  const [reelId, setReelId] = useState("");

  // Dropdown (build-a-combo) toggles
  const [includeWishlist, setIncludeWishlist] = useState(true);
  const [onlyAvailable, setOnlyAvailable] = useState(false);

  // Combo list filter
  const [comboFilter, setComboFilter] = useState<
    "all" | "active" | "wishlist"
  >("all");

  const [ownerId, setOwnerId] = useState<string>("");

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

        if (!cancelled) setOwnerId(user.id);

        const [rodRes, reelRes, comboRes] = await Promise.all([
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
          supabase
            .from("combos")
            .select("id,rod_id,reel_id,name,created_at")
            .eq("owner_id", user.id)
            .order("created_at", { ascending: false }),
        ]);

        if (rodRes.error) throw rodRes.error;
        if (reelRes.error) throw reelRes.error;
        if (comboRes.error) throw comboRes.error;

        if (!cancelled) {
          setRods((rodRes.data ?? []) as AnyRow[]);
          setReels((reelRes.data ?? []) as AnyRow[]);
          setCombos((comboRes.data ?? []) as ComboRow[]);
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setErr(e instanceof Error ? e.message : "Failed to load data.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const usedRodIds = useMemo(() => {
    const s = new Set<string>();
    for (const c of combos) s.add(String(c.rod_id));
    return s;
  }, [combos]);

  const usedReelIds = useMemo(() => {
    const s = new Set<string>();
    for (const c of combos) s.add(String(c.reel_id));
    return s;
  }, [combos]);

  const allowedRods = useMemo(() => {
    return rods.filter((r) => {
      const st = normalizeStatus(r.status);

      if (onlyAvailable) {
        // "Available" means: owned + not already used in any combo
        return st === "owned" && !usedRodIds.has(String(r.id ?? ""));
      }

      if (st === "owned") return true;
      if (includeWishlist && st === "wishlist") return true;
      return false;
    });
  }, [rods, includeWishlist, onlyAvailable, usedRodIds]);

  const allowedReels = useMemo(() => {
    return reels.filter((r) => {
      const st = normalizeStatus(r.status);

      if (onlyAvailable) {
        return st === "owned" && !usedReelIds.has(String(r.id ?? ""));
      }

      if (st === "owned") return true;
      if (includeWishlist && st === "wishlist") return true;
      return false;
    });
  }, [reels, includeWishlist, onlyAvailable, usedReelIds]);

  // keep selection valid if toggle filters hide current selection
  useEffect(() => {
    if (rodId && !allowedRods.some((r) => String(r.id) === rodId)) setRodId("");
    if (reelId && !allowedReels.some((r) => String(r.id) === reelId))
      setReelId("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includeWishlist, onlyAvailable, rods, reels, combos]);

  const selectedRod = useMemo(
    () => rods.find((r) => String(r.id) === rodId) ?? null,
    [rods, rodId]
  );
  const selectedReel = useMemo(
    () => reels.find((r) => String(r.id) === reelId) ?? null,
    [reels, reelId]
  );

  const preview =
    selectedRod || selectedReel
      ? `${selectedRod ? labelRow(selectedRod, "Rod") : "—"}  +  ${
          selectedReel ? labelRow(selectedReel, "Reel") : "—"
        }`
      : null;

  async function refreshCombos(currentOwnerId: string) {
    const { data, error } = await supabase
      .from("combos")
      .select("id,rod_id,reel_id,name,created_at")
      .eq("owner_id", currentOwnerId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    setCombos((data ?? []) as ComboRow[]);
  }

  async function saveCombo() {
    if (!rodId || !reelId) return;
    setSaving(true);
    setErr(null);

    const sessionRes = await supabase.auth.getSession();
    const user = sessionRes.data.session?.user;
    if (!user) {
      setErr("Not signed in.");
      setSaving(false);
      return;
    }

    const { error } = await supabase.from("combos").insert({
      owner_id: user.id,
      rod_id: rodId,
      reel_id: reelId,
    });

    if (error) {
      if ((error as any).code === "23505") {
        setErr("That rod + reel combo already exists.");
      } else {
        setErr(error.message);
      }
    } else {
      await refreshCombos(user.id);
      setRodId("");
      setReelId("");
    }

    setSaving(false);
  }

  async function deleteCombo(id: string) {
    if (!ownerId) return;

    const { error } = await supabase
      .from("combos")
      .delete()
      .eq("id", id)
      .eq("owner_id", ownerId);

    if (error) {
      setErr(error.message);
      return;
    }
    setCombos((c) => c.filter((x) => x.id !== id));
  }

  function comboParts(c: ComboRow) {
    const rod = rods.find((r) => String(r.id) === c.rod_id) ?? null;
    const reel = reels.find((r) => String(r.id) === c.reel_id) ?? null;

    const rodPrimary = rod ? primaryName(rod, "Rod") : "Rod";
    const reelPrimary = reel ? primaryName(reel, "Reel") : "Reel";

    const rodSecondary = rod ? secondaryName(rod) : null;
    const reelSecondary = reel ? secondaryName(reel) : null;

    const rodStatus = normalizeStatus(rod?.status);
    const reelStatus = normalizeStatus(reel?.status);

    const isWishlistCombo = rodStatus === "wishlist" || reelStatus === "wishlist";

    return {
      rodPrimary,
      reelPrimary,
      rodSecondary,
      reelSecondary,
      isWishlistCombo,
    };
  }

  const combosView = useMemo(() => {
    // classify + sort: Active first, Wishlist second, then alphabetical
    const enriched = combos.map((c) => {
      const parts = comboParts(c);
      return { c, ...parts };
    });

    const filtered = enriched.filter((x) => {
      if (comboFilter === "all") return true;
      if (comboFilter === "active") return !x.isWishlistCombo;
      if (comboFilter === "wishlist") return x.isWishlistCombo;
      return true;
    });

    filtered.sort((a, b) => {
      // Active first
      const ak = a.isWishlistCombo ? 1 : 0;
      const bk = b.isWishlistCombo ? 1 : 0;
      if (ak !== bk) return ak - bk;

      // Alphabetical by rod then reel
      const ar = toSortText(a.rodPrimary);
      const br = toSortText(b.rodPrimary);
      if (ar < br) return -1;
      if (ar > br) return 1;

      const ae = toSortText(a.reelPrimary);
      const be = toSortText(b.reelPrimary);
      if (ae < be) return -1;
      if (ae > be) return 1;

      return 0;
    });

    return filtered;
  }, [combos, rods, reels, comboFilter]);

  const counts = useMemo(() => {
    let active = 0;
    let wishlist = 0;
    for (const c of combos) {
      const { isWishlistCombo } = comboParts(c);
      if (isWishlistCombo) wishlist++;
      else active++;
    }
    return { active, wishlist };
  }, [combos, rods, reels]);

  if (loading) return <main className="p-6">Loading…</main>;

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Combos</h1>
          <div className="text-sm text-gray-500">
            {rods.length} {plural(rods.length, "rod")} • {reels.length}{" "}
            {plural(reels.length, "reel")} • {combos.length}{" "}
            {plural(combos.length, "combo")}
          </div>
        </div>

        <div className="flex gap-2">
          <Link className="px-4 py-2 rounded border" href="/rods">
            Rods
          </Link>
          <Link className="px-4 py-2 rounded border" href="/reels">
            Reels
          </Link>
        </div>
      </div>

      {err && (
        <div className="border rounded p-3 bg-red-50 text-red-800">{err}</div>
      )}

      <div className="border rounded p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={includeWishlist}
              onChange={(e) => setIncludeWishlist(e.target.checked)}
              disabled={onlyAvailable}
            />
            Include wishlist
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={onlyAvailable}
              onChange={(e) => setOnlyAvailable(e.target.checked)}
            />
            Only available (owned + not already in a combo)
          </label>

          <div className="text-gray-500">
            Showing: {allowedRods.length} {plural(allowedRods.length, "rod")} •{" "}
            {allowedReels.length} {plural(allowedReels.length, "reel")}
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          <select
            className="border rounded px-2 py-2 text-sm"
            value={rodId}
            onChange={(e) => setRodId(e.target.value)}
            aria-label="Select rod"
          >
            <option value="">— Select rod —</option>
            {allowedRods.map((r) => {
              const id = String(r.id ?? "");
              const used = usedRodIds.has(id);
              const st = normalizeStatus(r.status);
              const isWish = st === "wishlist";
              return (
                <option key={id} value={id}>
                  {labelRow(r, "Rod")}
                  {isWish ? " (wishlist)" : ""}
                  {used ? " (in combo)" : ""}
                </option>
              );
            })}
          </select>

          <select
            className="border rounded px-2 py-2 text-sm"
            value={reelId}
            onChange={(e) => setReelId(e.target.value)}
            aria-label="Select reel"
          >
            <option value="">— Select reel —</option>
            {allowedReels.map((r) => {
              const id = String(r.id ?? "");
              const used = usedReelIds.has(id);
              const st = normalizeStatus(r.status);
              const isWish = st === "wishlist";
              return (
                <option key={id} value={id}>
                  {labelRow(r, "Reel")}
                  {isWish ? " (wishlist)" : ""}
                  {used ? " (in combo)" : ""}
                </option>
              );
            })}
          </select>
        </div>

        {preview && (
          <div className="text-sm">
            <div className="text-gray-500">Preview</div>
            <div className="font-medium">{preview}</div>
          </div>
        )}

        <button
          disabled={!rodId || !reelId || saving}
          onClick={saveCombo}
          className="px-4 py-2 rounded bg-black text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save Combo"}
        </button>
      </div>

      <div className="border rounded p-4 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="font-medium">Active Combos</h2>
            <div className="text-xs text-gray-500 mt-1">
              Sorted: <span className="font-medium">Active</span> first, then{" "}
              <span className="font-medium">Wishlist</span>, then A→Z.
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setComboFilter("all")}
              className={`px-3 py-1.5 rounded border text-sm ${
                comboFilter === "all"
                  ? "bg-black text-white border-black"
                  : "bg-white"
              }`}
              title="Show all combos"
            >
              All ({combos.length})
            </button>
            <button
              type="button"
              onClick={() => setComboFilter("active")}
              className={`px-3 py-1.5 rounded border text-sm ${
                comboFilter === "active"
                  ? "bg-black text-white border-black"
                  : "bg-white"
              }`}
              title="Show active (owned) combos only"
            >
              Active ({counts.active})
            </button>
            <button
              type="button"
              onClick={() => setComboFilter("wishlist")}
              className={`px-3 py-1.5 rounded border text-sm ${
                comboFilter === "wishlist"
                  ? "bg-purple-600 text-white border-purple-700"
                  : "bg-white"
              }`}
              title="Show wishlist combos only"
            >
              Wishlist ({counts.wishlist})
            </button>
          </div>
        </div>

        {combos.length === 0 ? (
          <div className="text-sm text-gray-500">No combos yet.</div>
        ) : combosView.length === 0 ? (
          <div className="text-sm text-gray-500">No combos match that filter.</div>
        ) : (
          <div className="divide-y">
            {combosView.map((x) => {
              const c = x.c;
              const {
                rodPrimary,
                reelPrimary,
                rodSecondary,
                reelSecondary,
                isWishlistCombo,
              } = x;

              return (
                <div
                  key={c.id}
                  className="py-3 flex items-start justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="text-sm font-medium leading-5">
                        <span className="truncate">{rodPrimary}</span>
                        <span className="mx-2 font-extrabold text-gray-700">+</span>
                        <span className="truncate">{reelPrimary}</span>
                      </div>

                      {isWishlistCombo ? (
                        <span className="text-xs px-2 py-0.5 rounded bg-purple-600 text-white border border-purple-700">
                          Wishlist combo
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded bg-gray-900 text-white border border-gray-900">
                          Active
                        </span>
                      )}
                    </div>

                    {(rodSecondary || reelSecondary) && (
                      <div className="text-xs text-gray-500 mt-1 leading-4">
                        {rodSecondary ? (
                          <span className="mr-2">
                            <span className="text-gray-400">Rod:</span>{" "}
                            {rodSecondary}
                          </span>
                        ) : null}
                        {reelSecondary ? (
                          <span>
                            <span className="text-gray-400">Reel:</span>{" "}
                            {reelSecondary}
                          </span>
                        ) : null}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => deleteCombo(c.id)}
                    className="text-red-600 hover:underline text-sm whitespace-nowrap"
                    title="Delete combo"
                  >
                    Delete
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}