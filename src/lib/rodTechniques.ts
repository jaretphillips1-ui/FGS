export const ROD_TECHNIQUES: string[] = [
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
];

export function normalizeTechniques(v: unknown): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.map(String).map(s => s.trim()).filter(Boolean);
  // handle comma string just in case
  return String(v)
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
}
