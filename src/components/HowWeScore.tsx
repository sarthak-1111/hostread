import { Sigma } from "lucide-react";

export function HowWeScore({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`rounded-2xl border border-line bg-surface ${compact ? "p-5" : "p-6 sm:p-8"}`}>
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-ink-3">
        <Sigma className="size-4" aria-hidden="true" /> How we score
      </div>
      <div className={`mt-3 font-mono tabular ${compact ? "text-[15px]" : "text-lg sm:text-xl"} tracking-tight`}>
        Fit = 100 × (<span className="text-accent-ink">0.50·A</span> + <span className="text-violet">0.35·O</span> + <span className="text-green">0.15·S</span>)
      </div>
      <dl className={`mt-5 grid gap-4 ${compact ? "" : "sm:grid-cols-3"} text-sm`}>
        <div>
          <dt className="font-semibold text-accent-ink">A · Audience affinity</dt>
          <dd className="mt-1 leading-relaxed text-ink-2">
            Qloo&apos;s affinity of the brand among this show&apos;s listeners (<code className="font-mono text-xs">/v2/insights</code>, brand type, show as signal), min–max
            normalised across the candidate brands.
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-violet">O · Taste overlap</dt>
          <dd className="mt-1 leading-relaxed text-ink-2">
            Weighted Jaccard between the listeners&apos; and the brand fans&apos; top 40 entities in film, TV, music, books and dining (rank-weighted), averaged across domains and
            scaled so the best overlap in the deck = 1.
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-green">S · Surprise</dt>
          <dd className="mt-1 leading-relaxed text-ink-2">1 when a plain LLM, given only the show&apos;s name and topic, did not suggest the brand. These get the “Surprise fit” badge.</dd>
        </div>
      </dl>
      <p className="mt-5 border-t border-line pt-4 text-[13px] leading-relaxed text-ink-3">
        Scores are computed by deterministic code, never by the LLM. A fit score is a relative ranking within one show&apos;s deck — not a prediction of revenue, CPM or
        conversion.
      </p>
    </div>
  );
}
