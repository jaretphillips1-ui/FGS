'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type AnyRecord = Record<string, any>

const TABLE = 'gear_items'

// First-pass technique set (safe defaults; easy to expand later)
const TECHNIQUES = [
  'Crankbait',
  'Spinnerbait',
  'Chatterbait',
  'Swimbait',
  'Jerkbait',
  'Topwater',
  'Frog',
  'Flipping/Pitching',
  'Texas Rig',
  'Jig',
  'Ned Rig',
  'Drop Shot',
  'Wacky',
  'Carolina Rig',
  'Tube',
  'Spoon',
] as const

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`${label} timed out after ${ms}ms`)), ms)),
  ])
}

function isEditableKey(k: string) {
  const blocked = new Set(['id', 'created_at', 'updated_at', 'user_id', 'owner_id', 'deleted_at'])
  if (blocked.has(k)) return false
  if (k.startsWith('_')) return false
  return true
}

function coerceInputValue(value: any): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number') return String(value)
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function parseForUpdate(original: any, nextStr: string): any {
  if (nextStr === '') return null

  if (typeof original === 'number') {
    const n = Number(nextStr)
    return Number.isFinite(n) ? n : original
  }

  if (typeof original === 'boolean') {
    const s = nextStr.toLowerCase().trim()
    if (s === 'true' || s === '1' || s === 'yes') return true
    if (s === 'false' || s === '0' || s === 'no') return false
    return original
  }

  if (typeof original === 'object' && original !== null) {
    try {
      return JSON.parse(nextStr)
    } catch {
      return original
    }
  }

  return nextStr
}

function normalizeStatus(s: any): 'owned' | 'planned' | 'retired' | 'sold' | string {
  if (typeof s !== 'string') return 'owned'
  return s
}

function ensureStringArray(v: any): string[] {
  if (Array.isArray(v)) return v.filter((x) => typeof x === 'string')
  if (typeof v === 'string') return v ? [v] : []
  return []
}

