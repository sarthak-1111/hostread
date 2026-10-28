"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ArrowRight, LoaderCircle, Search } from "lucide-react";
import { EntityImage } from "./domain";

export interface Suggestion {
  id: string;
  name: string;
  subtitle?: string;
  image?: string;
  sample?: boolean;
}

export function SearchBox({
  onPick,
  onFreeText,
  placeholder = "Search a podcast, e.g. How I Built This",
  size = "lg",
  autoFocus = false,
}: {
  onPick: (s: Suggestion) => void;
  onFreeText: (q: string) => void;
  placeholder?: string;
  size?: "lg" | "md";
  autoFocus?: boolean;
}) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listId = useId();
  const boxRef = useRef<HTMLDivElement>(null);
  const reqId = useRef(0);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setItems([]);
      setLoading(false);
      return;
    }
    const id = ++reqId.current;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`);
        const json = (await res.json()) as { results?: Suggestion[]; error?: string };
        if (id !== reqId.current) return;
        setItems(json.results ?? []);
        setError(json.error ?? null);
        setActive(-1);
        setOpen(true);
      } catch {
        if (id === reqId.current) setError("Search is unavailable right now.");
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    }, 220);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const submit = () => {
    if (active >= 0 && items[active]) return onPick(items[active]);
    const exact = items.find((i) => i.name.toLowerCase() === q.trim().toLowerCase());
    if (exact) return onPick(exact);
    if (q.trim().length >= 2) onFreeText(q.trim());
  };

  const big = size === "lg";
  return (
    <div ref={boxRef} className="relative w-full">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className={`flex items-center gap-2 rounded-2xl border border-line-2 bg-surface shadow-card transition focus-within:border-ink/50 focus-within:ring-4 focus-within:ring-accent/10 ${big ? "p-2 pl-4" : "p-1.5 pl-3"}`}
      >
        <Search className={`${big ? "size-5" : "size-4"} shrink-0 text-ink-3`} aria-hidden="true" />
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => items.length && setOpen(true)}
          onKeyDown={(e) => {
            if (!open || !items.length) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(items.length - 1, a + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(-1, a - 1));
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          placeholder={placeholder}
          aria-label="Podcast name"
          role="combobox"
          aria-expanded={open && items.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          autoComplete="off"
          autoFocus={autoFocus}
          spellCheck={false}
          className={`min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-ink-3 focus-visible:outline-none ${big ? "h-11 text-[17px]" : "h-9 text-[15px]"}`}
        />
        {loading && <LoaderCircle className="size-4 shrink-0 animate-spin text-ink-3" aria-label="Searching" />}
        <button
          type="submit"
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-ink font-medium text-bg transition hover:opacity-90 disabled:opacity-40 ${big ? "h-11 px-5 text-[15px]" : "h-9 px-3.5 text-sm"}`}
          disabled={q.trim().length < 2}
        >
          <span className="hidden sm:inline">Find sponsors</span>
          <ArrowRight className="size-4" />
        </button>
      </form>
      {open && q.trim().length >= 2 && (items.length > 0 || error || !loading) && (
        <ul id={listId} role="listbox" className="absolute left-0 right-0 top-full z-40 mt-2 max-h-[360px] overflow-auto rounded-2xl border border-line bg-surface p-1.5 shadow-card">
          {items.map((s, i) => (
            <li
              key={s.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                onPick(s);
              }}
              className={`flex cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2 ${i === active ? "bg-surface-2" : ""}`}
            >
              <EntityImage src={s.image} name={s.name} className="size-9" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px] font-medium">{s.name}</div>
                {s.subtitle && <div className="truncate text-xs text-ink-3">{s.subtitle}</div>}
              </div>
              {s.sample && <span className="rounded bg-amber-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber">sample</span>}
            </li>
          ))}
          {!items.length && !loading && (
            <li className="px-3 py-3 text-sm text-ink-3">{error ?? `No podcasts found for “${q.trim()}”. Press Enter to let the agent search anyway.`}</li>
          )}
        </ul>
      )}
    </div>
  );
}
