export type LureCategoryKey = "hardbaits" | "jigs" | "soft-plastics" | "topwater";

export type LureSubgroup = {
  key: string;
  title: string;
  subtitle?: string;
};

export const LURE_TAXONOMY: Record<LureCategoryKey, LureSubgroup[]> = {
  hardbaits: [
    { key: "crankbaits", title: "Crankbaits", subtitle: "Squarebill, mid, deep — depth comes next." },
    { key: "jerkbaits", title: "Jerkbaits", subtitle: "Suspending and cadence-first." },
    { key: "lipless", title: "Lipless Crankbaits", subtitle: "Yo-yo, burn, grass ripping." },
    { key: "glidebaits", title: "Glidebaits", subtitle: "Bigger profile, slow and deliberate." },
    { key: "hard-swimbaits", title: "Swimbaits (Hard)", subtitle: "Hard-body swimmers and jointed baits." },
    { key: "wakebaits", title: "Wake Baits", subtitle: "Surface/sub-surface crawlers." },
  ],

  "soft-plastics": [
    { key: "worms", title: "Worms", subtitle: "Trick worms, finesse worms, ribbon tails." },
    { key: "creatures", title: "Creatures", subtitle: "Flipping and pitching staples." },
    { key: "craws", title: "Craws", subtitle: "Jig trailers and standalone rigs." },
    { key: "flukes", title: "Flukes", subtitle: "Jerk-style soft plastics." },
    { key: "soft-swimbaits", title: "Swimbaits (Soft)", subtitle: "Paddletails and swimmers." },
    { key: "grubs-tubes", title: "Grubs & Tubes", subtitle: "Classic smallmouth / multi-species." },
  ],

  jigs: [
    { key: "casting", title: "Casting Jigs", subtitle: "General-purpose skirted jigs." },
    { key: "football", title: "Football Jigs", subtitle: "Dragging and structure." },
    { key: "swim", title: "Swim Jigs", subtitle: "Horizontal retrieve + trailers." },
    { key: "finesse", title: "Finesse Jigs", subtitle: "Small profile, pressured fish." },
    { key: "bladed", title: "Bladed Jigs", subtitle: "Chatterbait-style vibration." },
  ],

  topwater: [
    { key: "frogs", title: "Frogs", subtitle: "Mats, slop, and heavy cover." },
    { key: "poppers", title: "Poppers", subtitle: "Spit, pause, and target work." },
    { key: "walking", title: "Walking Baits", subtitle: "Spook-style cadence." },
    { key: "buzzbaits", title: "Buzzbaits", subtitle: "Cover water fast." },
    { key: "prop", title: "Prop Baits", subtitle: "Chop and sputter." },
    { key: "toads", title: "Toads", subtitle: "Soft topwater runners." },
  ],
};
