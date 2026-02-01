'use client'

import Link from 'next/link'

export default function RodDetailPage() {
  return (
    <main style={{ padding: 16 }}>
      <h1>Rod Detail</h1>
      <p>Placeholder page for /rods/[id]. Next step: load gear_items by id, show techniques, allow edits.</p>
      <p><Link href="/rods">← Back to Rods</Link></p>
    </main>
  )
}
