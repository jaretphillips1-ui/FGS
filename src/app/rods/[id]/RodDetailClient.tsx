"use client"
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ROD_TECHNIQUES, normalizeTechniques } from "@/lib/rodTechniques";

type AnyRecord = Record<string, any>
const HIDE_KEYS = new Set(["rod_techniques", "techniques"]);

const TABLE = 'gear_items'

// Keys we never want to edit/save from the UI
const READONLY_KEYS = new Set([
  'id',
  'created_at',
  'updated_at',
  'owner_id',
  'gear_type',
])

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) =>
      setTimeout(() => rej(new Error(label + ' timed out after ' + ms + 'ms')), ms)
    ),
  ])
}

function isPlainObject(v: any) {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}

function deepEqual(a: any, b: any) {
  if (a === b) return true
  if (Array.isArray(a) && Array.isArray(b)) return JSON.stringify(a) === JSON.stringify(b)
  if (isPlainObject(a) && isPlainObject(b)) return JSON.stringify(a) === JSON.stringify(b)
  return false
}

function clampInt(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min
  return Math.max(min, Math.min(max, Math.trunc(n)))
}

function toTitle(s: string) {
  return s
    .replace(/^rod_/, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (m) => m.toUpperCase())
}

function pickFirstExistingKey(obj: AnyRecord | null, keys: string[]) {
  if (!obj) return null
  for (const k of keys) if (k in obj) return k
  return null
}

function formatFeetInches(totalInches: number | null) {
  if (totalInches == null || !Number.isFinite(totalInches)) return { ft: 0, inch: 0, total: null as number | null }
  const t = clampInt(totalInches, 0, 2000)
  const ft = Math.floor(t / 12)
  const inch = t % 12
  return { ft, inch, total: t }
}

