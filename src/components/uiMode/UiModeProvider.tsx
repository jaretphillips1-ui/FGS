"use client";

import React, { createContext, useContext, useMemo, useState } from "react";
import type { UiTier } from "@/lib/uiMode";
import { UI_OVERRIDES_STORAGE_KEY, UI_TIER_STORAGE_KEY } from "@/lib/uiMode";

type Overrides = Record<string, boolean>;

type UiModeContextValue = {
  tier: UiTier;
  setTier: (t: UiTier) => void;

  // Additive overrides (future: section-level toggles)
  overrides: Overrides;
  setOverride: (key: string, value: boolean) => void;
  toggleOverride: (key: string) => void;
};

const UiModeContext = createContext<UiModeContextValue | null>(null);

function safeReadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeWriteJson<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore storage failures (private mode, blocked storage, etc.)
  }
}

function readTierFromStorage(): UiTier {
  if (typeof window === "undefined") return "basic";
  try {
    const storedTier = localStorage.getItem(UI_TIER_STORAGE_KEY) as UiTier | null;
    if (storedTier === "basic" || storedTier === "advanced" || storedTier === "expert") {
      return storedTier;
    }
  } catch {
    // ignore
  }
  return "basic";
}

function readOverridesFromStorage(): Overrides {
  if (typeof window === "undefined") return {};
  return safeReadJson<Overrides>(UI_OVERRIDES_STORAGE_KEY, {});
}

export function UiModeProvider({ children }: { children: React.ReactNode }) {
  const [tier, setTierState] = useState<UiTier>(() => readTierFromStorage());
  const [overrides, setOverrides] = useState<Overrides>(() => readOverridesFromStorage());

  const setTier = (t: UiTier) => {
    setTierState(t);
    try {
      localStorage.setItem(UI_TIER_STORAGE_KEY, t);
    } catch {
      // ignore
    }
  };

  const setOverride = (key: string, value: boolean) => {
    setOverrides((prev) => {
      const next = { ...prev, [key]: value };
      safeWriteJson(UI_OVERRIDES_STORAGE_KEY, next);
      return next;
    });
  };

  const toggleOverride = (key: string) => {
    setOverrides((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      safeWriteJson(UI_OVERRIDES_STORAGE_KEY, next);
      return next;
    });
  };

  const value = useMemo<UiModeContextValue>(
    () => ({ tier, setTier, overrides, setOverride, toggleOverride }),
    [tier, overrides]
  );

  return <UiModeContext.Provider value={value}>{children}</UiModeContext.Provider>;
}

export function useUiMode() {
  const ctx = useContext(UiModeContext);
  if (!ctx) throw new Error("useUiMode must be used within UiModeProvider");
  return ctx;
}
