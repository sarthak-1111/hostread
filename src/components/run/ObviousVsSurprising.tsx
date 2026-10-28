import { Bot, Check, Fingerprint, Sparkles } from "lucide-react";
import type { BaselineResult, SponsorCard } from "@/lib/types";

function median(xs: number[]): number | undefined {
  if (!xs.length) return undefined;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

const aff = (x: number) => x.toFixed(2);

export function ObviousVsSurprising({ baseline, deck }: { baseline?: BaselineResult; deck: SponsorCard[] }) {
  if (!baseline) {
    return (
      <section aria-label="Obvious vs. Surprising, loading" className="frame p-6">
        <div className="skeleton h-6 w-56" />
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="skeleton h-40" />
          <div className="skeleton h-40" />
        </div>
      </section>
    );
  }
  const surprises = deck.filter((c) => c.surpriseFit).length;
  const matched = baseline.picks.filter((p) => p.matched).length;
  // Raw Qloo affinity for this audience (0–1), the same measure on both sides.
  const llmAff = median(baseline.picks.map((p) => p.affinity).filter((x): x is number => x !== undefined));
  const deckAff = median(deck.map((c) => c.score.rawAffinity).filter((x): x is number => x !== undefined));

  return (
    <section aria-labelledby="ovs" className="frame">
      <div className="border-b border-border-soft p-5 sm:p-6">
        <h2 id="ovs" className="scroll-mt-24 font-display text-[28px] leading-tight">
          Obvious <span className="text-muted">vs.</span> <span className="title-highlight">Surprising</span>
        </h2>
        <p className="mt-1.5 max-w-[62ch] text-[15px] text-fg-2">What a plain LLM guesses from the show&apos;s name and topic alone, next to what the taste graph found.</p>
        {baseline.available && (
          <dl className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Stat value={`${surprises} of ${deck.length}`} label="Taste-grounded picks the plain LLM missed" accent />
            <Stat value={`${matched} of ${baseline.picks.length}`} label="LLM guesses found in the taste graph" />
            <Stat
              value={llmAff !== undefined && deckAff !== undefined ? `${aff(llmAff)} vs ${aff(deckAff)}` : "None"}
              label={
                llmAff !== undefined && deckAff !== undefined
                  ? "Median Qloo affinity with these listeners: the LLM's guesses vs. HostRead's picks (0 to 1)"
                  : "LLM guesses with measurable listener affinity"
              }
            />
          </dl>
        )}
      </div>
      {!baseline.available ? (
        <p className="p-5 text-sm text-muted sm:p-6">{baseline.note ?? "The plain-LLM baseline wasn't available for this run."}</p>
      ) : (
        <div className="grid sm:grid-cols-2">
          <div className="border-b border-border-soft p-5 sm:border-b-0 sm:border-r sm:p-6">
            <h3 className="flex flex-wrap items-center gap-x-2 gap-y-0.5 font-semibold">
              <Bot className="size-4 text-muted" strokeWidth={1.75} aria-hidden="true" /> Plain LLM <span className="text-sm font-normal text-muted">without taste data</span>
            </h3>
            <ol className="mt-3 space-y-2">
              {baseline.picks.map((p, i) => (
                <li key={`${p.name}-${i}`} className="flex items-center justify-between gap-3 text-[14px]">
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span className="w-5 shrink-0 text-right font-mono text-label text-muted tabular">{i + 1}</span>
                    <span className="min-w-0 break-words">{p.name}</span>
                  </span>
                  <span className="shrink-0 text-label text-muted tabular">
                    {p.inDeck ? (
                      <span className="inline-flex items-center gap-1 text-success-text">
                        <Check className="size-3" aria-hidden="true" /> Also in deck
                      </span>
                    ) : p.affinity !== undefined ? (
                      <span className="font-mono">affinity {aff(p.affinity)}</span>
                    ) : p.matched ? (
                      "No affinity signal"
                    ) : (
                      "Not in taste graph"
                    )}
                  </span>
                </li>
              ))}
            </ol>
          </div>
          <div className="p-5 sm:p-6">
            <h3 className="flex flex-wrap items-center gap-x-2 gap-y-0.5 font-semibold">
              <Fingerprint className="size-4 text-accent-text" strokeWidth={1.75} aria-hidden="true" /> HostRead <span className="text-sm font-normal text-muted">with the Qloo taste graph</span>
            </h3>
            <ol className="mt-3 space-y-2">
              {deck.map((c) => (
                <li key={c.brand.id} className="flex items-center justify-between gap-3 text-[14px]">
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span className="w-5 shrink-0 text-right font-mono text-label text-muted tabular">{c.rank}</span>
                    <span className="min-w-0 break-words">{c.brand.name}</span>
                    {c.surpriseFit && (
                      <span className="inline-flex shrink-0 items-center gap-1 text-label text-accent-text">
                        <Sparkles className="size-3" aria-hidden="true" /> Surprise
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 font-mono text-label text-muted tabular">
                    {c.score.rawAffinity !== undefined ? `affinity ${aff(c.score.rawAffinity)} · ` : ""}fit {c.fit}
                  </span>
                </li>
              ))}
            </ol>
            <p className="mt-4 text-label text-muted">Every pick here comes from listener affinity in the taste graph, then the overlap check.</p>
          </div>
        </div>
      )}
    </section>
  );
}

function Stat({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  return (
    <div className={`flex flex-col-reverse border px-4 py-3.5 ${accent ? "border-accent bg-accent-wash" : "border-border-soft bg-bg"}`}>
      <dt className="mt-1 text-[13px] leading-snug text-fg-2">{label}</dt>
      <dd className={`font-display text-[28px] leading-none tabular ${accent ? "text-accent-text" : ""}`}>{value}</dd>
    </div>
  );
}
