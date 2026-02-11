"use client";

import { UI_TIER_LABEL, UI_TIERS, type UiTier } from "@/lib/uiMode";
import { useUiMode } from "@/components/uiMode/UiModeProvider";

export default function UiModePicker() {
  const { tier, setTier } = useUiMode();

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-500 hidden sm:inline">Mode</span>
      <select
        className="border rounded px-2 py-1 text-sm bg-white"
        value={tier}
        onChange={(e) => setTier(e.target.value as UiTier)}
        aria-label="UI mode"
      >
        {UI_TIERS.map((t) => (
          <option key={t} value={t}>
            {UI_TIER_LABEL[t]}
          </option>
        ))}
      </select>
    </div>
  );
}
