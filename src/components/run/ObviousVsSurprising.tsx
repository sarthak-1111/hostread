import { Bot, Check, Fingerprint, Sparkles } from "lucide-react";
import type { BaselineResult, SponsorCard } from "@/lib/types";

function median(xs: number[]): number | undefined {
  if (!xs.length) return undefined;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function ObviousVsSurprising({ baseline, deck }: { baseline?: BaselineResult; deck: SponsorCard[] }) {
  if (!baseline) {
    return (
      <section className="rounded-2xl border border-line bg-surface p-5">
        <div className="skeleton h-5 w-56" />
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="skeleton h-40" />
          <div className="skeleton h-40" />
        </div>
      </section>
    );
  }
  const surprises = deck.filter((c) => c.surpriseFit).length;
  const matched = baseline.picks.filter((p) => p.matched).length;
  const llmPct = median(baseline.picks.map((p) => p.percentile).filter((x): x is number => x !== undefined));
  const deckAff = deck.map((c) => c.score.rawAffinity).filter((x): x is number => x !== undefined);

  return (
    <section aria-labelledby="ovs" className="rounded-2xl border border-line bg-surface">
      <div className="border-b border-line p-5">
        <h2 id="ovs" className="font-serif text-[28px] leading-tight">
          Obvious <span className="text-ink-3">vs.</span> <span className="italic text-violet">Surprising</span>
        </h2>
        <p className="mt-1 text-sm text-ink-2">What a plain LLM guesses from the show&apos;s name and topic alone, next to what the taste graph found.</p>
        {baseline.available && (
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Stat value={`${surprises}/${deck.length}`} label="taste-grounded picks the plain LLM missed" tone="violet" />
            <Stat value={`${matched}/${baseline.picks.length}`} label="LLM guesses found in the taste graph" />
            <Stat
              value={llmPct !== undefined ? `${Math.round(llmPct * 100)}th` : "—"}
              label={llmPct !== undefined ? "median affinity percentile of the LLM's matched guesses among this show's candidate brands" : "LLM guesses had no measurable listener affinity"}
            />
          </div>
        )}
      </div>
      {!baseline.available ? (
        <p className="p-5 text-sm text-ink-3">{baseline.note ?? "The plain-LLM baseline wasn't available for this run."}</p>
      ) : (
        <div className="grid sm:grid-cols-2">
          <div className="border-b border-line p-5 sm:border-b-0 sm:border-r">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Bot className="size-4 text-ink-3" aria-hidden="true" /> Plain LLM <span className="font-normal text-ink-3">· no taste data</span>
            </div>
            <ol className="mt-3 space-y-1.5">
              {baseline.picks.map((p, i) => (
                <li key={`${p.name}-${i}`} className="flex items-center justify-between gap-3 text-[14px]">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="w-4 shrink-0 text-right font-mono text-[11px] text-ink-3">{i + 1}</span>
                    <span className="truncate">{p.name}</span>
                  </span>
                  <span className="shrink-0 font-mono text-[11px] text-ink-3 tabular">
                    {p.inDeck ? (
                      <span className="inline-flex items-center gap-1 text-green">
                        <Check className="size-3" /> also in deck
                      </span>
                    ) : p.percentile !== undefined ? (
                      `affinity pctl ${Math.round(p.percentile * 100)}`
                    ) : p.matched ? (
                      "no affinity signal"
                    ) : (
                      "not in taste graph"
                    )}
                  </span>
                </li>
              ))}
            </ol>
          </div>
          <div className="p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-violet">
              <Fingerprint className="size-4" aria-hidden="true" /> HostRead <span className="font-normal text-ink-3">· Qloo taste graph</span>
            </div>
            <ol className="mt-3 space-y-1.5">
              {deck.map((c) => (
                <li key={c.brand.id} className="flex items-center justify-between gap-3 text-[14px]">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="w-4 shrink-0 text-right font-mono text-[11px] text-ink-3">{c.rank}</span>
                    <span className="truncate">{c.brand.name}</span>
                    {c.surpriseFit && <Sparkles className="size-3.5 shrink-0 text-violet" aria-label="Surprise fit" />}
                  </span>
                  <span className="shrink-0 font-mono text-[11px] text-ink-3 tabular">fit {c.fit}</span>
                </li>
              ))}
            </ol>
            {deckAff.length > 0 && <p className="mt-3 text-[11.5px] text-ink-3">Every pick here comes from listener affinity in the taste graph, then overlap checks.</p>}
          </div>
        </div>
      )}
    </section>
  );
}

function Stat({ value, label, tone }: { value: string; label: string; tone?: "violet" }) {
  return (
    <div className={`rounded-xl px-3.5 py-3 ${tone === "violet" ? "bg-violet-soft" : "bg-surface-2"}`}>
      <div className={`text-2xl font-semibold tabular ${tone === "violet" ? "text-violet" : ""}`}>{value}</div>
      <div className="mt-0.5 text-[12px] leading-snug text-ink-2">{label}</div>
    </div>
  );
}
