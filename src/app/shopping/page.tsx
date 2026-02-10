"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { SectionHeader } from "@/components/SectionHeader";

type AnyRow = Record<string, unknown>;

type RestockRow = {
  id: string;
  name: string;
  item_type: "single" | "bulk" | string;
  quantity: number;
  low_threshold_effective: number;
  shop_threshold_effective: number;
  auto_shop_enabled: boolean;
  force_on_shopping_list: boolean;
  status: "GREEN" | "YELLOW" | "SHOPPING" | string;
  created_at?: string;
};

function formatBrandModel(brand: unknown, model: unknown): string | null {
  const b = String(brand ?? "").trim();
  const m = String(model ?? "").trim();
  if (b && m) return `${b} • ${m}`;
  if (b) return b;
  if (m) return m;
  return null;
}

function toText(v: unknown) {
  const s = String(v ?? "").trim();
  return s ? s : "—";
}

function gearTypeLabel(t: string) {
  const x = t.trim().toLowerCase();
  if (x === "rod") return "Rods";
  if (x === "reel") return "Reels";
  if (x === "lure") return "Lures";
  return x ? x.charAt(0).toUpperCase() + x.slice(1) : "Other";
}

function itemTypeLabel(t: string) {
  const x = t.trim().toLowerCase();
  if (x === "single") return "Single";
  if (x === "bulk") return "Bulk";
  return x ? x.charAt(0).toUpperCase() + x.slice(1) : "Other";
}

function detailHref(r: AnyRow): string | null {
  const id = String(r.id ?? "").trim();
  const gt = String(r.gear_type ?? "").trim().toLowerCase();
  if (!id) return null;

  if (gt === "rod") return `/rods/${id}`;
  if (gt === "reel") return `/reels/${id}`;

  // Lures are currently type-first static pages (not DB items), so no detail route yet.
  return null;
}

