# Writes /login page and upgrades /rods page (FGS)
Set-Location "C:\Users\lsphi\OneDrive\AI_Workspace\FGS\fgs-app"

New-Item -ItemType Directory -Path "src\app\login" -Force | Out-Null

@"
'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function sendLink() {
    setLoading(true)
    setMsg(null)

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/rods` },
    })

    setLoading(false)
    if (error) setMsg(error.message)
    else setMsg('Check your email for the sign-in link.')
  }

  return (
    <main className="p-6 max-w-md">
      <h1 className="text-2xl font-bold">Sign in</h1>
      <p className="mt-2 text-gray-600">We’ll email you a magic link.</p>

      <label className="block mt-6 text-sm font-medium">Email</label>
      <input
        className="mt-1 w-full border rounded px-3 py-2"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
      />

      <button
        className="mt-4 px-4 py-2 rounded bg-black text-white disabled:opacity-50"
        onClick={sendLink}
        disabled={!email || loading}
      >
        {loading ? 'Sending…' : 'Send magic link'}
      </button>

      {msg && <p className="mt-4 text-sm">{msg}</p>}
    </main>
  )
}
"@ | Out-File "src\app\login\page.tsx" -Encoding utf8

@"
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type GearItem = { id: string; name: string; status: string; created_at: string }

export default function RodLockerPage() {
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [rows, setRows] = useState<GearItem[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    setErr(null)

    const { data: auth } = await supabase.auth.getUser()
    const user = auth.user

    if (!user) {
      setUserEmail(null)
      setRows([])
      setLoading(false)
      return
    }

    setUserEmail(user.email ?? null)

    const { data, error } = await supabase
      .from('gear_items')
      .select('id,name,status,created_at')
      .eq('gear_type', 'rod')
      .order('created_at', { ascending: false })

    if (error) setErr(error.message)
    setRows(data ?? [])
    setLoading(false)
  }

  async function addTestRod() {
    setErr(null)
    const { data: auth } = await supabase.auth.getUser()
    const user = auth.user
    if (!user) return setErr('Not signed in.')

    const { error } = await supabase.from('gear_items').insert({
      owner_id: user.id,
      gear_type: 'rod',
      status: 'owned',
      name: `Test Rod ${new Date().toISOString().slice(11, 19)}`,
      saltwater_ok: false,
    })

    if (error) setErr(error.message)
    await load()
  }

  async function signOut() {
    await supabase.auth.signOut()
    await load()
  }

  useEffect(() => {
    load()
    const { data: sub } = supabase.auth.onAuthStateChange(() => load())
    return () => sub.subscription.unsubscribe()
  }, [])

  if (loading) return <main className="p-6">Loading…</main>

  if (!userEmail) {
    return (
      <main className="p-6">
        <h1 className="text-2xl font-bold">Rod Locker</h1>
        <p className="mt-2 text-gray-600">You need to sign in first.</p>
        <Link className="inline-block mt-4 underline" href="/login">Go to login</Link>
      </main>
    )
  }

  return (
    <main className="p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Rod Locker</h1>
          <p className="text-sm text-gray-600">Signed in as {userEmail}</p>
        </div>
        <button className="px-3 py-2 rounded border" onClick={signOut}>Sign out</button>
      </div>

      <div className="mt-6 flex gap-3">
        <button className="px-4 py-2 rounded bg-black text-white" onClick={addTestRod}>Add Test Rod</button>
        <button className="px-4 py-2 rounded border" onClick={load}>Refresh</button>
      </div>

      {err && <p className="mt-4 text-sm text-red-600">{err}</p>}

      <ul className="mt-6 space-y-2">
        {rows.map((r) => (
          <li key={r.id} className="border rounded p-3">
            <div className="font-medium">{r.name}</div>
            <div className="text-sm text-gray-600">{r.status}</div>
          </li>
        ))}
      </ul>

      {rows.length === 0 && <p className="mt-6 text-gray-600">No rods yet. Add one.</p>}
    </main>
  )
}
"@ | Out-File "src\app\rods\page.tsx" -Encoding utf8

Write-Host "✅ Wrote /login + upgraded /rods" -ForegroundColor Green
