import Link from "next/link";
import { SourceLink } from "@/components/SourceLink";
import { SectionHeader } from "@/components/SectionHeader";
import { LURE_CATEGORIES } from "@/lib/lureCategories";

const SOURCES = {
  spro: "https://www.spro.com/",
  rapalaUS: "https://www.rapala.com/us_en/rapala",
  reaction: "https://www.reactioninnovations.com/",
  zoom: "https://zoombait.com/",
  keitech: "https://www.keitechusa.com/",
  zman: "https://zmanfishing.com/",
  missileSpunkShad: "https://www.missilebaits.store/products/spunk-shad-3-0",
  jackall: "https://www.jackall-lures.com/",
  megabass: "https://megabassusa.com/",
};

export default function Page() {
  return (
    <main className="max-w-5xl mx-auto p-6 space-y-6">
      <SectionHeader
        title="Lures"
        subtitle="Type-first organization. Brand and depth filters come after the taxonomy is locked."
        navLinks={[
          { href: "/rods", label: "Rods" },
          { href: "/reels", label: "Reels" },
          { href: "/combos", label: "Combos" },
        ]}
      />

      <section className="grid sm:grid-cols-2 gap-3">
        {LURE_CATEGORIES.map((c) => (
          <Link key={c.key} href={c.href} className="border rounded p-4 bg-white hover:bg-gray-50 block">
            <div className="font-medium">{c.title}</div>
            <div className="text-sm text-gray-600 mt-1">{c.subtitle}</div>
          </Link>
        ))}
      </section>

      <section className="border rounded p-4 bg-white space-y-2">
        <div className="text-sm font-medium">Seed Sources</div>
        <div className="flex flex-wrap gap-2 text-xs text-gray-700">
          <SourceLink href={SOURCES.missileSpunkShad} label="Missile Baits – Spunk Shad 3.0" />
          <span className="text-gray-400">•</span>
          <SourceLink href={SOURCES.keitech} label="Keitech" />
          <span className="text-gray-400">•</span>
          <SourceLink href={SOURCES.zoom} label="Zoom" />
          <span className="text-gray-400">•</span>
          <SourceLink href={SOURCES.zman} label="Z-Man" />
          <span className="text-gray-400">•</span>
          <SourceLink href={SOURCES.reaction} label="Reaction Innovations" />
          <span className="text-gray-400">•</span>
          <SourceLink href={SOURCES.rapalaUS} label="Rapala (US) Hub" />
          <span className="text-gray-400">•</span>
          <SourceLink href={SOURCES.spro} label="SPRO" />
          <span className="text-gray-400">•</span>
          <SourceLink href={SOURCES.jackall} label="Jackall" />
          <span className="text-gray-400">•</span>
          <SourceLink href={SOURCES.megabass} label="Megabass" />
        </div>
      </section>

      <footer className="text-xs text-gray-500 pt-1">
        Rule reminder: UX uses only <span className="font-medium">Owned</span> and{" "}
        <span className="font-medium">Wishlist</span>.
      </footer>
    </main>
  );
}
