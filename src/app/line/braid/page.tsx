type Status = "owned" | "wishlist";
type Item = { brand: string; model: string; notes?: string; status: Status; sourceUrl?: string };

const SOURCES = {
  sunlineLine: "https://sunlineamerica.com/collections/line",
  sufixCanada: "https://www.rapala.ca/ca_en/sufix",
};

const ITEMS: Item[] = [
  { brand: "Sufix", model: "832 Advanced Superline", notes: "Braid mainline staple.", status: "wishlist", sourceUrl: SOURCES.sufixCanada },
  { brand: "Sunline", model: "FX2 Braid", notes: "8-carrier braid option.", status: "wishlist", sourceUrl: SOURCES.sunlineLine },
  { brand: "Sunline", model: "Braid families (browse)", notes: "Use as a catalog anchor for exact picks later.", status: "wishlist", sourceUrl: SOURCES.sunlineLine },
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
        <h1 className="text-2xl font-semibold">Line • Braid</h1>
        <p className="text-sm text-gray-600">Seeded braid entries + anchors. Later: add lb test, color, spool size.</p>
        <div className="flex flex-wrap gap-2 text-xs text-gray-700">
          <a className="underline" href={SOURCES.sunlineLine} target="_blank" rel="noreferrer">Sunline line collection</a>
          <span className="text-gray-400">•</span>
          <a className="underline" href={SOURCES.sufixCanada} target="_blank" rel="noreferrer">Sufix (Rapala Canada)</a>
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
                  <div className="flex items-center gap-2"><Pill>Braid</Pill><StatusPill s={x.status}/></div>
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
                <div className="flex items-center gap-2"><Pill>Braid</Pill><StatusPill s={x.status}/></div>
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