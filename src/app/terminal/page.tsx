import { SourceLink } from "@/components/SourceLink";

const SOURCES = {
  bkk: "https://bkkhooks.com/",
  bkkAmericasCatalog: "https://bkkhooks-americas.com/catalog/",
  owner: "https://www.ownerhooks.com/",
  gamakatsu: "https://gamakatsu.com/",
};

type Status = "owned" | "wishlist";

type TerminalItem = {
  brand: string;
  model: string;
  category: "hooks" | "weights" | "swivels" | "snaps" | "jigheads" | "terminal-tools";
  notes?: string;
  status: Status;
  sourceUrl?: string;
};

const SEED_TERMINAL: TerminalItem[] = [
  {
    brand: "BKK",
    model: "Octopus / Live Bait hook families (catalog seed)",
    category: "hooks",
    notes: "Catalog anchor for later real SKU capture (sizes, packs, etc.).",
    status: "wishlist",
    sourceUrl: SOURCES.bkkAmericasCatalog,
  },
  {
    brand: "BKK",
    model: "Wide Gap (EWG-style) hook families (catalog seed)",
    category: "hooks",
    notes: "Good placeholder for worm hooks / flipping soft plastics.",
    status: "wishlist",
    sourceUrl: SOURCES.bkkAmericasCatalog,
  },
  {
    brand: "Owner",
    model: "Hook lineup (brand hub seed)",
    category: "hooks",
    notes: "Landing page seed — we’ll pull exact models later (EWG, wacky, dropshot, trebles).",
    status: "wishlist",
    sourceUrl: SOURCES.owner,
  },
  {
    brand: "Gamakatsu",
    model: "Hook lineup (brand hub seed)",
    category: "hooks",
    notes: "Landing page seed — common models include EWG, finesse, trebles, circles.",
    status: "wishlist",
    sourceUrl: SOURCES.gamakatsu,
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

function CatPill({ c }: { c: TerminalItem["category"] }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 text-xs border rounded bg-gray-50 text-gray-800 border-gray-200">
      {c}
    </span>
  );
}

export default function Page() {
  const owned = SEED_TERMINAL.filter((x) => x.status === "owned");
  const wishlist = SEED_TERMINAL.filter((x) => x.status === "wishlist");

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Terminal Tackle</h1>
        <p className="text-sm text-gray-600">
          Seeded “real-ish” terminal entries and brand anchors. Next we’ll add actual hook sizes, weights, and packs.
        </p>

        <div className="flex flex-wrap gap-2 text-xs text-gray-700">
          <SourceLink href={SOURCES.bkk} label="BKK (global)" />
          <span className="text-gray-400">•</span>
          <SourceLink href={SOURCES.bkkAmericasCatalog} label="BKK Americas catalog" />
          <span className="text-gray-400">•</span>
          <SourceLink href={SOURCES.owner} label="Owner Hooks" />
          <span className="text-gray-400">•</span>
          <SourceLink href={SOURCES.gamakatsu} label="Gamakatsu" />
        </div>
      </header>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Owned</h2>
        {owned.length === 0 ? (
          <div className="border rounded p-4 text-sm text-gray-700 bg-white">
            Nothing marked owned yet — we can flip statuses fast once you list what’s in your hook box.
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
                    <SourceLink href={x.sourceUrl} />
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
                  <SourceLink href={x.sourceUrl} />
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
