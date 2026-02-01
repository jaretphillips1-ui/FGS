'use client'

import Link from 'next/link'

export default function NewRodPage() {
  return (
    <main style={{ padding: 16 }}>
      <h1>New Rod</h1>
      <p>Placeholder page. Next step: build the form + insert into gear_items & gear_item_techniques.</p>
      <p><Link href="/rods">← Back to Rods</Link></p>
    </main>
  )
}