export default function RodDetailClient({ id }: { id: string }) {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [savedMsg, setSavedMsg] = useState<string | null>(null)
  const [validationErr, setValidationErr] = useState<string | null>(null)

  const [original, setOriginal] = useState<AnyRecord | null>(null)
  const [draft, setDraft] = useState<AnyRecord>({})

  const loadSeq = useRef(0)

  const editableKeys = useMemo(() => {
    if (!original) return []
    return Object.keys(original).filter(isEditableKey).sort()
  }, [original])

  // If either of these columns exist, we’ll store techniques in the DB.
  const techniquesKey = useMemo(() => {
    if (!original) return null
    if (editableKeys.includes('techniques')) return 'techniques'
    if (editableKeys.includes('techniques_json')) return 'techniques_json'
    return null
  }, [editableKeys, original])

  const selectedTechniques = useMemo(() => {
    if (!original) return []
    const key = techniquesKey
    if (!key) return ensureStringArray(draft.__local_techniques)
    return ensureStringArray(draft[key])
  }, [draft, original, techniquesKey])

  function setSelectedTechniques(next: string[]) {
    const key = techniquesKey
    if (key) {
      setDraft((d) => ({ ...d, [key]: next }))
    } else {
      // Local-only; won’t be saved to DB until we add a column/table
      setDraft((d) => ({ ...d, __local_techniques: next }))
    }
  }

  function toggleTechnique(label: string) {
    const set = new Set(selectedTechniques)
    if (set.has(label)) set.delete(label)
    else set.add(label)
    setSelectedTechniques(Array.from(set).sort())
  }

  useEffect(() => {
    if (!id) {
      setErr('Missing id')
      setLoading(false)
      return
    }

    const seq = ++loadSeq.current
    let cancelled = false

    async function load() {
      setLoading(true)
      setErr(null)
      setSavedMsg(null)

      try {
        const sessionRes = await withTimeout(supabase.auth.getSession(), 6000, 'auth.getSession()')
        const user = sessionRes.data.session?.user
        if (!user) throw new Error('Not signed in.')

        const queryRes = await withTimeout(
          supabase.from(TABLE).select('*').eq('id', id).single(),
          8000,
          'gear_items single()'
        )

        if (queryRes.error) throw queryRes.error
        if (!queryRes.data) throw new Error('Rod not found')

        if (!cancelled && seq === loadSeq.current) {
          setOriginal(queryRes.data as AnyRecord)
          setDraft(queryRes.data as AnyRecord)
        }
      } catch (e: any) {
        if (!cancelled) setErr(e?.message ?? 'Failed to load rod')
      } finally {
        if (!cancelled && seq === loadSeq.current) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [id])

  function setField(k: string, value: any) {
    setDraft((d) => ({ ...d, [k]: value }))
  }

  function updateFieldFromString(k: string, nextStr: string) {
    if (!original) return
    setDraft((d) => ({ ...d, [k]: parseForUpdate(original[k], nextStr) }))
  }

  async function save() {
    if (!original) return

    setSaving(true)
      setValidationErr(null)

      const trimmedName = String(draft.name ?? '').trim()
      if (!trimmedName) {
        setSaving(false)
        setValidationErr('Name is required.')
        return
      }
    setErr(null)
    setSavedMsg(null)

    try {
      const patch: AnyRecord = {}
    // Apply trimmed name (and only persist if it actually changed)
    if ((original?.name ?? '') !== trimmedName) patch.name = trimmedName


      // Only save editable keys (and only changed ones)
      for (const k of editableKeys) {
        // Don’t accidentally persist local-only techniques placeholder
        if (k === '__local_techniques') continue

        const before = original[k]
        const after = draft[k]

        const changed =
          typeof before === 'object'
            ? JSON.stringify(before) !== JSON.stringify(after)
            : before !== after

        if (changed) patch[k] = after
      }

      if (Object.keys(patch).length === 0) {
        setSavedMsg('No changes to save.')
        return
      }

      const res = await withTimeout(supabase.from(TABLE).update(patch).eq('id', id), 8000, 'gear_items update')
      // Keep in-memory state in sync with what we just saved
      setOriginal((o) => ({ ...(o ?? {}), ...patch }))
      if (res.error) throw res.error

      setOriginal({ ...original, ...patch })
      setSavedMsg('Saved.')
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to save')
    } finally {
      setSaving(false)
      setTimeout(() => setSavedMsg(null), 1500)
    }
  }

  // Friendly header name
  const title = useMemo(() => {
    const n = draft?.name
    if (typeof n === 'string' && n.trim()) return n.trim()
    return 'Rod'
  }, [draft])

  // “Other fields” = editable keys minus the basics we render explicitly.
  const otherKeys = useMemo(() => {
    const hidden = new Set(['name', 'status', 'saltwater_ok', techniquesKey ?? ''])
    return editableKeys.filter((k) => !hidden.has(k))
  }, [editableKeys, techniquesKey])

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
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
            className="px-4 py-2 rounded bg-black text-white disabled:opacity-50"
            onClick={save}
            disabled={saving || loading || !original || !isDirty}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {loading && <div className="text-gray-600">Loading…</div>}
      {err && <div className="border rounded p-3 bg-red-50 text-red-800">{err}</div>}
      {validationErr && <div className="border rounded p-3 bg-red-50 text-red-800">{validationErr}</div>}

      {savedMsg && <div className="border rounded p-3 bg-green-50 text-green-800">{savedMsg}</div>}

      {!loading && !err && original && (
        <>
          {/* BASICS */}
          <section className="border rounded p-4 space-y-4">
            <h2 className="text-sm font-semibold text-gray-700">Basics</h2>

            <label className="grid gap-1">
              <div className="text-sm font-medium">Name</div>
              <input
                className="border rounded px-3 py-2"
                value={coerceInputValue(draft.name)}
                onChange={(e) => setField('name', e.target.value)}
                placeholder="Rod name"
              />
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="grid gap-1">
                <div className="text-sm font-medium">Status</div>
                <select
                  className="border rounded px-3 py-2"
                  value={normalizeStatus(draft.status)}
                  onChange={(e) => setField('status', e.target.value)}
                >
                  <option value="owned">owned</option>
                  <option value="planned">planned</option>
                  <option value="retired">retired</option>
                  <option value="sold">sold</option>
                </select>
              </label>

              <label className="flex items-center gap-3 border rounded px-3 py-2">
                <input
                  type="checkbox"
                  checked={!!draft.saltwater_ok}
                  onChange={(e) => setField('saltwater_ok', e.target.checked)}
                />
                <span className="text-sm font-medium">Saltwater OK</span>
              </label>
            </div>
          </section>

          {/* TECHNIQUES */}
          <section className="border rounded p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-gray-700">Techniques</h2>
              {!techniquesKey && (
                <span className="text-xs text-gray-500">
                  (local only — add a DB column/table later)
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {TECHNIQUES.map((t) => {
                const active = selectedTechniques.includes(t)
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggleTechnique(t)}
                    className={
                      'px-3 py-1 rounded-full border text-sm ' +
                      (active ? 'bg-black text-white' : 'bg-white hover:bg-gray-50')
                    }
                  >
                    {t}
                  </button>
                )
              })}
            </div>

            <div className="text-xs text-gray-500">
              Selected: {selectedTechniques.length ? selectedTechniques.join(', ') : '—'}
            </div>
          </section>

          {/* OTHER FIELDS (fallback) */}
          {otherKeys.length > 0 && (
            <details className="border rounded p-4">
              <summary className="cursor-pointer select-none text-sm font-semibold text-gray-700">
                Other fields
              </summary>

              <div className="mt-4 grid gap-3">
                {otherKeys.map((k) => {
                  const origVal = original[k]
                  const current = draft[k]

                  return (
                    <label key={k} className="grid gap-1">
                      <div className="text-sm font-medium">{k}</div>
                      <input
                        className="border rounded px-3 py-2"
                        value={coerceInputValue(current)}
                        onChange={(e) => updateFieldFromString(k, e.target.value)}
                        placeholder={coerceInputValue(origVal)}
                      />
                    </label>
                  )
                })}
              </div>
            </details>
          )}

          {/* DEBUG */}
          <details className="border rounded p-4">
            <summary className="cursor-pointer select-none text-sm font-semibold text-gray-700">
              Debug: full row JSON
            </summary>
            <pre className="mt-3 text-xs overflow-auto">{JSON.stringify(original, null, 2)}</pre>
          </details>
        </>
      )}
    </div>
  )
}
