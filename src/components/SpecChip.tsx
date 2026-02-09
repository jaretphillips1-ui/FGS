"use client";

import * as React from "react";

function isEmptyValue(value: unknown): boolean {
  if (value == null) return true;

  if (typeof value === "number") {
    // Treat 0 as "not set" for our display chips
    return !Number.isFinite(value) || value === 0;
  }

  const s = String(value).trim();

  // Common placeholders we want to hide
  if (!s) return true;
  if (s === "—") return true;
  if (s === "-") return true;

  // Hide common "zero with units" variants
  const normalized = s.toLowerCase();
  if (normalized === "0" || normalized === "0.0") return true;
  if (normalized === "0 oz" || normalized === "0.0 oz") return true;
  if (normalized === "0 lb" || normalized === "0.0 lb") return true;

  return false;
}

export function SpecChip({
  label,
  value,
  className,
  title,
}: {
  label: string;
  value: unknown;
  className?: string;
  title?: string;
}) {
  if (isEmptyValue(value)) return null;

  return (
    <span
      className={className ?? "px-2 py-1 rounded border bg-white"}
      title={title}
      aria-label={`${label}: ${String(value)}`}
    >
      {label}: {String(value)}
    </span>
  );
}
