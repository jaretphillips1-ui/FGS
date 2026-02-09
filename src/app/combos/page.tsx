import Link from "next/link";

export default function CombosPage() {
  return (
    <main className="max-w-4xl mx-auto p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Combos</h1>
          <div className="text-sm text-gray-500">Coming soon</div>
        </div>

        <div className="flex items-center gap-2">
          <Link className="px-4 py-2 rounded border" href="/rods">
            Rods
          </Link>
          <Link className="px-4 py-2 rounded border" href="/reels">
            Reels
          </Link>
        </div>
      </div>

      <div className="border rounded p-4 text-sm text-gray-600">
        This page is a placeholder so we can wire up navigation. Next we’ll add:
        <ul className="list-disc pl-5 mt-2 space-y-1">
          <li>Combo list (rod + reel pairing)</li>
          <li>New Combo</li>
          <li>Filters (species/technique/status)</li>
        </ul>
      </div>
    </main>
  );
}
