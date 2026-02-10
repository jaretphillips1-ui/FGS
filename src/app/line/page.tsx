const SOURCES = {
  sunlineLine: "https://sunlineamerica.com/collections/line",
  sufixCanada: "https://www.rapala.ca/ca_en/sufix",
  rapalaUS: "https://www.rapala.com/us_en/rapala",
};

type Status = "owned" | "wishlist";

type LineItem = {
  brand: string;
  model: string;
  category: "braid" | "fluoro" | "mono" | "leader" | "backing";
  notes?: string;
  status: Status;
  sourceUrl?: string;
};

const SEED_LINE: LineItem[] = [
  {
    brand: "Sunline",
    model: "FX2 Braid",
    category: "braid",
    notes: "8-carrier braid option — common for mainline on baitcasters/spinning.",
    status: "wishlist",
    sourceUrl: SOURCES.sunlineLine,
  },
  {
    brand: "Sunline",
    model: "Shooter FC",
    category: "fluoro",
    notes: "Premium fluorocarbon option — typical for leaders / finesse.",
    status: "wishlist",
    sourceUrl: SOURCES.sunlineLine,
  },
  {
    brand: "Sufix",
    model: "832 Advanced Superline",
    category: "braid",
    notes: "Classic braid pick — mainline for many setups.",
    status: "wishlist",
    sourceUrl: SOURCES.sufixCanada,
  },
  {
    brand: "Sufix",
    model: "Advance Fluorocarbon Leader",
    category: "leader",
    notes: "Leader material option for braid-to-leader setups.",
    status: "wishlist",
    sourceUrl: SOURCES.sufixCanada,
  },
  {
    brand: "Rapala",
    model: "Brand hub (for cross-links)",
    category: "backing",
    notes: "Landing/source hub (helps later when we add more Rapala-owned lines).",
    status: "wishlist",
    sourceUrl: SOURCES.rapalaUS,
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

function CatPill({ c }: { c: LineItem["category"] }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 text-xs border rounded bg-gray-50 text-gray-800 border-gray-200">
      {c}
    </span>
  );
}

export default function Page() {
  const owned = SEED_LINE.filter((x) => x.status === "owned");
  const wishlist = SEED_LINE.filter((x) => x.status === "wishlist");

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Fishing Line</h1>
        <p className="text-sm text-gray-600">
          Seeded entries (real-looking) so the section feels “alive”. We’ll wire DB + Add flows later.
        </p>

        <div className="flex flex-wrap gap-2 text-xs text-gray-700">
          <a className="underline" href={SOURCES.sunlineLine} target="_blank" rel="noreferrer">
            Sunline line collection
          </a>
          <span className="text-gray-400">•</span>
          <a className="underline" href={SOURCES.sufixCanada} target="_blank" rel="noreferrer">
            Sufix (Rapala Canada)
          </a>
          <span className="text-gray-400">•</span>
          <a className="underline" href={SOURCES.rapalaUS} target="_blank" rel="noreferrer">
            Rapala (US) brand hub
          </a>
        </div>
      </header>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Owned</h2>
        {owned.length === 0 ? (
          <div className="border rounded p-4 text-sm text-gray-700 bg-white">
            Nothing marked owned yet. We can flip statuses as you confirm what you actually have in-hand.
          </div>
        ) : (
          <div className="grid gap-3">
            {owned.map((x, i) => (
              <div key={`o-${i}`} className="border rounded p-4 bg-white">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-medium">
                    {x.brand} — {x.model}
                  </div>
                  <div className="flex items-center gap-2">
                    <CatPill c={x.category} />
                    <StatusPill s={x.status} />
                  </div>
                </div>
                {x.notes ? <div className="text-sm text-gray-700 mt-2">{x.notes}</div> : null}
                {x.sourceUrl ? (
                  <div className="text-xs text-gray-600 mt-2">
                    Source:{" "}
                    <a className="underline" href={x.sourceUrl} target="_blank" rel="noreferrer">
                      {x.sourceUrl}
                    </a>
                  </div>
                ) : null}
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
                <div className="font-medium">
                  {x.brand} — {x.model}
                </div>
                <div className="flex items-center gap-2">
                  <CatPill c={x.category} />
                  <StatusPill s={x.status} />
                </div>
              </div>
              {x.notes ? <div className="text-sm text-gray-700 mt-2">{x.notes}</div> : null}
              {x.sourceUrl ? (
                <div className="text-xs text-gray-600 mt-2">
                  Source:{" "}
                  <a className="underline" href={x.sourceUrl} target="_blank" rel="noreferrer">
                    {x.sourceUrl}
                  </a>
                </div>
              ) : null}
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
