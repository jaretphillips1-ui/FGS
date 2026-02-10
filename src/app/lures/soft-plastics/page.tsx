const SOURCES = {
  zoom: "https://zoombait.com/",
  keitech: "https://www.keitechusa.com/",
  zman: "https://zmanfishing.com/",
  reaction: "https://www.reactioninnovations.com/",
  missileSpunkShad: "https://www.missilebaits.store/products/spunk-shad-3-0",
};

type Status = "owned" | "wishlist";
type Item = { brand: string; model: string; notes?: string; status: Status; sourceUrl?: string };

const ITEMS: Item[] = [
  { brand: "Missile Baits", model: "Spunk Shad 3.0", notes: "Seed from real product page.", status: "wishlist", sourceUrl: SOURCES.missileSpunkShad },
  { brand: "Zoom", model: "Fluke / Trick Worm families (anchor)", notes: "Pick exact baits/colors later.", status: "wishlist", sourceUrl: SOURCES.zoom },
  { brand: "Keitech", model: "Easy Shiner / Swing Impact families (anchor)", notes: "Swimbait/finesse staples.", status: "wishlist", sourceUrl: SOURCES.keitech },
  { brand: "Z-Man", model: "ElaZtech lineup (anchor)", notes: "Durable plastics (TRD etc.).", status: "wishlist", sourceUrl: SOURCES.zman },
  { brand: "Reaction Innovations", model: "Sweet Beaver family (anchor)", notes: "Flipping/creature base.", status: "wishlist", sourceUrl: SOURCES.reaction },
];

function Pill({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex items-center px-2 py-0.5 text-xs border rounded bg-gray-50 text-gray-800 border-gray-200">{children}</span>;
}
function StatusPill({ s }: { s: Status }) {
  const cls = s === "owned" ? "bg-emerald-100 text-emerald-900 border-emerald-200" : "bg-amber-100 text-amber-900 border-amber-200";
  return <span className={`inline-flex items-center px-2 py-0.5 text-xs border rounded ${cls}`}>{s === "owned" ? "Owned" : "Wishlist"}</span>;
}

export default function Page() {
  const owned = ITEMS.filter(x => x.status === "owned");
  const wishlist = ITEMS.filter(x => x.status === "wishlist");
  return (
    <main className="max-w-5xl mx-auto p-6 space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Lures • Soft Plastics</h1>
        <p className="text-sm text-gray-600">Seeded plastics so this category is instantly “real”.</p>
        <div className="flex flex-wrap gap-2 text-xs text-gray-700">
          <a className="underline" href={SOURCES.missileSpunkShad} target="_blank" rel="noreferrer">Missile Baits – Spunk Shad</a>
          <span className="text-gray-400">•</span>
          <a className="underline" href={SOURCES.zoom} target="_blank" rel="noreferrer">Zoom</a>
          <span className="text-gray-400">•</span>
          <a className="underline" href={SOURCES.keitech} target="_blank" rel="noreferrer">Keitech</a>
          <span className="text-gray-400">•</span>
          <a className="underline" href={SOURCES.zman} target="_blank" rel="noreferrer">Z-Man</a>
          <span className="text-gray-400">•</span>
          <a className="underline" href={SOURCES.reaction} target="_blank" rel="noreferrer">Reaction Innovations</a>
        </div>
      </header>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Owned</h2>
        {owned.length === 0 ? <div className="border rounded p-4 text-sm text-gray-700 bg-white">None marked owned yet.</div> : (
          <div className="grid gap-3">
            {owned.map((x,i)=>(
              <div key={i} className="border rounded p-4 bg-white">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-medium">{x.brand} — {x.model}</div>
                  <div className="flex items-center gap-2"><Pill>Soft Plastic</Pill><StatusPill s={x.status}/></div>
                </div>
                {x.notes ? <div className="text-sm text-gray-700 mt-2">{x.notes}</div> : null}
                {x.sourceUrl ? <div className="text-xs text-gray-600 mt-2">Source: <a className="underline" href={x.sourceUrl} target="_blank" rel="noreferrer">{x.sourceUrl}</a></div> : null}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Wishlist</h2>
        <div className="grid gap-3">
          {wishlist.map((x,i)=>(
            <div key={i} className="border rounded p-4 bg-white">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-medium">{x.brand} — {x.model}</div>
                <div className="flex items-center gap-2"><Pill>Soft Plastic</Pill><StatusPill s={x.status}/></div>
              </div>
              {x.notes ? <div className="text-sm text-gray-700 mt-2">{x.notes}</div> : null}
              {x.sourceUrl ? <div className="text-xs text-gray-600 mt-2">Source: <a className="underline" href={x.sourceUrl} target="_blank" rel="noreferrer">{x.sourceUrl}</a></div> : null}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}