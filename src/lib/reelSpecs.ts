// src/lib/reelSpecs.ts

export const REEL_TYPE_VALUES = [
  "baitcaster",
  "spinning",
  "bfs",
  "round",
  "other",
] as const;

export type ReelType = (typeof REEL_TYPE_VALUES)[number];

export const REEL_HAND_VALUES = ["right", "left"] as const;
export type ReelHand = (typeof REEL_HAND_VALUES)[number];

export function reelTypeLabel(v: string): string {
  const s = String(v ?? "").trim().toLowerCase();
  switch (s) {
    case "baitcaster":
      return "Baitcaster";
    case "spinning":
      return "Spinning";
    case "bfs":
      return "BFS";
    case "round":
      return "Round";
    case "other":
      return "Other";
    default:
      return s ? s : "—";
  }
}

export function reelHandLabel(v: string): string {
  const s = String(v ?? "").trim().toLowerCase();
  if (s === "right") return "Right hand";
  if (s === "left") return "Left hand";
  return s ? s : "—";
}

export function normalizeGearRatio(v: string): string {
  // Keep as a human-friendly string. Common format: "7.4:1"
  const s = String(v ?? "").trim();
  return s;
}

export function numOrNullFromInput(raw: string): number | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function clampNum(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}