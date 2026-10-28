"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { SearchBox, type Suggestion } from "./SearchBox";
import { SafetyToggles } from "./SafetyToggles";
import type { SafetyCategory } from "@/lib/types";

export interface LaunchExample {
  name: string;
  genre: string;
  id?: string;
}

export function showHref(p: { id?: string; name: string }, exclude: SafetyCategory[]) {
  const qs = new URLSearchParams();
  if (p.id) qs.set("name", p.name);
  else qs.set("q", p.name);
  if (exclude.length) qs.set("x", exclude.join(","));
  return p.id ? `/show/${encodeURIComponent(p.id)}?${qs}` : `/run?${qs}`;
}

export function LaunchPanel({ examples }: { examples: LaunchExample[] }) {
  const router = useRouter();
  const [exclude, setExclude] = useState<SafetyCategory[]>([]);
  const go = (p: { id?: string; name: string }) => router.push(showHref(p, exclude));
  return (
    <div className="w-full">
      <SearchBox autoFocus onPick={(s: Suggestion) => go({ id: s.id, name: s.name })} onFreeText={(q) => go({ name: q })} />
      <div className="mt-4">
        <SafetyToggles value={exclude} onChange={setExclude} />
      </div>
      {examples.length > 0 && (
        <div className="mt-7">
          <div className="mb-2.5 text-xs font-medium uppercase tracking-[0.14em] text-ink-3">Try a show</div>
          <div className="flex flex-wrap gap-2">
            {examples.map((ex) => (
              <button
                key={ex.name}
                type="button"
                onClick={() => go(ex)}
                className="group inline-flex items-center gap-2 rounded-full border border-line-2 bg-surface py-1.5 pl-3 pr-2 text-[14px] transition hover:border-ink/40"
              >
                <span className="font-medium">{ex.name}</span>
                <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-ink-3">{ex.genre}</span>
                <ArrowUpRight className="size-3.5 text-ink-3 transition group-hover:text-ink" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
