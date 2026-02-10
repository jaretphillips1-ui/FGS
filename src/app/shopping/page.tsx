"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { SectionHeader } from "@/components/SectionHeader";

type AnyRow = Record<string, unknown>;

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
  const [items, setItems] = useState<AnyRow[]>([]);

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

        const { data, error } = await supabase
          .from("gear_items")
          .select("id,gear_type,name,brand,model,status,created_at")
          .eq("owner_id", user.id)
          .eq("status", "wishlist")
          .order("created_at", { ascending: false });

        if (error) throw error;

        if (!cancelled) setItems((data ?? []) as AnyRow[]);
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

  const grouped = useMemo(() => {
    const map = new Map<string, AnyRow[]>();
    for (const it of items) {
      const gt = String(it.gear_type ?? "").trim().toLowerCase() || "other";
      if (!map.has(gt)) map.set(gt, []);
      map.get(gt)!.push(it);
    }

    // Sort group keys in a friendly order
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
  }, [items]);

  if (loading) return <main className="p-6">Loading…</main>;

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-6">
      <SectionHeader
        title="Shopping"
        subtitle="Auto-built from your Wishlist items (low-inventory restock comes next)."
        navLinks={[
          { href: "/rods", label: "Rods" },
          { href: "/reels", label: "Reels" },
          { href: "/combos", label: "Combos" },
          { href: "/lures", label: "Lures" },
          { href: "/manufacturers", label: "Manufacturers" },
        ]}
      />

      {err ? <div className="border rounded p-3 bg-red-50 text-red-800">{err}</div> : null}

      {items.length === 0 ? (
        <div className="border rounded p-4 bg-white text-sm text-gray-700">
          Nothing on the Shopping list yet — add items as <span className="font-medium">Wishlist</span>, and they’ll appear here.
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.keys.map((k) => {
            const list = grouped.map.get(k) ?? [];
            return (
              <section key={k} className="space-y-3">
                <div className="flex items-baseline justify-between">
                  <h2 className="text-lg font-semibold">{gearTypeLabel(k)}</h2>
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

      <div className="border rounded p-4 bg-white text-sm text-gray-700">
        Next: add “Restock” rules (quantity thresholds) so consumables automatically show up here too.
      </div>
    </main>
  );
}
