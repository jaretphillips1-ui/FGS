"use client";

import * as React from "react";
import { supabase } from "@/lib/supabase";

type Status = "owned" | "wishlist";
type Category = "graphs" | "transducer" | "mounts" | "power" | "wiring";

type ElectronicsItem = {
  name: string;
  category: Category;
  notes?: string;
  status: Status;
};

type ElectronicsRow = {
  id: string;
  name: string;
  category: Category;
  notes: string | null;
  status: Status;
  created_at: string;
};

const SEED_ELECTRONICS: ElectronicsItem[] = [
  { name: "Graph (main unit)", category: "graphs", notes: "Primary display unit (brand/model later).", status: "wishlist" },
  { name: "Transducer (2D/DI/SI)", category: "transducer", notes: "Seed entry to capture what’s on each hull/pole.", status: "wishlist" },
  { name: "Live sonar module / black box", category: "transducer", notes: "Seed entry for LiveScope / MEGA Live style systems.", status: "wishlist" },
  { name: "Pole mount (live sonar)", category: "mounts", notes: "Manual or quick-stow pole mount.", status: "wishlist" },
  { name: "Battery (LiFePO4)", category: "power", notes: "Capacity + voltage later (12V/24V builds).", status: "wishlist" },
  { name: "Fuse block / breaker", category: "power", notes: "Clean power distribution, safety, serviceability.", status: "wishlist" },
  { name: "Through-hull / quick disconnect", category: "wiring", notes: "Keeps wiring tidy + easy to remove electronics.", status: "wishlist" },

  // Owned (from our chat + your links)
  {
    name: "Humminbird MEGA 360 Imaging",
    category: "transducer",
    notes: "Owned. 360 transducer system. Link: https://humminbird.johnsonoutdoors.com/us/learn/imaging/mega-360-imaging",
    status: "owned",
  },
  {
    name: "Garmin Force Current (kayak trolling motor)",
    category: "power",
    notes: "Owned. Trolling motor. Link: https://www.garmin.com/en-CA/p/1059129/",
    status: "owned",
  },
  {
    name: "Garmin LiveScope Plus (bundle)",
    category: "transducer",
    notes: "Owned. LiveScope bundle link (Tackle Depot): https://www.tackledepot.ca/products/garmin-livescope-bundles?variant=41934585659459",
    status: "owned",
  },
];

function StatusPill({ s }: { s: Status }) {
  const cls =
    s === "owned"
      ? "bg-emerald-100 text-emerald-900 border-emerald-200"
      : "bg-amber-100 text-amber-900 border-amber-200";
  const label = s === "owned" ? "Owned" : "Wishlist";
  return <span className={`inline-flex items-center px-2 py-0.5 text-xs border rounded ${cls}`}>{label}</span>;
}

function CatPill({ c }: { c: Category }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 text-xs border rounded bg-gray-50 text-gray-800 border-gray-200">
      {c}
    </span>
  );
}

