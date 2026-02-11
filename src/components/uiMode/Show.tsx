"use client";

import type { UiTier } from "@/lib/uiMode";
import { tierGte } from "@/lib/uiMode";
import { useUiMode } from "@/components/uiMode/UiModeProvider";

export type ShowProps = {
  minTier?: UiTier;       // default basic
  overrideKey?: string;   // if true in overrides, always show
  children: React.ReactNode;
};

export default function Show({ minTier = "basic", overrideKey, children }: ShowProps) {
  const { tier, overrides } = useUiMode();

  const forced = overrideKey ? !!overrides[overrideKey] : false;
  const allowed = tierGte(tier, minTier);

  if (!forced && !allowed) return null;
  return <>{children}</>;
}
