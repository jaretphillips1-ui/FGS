"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { SectionHeader } from "@/components/SectionHeader";

type IntakeStatus = "owned" | "wishlist";
type IntakeRow = {
  id: string;
  category: string;
  status: IntakeStatus;
  brand: string | null;
  model: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type IntakePhotoRow = {
  id: string;
  intake_id: string;
  storage_path: string;
  created_at: string;
};

const CATEGORIES = [
  "Hard Baits",
  "Soft Plastics",
  "Jigs",
  "Topwater",
  "Terminal",
  "Line",
  "Rod",
  "Reel",
  "Electronics",
  "Toolbox",
].slice().sort((a, b) => a.localeCompare(b));

function StatusPill({ s }: { s: IntakeStatus }) {
  const cls =
    s === "owned"
      ? "bg-emerald-100 text-emerald-900 border-emerald-200"
      : "bg-amber-100 text-amber-900 border-amber-200";
  const label = s === "owned" ? "Owned" : "Wishlist";
  return <span className={`inline-flex items-center px-2 py-0.5 text-xs border rounded ${cls}`}>{label}</span>;
}

export default function IntakePage() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [rows, setRows] = useState<IntakeRow[]>([]);
  const [photosByIntake, setPhotosByIntake] = useState<Map<string, IntakePhotoRow[]>>(new Map());

  const [category, setCategory] = useState<string>(CATEGORIES[0] ?? "Hard Baits");
  const [status, setStatus] = useState<IntakeStatus>("owned");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [notes, setNotes] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);

  const sortedRows = useMemo(() => {
    return rows.slice().sort((a, b) => (b.updated_at ?? "").localeCompare(a.updated_at ?? ""));
  }, [rows]);

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
        .from("gear_intake_items")
        .select("id,category,status,brand,model,notes,created_at,updated_at")
        .order("updated_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      const items = (data ?? []) as IntakeRow[];
      setRows(items);

      const ids = items.map((x) => x.id);
      if (ids.length === 0) {
        setPhotosByIntake(new Map());
        return;
      }

      const { data: pData, error: pErr } = await supabase
        .from("gear_intake_photos")
        .select("id,intake_id,storage_path,created_at")
        .in("intake_id", ids);

      if (pErr) throw pErr;

      const map = new Map<string, IntakePhotoRow[]>();
      for (const p of (pData ?? []) as IntakePhotoRow[]) {
        if (!map.has(p.intake_id)) map.set(p.intake_id, []);
        map.get(p.intake_id)!.push(p);
      }
      setPhotosByIntake(map);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to load intake.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function createIntake() {
    setSaving(true);
    setErr(null);

    try {
      const sessionRes = await supabase.auth.getSession();
      const user = sessionRes.data.session?.user;
      if (!user) {
        window.location.href = "/login";
        return;
      }

      const { data: created, error: insErr } = await supabase
        .from("gear_intake_items")
        .insert({
          owner_id: user.id,
          category,
          status,
          brand: brand.trim() ? brand.trim() : null,
          model: model.trim() ? model.trim() : null,
          notes: notes.trim() ? notes.trim() : null,
        })
        .select("id,category,status,brand,model,notes,created_at,updated_at")
        .single();

      if (insErr) throw insErr;
      const intake = created as IntakeRow;

      if (files.length > 0) {
        for (const f of files) {
          const safeName = f.name.replace(/[^\w.\-]+/g, "_");
          const objectPath = `private/${user.id}/${intake.id}/${Date.now()}_${safeName}`;

          const up = await supabase.storage.from("gear-photos").upload(objectPath, f, { upsert: false });
          if (up.error) throw up.error;

          const { error: pInsErr } = await supabase.from("gear_intake_photos").insert({
            intake_id: intake.id,
            owner_id: user.id,
            storage_path: objectPath,
          });
          if (pInsErr) throw pInsErr;
        }
      }

      setBrand("");
      setModel("");
      setNotes("");
      setFiles([]);

      await load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to create intake item.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteIntake(intakeId: string) {
    if (!confirm("Delete this intake item (and its photo rows)?")) return;

    try {
      const { error } = await supabase.from("gear_intake_items").delete().eq("id", intakeId);
      if (error) throw error;
      await load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Delete failed.");
    }
  }

  if (loading) return <main className="p-6">Loading…</main>;

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-6">
      <SectionHeader
        title="Intake"
        subtitle="Take photos, capture basic details, and build your real gear list. (Stage 1)"
        navLinks={[
          { href: "/shopping", label: "Shopping" },
          { href: "/inventory", label: "Inventory" },
          { href: "/lures", label: "Lures" },
        ]}
      />

      {err ? <div className="border rounded p-3 bg-red-50 text-red-800">{err}</div> : null}

      <section className="border rounded p-4 bg-white space-y-3">
        <div className="text-sm font-medium">New Intake Item</div>

        <div className="grid sm:grid-cols-2 gap-3">
          <label className="text-sm space-y-1">
            <div className="text-gray-700">Category</div>
            <select
              className="w-full border rounded px-2 py-1"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm space-y-1">
            <div className="text-gray-700">Status</div>
            <select
              className="w-full border rounded px-2 py-1"
              value={status}
              onChange={(e) => setStatus(e.target.value as IntakeStatus)}
            >
              <option value="owned">Owned</option>
              <option value="wishlist">Wishlist</option>
            </select>
          </label>

          <label className="text-sm space-y-1">
            <div className="text-gray-700">Brand</div>
            <input
              className="w-full border rounded px-2 py-1"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder="e.g., Rapala"
            />
          </label>

          <label className="text-sm space-y-1">
            <div className="text-gray-700">Model</div>
            <input
              className="w-full border rounded px-2 py-1"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="e.g., Shadow Rap"
            />
          </label>
        </div>

        <label className="text-sm space-y-1 block">
          <div className="text-gray-700">Notes</div>
          <textarea
            className="w-full border rounded px-2 py-1 min-h-20"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>

        <label className="text-sm space-y-1 block">
          <div className="text-gray-700">Photos (optional)</div>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          />
          {files.length > 0 ? <div className="text-xs text-gray-500">{files.length} selected</div> : null}
        </label>

        <button
          className="px-3 py-2 rounded border text-sm hover:bg-gray-50 disabled:opacity-50"
          onClick={createIntake}
          disabled={saving}
        >
          {saving ? "Saving…" : "Save Intake Item"}
        </button>
      </section>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">Inbox</h2>
          <div className="text-xs text-gray-500">{sortedRows.length}</div>
        </div>

        {sortedRows.length === 0 ? (
          <div className="border rounded p-4 text-sm text-gray-700 bg-white">No intake items yet.</div>
        ) : (
          <div className="grid gap-3">
            {sortedRows.map((r) => {
              const photos = photosByIntake.get(r.id) ?? [];
              const title = [r.brand, r.model].filter(Boolean).join(" — ") || "(No brand/model yet)";
              return (
                <div key={r.id} className="border rounded p-4 bg-white space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-medium">{title}</div>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center px-2 py-0.5 text-xs border rounded bg-gray-50 text-gray-800 border-gray-200">
                        {r.category}
                      </span>
                      <StatusPill s={r.status} />
                    </div>
                  </div>

                  {r.notes ? <div className="text-sm text-gray-700">{r.notes}</div> : null}

                  <div className="text-xs text-gray-500">
                    Photos: {photos.length} • Updated: {new Date(r.updated_at).toLocaleString()}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      className="px-2 py-1 rounded border text-xs hover:bg-gray-50"
                      onClick={() => deleteIntake(r.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <div className="border rounded p-4 bg-white text-sm text-gray-700">
        Goal: once Intake is solid, we promote items into real gear tables and we can delete the seeded/fake framework.
      </div>
    </main>
  );
}

