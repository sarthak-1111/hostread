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
        <div className="mt-8">
          <p className="eyebrow mb-3">Or open an example deck</p>
          <div className="flex flex-wrap gap-2">
            {examples.map((ex) => (
              <button
                key={ex.name}
                type="button"
                onClick={() => go(ex)}
                className="group inline-flex min-h-10 items-center gap-2 border border-border-soft bg-surface py-1.5 pl-3 pr-2.5 text-[14px] transition-[border-color,box-shadow] duration-150 hover:border-fg hover:shadow-soft"
              >
                <span className="font-medium">{ex.name}</span>
                <span className="text-label text-muted">{ex.genre}</span>
                <ArrowUpRight className="size-3.5 text-muted transition-colors duration-150 group-hover:text-accent-text" aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
