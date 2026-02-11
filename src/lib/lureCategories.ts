import type { LureCategoryKey } from "@/lib/lureTaxonomy";

export type LureCategory = {
  key: LureCategoryKey;
  title: string;
  subtitle: string;
  href: string;
};

export const LURE_CATEGORIES: LureCategory[] = [
  {
    key: "hardbaits",
    title: "Hard Baits",
    subtitle: "Crankbaits, jerkbaits, and other hard-bodied lures.",
    href: "/lures/hardbaits",
  },
  {
    key: "jigs",
    title: "Jigs",
    subtitle: "Casting, swim, finesse — then we’ll add weights, trailers, and colors.",
    href: "/lures/jigs",
  },
  {
    key: "soft-plastics",
    title: "Soft Plastics",
    subtitle: "Worms, creatures, flukes, swimbaits — brand later, type first.",
    href: "/lures/soft-plastics",
  },
  {
    key: "topwater",
    title: "Topwater",
    subtitle: "Frogs, poppers, walkers — surface baits and hook swap notes later.",
    href: "/lures/topwater",
  },
];
