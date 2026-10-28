"use client";

import { ShieldCheck } from "lucide-react";
import { SAFETY_CATEGORIES } from "@/lib/safety";
import type { SafetyCategory } from "@/lib/types";

export function SafetyToggles({ value, onChange, compact = false }: { value: SafetyCategory[]; onChange: (v: SafetyCategory[]) => void; compact?: boolean }) {
  const toggle = (k: SafetyCategory) => onChange(value.includes(k) ? value.filter((x) => x !== k) : [...value, k].sort());
  return (
    <fieldset className="flex flex-wrap items-center gap-1.5">
      <legend className="sr-only">Brand-safety exclusions</legend>
      <span className={`mr-1 inline-flex items-center gap-1.5 text-ink-2 ${compact ? "text-xs" : "text-[13px]"}`}>
        <ShieldCheck className="size-4" aria-hidden="true" /> Exclude:
      </span>
      {SAFETY_CATEGORIES.map((c) => {
        const on = value.includes(c.key);
        return (
          <button
            key={c.key}
            type="button"
            title={c.hint}
            aria-pressed={on}
            onClick={() => toggle(c.key)}
            className={`rounded-full border px-2.5 py-1 transition ${compact ? "text-xs" : "text-[13px]"} ${
              on ? "border-ink bg-ink text-bg" : "border-line-2 bg-surface text-ink-2 hover:border-ink/40 hover:text-ink"
            }`}
          >
            {on ? "✕ " : ""}
            {c.label}
          </button>
        );
      })}
    </fieldset>
  );
}