function Card({ item }: { item: ElectronicsItem }) {
  return (
    <div className="border rounded p-4 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-medium">{item.name}</div>
        <div className="flex items-center gap-2">
          <CatPill c={item.category} />
          <StatusPill s={item.status} />
        </div>
      </div>
      {item.notes ? <div className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">{item.notes}</div> : null}
    </div>
  );
}

export default function Page() {
  const [loading, setLoading] = React.useState(true);
  const [importing, setImporting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [rows, setRows] = React.useState<ElectronicsRow[] | null>(null);
  const [hasSession, setHasSession] = React.useState<boolean>(true);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
    if (sessionErr) {
      setHasSession(true);
      setRows(null);
      setError(sessionErr.message);
      setLoading(false);
      return;
    }

    const user = sessionData.session?.user;
    if (!user) {
      setHasSession(false);
      setRows(null);
      setLoading(false);
      return;
    }

    setHasSession(true);

    const { data, error: qErr } = await supabase
      .from("electronics_items")
      .select("id,name,category,notes,status,created_at")
      .order("status", { ascending: true }) // 'owned' / 'wishlist' ordering is enum-based; still OK
      .order("name", { ascending: true });

    if (qErr) {
      setRows(null);
      setError(qErr.message);
      setLoading(false);
      return;
    }

    setRows((data ?? []) as ElectronicsRow[]);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const itemsFromDb: ElectronicsItem[] =
    rows?.map((r) => ({
      name: r.name,
      category: r.category,
      notes: r.notes ?? undefined,
      status: r.status,
    })) ?? [];

  const useSeedFallback = !loading && hasSession && !error && rows != null && rows.length === 0;

  const displayItems: ElectronicsItem[] = useSeedFallback ? SEED_ELECTRONICS : itemsFromDb;

  const owned = displayItems.filter((x) => x.status === "owned");
  const wishlist = displayItems.filter((x) => x.status === "wishlist");

  async function importSeed() {
    setImporting(true);
    setError(null);

    const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
    if (sessionErr) {
      setError(sessionErr.message);
      setImporting(false);
      return;
    }
    const user = sessionData.session?.user;
    if (!user) {
      setHasSession(false);
      setError("You must be logged in to import.");
      setImporting(false);
      return;
    }

    // Only import if table is empty for this user (defensive).
    const { data: existing, error: existingErr } = await supabase
      .from("electronics_items")
      .select("id")
      .limit(1);

    if (existingErr) {
      setError(existingErr.message);
      setImporting(false);
      return;
    }
    if (existing && existing.length > 0) {
      setImporting(false);
      await load();
      return;
    }

    const payload = SEED_ELECTRONICS.map((x) => ({
      user_id: user.id,
      name: x.name,
      category: x.category,
      notes: x.notes ?? null,
      status: x.status,
    }));

    const { error: insErr } = await supabase.from("electronics_items").insert(payload);

    if (insErr) {
      setError(insErr.message);
      setImporting(false);
      return;
    }

    setImporting(false);
    await load();
  }

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Electronics</h1>
        <p className="text-sm text-gray-600">
          This page is now <span className="font-medium">DB-backed</span>. If your database is empty, we show the seeded framework as a safe fallback.
        </p>
      </header>

      {!hasSession ? (
        <div className="border rounded p-4 text-sm text-gray-700 bg-white">
          You’re not logged in. Go to <span className="font-medium">/login</span>, then come back here.
        </div>
      ) : null}

      {loading ? (
        <div className="border rounded p-4 text-sm text-gray-700 bg-white">Loading electronics…</div>
      ) : null}

      {error ? (
        <div className="border rounded p-4 text-sm text-red-700 bg-white">
          <div className="font-medium">Error</div>
          <div className="mt-1">{error}</div>
          <button type="button" className="mt-3 px-4 py-2 rounded bg-black text-white" onClick={() => void load()}>
            Retry
          </button>
        </div>
      ) : null}

      {useSeedFallback ? (
        <div className="border rounded p-4 text-sm text-gray-700 bg-white flex flex-col gap-3">
          <div>
            Your <span className="font-medium">electronics_items</span> table is empty for this account. You’re viewing the seeded framework.
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={`px-4 py-2 rounded bg-black text-white ${importing ? "opacity-60 cursor-not-allowed" : ""}`}
              disabled={importing}
              onClick={() => void importSeed()}
            >
              {importing ? "Importing…" : "Import seeded list to my account"}
            </button>
            <button type="button" className="px-4 py-2 rounded border" onClick={() => void load()}>
              Refresh
            </button>
          </div>
        </div>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Owned</h2>
        {(!loading && owned.length === 0) ? (
          <div className="border rounded p-4 text-sm text-gray-700 bg-white">
            No owned electronics yet.
          </div>
        ) : (
          <div className="grid gap-3">
            {owned.map((x, i) => (
              <Card key={`o-${i}`} item={x} />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Wishlist</h2>
          <button
            type="button"
            className="px-4 py-2 rounded bg-black text-white opacity-60 cursor-not-allowed"
            disabled
            title="Add/Edit/Delete comes next after read-only is stable"
          >
            Add (next)
          </button>
        </div>

        {(!loading && wishlist.length === 0) ? (
          <div className="border rounded p-4 text-sm text-gray-700 bg-white">
            Nothing on the wishlist yet.
          </div>
        ) : (
          <div className="grid gap-3">
            {wishlist.map((x, i) => (
              <Card key={`w-${i}`} item={x} />
            ))}
          </div>
        )}
      </section>

      <footer className="text-xs text-gray-500 pt-2">
        Rule reminder: UX uses only <span className="font-medium">Owned</span> and <span className="font-medium">Wishlist</span>.
      </footer>
    </main>
  );
}
