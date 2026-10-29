"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export interface TabItem<K extends string> {
  key: K;
  label: string;
  /** Label on phone widths, where the full row would not fit. */
  short?: string;
  Icon?: LucideIcon;
  /** Small count or note after the label, e.g. "8". */
  badge?: ReactNode;
  /** Pulsing dot, e.g. while the agent is still working. */
  live?: boolean;
}

/**
 * WAI-ARIA tabs: arrow keys, Home and End move between tabs (roving tabindex),
 * and each tab controls the panel with the matching id. Sticks under the site
 * header so the sections stay one click away on long pages. On narrow screens
 * the row scrolls sideways, fades at the edge while more tabs are hidden, and
 * keeps the active tab in view.
 */
export function TabList<K extends string>({
  id,
  label,
  tabs,
  active,
  onChange,
  className = "",
}: {
  id: string;
  label: string;
  tabs: TabItem<K>[];
  active: K;
  onChange: (k: K) => void;
  /** Spacing etc. Render the list as a direct child of the page, not inside a wrapper, or it can't stick. */
  className?: string;
}) {
  const refs = useRef<Partial<Record<K, HTMLButtonElement | null>>>({});
  const rowRef = useRef<HTMLDivElement>(null);
  const [moreRight, setMoreRight] = useState(false);

  const measure = () => {
    const row = rowRef.current;
    if (row) setMoreRight(row.scrollLeft + row.clientWidth < row.scrollWidth - 4);
  };
  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);
  // Bring the active tab into view sideways only; never scroll the page.
  useEffect(() => {
    const row = rowRef.current;
    const el = refs.current[active];
    if (!row || !el) return;
    const left = el.offsetLeft - 24;
    const right = el.offsetLeft + el.offsetWidth + 24;
    if (left < row.scrollLeft) row.scrollTo({ left });
    else if (right > row.scrollLeft + row.clientWidth) row.scrollTo({ left: right - row.clientWidth });
    measure();
  }, [active]);

  const move = (from: K, delta: number | "first" | "last") => {
    const i = tabs.findIndex((t) => t.key === from);
    const j = delta === "first" ? 0 : delta === "last" ? tabs.length - 1 : (i + delta + tabs.length) % tabs.length;
    const next = tabs[j].key;
    onChange(next);
    refs.current[next]?.focus();
  };
  return (
    <div className={`no-print sticky top-16 z-20 -mx-4 border-b border-border-soft bg-[var(--tm-header-bg)] px-4 backdrop-blur-sm sm:-mx-6 sm:px-6 ${className}`}>
      <div
        ref={rowRef}
        role="tablist"
        aria-label={label}
        onScroll={measure}
        className={`relative -mb-px flex gap-0.5 overflow-x-auto [scrollbar-width:none] sm:gap-1 ${moreRight ? "[mask-image:linear-gradient(to_right,black_82%,transparent)]" : ""}`}
      >
        {tabs.map((t) => {
          const selected = t.key === active;
          return (
            <button
              key={t.key}
              ref={(el) => {
                refs.current[t.key] = el;
              }}
              type="button"
              role="tab"
              id={`${id}-tab-${t.key}`}
              aria-selected={selected}
              aria-controls={`${id}-panel-${t.key}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(t.key)}
              onKeyDown={(e) => {
                if (e.key === "ArrowRight") move(t.key, 1);
                else if (e.key === "ArrowLeft") move(t.key, -1);
                else if (e.key === "Home") move(t.key, "first");
                else if (e.key === "End") move(t.key, "last");
                else return;
                e.preventDefault();
              }}
              className={`inline-flex min-h-12 shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-2.5 font-mono text-[12px] font-bold uppercase tracking-[0.08em] transition-colors duration-150 sm:px-3 ${
                selected ? "border-accent text-fg" : "border-transparent text-muted hover:text-fg"
              }`}
            >
              {t.live ? (
                <span className="on-air size-1.5 rounded-full bg-accent" aria-hidden="true" />
              ) : t.Icon ? (
                <t.Icon className="hidden size-3.5 sm:block" strokeWidth={2} aria-hidden="true" />
              ) : null}
              {t.short ? (
                <>
                  <span className="sm:hidden">{t.short}</span>
                  <span className="hidden sm:inline">{t.label}</span>
                </>
              ) : (
                t.label
              )}
              {t.badge !== undefined && t.badge !== null && (
                <span className={`px-1.5 py-px text-[11px] tabular ${selected ? "bg-fg text-bg" : "bg-border-soft text-fg-2"}`}>{t.badge}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function TabPanel<K extends string>({ id, k, active, children, className = "" }: { id: string; k: K; active: K; children: ReactNode; className?: string }) {
  // Inactive panels stay mounted (hidden), so open cards and written pitches survive tab switches.
  return (
    <div role="tabpanel" id={`${id}-panel-${k}`} aria-labelledby={`${id}-tab-${k}`} hidden={k !== active} tabIndex={0} className={`focus-visible:outline-none ${className}`}>
      {children}
    </div>
  );
}
