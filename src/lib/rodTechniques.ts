export function sortTechniques(arr: string[]): string[] {
  const uniq = Array.from(
    new Set(arr.map(String).map(s => s.trim()).filter(Boolean))
  );

  // Case-insensitive alphabetical order
  uniq.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  return uniq;
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

export function normalizeTechniques(v: unknown): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return sortTechniques(v);

  // handle comma string just in case
  return sortTechniques(
    String(v)
      .split(",")
      .map(s => s.trim())
      .filter(Boolean)
  );
}
