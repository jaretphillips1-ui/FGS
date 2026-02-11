import { LuresCategoryPage, type SeedItem } from "../_components/LuresCategoryPage";
import { LURE_TAXONOMY } from "@/lib/lureTaxonomy";

const SOURCES = {
  zoom: "https://zoombait.com/",
  keitech: "https://www.keitechusa.com/",
  zman: "https://zmanfishing.com/",
  reaction: "https://www.reactioninnovations.com/",
  missileSpunkShad: "https://www.missilebaits.store/products/spunk-shad-3-0",
};

const ITEMS: SeedItem[] = [
  {
    brand: "Missile Baits",
    model: "Spunk Shad 3.0",
    notes: "Seed from a real product page (good template for later exact sizes/colors).",
    status: "wishlist",
    sourceUrl: SOURCES.missileSpunkShad,
    subgroupKey: "soft-swimbaits",
  },
  {
    brand: "Zoom",
    model: "Fluke / Trick Worm Families (Anchor)",
    notes: "Pick exact baits/colors later. Type-first stays the priority.",
    status: "wishlist",
    sourceUrl: SOURCES.zoom,
    subgroupKey: "flukes",
  },
  {
    brand: "Keitech",
    model: "Easy Shiner / Swing Impact Families (Anchor)",
    notes: "Swimbait/finesse staples.",
    status: "wishlist",
    sourceUrl: SOURCES.keitech,
    subgroupKey: "soft-swimbaits",
  },
  {
    brand: "Z-Man",
    model: "ElaZtech Lineup (Anchor)",
    notes: "Durable plastics (TRD etc.).",
    status: "wishlist",
    sourceUrl: SOURCES.zman,
    subgroupKey: "worms",
  },
  {
    brand: "Reaction Innovations",
    model: "Sweet Beaver Family (Anchor)",
    notes: "Flipping/creature base.",
    status: "wishlist",
    sourceUrl: SOURCES.reaction,
    subgroupKey: "creatures",
  },
];

export default function Page() {
  return (
    <LuresCategoryPage
      title="Lures"
      subtitle="Soft plastics — type-first. Brand filter comes after we lock the taxonomy."
      typeLabel="Soft Plastics"
      subgroups={LURE_TAXONOMY["soft-plastics"]}
      sources={[
        { href: SOURCES.missileSpunkShad, label: "Missile Baits – Spunk Shad" },
        { href: SOURCES.zoom, label: "Zoom" },
        { href: SOURCES.keitech, label: "Keitech" },
        { href: SOURCES.zman, label: "Z-Man" },
        { href: SOURCES.reaction, label: "Reaction Innovations" },
      ]}
      items={ITEMS}
    />
  );
}
