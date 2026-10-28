export function HowWeScore({ compact = false }: { compact?: boolean }) {
  const Heading = compact ? "h3" : "h2";
  return (
    <div className={`rounded-lg bg-surface shadow-[0_0_0_1px_var(--border-soft)] ${compact ? "p-5" : "p-6 sm:p-10"}`}>
      <Heading className={`font-display leading-tight ${compact ? "text-[22px]" : "text-[32px] sm:text-[36px]"}`}>How we score</Heading>
      <p className={`mt-4 overflow-x-auto font-mono tabular text-fg ${compact ? "text-[14px]" : "text-[15px] sm:text-[18px]"}`}>
        Fit = 100 × (0.50·<b className="font-semibold">A</b> + 0.35·<b className="font-semibold">O</b> + 0.15·<b className="font-semibold">S</b>)
      </p>
      <dl className={`mt-6 grid gap-6 text-[15px] ${compact ? "" : "md:grid-cols-3 md:gap-8"}`}>
        <div>
          <dt className="font-medium text-fg">A, audience affinity</dt>
          <dd className="mt-1.5 max-w-[62ch] leading-relaxed text-fg-2">
            Qloo&apos;s affinity of the brand among this show&apos;s listeners (<code className="font-mono text-[13px]">/v2/insights</code>, brand type, show as signal),
            min-max normalised across the candidate brands.
          </dd>
        </div>
        <div>
          <dt className="font-medium text-fg">O, taste overlap</dt>
          <dd className="mt-1.5 max-w-[62ch] leading-relaxed text-fg-2">
            Weighted Jaccard between the listeners&apos; and the brand fans&apos; top 40 entities in film, TV, music, books and dining, averaged across domains and scaled so the
            best overlap in the deck is 1.
          </dd>
        </div>
        <div>
          <dt className="font-medium text-fg">S, surprise</dt>
          <dd className="mt-1.5 max-w-[62ch] leading-relaxed text-fg-2">
            1 when a plain LLM, given only the show&apos;s name and topic, did not suggest the brand. These brands get the Surprise fit badge.
          </dd>
        </div>
      </dl>
      <p className="mt-6 border-t border-border-soft pt-4 text-[13px] leading-relaxed text-muted">
        <span className="block max-w-[72ch]">
          Scores come from deterministic code, never from the LLM. A fit score is a relative ranking within one show&apos;s deck, not a prediction of revenue, CPM or conversion.
        </span>
      </p>
    </div>
  );
}
