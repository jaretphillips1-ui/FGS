import { LuresCategoryPage, type SeedItem } from "../_components/LuresCategoryPage";
import { LURE_TAXONOMY } from "@/lib/lureTaxonomy";

const SOURCES = { spro: "https://www.spro.com/" };

const ITEMS: SeedItem[] = [
  {
    brand: "SPRO",
    model: "Topwater/Frogs (Anchor)",
    notes: "Later: exact frog models + sizes + hook swaps.",
    status: "wishlist",
    sourceUrl: SOURCES.spro,
  },
  { model: "Poppers", notes: "Later: exact models + sizes.", status: "wishlist" },
  { model: "Walking Baits", notes: "Later: exact models + sizes.", status: "wishlist" },
];

export default function Page() {
  return (
    <LuresCategoryPage
      title="Lures"
      subtitle="Topwater — type-first. Later: exact models, colors, and hook upgrades."
      typeLabel="Topwater"
      subgroups={LURE_TAXONOMY.topwater}
      sources={[{ href: SOURCES.spro, label: "SPRO" }]}
      items={ITEMS}
    />
  );
}
