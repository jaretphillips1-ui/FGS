type Status = "owned" | "wishlist";

type ElectronicsItem = {
  name: string;
  category: "graphs" | "transducer" | "mounts" | "power" | "wiring";
  notes?: string;
  status: Status;
};

const SEED_ELECTRONICS: ElectronicsItem[] = [
  { name: "Graph (main unit)", category: "graphs", notes: "Primary display unit (brand/model later).", status: "wishlist" },
  { name: "Transducer (2D/DI/SI)", category: "transducer", notes: "Seed entry to capture what’s on each hull/pole.", status: "wishlist" },
  { name: "Live sonar module / black box", category: "transducer", notes: "Seed entry for LiveScope / MEGA Live style systems.", status: "wishlist" },
  { name: "Pole mount (live sonar)", category: "mounts", notes: "Manual or quick-stow pole mount.", status: "wishlist" },
  { name: "Battery (LiFePO4)", category: "power", notes: "Capacity + voltage later (12V/24V builds).", status: "wishlist" },
  { name: "Fuse block / breaker", category: "power", notes: "Clean power distribution, safety, serviceability.", status: "wishlist" },
  { name: "Through-hull / quick disconnect", category: "wiring", notes: "Keeps wiring tidy + easy to remove electronics.", status: "wishlist" },

  // Added (from links)
  {
    name: "Humminbird MEGA 360 Imaging",
    category: "transducer",
    notes: "360 transducer system. Link: https://humminbird.johnsonoutdoors.com/us/learn/imaging/mega-360-imaging",
    status: "wishlist",
  },
  {
    name: "Garmin Force Current (kayak trolling motor)",
    category: "power",
    notes: "Trolling motor. Link: https://www.garmin.com/en-CA/p/1059129/",
    status: "wishlist",
  },
  {
    name: "Garmin LiveScope bundle (Live sonar)",
    category: "transducer",
    notes: "LiveScope bundle link (Tackle Depot): https://www.tackledepot.ca/products/garmin-livescope-bundles?variant=41934585659459",
    status: "owned",
  },
];

function StatusPill({ s }: { s: Status }) {
  const cls =
    s === "owned"
      ? "bg-emerald-100 text-emerald-900 border-emerald-200"
      : "bg-amber-100 text-amber-900 border-amber-200";
  const label = s === "owned" ? "Owned" : "Wishlist";
  return <span className={`inline-flex items-center px-2 py-0.5 text-xs border rounded ${cls}`}>{label}</span>;
}

function CatPill({ c }: { c: ElectronicsItem["category"] }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 text-xs border rounded bg-gray-50 text-gray-800 border-gray-200">
      {c}
    </span>
  );
}

export default function Page() {
  const owned = SEED_ELECTRONICS.filter((x) => x.status === "owned");
  const wishlist = SEED_ELECTRONICS.filter((x) => x.status === "wishlist");

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Electronics</h1>
        <p className="text-sm text-gray-600">
          Seeded framework for graphs, mounts, and power so we can fill details gradually.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Owned</h2>
        {owned.length === 0 ? (
          <div className="border rounded p-4 text-sm text-gray-700 bg-white">
            No owned electronics seeded here yet — when you list what’s already installed, we’ll flip them to Owned.
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