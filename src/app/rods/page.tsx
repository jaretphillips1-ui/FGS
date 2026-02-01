'use client'

import { useRouter } from 'next/navigation'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type GearItem = {
  id: string
  name: string
  status: string
  created_at: string
}

export default function RodLockerPage() {
  const router = useRouter();
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

    const suffix = new Date().toISOString().slice(11, 19)
    const rodName = 'Test Rod ' + suffix

    const { error } = await supabase.from('gear_items').insert({
      owner_id: user.id,
      gear_type: 'rod',
      status: 'owned',
      name: rodName,
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
        <Link className="inline-block mt-4 underline" href="/login">
          Go to login
        </Link>
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
        <button className="px-3 py-2 rounded border" onClick={signOut}>
          Sign out
        </button>
      </div>

      <div className="mt-6 flex gap-3">
        <button className="px-4 py-2 rounded bg-black text-white" onClick={addTestRod}>
          Add Test Rod
        </button>
        
        <button className="px-4 py-2 rounded border" onClick={() => router.push('/rods/new')}>
          New Rod
        </button><button className="px-4 py-2 rounded border" onClick={load}>
          Refresh
        </button>
      </div>

      {err && <p className="mt-4 text-sm text-red-600">{err}</p>}

      <ul className="mt-6 space-y-2">
        {rows.map((r) => (
          <li key={r.id} className="border rounded p-3 cursor-pointer hover:bg-gray-50" onClick={() => router.push(`/rods/${r.id}`)}>
            <div className="font-medium">{r.name}</div>
            <div className="text-sm text-gray-600">{r.status}</div>
          </li>
        ))}
      </ul>

      {rows.length === 0 && <p className="mt-6 text-gray-600">No rods yet. Add one.</p>}
    </main>
  )
}

