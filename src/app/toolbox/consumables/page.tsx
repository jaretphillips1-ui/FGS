type Status = "owned" | "wishlist";
type Item = { name: string; notes?: string; status: Status };

const ITEMS: Item[] = [
  { name: "Super glue", notes: "Bait repairs, keeper fixes.", status: "wishlist" },
  { name: "Bait mend", notes: "Softer repair adhesive for plastics.", status: "wishlist" },
  { name: "Hook files / sharpeners", notes: "Keep hooks sticky sharp.", status: "wishlist" },
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
        <h1 className="text-2xl font-semibold">Toolbox • Consumables</h1>
        <p className="text-sm text-gray-600">Consumable items that keep everything running.</p>
      </header>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Owned</h2>
        {owned.length === 0 ? <div className="border rounded p-4 text-sm text-gray-700 bg-white">None marked owned yet.</div> : (
          <div className="grid gap-3">
            {owned.map((x,i)=>(
              <div key={i} className="border rounded p-4 bg-white">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium">{x.name}</div>
                  <div className="flex items-center gap-2"><Pill>Consumables</Pill><StatusPill s={x.status}/></div>
                </div>
                {x.notes ? <div className="text-sm text-gray-700 mt-2">{x.notes}</div> : null}
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
              <div className="flex items-center justify-between gap-2">
                <div className="font-medium">{x.name}</div>
                <div className="flex items-center gap-2"><Pill>Consumables</Pill><StatusPill s={x.status}/></div>
              </div>
              {x.notes ? <div className="text-sm text-gray-700 mt-2">{x.notes}</div> : null}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}