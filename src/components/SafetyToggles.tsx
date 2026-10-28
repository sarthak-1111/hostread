"use client";

import { ShieldCheck, X } from "lucide-react";
import { SAFETY_CATEGORIES } from "@/lib/safety";
import type { SafetyCategory } from "@/lib/types";

export function SafetyToggles({ value, onChange, compact = false }: { value: SafetyCategory[]; onChange: (v: SafetyCategory[]) => void; compact?: boolean }) {
  const toggle = (k: SafetyCategory) => onChange(value.includes(k) ? value.filter((x) => x !== k) : [...value, k].sort());
  return (
    <fieldset className="flex flex-wrap items-center gap-1.5">
      <legend className="sr-only">Brand-safety exclusions</legend>
      <span className={`mr-1 inline-flex items-center gap-1.5 text-fg-2 ${compact ? "text-label" : "text-[13px]"}`}>
        <ShieldCheck className="size-4 text-muted" strokeWidth={1.75} aria-hidden="true" /> Exclude
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
            className={`inline-flex min-h-7 items-center gap-1 rounded-full px-3 py-1 transition-colors duration-150 ${compact ? "text-label" : "text-[13px]"} ${
              on ? "bg-fg text-bg" : "bg-surface text-fg-2 shadow-[0_0_0_1px_var(--ring-warm)] hover:text-fg hover:shadow-[0_0_0_1px_var(--meta)]"
            }`}
          >
            {on && <X className="size-3" strokeWidth={2} aria-hidden="true" />}
            {c.label}
          </button>
        );
      })}
    </fieldset>
  );
}
