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
