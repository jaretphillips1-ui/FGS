import Link from "next/link";

type Tile = {
  title: string;
  href: string;
  desc: string;
  badge?: string;
};

function TileCard(t: Tile) {
  return (
    <Link
      href={t.href}
      className="block rounded-lg border bg-white p-4 hover:bg-gray-50 transition"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="font-semibold text-sm">{t.title}</div>
        {t.badge ? (
          <span className="text-[11px] px-2 py-0.5 rounded border bg-gray-100 text-gray-700">
            {t.badge}
          </span>
        ) : null}
      </div>
      <div className="text-xs text-gray-600 mt-1">{t.desc}</div>
      <div className="text-xs text-gray-500 mt-2">{t.href}</div>
    </Link>
  );
}

export default function TerminalHomePage() {
  const terminalTools: Tile[] = [
    { title: "Hooks", href: "/terminal/hooks", desc: "Terminal tool for hooks." },
    { title: "Jigheads", href: "/terminal/jigheads", desc: "Terminal tool for jigheads." },
    { title: "Weights", href: "/terminal/weights", desc: "Terminal tool for weights." },
    { title: "Swivels & Snaps", href: "/terminal/swivels-snaps", desc: "Terminal tool for swivels/snaps." },
  ];

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Terminal</h1>
          <div className="text-sm text-gray-500 mt-1">Quick utilities.</div>
        </div>

        <div className="flex items-center gap-2">
          <Link className="px-4 py-2 rounded border" href="/rods">
            Rods
          </Link>
          <Link className="px-4 py-2 rounded border" href="/reels">
            Reels
          </Link>
          <Link className="px-4 py-2 rounded border" href="/combos">
            Combos
          </Link>
        </div>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-gray-700">Terminal Tools</h2>
          <div className="text-xs text-gray-500">Quick utilities</div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {terminalTools
            .slice()
            .sort((a, b) => a.title.localeCompare(b.title))
            .map((t) => (
              <TileCard key={t.href} {...t} />
            ))}
        </div>
      </section>
    </main>
  );
}