export default function ShoppingPage() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [restock, setRestock] = useState<RestockRow[]>([]);
  const [wishlist, setWishlist] = useState<AnyRow[]>([]);

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

        // 1) Restock (computed): inventory variants that are SHOPPING
        // NOTE: inventory_variants currently has no owner_id; if/when we add RLS/owner scoping,
        // this query will be updated to filter to the signed-in user.
        const restockRes = await supabase
          .from("inventory_variant_status_v")
          .select(
            "id,name,item_type,quantity,low_threshold_effective,shop_threshold_effective,auto_shop_enabled,force_on_shopping_list,status,created_at"
          )
          .eq("status", "SHOPPING")
          .order("created_at", { ascending: false });

        if (restockRes.error) throw restockRes.error;

        // 2) Wishlist (existing): gear_items set to wishlist
        const wishlistRes = await supabase
          .from("gear_items")
          .select("id,gear_type,name,brand,model,status,created_at")
          .eq("owner_id", user.id)
          .eq("status", "wishlist")
          .order("created_at", { ascending: false });

        if (wishlistRes.error) throw wishlistRes.error;

        if (!cancelled) {
          setRestock(((restockRes.data ?? []) as unknown as RestockRow[]) ?? []);
          setWishlist((wishlistRes.data ?? []) as AnyRow[]);
        }
      } catch (e: unknown) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Failed to load shopping list.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const wishlistGrouped = useMemo(() => {
    const map = new Map<string, AnyRow[]>();
    for (const it of wishlist) {
      const gt = String(it.gear_type ?? "").trim().toLowerCase() || "other";
      if (!map.has(gt)) map.set(gt, []);
      map.get(gt)!.push(it);
    }

    // Friendly order
    const order = ["rod", "reel", "lure", "other"];
    const keys = Array.from(map.keys()).sort((a, b) => {
      const ai = order.indexOf(a);
      const bi = order.indexOf(b);
      if (ai === -1 && bi === -1) return a.localeCompare(b);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });

    return { map, keys };
  }, [wishlist]);

  const restockGrouped = useMemo(() => {
    const map = new Map<string, RestockRow[]>();
    for (const it of restock) {
      const k = String(it.item_type ?? "").trim().toLowerCase() || "other";
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(it);
    }

    const order = ["bulk", "single", "other"];
    const keys = Array.from(map.keys()).sort((a, b) => {
      const ai = order.indexOf(a);
      const bi = order.indexOf(b);
      if (ai === -1 && bi === -1) return a.localeCompare(b);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });

    return { map, keys };
  }, [restock]);

  if (loading) return <main className="p-6">Loading…</main>;

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-6">
      <SectionHeader
        title="Shopping"
        subtitle="Auto-built from Restock rules + your Wishlist items."
        navLinks={[
          { href: "/rods", label: "Rods" },
          { href: "/reels", label: "Reels" },
          { href: "/combos", label: "Combos" },
          { href: "/lures", label: "Lures" },
          { href: "/manufacturers", label: "Manufacturers" },
        ]}
      />

      {err ? <div className="border rounded p-3 bg-red-50 text-red-800">{err}</div> : null}

      {/* Restock */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">Restock</h2>
          <div className="text-xs text-gray-500">{restock.length} item{restock.length === 1 ? "" : "s"}</div>
        </div>

        {restock.length === 0 ? (
          <div className="border rounded p-4 bg-white text-sm text-gray-700">
            Nothing needs restocking right now.
          </div>
        ) : (
          <div className="space-y-6">
            {restockGrouped.keys.map((k) => {
              const list = restockGrouped.map.get(k) ?? [];
              return (
                <section key={k} className="space-y-3">
                  <div className="flex items-baseline justify-between">
                    <h3 className="text-base font-semibold">{itemTypeLabel(k)}</h3>
                    <div className="text-xs text-gray-500">{list.length} item{list.length === 1 ? "" : "s"}</div>
                  </div>

                  <div className="grid gap-3">
                    {list.map((r) => {
                      const id = String(r.id ?? "");
                      const name = String(r.name ?? "").trim() || "Item";

                      return (
                        <div key={id} className="border rounded p-4 bg-white">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="font-medium truncate">{name}</div>
                              <div className="text-sm text-gray-600 truncate">
                                Qty: <span className="font-medium">{toText(r.quantity)}</span>{" "}
                                <span className="text-gray-400">•</span>{" "}
                                Low: {toText(r.low_threshold_effective)}{" "}
                                <span className="text-gray-400">•</span>{" "}
                                Shop: {toText(r.shop_threshold_effective)}
                              </div>
                              <div className="text-xs text-gray-500 mt-1">
                                Auto: {r.auto_shop_enabled ? "On" : "Off"}{" "}
                                <span className="text-gray-400">•</span>{" "}
                                Manual: {r.force_on_shopping_list ? "Forced" : "Normal"}
                              </div>
                            </div>

                            <span className="text-xs px-2 py-0.5 rounded bg-amber-600 text-white border border-amber-700">
                              Shopping
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </section>

      {/* Wishlist */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">Wishlist</h2>
          <div className="text-xs text-gray-500">{wishlist.length} item{wishlist.length === 1 ? "" : "s"}</div>
        </div>

        {wishlist.length === 0 ? (
          <div className="border rounded p-4 bg-white text-sm text-gray-700">
            Nothing on the Wishlist yet — mark items as <span className="font-medium">Wishlist</span>, and they’ll appear here.
          </div>
        ) : (
          <div className="space-y-6">
            {wishlistGrouped.keys.map((k) => {
              const list = wishlistGrouped.map.get(k) ?? [];
              return (
                <section key={k} className="space-y-3">
                  <div className="flex items-baseline justify-between">
                    <h3 className="text-base font-semibold">{gearTypeLabel(k)}</h3>
                    <div className="text-xs text-gray-500">{list.length} item{list.length === 1 ? "" : "s"}</div>
                  </div>

                  <div className="grid gap-3">
                    {list.map((r) => {
                      const id = String(r.id ?? "");
                      const name = String(r.name ?? "").trim() || "Item";
                      const bm = formatBrandModel(r.brand, r.model);
                      const href = detailHref(r);

                      const card = (
                        <div className="border rounded p-4 bg-white hover:bg-gray-50">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="font-medium truncate">{name}</div>
                              {bm ? <div className="text-sm text-gray-600 truncate">{bm}</div> : null}
                              <div className="text-xs text-gray-500 mt-1">Status: {toText(r.status)}</div>
                            </div>

                            <span className="text-xs px-2 py-0.5 rounded bg-purple-600 text-white border border-purple-700">
                              Wishlist
                            </span>
                          </div>
                        </div>
                      );

                      return href ? (
                        <Link key={id} href={href} className="block">
                          {card}
                        </Link>
                      ) : (
                        <div key={id}>{card}</div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </section>

      <div className="border rounded p-4 bg-white text-sm text-gray-700">
        Next: add a simple Inventory page to edit quantities + manual restock toggles (and later tie inventory variants to catalog/lures).
      </div>
    </main>
  );
}
