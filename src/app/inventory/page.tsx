"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { SectionHeader } from "@/components/SectionHeader";

type Status = "GREEN" | "YELLOW" | "SHOPPING" | string;

type InventoryRow = {
  id: string;
  name: string;
  item_type: "single" | "bulk" | string;
  quantity: number;
  low_threshold_effective: number;
  shop_threshold_effective: number;
  auto_shop_enabled: boolean;
  force_on_shopping_list: boolean;
  status: Status;
};

function StatusPill({ s }: { s: Status }) {
  const cls =
    s === "GREEN"
      ? "bg-emerald-100 text-emerald-900 border-emerald-200"
      : s === "YELLOW"
      ? "bg-amber-100 text-amber-900 border-amber-200"
      : "bg-orange-100 text-orange-900 border-orange-200";

  const label = s === "GREEN" ? "Green" : s === "YELLOW" ? "Low" : "Shopping";

  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs border rounded ${cls}`}>
      {label}
    </span>
  );
}

function ItemTypePill({ t }: { t: string }) {
  const label = t === "single" ? "Single" : t === "bulk" ? "Bulk" : t;
  return (
    <span className="inline-flex items-center px-2 py-0.5 text-xs border rounded bg-gray-50 text-gray-800 border-gray-200">
      {label}
    </span>
  );
}

export default function InventoryPage() {
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

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
          .from("inventory_variant_status_v")
          .select(
            "id,name,item_type,quantity,low_threshold_effective,shop_threshold_effective,auto_shop_enabled,force_on_shopping_list,status"
          )
          .order("name", { ascending: true });

        if (error) throw error;

        if (!cancelled) setRows((data ?? []) as InventoryRow[]);
      } catch (e: unknown) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Failed to load inventory.");
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
    const map = new Map<Status, InventoryRow[]>();
    for (const r of rows) {
      if (!map.has(r.status)) map.set(r.status, []);
      map.get(r.status)!.push(r);
    }

    const order: Status[] = ["SHOPPING", "YELLOW", "GREEN"];
    const keys = order.filter((k) => map.has(k));

    return { map, keys };
  }, [rows]);

  async function patchRow(id: string, patch: Partial<InventoryRow>) {
    const { error } = await supabase
      .from("inventory_variants")
      .update(patch)
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    const { data } = await supabase
      .from("inventory_variant_status_v")
      .select(
        "id,name,item_type,quantity,low_threshold_effective,shop_threshold_effective,auto_shop_enabled,force_on_shopping_list,status"
      )
      .order("name", { ascending: true });

    setRows((data ?? []) as InventoryRow[]);
  }

  if (loading) return <main className="p-6">Loading…</main>;

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-6">
      <SectionHeader
        title="Inventory"
        subtitle="Manage quantities and restock rules. Status is computed automatically."
        navLinks={[
          { href: "/shopping", label: "Shopping" },
          { href: "/toolbox", label: "Toolbox" },
        ]}
      />

      {err ? <div className="border rounded p-3 bg-red-50 text-red-800">{err}</div> : null}

      {grouped.keys.map((k) => {
        const list = grouped.map.get(k)!;
        return (
          <section key={k} className="space-y-3">
            <h2 className="text-lg font-semibold">
              {k === "GREEN" ? "Green" : k === "YELLOW" ? "Low" : "Shopping"}{" "}
              <span className="text-xs text-gray-500">({list.length})</span>
            </h2>

            <div className="grid gap-3">
              {list.map((r) => (
                <div key={r.id} className="border rounded p-4 bg-white space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-medium">{r.name}</div>
                    <div className="flex items-center gap-2">
                      <ItemTypePill t={r.item_type} />
                      <StatusPill s={r.status} />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-sm">
                    <label className="flex items-center gap-1">
                      Qty
                      <input
                        type="number"
                        className="w-20 border rounded px-2 py-1"
                        value={r.quantity}
                        onChange={(e) =>
                          patchRow(r.id, { quantity: Number(e.target.value) })
                        }
                      />
                    </label>

                    <div className="text-gray-600">
                      Low: {r.low_threshold_effective} • Shop: {r.shop_threshold_effective}
                    </div>

                    <label className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={r.auto_shop_enabled}
                        onChange={(e) =>
                          patchRow(r.id, { auto_shop_enabled: e.target.checked })
                        }
                      />
                      Auto
                    </label>

                    <label className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={r.force_on_shopping_list}
                        onChange={(e) =>
                          patchRow(r.id, { force_on_shopping_list: e.target.checked })
                        }
                      />
                      Force
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })}

      <div className="border rounded p-4 bg-white text-sm text-gray-700">
        Inventory drives <Link href="/shopping" className="underline">Shopping</Link>.  
        Green = healthy, Low = warning, Shopping = needs restock.
      </div>
    </main>
  );
}
