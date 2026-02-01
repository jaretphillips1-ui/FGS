'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

type AnyRecord = Record<string, any>;

function isEditableKey(k: string) {
  const blocked = new Set([
    'id',
    'created_at',
    'updated_at',
    'user_id',
    'owner_id',
    'deleted_at',
  ]);
  if (blocked.has(k)) return false;
  if (k.startsWith('_')) return false;
  return true;
}

function coerceInputValue(value: any): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function parseForUpdate(original: any, nextStr: string): any {
  if (nextStr === '') return null;

  if (typeof original === 'number') {
    const n = Number(nextStr);
    return Number.isFinite(n) ? n : original;
  }

  if (typeof original === 'boolean') {
    const s = nextStr.toLowerCase().trim();
    if (s === 'true' || s === '1' || s === 'yes') return true;
    if (s === 'false' || s === '0' || s === 'no') return false;
    return original;
  }

  if (typeof original === 'object' && original !== null) {
    try {
      return JSON.parse(nextStr);
    } catch {
      return original;
    }
  }

  return nextStr;
}

export default function RodDetailClient({ id }: { id: string }) {
  const router = useRouter();

  // IMPORTANT: must match rods list table
  const TABLE = 'gear_items';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [original, setOriginal] = useState<AnyRecord | null>(null);
  const [draft, setDraft] = useState<AnyRecord>({});
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const editableKeys = useMemo(() => {
    if (!original) return [];
    return Object.keys(original).filter(isEditableKey).sort();
  }, [original]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setErr(null);
      setSavedMsg(null);

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.user) throw new Error('Auth session missing');

        const { data, error } = await supabase
          .from(TABLE)
          .select('*')
          .eq('id', id)
          .single();

        if (error) throw error;
        if (!data) throw new Error('Rod not found');

        if (!cancelled) {
          setOriginal(data as AnyRecord);
          setDraft(data as AnyRecord);
        }
      } catch (e: any) {
        if (!cancelled) setErr(e?.message ?? 'Failed to load rod');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (!id) {
      setErr('Missing id');
      setLoading(false);
      return;
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [id]);

  async function save() {
    if (!original) return;

    setSaving(true);
    setErr(null);
    setSavedMsg(null);

    try {
      const patch: AnyRecord = {};
      for (const k of editableKeys) {
        const before = original[k];
        const after = draft[k];

        const changed =
          typeof before === 'object'
            ? JSON.stringify(before) !== JSON.stringify(after)
            : before !== after;

        if (changed) patch[k] = after;
      }

      if (Object.keys(patch).length === 0) {
        setSavedMsg('No changes to save.');
        return;
      }

      const { error } = await supabase.from(TABLE).update(patch).eq('id', id);
      if (error) throw error;

      setOriginal({ ...original, ...patch });
      setSavedMsg('Saved.');
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to save');
    } finally {
      setSaving(false);
      setTimeout(() => setSavedMsg(null), 1500);
    }
  }

  function updateField(k: string, nextStr: string) {
    if (!original) return;
    setDraft((d) => ({
      ...d,
      [k]: parseForUpdate(original[k], nextStr),
    }));
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Rod</h1>
          <div className="text-sm text-gray-500 break-all">ID: {id}</div>
        </div>

        <div className="flex items-center gap-2">
          <button className="px-4 py-2 rounded border" onClick={() => router.push('/rods')}>
            Back
          </button>

          <button
            className="px-4 py-2 rounded bg-black text-white disabled:opacity-50"
            onClick={save}
            disabled={saving || loading || !original}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {loading && <div className="text-gray-600">Loading...</div>}
      {err && <div className="border rounded p-3 bg-red-50 text-red-800">{err}</div>}
      {savedMsg && <div className="border rounded p-3 bg-green-50 text-green-800">{savedMsg}</div>}

      {!loading && !err && !original && <div className="border rounded p-3">Not found.</div>}

      {!loading && original && (
        <div className="border rounded p-4 space-y-4">
          {editableKeys.length === 0 ? (
            <div className="text-gray-600">No editable fields detected.</div>
          ) : (
            <div className="grid gap-3">
              {editableKeys.map((k) => {
                const origVal = original[k];
                const current = draft[k];

                return (
                  <label key={k} className="grid gap-1">
                    <div className="text-sm font-medium">{k}</div>
                    <input
                      className="border rounded px-3 py-2"
                      value={coerceInputValue(current)}
                      onChange={(e) => updateField(k, e.target.value)}
                      placeholder={coerceInputValue(origVal)}
                    />
                  </label>
                );
              })}
            </div>
          )}
        </div>
      )}

      {!loading && original && (
        <details className="border rounded p-4">
          <summary className="cursor-pointer select-none">Debug: full row JSON</summary>
          <pre className="mt-3 text-xs overflow-auto">{JSON.stringify(original, null, 2)}</pre>
        </details>
      )}
    </div>
  );
}