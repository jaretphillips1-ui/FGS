type Status = "owned" | "wishlist";

type ToolboxItem = {
  name: string;
  category: "tools" | "organizers" | "storage" | "consumables";
  notes?: string;
  status: Status;
};

const SEED_TOOLBOX: ToolboxItem[] = [
  { name: "Split-ring pliers", category: "tools", notes: "Small split rings, trebles, and hardware work.", status: "wishlist" },
  { name: "Line scissors / braid cutters", category: "tools", notes: "Dedicated braid cutter helps keep cuts clean.", status: "wishlist" },
  { name: "Forceps / hook remover", category: "tools", notes: "Pickerel-friendly and safer unhooking.", status: "wishlist" },
  { name: "Terminal organizer box (small compartments)", category: "organizers", notes: "Hooks, weights, swivels, snaps.", status: "wishlist" },
  { name: "Soft plastics binder / gallon zip storage", category: "storage", notes: "Keeps packs organized by style (worms, flukes, creatures).", status: "wishlist" },
  { name: "Super glue + bait mend", category: "consumables", notes: "Extends life of plastics, small repairs.", status: "wishlist" },
];

function StatusPill({ s }: { s: Status }) {
  const cls =
    s === "owned"
      ? "bg-emerald-100 text-emerald-900 border-emerald-200"
      : "bg-amber-100 text-amber-900 border-amber-200";
  const label = s === "owned" ? "Owned" : "Wishlist";
  return <span className={`inline-flex items-center px-2 py-0.5 text-xs border rounded ${cls}`}>{label}</span>;
}

function CatPill({ c }: { c: ToolboxItem["category"] }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 text-xs border rounded bg-gray-50 text-gray-800 border-gray-200">
      {c}
    </span>
  );
}

export default function Page() {
  const owned = SEED_TOOLBOX.filter((x) => x.status === "owned");
  const wishlist = SEED_TOOLBOX.filter((x) => x.status === "wishlist");

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Toolbox</h1>
        <p className="text-sm text-gray-600">
          Quick seed list so Toolbox isn’t empty. Later we’ll break this into your actual bins/drawers.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Owned</h2>
        {owned.length === 0 ? (
          <div className="border rounded p-4 text-sm text-gray-700 bg-white">
            No owned items seeded yet — once you call out what’s already in the bag, we’ll flip them to Owned.
          </div>
        ) : (
          <div className="grid gap-3">
            {owned.map((x, i) => (
              <div key={`o-${i}`} className="border rounded p-4 bg-white">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-medium">{x.name}</div>
                  <div className="flex items-center gap-2">
                    <CatPill c={x.category} />
                    <StatusPill s={x.status} />
                  </div>
                </div>
                {x.notes ? <div className="text-sm text-gray-700 mt-2">{x.notes}</div> : null}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Wishlist</h2>
          <button
            type="button"
            className="px-4 py-2 rounded bg-black text-white opacity-60 cursor-not-allowed"
            disabled
            title="Coming soon"
          >
            Add (coming soon)
          </button>
        </div>

        <div className="grid gap-3">
          {wishlist.map((x, i) => (
            <div key={`w-${i}`} className="border rounded p-4 bg-white">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-medium">{x.name}</div>
                <div className="flex items-center gap-2">
                  <CatPill c={x.category} />
                  <StatusPill s={x.status} />
                </div>
              </div>
              {x.notes ? <div className="text-sm text-gray-700 mt-2">{x.notes}</div> : null}
            </div>
          ))}
        </div>
      </section>

      <footer className="text-xs text-gray-500 pt-2">
        Rule reminder: UX uses only <span className="font-medium">Owned</span> and <span className="font-medium">Wishlist</span>.
      </footer>
    </main>
  );
}
