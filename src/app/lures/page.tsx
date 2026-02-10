const SOURCES = {
  spro: "https://www.spro.com/",
  rapalaUS: "https://www.rapala.com/us_en/rapala",
  reaction: "https://www.reactioninnovations.com/",
  zoom: "https://zoombait.com/",
  keitech: "https://www.keitechusa.com/",
  zman: "https://zmanfishing.com/",
  missileSpunkShad: "https://www.missilebaits.store/products/spunk-shad-3-0",

  // Added
  jackall: "https://www.jackall-lures.com/",
  megabass: "https://megabassusa.com/",
};

type Status = "owned" | "wishlist";

type LureItem = {
  brand: string;
  model: string;
  category: "soft-plastic" | "hardbait" | "jig" | "blade" | "swimbait" | "frog";
  notes?: string;
  status: Status;
  sourceUrl?: string;
};

const SEED_LURES: LureItem[] = [
  {
    brand: "Missile Baits",
    model: "Spunk Shad 3.0",
    category: "soft-plastic",
    notes: "Seeded from a real product page (good template for later exact sizes/colors).",
    status: "wishlist",
    sourceUrl: SOURCES.missileSpunkShad,
  },
  {
    brand: "Keitech",
    model: "Easy Shiner / Swing Impact family (brand hub seed)",
    category: "swimbait",
    notes: "Anchor for paddle-tail swimbaits and finesse swimbaits.",
    status: "wishlist",
    sourceUrl: SOURCES.keitech,
  },
  {
    brand: "Zoom",
    model: "Super Fluke / Trick Worm family (brand hub seed)",
    category: "soft-plastic",
    notes: "Anchor for flukes, worms, creature baits — we’ll pull exact items later.",
    status: "wishlist",
    sourceUrl: SOURCES.zoom,
  },
  {
    brand: "Z-Man",
    model: "ElaZtech lineup (brand hub seed)",
    category: "soft-plastic",
    notes: "Anchor for durable plastics (TRD / Ned, paddletails, etc.).",
    status: "wishlist",
    sourceUrl: SOURCES.zman,
  },
  {
    brand: "Reaction Innovations",
    model: "Sweet Beaver / creature family (brand hub seed)",
    category: "soft-plastic",
    notes: "Anchor for flipping / creature baits.",
    status: "wishlist",
    sourceUrl: SOURCES.reaction,
  },
  {
    brand: "Rapala",
    model: "Brand hub seed (hardbaits later)",
    category: "hardbait",
    notes: "Anchor for later: Shad Rap, Husky Jerk, DT series, etc.",
    status: "wishlist",
    sourceUrl: SOURCES.rapalaUS,
  },
  {
    brand: "SPRO",
    model: "Brand hub seed (frogs / hardbaits later)",
    category: "frog",
    notes: "Anchor for later: Bronzeye-style frogs and other SPRO staples.",
    status: "wishlist",
    sourceUrl: SOURCES.spro,
  },

  // Added (from links)
  {
    brand: "Jackall",
    model: "Brand hub seed (hardbaits / finesse later)",
    category: "hardbait",
    notes: "Anchor for later: jerkbaits, cranks, topwater, and other Jackall staples.",
    status: "wishlist",
    sourceUrl: SOURCES.jackall,
  },
  {
    brand: "Megabass",
    model: "Brand hub seed (hardbaits / finesse later)",
    category: "hardbait",
    notes: "Anchor for later: Vision 110 style jerkbaits, cranks, topwater, etc.",
    status: "wishlist",
    sourceUrl: SOURCES.megabass,
  },
];

function StatusPill({ s }: { s: Status }) {
  const cls =
    s === "owned"
      ? "bg-emerald-100 text-emerald-900 border-emerald-200"
      : "bg-amber-100 text-amber-900 border-amber-200";
  const label = s === "owned" ? "Owned" : "Wishlist";
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs border rounded ${cls}`}
    >
      {label}
    </span>
  );
}

function CatPill({ c }: { c: LureItem["category"] }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 text-xs border rounded bg-gray-50 text-gray-800 border-gray-200">
      {c}
    </span>
  );
}

export default function Page() {
  const owned = SEED_LURES.filter((x) => x.status === "owned");
  const wishlist = SEED_LURES.filter((x) => x.status === "wishlist");

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Lures</h1>
        <p className="text-sm text-gray-600">
          Seed entries across soft plastics + hard baits so this section has
          “shape” immediately.
        </p>

        <div className="flex flex-wrap gap-2 text-xs text-gray-700">
          <a
            className="underline"
            href={SOURCES.missileSpunkShad}
            target="_blank"
            rel="noreferrer"
          >
            Missile Baits – Spunk Shad 3.0
          </a>
          <span className="text-gray-400">•</span>
          <a className="underline" href={SOURCES.keitech} target="_blank" rel="noreferrer">
            Keitech USA
          </a>
          <span className="text-gray-400">•</span>
          <a className="underline" href={SOURCES.zoom} target="_blank" rel="noreferrer">
            Zoom
          </a>
          <span className="text-gray-400">•</span>
          <a className="underline" href={SOURCES.zman} target="_blank" rel="noreferrer">
            Z-Man
          </a>
          <span className="text-gray-400">•</span>
          <a className="underline" href={SOURCES.reaction} target="_blank" rel="noreferrer">
            Reaction Innovations
          </a>
          <span className="text-gray-400">•</span>
          <a className="underline" href={SOURCES.rapalaUS} target="_blank" rel="noreferrer">
            Rapala (US) hub
          </a>
          <span className="text-gray-400">•</span>
          <a className="underline" href={SOURCES.spro} target="_blank" rel="noreferrer">
            SPRO
          </a>
          <span className="text-gray-400">•</span>
          <a className="underline" href={SOURCES.jackall} target="_blank" rel="noreferrer">
            Jackall
          </a>
          <span className="text-gray-400">•</span>
          <a className="underline" href={SOURCES.megabass} target="_blank" rel="noreferrer">
            Megabass
          </a>
        </div>
      </header>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Owned</h2>
        {owned.length === 0 ? (
          <div className="border rounded p-4 text-sm text-gray-700 bg-white">
            No owned lures seeded yet — once you tell me your “definitely have”
            baits, we’ll flip them to Owned.
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
                {x.notes ? (
                  <div className="text-sm text-gray-700 mt-2">{x.notes}</div>
                ) : null}
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
              {x.notes ? (
                <div className="text-sm text-gray-700 mt-2">{x.notes}</div>
              ) : null}
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
        Rule reminder: UX uses only <span className="font-medium">Owned</span> and{" "}
        <span className="font-medium">Wishlist</span>.
      </footer>
    </main>
  );
}