"use client";

import { useRouter } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { SearchBox, type Suggestion } from "../SearchBox";
import type { LaunchExample } from "../LaunchPanel";

export function brandHref(b: { id?: string; name: string }) {
  const qs = new URLSearchParams();
  if (b.id) {
    qs.set("id", b.id);
    qs.set("name", b.name);
  } else qs.set("q", b.name);
  return `/brands/match?${qs}`;
}

export function BrandLaunch({ examples }: { examples: LaunchExample[] }) {
  const router = useRouter();
  const go = (b: { id?: string; name: string }) => router.push(brandHref(b));
  return (
    <div className="w-full">
      <SearchBox kind="brand" autoFocus onPick={(s: Suggestion) => go({ id: s.id, name: s.name })} onFreeText={(q) => go({ name: q })} />
      {examples.length > 0 && (
        <div className="mt-8">
          <p className="eyebrow mb-3">Or try a brand</p>
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
