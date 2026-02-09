/**
 * Rod Techniques
 * - Canonicalization: map common variations to one official label
 * - Normalization: accept array / JSON string / comma string
 * - Always returns unique, alphabetically sorted canonical labels
 */

export const TECHNIQUE_ALIASES: Record<string, string> = {
  // canonical : aliases
  "Drop Shot": "dropshot,drop-shot,drop shot,drop  shot",
  "Chatterbait": "chatter bait,bladed jig,bladed-jig",
  "Swimbait": "swim bait,swim-bait",
  "Topwater": "top water,top-water,surface",
  "Texas Rig": "texasrig,texas-rig,tx rig,tx-rig",
  "Carolina Rig": "carolinarig,carolina-rig,c rig,c-rig",
  "Ned Rig": "nedrig,ned-rig",
  "Spinnerbait": "spinner bait,spinner-bait",
  "Crankbait": "crank bait,crank-bait",
  "Jerkbait": "jerk bait,jerk-bait",
  "Frog": "frogging",
  "Pitching": "pitch",
  "Flipping": "flip",
  "Punching": "punch",
  "Wacky": "wacky rig,wacky-rig",
};

export function sortTechniques(arr: string[]): string[] {
  const uniq = Array.from(
    new Set(arr.map(String).map((s) => s.trim()).filter(Boolean))
  );
  uniq.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  return uniq;
}

const aliasToCanonical: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const [canonical, aliasesCsv] of Object.entries(TECHNIQUE_ALIASES)) {
    const aliases = aliasesCsv
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);

    // canonical itself should resolve to canonical
    map[canonical.toLowerCase()] = canonical;

    for (const a of aliases) {
      map[a.toLowerCase()] = canonical;
    }
  }
  return map;
})();

export function canonicalizeTechnique(input: string): string {
  const raw = String(input ?? "").trim();
  if (!raw) return "";

  const key = raw.toLowerCase();
  return aliasToCanonical[key] ?? raw;
}

export const MAX_TECHNIQUES = 5;

export const ROD_TECHNIQUES: string[] = sortTechniques([
  "Jig",
  "Texas Rig",
  "Ned Rig",
  "Wacky",
  "Drop Shot",
  "Carolina Rig",
  "Swimbait",
  "Spinnerbait",
  "Chatterbait",
  "Crankbait",
  "Jerkbait",
  "Topwater",
  "Frog",
  "Punching",
  "Flipping",
  "Pitching",
  "Finesse",
  "Trolling",
]);

function tryParseJsonArray(s: string): string[] | null {
  const t = s.trim();
  if (!t) return null;
  if (!(t.startsWith("[") && t.endsWith("]"))) return null;

  try {
    const parsed = JSON.parse(t);
    if (Array.isArray(parsed)) return parsed.map(String);
    return null;
  } catch {
    return null;
  }
}

export function normalizeTechniques(v: unknown): string[] {
  if (!v) return [];

  // already an array
  if (Array.isArray(v)) {
    return sortTechniques(v.map(String).map(canonicalizeTechnique).filter(Boolean));
  }

  // string cases (JSON string, comma string, single string)
  const s = String(v).trim();
  if (!s) return [];

  const jsonArr = tryParseJsonArray(s);
  if (jsonArr) {
    return sortTechniques(jsonArr.map(canonicalizeTechnique).filter(Boolean));
  }

  // comma-separated fallback
  if (s.includes(",")) {
    return sortTechniques(
      s
        .split(",")
        .map((x) => x.trim())
        .map(canonicalizeTechnique)
        .filter(Boolean)
    );
  }

  // single value
  return sortTechniques([canonicalizeTechnique(s)].filter(Boolean));
}

function uniqPreserveOrder(arr: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of arr) {
    const s = String(v ?? "").trim();
    if (!s) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

function parseTechniquesRaw(v: unknown): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.map(String);

  const s = String(v).trim();
  if (!s) return [];

  const jsonArr = tryParseJsonArray(s);
  if (jsonArr) return jsonArr.map(String);

  if (s.includes(",")) return s.split(",").map((x) => x.trim()).filter(Boolean);

  return [s];
}

/**
 * Normalize techniques while preserving a "primary" in slot 0 if present.
 * - Canonicalizes labels
 * - Preserves primary position
 * - Sorts secondaries alphabetically for cleanliness
 */
export function normalizeTechniquesWithPrimary(v: unknown): { primary: string; techniques: string[] } {
  const raw = parseTechniquesRaw(v).map(canonicalizeTechnique).filter(Boolean);
  const uniq = uniqPreserveOrder(raw);

  const primary = uniq[0] ?? "";
  const secondarySorted = sortTechniques(uniq.slice(1));
  const techniques = primary ? [primary, ...secondarySorted] : secondarySorted;

  return { primary, techniques };
}

/**
 * Build a store-ready array where primary is first and the rest are sorted.
 * Accepts either an array (already chosen) or any normalizeTechniques input.
 */
export function buildTechniquesForStore(primary: string | null | undefined, techniques: unknown): string[] {
  const base = Array.isArray(techniques)
    ? techniques.map(String)
    : normalizeTechniquesWithPrimary(techniques).techniques;

  const canon = base.map(canonicalizeTechnique).filter(Boolean);
  const uniq = uniqPreserveOrder(canon);

  const p = canonicalizeTechnique(String(primary ?? "")).trim();
  const rest = uniq.filter((t) => t !== p);

  const restSorted = sortTechniques(rest);
  return p ? [p, ...restSorted] : restSorted;
}
export type TechniqueChipVariant = "primary" | "selected" | "unselected";
export type TechniqueChipSize = "xs" | "sm" | "md";

/**
 * Shared chip styling so technique chips look consistent across pages.
 * - primary: strongest (used for primary technique)
 * - selected: active/filtered/selected
 * - unselected: available but not selected
 */
export function techniqueChipClass(
  variant: TechniqueChipVariant,
  size: TechniqueChipSize = "sm"
): string {
  const sizeCls =
    size === "xs"
      ? "text-xs px-2 py-0.5"
      : size === "md"
      ? "text-sm px-3 py-1.5"
      : "text-sm px-3 py-1";

  const base = `${sizeCls} rounded border transition-colors`;

  const v =
    variant === "primary"
      ? "bg-green-600 text-white border border-green-700 hover:bg-green-700"
      : variant === "selected"
      ? "bg-gray-200 text-gray-800 border border-gray-300 hover:bg-gray-300"
      : "bg-white text-gray-800 border border-gray-300 hover:bg-gray-50";

  return `${base} ${v}`.trim();
}