export default function RodDetailClient({ id, initial }: { id: string; initial?: AnyRecord }) {
  const router = useRouter()

  const [techniques, setTechniques] = useState<string[]>([]);

  function toggleTechnique(name: string) {

    setTechniques((cur) => (cur.includes(name) ? cur.filter((x) => x !== name) : [...cur, name]));

  }


  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [err, setErr] = useState<string | null>(null)
  const [validationErr, setValidationErr] = useState<string | null>(null)
  const [savedMsg, setSavedMsg] = useState<string | null>(null)

  const [original, setOriginal] = useState<AnyRecord | null>(null)
  const [draft, setDraft] = useState<AnyRecord | null>(null)

  // Local-only length editor state (feet+inches) -> saved into total inches column
  const [lenFeet, setLenFeet] = useState(7)
  const [lenInches, setLenInches] = useState(0)

  const loadSeq = useRef(0)

  // If the server already provided the row, seed state and skip the initial client fetch.
  useEffect(() => {
    if (initial) return;
    if (!initial) return;
\n\ \ \ \ setOriginal\(initial\);
    setDraft(initial);

    const lk = pickFirstExistingKey(initial, ['rod_length_in', 'length_in']);
    if (lk) {
      const { ft, inch } = formatFeetInches(Number(initial[lk] ?? 0));
      setLenFeet(ft);
      setLenInches(inch);
    }

    setLoading(false);
  }, [initial]);

  // Detect which columns exist on this row (schema-safe mapping)
  const lengthKey = useMemo(() => pickFirstExistingKey(original, ['rod_length_in', 'length_in']), [original])
  const piecesKey = useMemo(() => pickFirstExistingKey(original, ['rod_pieces', 'pieces']), [original])
  const powerKey = useMemo(() => pickFirstExistingKey(original, ['rod_power', 'power']), [original])
  const actionKey = useMemo(() => pickFirstExistingKey(original, ['rod_action', 'action']), [original])
  const notesKey = useMemo(() => pickFirstExistingKey(original, ['rod_notes', 'notes']), [original])
  const storageKey = useMemo(() => pickFirstExistingKey(original, ['rod_storage_note', 'storage_note']), [original])

  const editableKeys = useMemo(() => {
    if (!original) return []
    return Object.keys(original)
      .filter((k) => !READONLY_KEYS.has(k))
      .sort()
  }, [original])

  const isDirty = useMemo(() => {
    if (!original || !draft) return false

    for (const k of editableKeys) {
      if (k === lengthKey) continue
      const before = original[k]
      const after = draft[k]
      if (!deepEqual(before, after)) return true
    }

    if (lengthKey) {
      const base = Number(original[lengthKey] ?? 0)
      const curTotal = clampInt(Number(lenFeet), 0, 12) * 12 + clampInt(Number(lenInches), 0, 11)
      if (clampInt(base, 0, 2000) !== curTotal) return true
    }

    return false
  }, [original, draft, editableKeys, lengthKey, lenFeet, lenInches])

  useEffect(() => {
    if (initial) return;
    const seq = ++loadSeq.current
    let cancelled = false

    async function load() {
      setLoading(true)
      setErr(null)

      try {
        const sessionRes = await withTimeout(supabase.auth.getSession(), 6000, 'auth.getSession()')
        const user = sessionRes.data.session?.user
        if (!user) {
          router.push('/login')
          return
        }

        const res = await withTimeout(
          supabase.from(TABLE).select('*').eq('id', id).single(),
          8000,
          'gear_items select'
        )

        if (res.error) throw res.error
        const row = res.data as AnyRecord

        if (row?.gear_type !== 'rod') setErr(`Warning: gear_type is "${String(row?.gear_type ?? '')}".`)

        if (!cancelled && seq === loadSeq.current) {
          setOriginal(row)
          setDraft(row)

          const lk = pickFirstExistingKey(row, ['rod_length_in', 'length_in'])
          if (lk) {
            const { ft, inch } = formatFeetInches(Number(row[lk] ?? 0))
            setLenFeet(ft)
            setLenInches(inch)
          }
        }
      } catch (e: any) {
        if (!cancelled && seq === loadSeq.current) setErr(e?.message ?? 'Failed to load rod.')
      } finally {
        if (!cancelled && seq === loadSeq.current) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [id])
  
  async function deleteRod() {
    if (!original) return

    const name = String(original.name ?? "").trim() || "this rod"
    const ok = window.confirm(`Delete ${name}? This cannot be undone.`)
    if (!ok) return

    setSaving(true)
    setErr(null)
    setValidationErr(null)
    setSavedMsg(null)

    try {
      const sessionRes = await withTimeout(supabase.auth.getSession(), 6000, "auth.getSession()")
      const user = sessionRes.data.session?.user
      if (!user) {
        router.push("/login")
        return
      }

      const res = await withTimeout(
        supabase.from(TABLE).delete().eq("id", id),
        8000,
        "gear_items delete"
      )
      if (res.error) throw res.error

      router.push("/rods")
      router.refresh()
    } catch (e: any) {
      setErr(e?.message ?? "Failed to delete.")
    } finally {
      setSaving(false)
    }
  }

  async function save() {
    if (!original || !draft) return

    setSaving(true)
    setErr(null)
    setValidationErr(null)
    setSavedMsg(null)

    const trimmedName = String(draft.name ?? '').trim()
    if (!trimmedName) {
      setSaving(false)
      setValidationErr('Name is required.')
      return
    }

    try {
      const patch: AnyRecord = {}

      if (String(original.name ?? '') !== trimmedName) patch.name = trimmedName

      for (const k of editableKeys) {
        if (k === 'name') continue
        if (k === lengthKey) continue
        const before = original[k]
        const after = draft[k]
        if (!deepEqual(before, after)) patch[k] = after
      }

      if (lengthKey) {
        const curTotal = clampInt(Number(lenFeet), 0, 12) * 12 + clampInt(Number(lenInches), 0, 11)
        const base = clampInt(Number(original[lengthKey] ?? 0), 0, 2000)
        if (curTotal !== base) patch[lengthKey] = curTotal
      }

      if (Object.keys(patch).length === 0) {
        setSavedMsg('No changes to save.')
        return
      }

      const res = await withTimeout(
        supabase.from(TABLE).update(patch).eq('id', id),
        8000,
        'gear_items update'
      )
      if (res.error) throw res.error

      const next = { ...original, ...patch }
      setOriginal(next)
      setDraft(next)

      setSavedMsg('Saved.')
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to save.')
    } finally {
      setSaving(false)
      setTimeout(() => setSavedMsg(null), 1500)
    }
  }

  if (loading) return <main className="p-6">Loading…</main>
  if (!draft || !original) return <main className="p-6">Not found.</main>

  const title = (String(draft.name ?? '').trim() || 'Rod') as string

  const renderedKeys = new Set<string>([
    'name',
    'status',
    'saltwater_ok',
    lengthKey ?? '',
    piecesKey ?? '',
    powerKey ?? '',
    actionKey ?? '',
    notesKey ?? '',
    storageKey ?? '',
  ].filter(Boolean))

  const otherKeys = editableKeys.filter((k) => !renderedKeys.has(k))

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{title}</h1>
          <div className="text-sm text-gray-500 break-all">ID: {id}</div>
        </div>

        <div className="flex items-center gap-2">
          <button className="px-4 py-2 rounded border" onClick={() => router.push('/rods')}>
            Back
          </button>
          <button
            className="px-4 py-2 rounded border border-red-300 text-red-700 disabled:opacity-50"
            onClick={deleteRod}
            disabled={saving}
            title="Delete this rod"
          >
            Delete
          </button>

          <button
            className="px-4 py-2 rounded bg-black text-white disabled:opacity-50"
            onClick={save}
            disabled={saving || !isDirty}
            title={!isDirty ? 'No changes' : 'Save changes'}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {err && <div className="border rounded p-3 bg-red-50 text-red-800">{err}</div>}
      {validationErr && <div className="border rounded p-3 bg-red-50 text-red-800">{validationErr}</div>}
      {savedMsg && <div className="border rounded p-3 bg-green-50 text-green-800">{savedMsg}</div>}

      <section className="border rounded p-4 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700">Basics</h2>

        <label className="grid gap-1">
          <div className="text-sm font-medium">Name</div>
          <input
            className="border rounded px-3 py-2"
            value={String(draft.name ?? '')}
            onChange={(e) => setDraft((d) => ({ ...(d ?? {}), name: e.target.value }))}
          />
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {'status' in draft && (
            <label className="grid gap-1">
              <div className="text-sm font-medium">Status</div>
              <select
                className="border rounded px-3 py-2"
                value={String(draft.status ?? '')}
                onChange={(e) => setDraft((d) => ({ ...(d ?? {}), status: e.target.value }))}
              >
                <option value="owned">owned</option>
                <option value="planned">planned</option>
                <option value="retired">retired</option>
                <option value="sold">sold</option>
              </select>
            </label>
          )}

          {'saltwater_ok' in draft && (
            <label className="flex items-center gap-3 border rounded px-3 py-2">
              <input
                type="checkbox"
                checked={!!draft.saltwater_ok}
                onChange={(e) => setDraft((d) => ({ ...(d ?? {}), saltwater_ok: e.target.checked }))}
              />
              <span className="text-sm font-medium">Saltwater OK</span>
            </label>
          )}
        </div>
      </section>

      <section className="border rounded p-4 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700">Rod Specs</h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="grid gap-1">
            <div className="text-sm font-medium">Length (ft)</div>
            <input
              className="border rounded px-3 py-2"
              type="number"
              min={0}
              max={12}
              value={lenFeet}
              onChange={(e) => setLenFeet(Number(e.target.value))}
              disabled={!lengthKey}
            />
            {!lengthKey && <div className="text-xs text-gray-500">Not saved (no length column)</div>}
          </label>

          <label className="grid gap-1">
            <div className="text-sm font-medium">Length (in)</div>
            <input
              className="border rounded px-3 py-2"
              type="number"
              min={0}
              max={11}
              value={lenInches}
              onChange={(e) => setLenInches(Number(e.target.value))}
              disabled={!lengthKey}
            />
          </label>

          <div className="grid gap-1">
            <div className="text-sm font-medium">Preview</div>
            <div className="border rounded px-3 py-2 text-sm text-gray-700">
              {clampInt(Number(lenFeet), 0, 12)}&apos; {clampInt(Number(lenInches), 0, 11)}&quot;
              {lengthKey ? '' : <span className="text-gray-500"> — not saved</span>}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="grid gap-1">
            <div className="text-sm font-medium">Pieces</div>
            <input
              className="border rounded px-3 py-2"
              type="number"
              min={1}
              max={10}
              value={piecesKey ? Number(draft[piecesKey] ?? 1) : 1}
              onChange={(e) =>
                piecesKey && setDraft((d) => ({ ...(d ?? {}), [piecesKey]: clampInt(Number(e.target.value), 1, 10) }))
              }
              disabled={!piecesKey}
            />
            {!piecesKey && <div className="text-xs text-gray-500">Not saved (no pieces column)</div>}
          </label>

          <label className="grid gap-1">
            <div className="text-sm font-medium">Power</div>
            <input
              className="border rounded px-3 py-2"
              value={powerKey ? String(draft[powerKey] ?? '') : ''}
              onChange={(e) => powerKey && setDraft((d) => ({ ...(d ?? {}), [powerKey]: e.target.value }))}
              disabled={!powerKey}
              placeholder="e.g., MH"
            />
            {!powerKey && <div className="text-xs text-gray-500">Not saved (no power column)</div>}
          </label>

          <label className="grid gap-1">
            <div className="text-sm font-medium">Action</div>
            <input
              className="border rounded px-3 py-2"
              value={actionKey ? String(draft[actionKey] ?? '') : ''}
              onChange={(e) => actionKey && setDraft((d) => ({ ...(d ?? {}), [actionKey]: e.target.value }))}
              disabled={!actionKey}
              placeholder="e.g., Fast"
            />
            {!actionKey && <div className="text-xs text-gray-500">Not saved (no action column)</div>}
          </label>
        </div>
      </section>

      <section className="border rounded p-4 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700">Notes</h2>

        <label className="grid gap-1">

      <section className="border rounded p-4 space-y-3">

        <h2 className="text-sm font-semibold text-gray-700">Rod Techniques</h2>



        <div className="flex flex-wrap gap-2">

          {ROD_TECHNIQUES.map((t) => {

            const active = techniques.includes(t)

            return (

              <button

                key={t}

                type="button"

                onClick={() => toggleTechnique(t)}

                className={

                  "px-3 py-1 rounded border text-sm " +

                  (active ? "bg-black text-white border-black" : "bg-white text-black")

                }

                aria-pressed={active}

                disabled={saving}

              >

                {t}

              </button>

            )

          })}

        </div>



        <div className="text-xs text-gray-500">

          Selected: {techniques.length ? techniques.join(", ") : "none"}

        </div>

      </section>

          <div className="text-sm font-medium">Notes</div>
          <textarea
            className="border rounded px-3 py-2 min-h-[90px]"
            value={notesKey ? String(draft[notesKey] ?? '') : ''}
            onChange={(e) => notesKey && setDraft((d) => ({ ...(d ?? {}), [notesKey]: e.target.value }))}
            disabled={!notesKey}
          />
          {!notesKey && <div className="text-xs text-gray-500">Not saved (no notes column)</div>}
        </label>

        <label className="grid gap-1">
          <div className="text-sm font-medium">Storage note</div>
          <input
            className="border rounded px-3 py-2"
            value={storageKey ? String(draft[storageKey] ?? '') : ''}
            onChange={(e) => storageKey && setDraft((d) => ({ ...(d ?? {}), [storageKey]: e.target.value }))}
            disabled={!storageKey}
            placeholder="Where it lives (rack, locker, tube, etc.)"
          />
          {!storageKey && <div className="text-xs text-gray-500">Not saved (no storage column)</div>}
        </label>
      </section>

      {otherKeys.length > 0 && (
        <section className="border rounded p-4 space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">Other fields</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {otherKeys.map((k) => {
              const v = draft[k]
              const isBool = typeof v === 'boolean'
              const isNum = typeof v === 'number'

              return (
                <label key={k} className="grid gap-1">
                  <div className="text-sm font-medium">{toTitle(k)}</div>

                  {isBool ? (
                    <input
                      type="checkbox"
                      checked={!!v}
                      onChange={(e) => setDraft((d) => ({ ...(d ?? {}), [k]: e.target.checked }))}
                    />
                  ) : (
                    <input
                      className="border rounded px-3 py-2"
                      type={isNum ? 'number' : 'text'}
                      value={v == null ? '' : String(v)}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...(d ?? {}),
                          [k]: isNum ? Number(e.target.value) : e.target.value,
                        }))
                      }
                    />
                  )}
                </label>
              )
            })}
          </div>
        </section>
      )}

      <div className="text-xs text-gray-500">
        Save is enabled only when something changes. Updates write only changed columns that exist on this row.
      </div>
    </main>
  )
}






