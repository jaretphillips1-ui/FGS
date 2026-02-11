export type UiTier = "basic" | "advanced" | "expert";

export const UI_TIERS: UiTier[] = ["basic", "advanced", "expert"];

export const UI_TIER_LABEL: Record<UiTier, string> = {
  basic: "Basic",
  advanced: "Advanced",
  expert: "Expert",
};

export const UI_TIER_STORAGE_KEY = "fgs.uiTier.v1";
export const UI_OVERRIDES_STORAGE_KEY = "fgs.uiOverrides.v1";

export function tierRank(t: UiTier): number {
  switch (t) {
    case "basic":
      return 0;
    case "advanced":
      return 1;
    case "expert":
      return 2;
  }
}

export function tierGte(a: UiTier, b: UiTier): boolean {
  return tierRank(a) >= tierRank(b);
}
