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

// SOP: dropdown options Title Case + alphabetical
const CATEGORY_OPTIONS: { value: Category; label: string }[] = [
  { value: "graphs", label: "Graphs" },
  { value: "mounts", label: "Mounts" },
  { value: "power", label: "Power" },
  { value: "transducer", label: "Transducer" },
  { value: "wiring", label: "Wiring" },
];

const STATUS_OPTIONS: { value: Status; label: string }[] = [
  { value: "owned", label: "Owned" },
  { value: "wishlist", label: "Wishlist" },
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

// Basic URL detection (http/https) inside notes
const URL_RE = /\bhttps?:\/\/[^\s<>()]+/gi;

function safeUrl(raw: string): string {
  const s = String(raw ?? "").trim();
  return s;
}

function shortUrlLabel(raw: string): string {
  const s = safeUrl(raw);
  try {
    const u = new URL(s);
    const host = u.host.replace(/^www\./i, "");
    const path = (u.pathname ?? "") + (u.search ?? "");
    if (!path || path === "/") return host;
    const trimmed = path.length > 22 ? `${path.slice(0, 19)}…` : path;
    return `${host}${trimmed.startsWith("/") ? "" : "/"}${trimmed}`;
  } catch {
    // Fallback (should be rare)
    const noProto = s.replace(/^https?:\/\//i, "").replace(/^www\./i, "");
    if (noProto.length <= 28) return noProto;
    return `${noProto.slice(0, 24)}…`;
  }
}

function LinkifiedNotes({ text }: { text: string }) {
  // Preserve newlines and spacing while linkifying URLs
  const src = String(text ?? "");
  const parts: React.ReactNode[] = [];

  let last = 0;
  let match: RegExpExecArray | null;

  // Need a fresh regex instance because global regex keeps state
  const re = new RegExp(URL_RE.source, "gi");

  while ((match = re.exec(src)) !== null) {
    const start = match.index;
    const url = match[0];

    if (start > last) {
      parts.push(src.slice(last, start));
    }

    const href = safeUrl(url);
    const label = shortUrlLabel(href);

    parts.push(
      <a
        key={`u-${start}-${href}`}
        href={href}
        target="_blank"
        rel="noreferrer noopener"
        className="underline underline-offset-2 text-blue-700 hover:text-blue-900 break-all"
        title={href}
      >
        {label}
      </a>
    );

    last = start + url.length;
  }

  if (last < src.length) {
    parts.push(src.slice(last));
  }

  return <div className="whitespace-pre-wrap">{parts}</div>;
}

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-xl bg-white rounded-lg border shadow-lg">
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b">
          <div className="font-semibold">{title}</div>
          <button type="button" className="px-3 py-1 rounded border text-sm" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

function Card({
  item,
  canEdit,
  onEdit,
}: {
  item: ElectronicsItem;
  canEdit: boolean;
  onEdit?: () => void;
}) {
  return (
    <div className="border rounded p-4 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-medium">{item.name}</div>

        <div className="flex flex-wrap items-center gap-2">
          <CatPill c={item.category} />
          <StatusPill s={item.status} />

          {canEdit && onEdit ? (
            <button type="button" className="ml-1 px-3 py-1 rounded border text-sm" onClick={onEdit}>
              Edit
            </button>
          ) : null}
        </div>
      </div>

      {item.notes ? (
        <div className="text-sm text-gray-700 mt-2">
          <LinkifiedNotes text={item.notes} />
        </div>
      ) : null}
    </div>
  );
}

export default function Page() {
  const [loading, setLoading] = React.useState(true);
  const [importing, setImporting] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [rows, setRows] = React.useState<ElectronicsRow[] | null>(null);
  const [hasSession, setHasSession] = React.useState<boolean>(true);

  // modal mode: "add" | "edit"
  const [showModal, setShowModal] = React.useState(false);
  const [mode, setMode] = React.useState<"add" | "edit">("add");
  const [editId, setEditId] = React.useState<string | null>(null);

  // form state
  const [formName, setFormName] = React.useState("");
  const [formCategory, setFormCategory] = React.useState<Category>("graphs");
  const [formStatus, setFormStatus] = React.useState<Status>("wishlist");
  const [formNotes, setFormNotes] = React.useState("");
  const [formErr, setFormErr] = React.useState<string | null>(null);

  const resetForm = React.useCallback(() => {
    setFormName("");
    setFormCategory("graphs");
    setFormStatus("wishlist");
    setFormNotes("");
    setFormErr(null);
    setEditId(null);
    setMode("add");
  }, []);

  const openAdd = React.useCallback(() => {
    resetForm();
    setMode("add");
    setShowModal(true);
  }, [resetForm]);

  const openEdit = React.useCallback(
    (row: ElectronicsRow) => {
      setFormErr(null);
      setMode("edit");
      setEditId(row.id);
      setFormName(row.name ?? "");
      setFormCategory(row.category);
      setFormStatus(row.status);
      setFormNotes(row.notes ?? "");
      setShowModal(true);
    },
    []
  );

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
      .order("status", { ascending: true })
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

  const useSeedFallback = !loading && hasSession && !error && rows != null && rows.length === 0;

  const ownedRows = (rows ?? []).filter((r) => r.status === "owned");
  const wishlistRows = (rows ?? []).filter((r) => r.status === "wishlist");

  const ownedSeed = SEED_ELECTRONICS.filter((x) => x.status === "owned");
  const wishlistSeed = SEED_ELECTRONICS.filter((x) => x.status === "wishlist");

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

    const { data: existing, error: existingErr } = await supabase.from("electronics_items").select("id").limit(1);

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

  async function saveForm() {
    setFormErr(null);

    const name = formName.trim();
    if (!name) {
      setFormErr("Name is required.");
      return;
    }

    setSaving(true);
    setError(null);

    const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
    if (sessionErr) {
      setSaving(false);
      setError(sessionErr.message);
      return;
    }
    const user = sessionData.session?.user;
    if (!user) {
      setHasSession(false);
      setSaving(false);
      setError("You must be logged in.");
      return;
    }

    const payload = {
      name,
      category: formCategory,
      status: formStatus,
      notes: formNotes.trim() ? formNotes.trim() : null,
    };

    if (mode === "add") {
      const insPayload = { user_id: user.id, ...payload };
      const { error: insErr } = await supabase.from("electronics_items").insert([insPayload]);
      if (insErr) {
        setSaving(false);
        setError(insErr.message);
        return;
      }
    } else {
      const id = editId;
      if (!id) {
        setSaving(false);
        setError("Missing edit id.");
        return;
      }

      const { error: upErr } = await supabase.from("electronics_items").update(payload).eq("id", id);
      if (upErr) {
        setSaving(false);
        setError(upErr.message);
        return;
      }
    }

    setSaving(false);
    setShowModal(false);
    resetForm();
    await load();
  }

  const canAdd = hasSession && !loading && !error;

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-6">
      <header className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold">Electronics</h1>
            <p className="text-sm text-gray-600">
              DB-backed. If your database is empty, we show the seeded framework as a safe fallback.
            </p>
          </div>
          <button
            type="button"
            className={`px-4 py-2 rounded bg-black text-white ${canAdd ? "" : "opacity-50 cursor-not-allowed"}`}
            disabled={!canAdd}
            onClick={openAdd}
            title={!hasSession ? "Log in to add items" : undefined}
          >
            Add
          </button>
        </div>
      </header>

      {!hasSession ? (
        <div className="border rounded p-4 text-sm text-gray-700 bg-white">
          You’re not logged in. Go to <span className="font-medium">/login</span>, then come back here.
        </div>
      ) : null}

      {loading ? <div className="border rounded p-4 text-sm text-gray-700 bg-white">Loading electronics…</div> : null}

      {error ? (
        <div className="border rounded p-4 text-sm text-red-700 bg-white">
          <div className="font-medium">Error</div>
          <div className="mt-1 whitespace-pre-wrap">{error}</div>
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
        {useSeedFallback ? (
          ownedSeed.length === 0 ? (
            <div className="border rounded p-4 text-sm text-gray-700 bg-white">No owned electronics yet.</div>
          ) : (
            <div className="grid gap-3">
              {ownedSeed.map((x, i) => (
                <Card key={`o-seed-${i}`} item={x} canEdit={false} />
              ))}
            </div>
          )
        ) : ownedRows.length === 0 ? (
          <div className="border rounded p-4 text-sm text-gray-700 bg-white">No owned electronics yet.</div>
        ) : (
          <div className="grid gap-3">
            {ownedRows.map((r) => (
              <Card
                key={r.id}
                item={{ name: r.name, category: r.category, notes: r.notes ?? undefined, status: r.status }}
                canEdit={true}
                onEdit={() => openEdit(r)}
              />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Wishlist</h2>
        {useSeedFallback ? (
          wishlistSeed.length === 0 ? (
            <div className="border rounded p-4 text-sm text-gray-700 bg-white">Nothing on the wishlist yet.</div>
          ) : (
            <div className="grid gap-3">
              {wishlistSeed.map((x, i) => (
                <Card key={`w-seed-${i}`} item={x} canEdit={false} />
              ))}
            </div>
          )
        ) : wishlistRows.length === 0 ? (
          <div className="border rounded p-4 text-sm text-gray-700 bg-white">Nothing on the wishlist yet.</div>
        ) : (
          <div className="grid gap-3">
            {wishlistRows.map((r) => (
              <Card
                key={r.id}
                item={{ name: r.name, category: r.category, notes: r.notes ?? undefined, status: r.status }}
                canEdit={true}
                onEdit={() => openEdit(r)}
              />
            ))}
          </div>
        )}
      </section>

      <footer className="text-xs text-gray-500 pt-2">
        Rule reminder: UX uses only <span className="font-medium">Owned</span> and <span className="font-medium">Wishlist</span>.
      </footer>

      {showModal ? (
        <ModalShell
          title={mode === "add" ? "Add Electronics" : "Edit Electronics"}
          onClose={() => {
            if (!saving) setShowModal(false);
          }}
        >
          <div className="space-y-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium" htmlFor="name">
                Name
              </label>
              <input
                id="name"
                className="border rounded px-3 py-2 text-sm"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g., Garmin Echomap Ultra 2 106sv"
                autoFocus
              />
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium" htmlFor="category">
                Category
              </label>
              <select
                id="category"
                className="border rounded px-3 py-2 text-sm"
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value as Category)}
              >
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium" htmlFor="status">
                Status
              </label>
              <select
                id="status"
                className="border rounded px-3 py-2 text-sm"
                value={formStatus}
                onChange={(e) => setFormStatus(e.target.value as Status)}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium" htmlFor="notes">
                Notes (optional)
              </label>
              <textarea
                id="notes"
                className="border rounded px-3 py-2 text-sm min-h-[96px]"
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="Links, install notes, voltage/amp details, etc."
              />
            </div>

            {formErr ? <div className="text-sm text-red-700">{formErr}</div> : null}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button type="button" className="px-4 py-2 rounded border" onClick={() => setShowModal(false)} disabled={saving}>
                Cancel
              </button>
              <button
                type="button"
                className={`px-4 py-2 rounded bg-black text-white ${saving ? "opacity-60 cursor-not-allowed" : ""}`}
                onClick={() => void saveForm()}
                disabled={saving}
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </ModalShell>
      ) : null}
    </main>
  );
}
