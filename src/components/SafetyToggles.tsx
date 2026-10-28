"use client";

import { ShieldCheck, X } from "lucide-react";
import { SAFETY_CATEGORIES } from "@/lib/safety";
import type { SafetyCategory } from "@/lib/types";

export function SafetyToggles({ value, onChange, compact = false }: { value: SafetyCategory[]; onChange: (v: SafetyCategory[]) => void; compact?: boolean }) {
  const toggle = (k: SafetyCategory) => onChange(value.includes(k) ? value.filter((x) => x !== k) : [...value, k].sort());
  return (
    <fieldset className="flex flex-wrap items-center gap-1.5">
      <legend className="sr-only">Brand-safety exclusions</legend>
      <span className="eyebrow mr-1.5 inline-flex items-center gap-1.5">
        <ShieldCheck className="size-3.5" strokeWidth={2} aria-hidden="true" /> Exclude
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
            className={`inline-flex min-h-9 items-center gap-1 border px-2.5 py-1 transition-colors duration-150 ${compact ? "text-label" : "text-[13px]"} ${
              on ? "border-fg bg-fg text-bg" : "border-border-soft bg-surface text-fg-2 hover:border-fg hover:text-fg"
            }`}
          >
            {on && <X className="size-3" strokeWidth={2.25} aria-hidden="true" />}
            {c.label}
          </button>
        );
      })}
    </fieldset>
  );
}
