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

    const redirectTo = window.location.origin + '/auth/callback?next=/rods'

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    })

    setLoading(false)
    if (error) setMsg(error.message)
    else setMsg('Check your email for the sign-in link.')
  }

  async function devSignIn() {
    setLoading(true)
    setMsg(null)

    const { error } = await supabase.auth.signInAnonymously()
    setLoading(false)

    if (error) setMsg(error.message)
    else window.location.href = '/rods'
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
      {process.env.NODE_ENV !== 'production' && (
        <button
          className="mt-3 px-4 py-2 rounded border"
          onClick={devSignIn}
          disabled={loading}
        >
          DEV: Continue without email
        </button>
      )}
      {msg && <p className="mt-4 text-sm">{msg}</p>}
</main>
  )
}


