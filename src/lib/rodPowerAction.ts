// src/lib/rodPowerAction.ts

export const ROD_POWER_VALUES = ["UL", "L", "ML", "M", "MH", "H", "XH"] as const;
export type RodPowerValue = (typeof ROD_POWER_VALUES)[number];

export const ROD_POWER_OPTIONS = ["—", ...ROD_POWER_VALUES] as const;
export type RodPowerOption = (typeof ROD_POWER_OPTIONS)[number];

export function rodPowerLabel(v: string): string {
  const s = String(v ?? "").trim();
  switch (s) {
    case "—":
      return "—";
    case "UL":
      return "Ultra Light";
    case "L":
      return "Light";
    case "ML":
      return "Medium Light";
    case "M":
      return "Medium";
    case "MH":
      return "Medium Heavy";
    case "H":
      return "Heavy";
    case "XH":
      return "Extra Heavy";
    default:
      return s || "—";
  }
}

// Keep stored values exactly as-is; only labels are expanded.
export const ROD_ACTION_VALUES = ["Slow", "Mod", "Mod-Fast", "Fast", "X-Fast"] as const;
export type RodActionValue = (typeof ROD_ACTION_VALUES)[number];

export const ROD_ACTION_OPTIONS = ["—", ...ROD_ACTION_VALUES] as const;
export type RodActionOption = (typeof ROD_ACTION_OPTIONS)[number];

export function rodActionLabel(v: string): string {
  const s = String(v ?? "").trim();
  switch (s) {
    case "—":
      return "—";
    case "Slow":
      return "Slow";
    case "Mod":
      return "Moderate";
    case "Mod-Fast":
      return "Moderate Fast";
    case "Fast":
      return "Fast";
    case "X-Fast":
      return "Extra Fast";
    default:
      return s || "—";
  }
}

export function optionToNullableValue(opt: string): string | null {
  const s = String(opt ?? "").trim();
  return !s || s === "—" ? null : s;
}

export function valueToOption(v: unknown): string {
  const s = String(v ?? "").trim();
  return s ? s : "—";
}