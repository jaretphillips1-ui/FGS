import { LuresCategoryPage, type SeedItem } from "../_components/LuresCategoryPage";
import { LURE_TAXONOMY } from "@/lib/lureTaxonomy";

const SOURCES = {
  rapalaUS: "https://www.rapala.com/us_en/rapala",
  jackall: "https://www.jackall-lures.com/",
  megabass: "https://megabassusa.com/",
};

const ITEMS: SeedItem[] = [
  {
    brand: "Rapala",
    model: "Hardbait Hub (Anchor)",
    notes: "Later: Shad Rap, Husky Jerk, DT Series, and depth-specific sorting.",
    status: "wishlist",
    sourceUrl: SOURCES.rapalaUS,
  },
  {
    brand: "Jackall",
    model: "Hardbait/Finesse Hub (Anchor)",
    notes: "Later: jerkbaits, cranks, topwater — SKU-level entries when we lock taxonomy.",
    status: "wishlist",
    sourceUrl: SOURCES.jackall,
  },
  {
    brand: "Megabass",
    model: "Hardbait/Finesse Hub (Anchor)",
    notes: "Later: Vision 110 style jerkbaits, cranks, topwater.",
    status: "wishlist",
    sourceUrl: SOURCES.megabass,
  },
  {
    model: "Crankbaits (Mid-Depth)",
    notes: "Later: exact models + running depth (Shallow / Mid / Deep).",
    status: "wishlist",
  },
  {
    model: "Jerkbaits (Suspending)",
    notes: "Later: exact models + sizes + hook upgrades.",
    status: "wishlist",
  },
];

export default function Page() {
  return (
    <LuresCategoryPage
      title="Lures"
      subtitle="Hard baits — organized by type first. Depth and brand filters come next."
      typeLabel="Hard Baits"
      subgroups={LURE_TAXONOMY.hardbaits}
      sources={[
        { href: SOURCES.rapalaUS, label: "Rapala (US) Hub" },
        { href: SOURCES.jackall, label: "Jackall" },
        { href: SOURCES.megabass, label: "Megabass" },
      ]}
      items={ITEMS}
    />
  );
}
