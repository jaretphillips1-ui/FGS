import Link from "next/link";
import { SourceLink } from "@/components/SourceLink";
import { SectionHeader } from "@/components/SectionHeader";
import type { LureSubgroup } from "@/lib/lureTaxonomy";

export type SeedItem = {
  brand?: string;
  model: string;
  notes?: string;
  status: "owned" | "wishlist";
  sourceUrl?: string;
};

function StatusPill({ s }: { s: "owned" | "wishlist" }) {
  const cls =
    s === "owned"
      ? "bg-emerald-100 text-emerald-900 border-emerald-200"
      : "bg-amber-100 text-amber-900 border-amber-200";
  const label = s === "owned" ? "Owned" : "Wishlist";
  return <span className={`inline-flex items-center px-2 py-0.5 text-xs border rounded ${cls}`}>{label}</span>;
}

function TypePill({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 text-xs border rounded bg-gray-50 text-gray-800 border-gray-200">
      {label}
    </span>
  );
}

function Card({ item, typeLabel }: { item: SeedItem; typeLabel: string }) {
  const title = item.brand ? `${item.brand} — ${item.model}` : item.model;

  return (
    <div className="border rounded p-4 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-medium">{title}</div>
        <div className="flex items-center gap-2">
          <TypePill label={typeLabel} />
          <StatusPill s={item.status} />
        </div>
      </div>

      {item.notes ? <div className="text-sm text-gray-700 mt-2">{item.notes}</div> : null}

      {item.sourceUrl ? (
        <div className="text-xs text-gray-600 mt-2">
          Source: <SourceLink href={item.sourceUrl} />
        </div>
      ) : null}
    </div>
  );
}

function SubgroupCard({ g }: { g: LureSubgroup }) {
  return (
    <div className="border rounded p-4 bg-white">
      <div className="font-medium">{g.title}</div>
      {g.subtitle ? <div className="text-sm text-gray-600 mt-1">{g.subtitle}</div> : null}
    </div>
  );
}

export function LuresCategoryPage({
  title,
  subtitle,
  typeLabel,
  sources,
  subgroups,
  items,
}: {
  title: string;
  subtitle: string;
  typeLabel: string;
  sources?: { href: string; label?: string }[] | null;
  subgroups?: LureSubgroup[] | null;
  items: SeedItem[];
}) {
  const owned = items.filter((x) => x.status === "owned");
  const wishlist = items.filter((x) => x.status === "wishlist");

  const sortedSubgroups = (subgroups ?? []).slice().sort((a, b) => a.title.localeCompare(b.title));

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-6">
      <SectionHeader
        title={title}
        subtitle={subtitle}
        crumbs={[{ label: "Lures", href: "/lures" }, { label: typeLabel }]}
        navLinks={[
          { href: "/rods", label: "Rods" },
          { href: "/reels", label: "Reels" },
          { href: "/combos", label: "Combos" },
          { href: "/shopping", label: "Shopping" },
          { href: "/inventory", label: "Inventory" },
          { href: "/manufacturers", label: "Manufacturers" },
        ]}
      />

      {sortedSubgroups.length > 0 ? (
        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-semibold">Sub-groups</h2>
            <div className="text-xs text-gray-500">{sortedSubgroups.length}</div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {sortedSubgroups.map((g) => (
              <SubgroupCard key={g.key} g={g} />
            ))}
          </div>
        </section>
      ) : null}

      {sources && sources.length > 0 ? (
        <div className="flex flex-wrap gap-2 text-xs text-gray-700">
          {sources.map((s, i) => (
            <span key={`${s.href}-${i}`} className="inline-flex items-center gap-2">
              <SourceLink href={s.href} label={s.label} />
              {i < sources.length - 1 ? <span className="text-gray-400">•</span> : null}
            </span>
          ))}
        </div>
      ) : null}

      <div className="border rounded p-4 bg-white space-y-2">
        <div className="text-sm font-medium">Coming Next</div>
        <div className="text-sm text-gray-600">
          We’ll keep this <span className="font-medium">type-first</span>, then add filters:
        </div>
        <ul className="text-sm text-gray-700 list-disc pl-5">
          <li>
            <span className="font-medium">Depth/Range</span> (for hardbaits: Shallow / Mid / Deep)
          </li>
          <li>
            <span className="font-medium">Technique</span> (tie into your existing techniques system)
          </li>
          <li>
            <span className="font-medium">Brand</span> (dropdown once the category taxonomy is locked)
          </li>
        </ul>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Owned</h2>
        {owned.length === 0 ? (
          <div className="border rounded p-4 text-sm text-gray-700 bg-white">None marked owned yet.</div>
        ) : (
          <div className="grid gap-3">{owned.map((x, i) => <Card key={`o-${i}`} item={x} typeLabel={typeLabel} />)}</div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Wishlist</h2>
        <div className="grid gap-3">{wishlist.map((x, i) => <Card key={`w-${i}`} item={x} typeLabel={typeLabel} />)}</div>
      </section>

      <footer className="text-xs text-gray-500 pt-1">
        Rule reminder: UX uses only <span className="font-medium">Owned</span> and{" "}
        <span className="font-medium">Wishlist</span>.
      </footer>
    </main>
  );
}
