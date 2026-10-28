export function BrandScoring({ compact = false }: { compact?: boolean }) {
  const Heading = compact ? "h3" : "h2";
  return (
    <div className={`frame ${compact ? "p-5" : "p-6 sm:p-10"}`}>
      <Heading className={`font-display leading-tight ${compact ? "text-[22px]" : "text-[34px] sm:text-[44px]"}`}>How brand matches are scored</Heading>
      <p className={`code-window mt-5 overflow-x-auto px-4 py-3.5 tabular shadow-soft ${compact ? "text-[13px]" : "text-[14px] sm:text-[17px]"}`}>
        Fit = 100 × (0.60·<b className="font-bold text-accent">A</b> + 0.40·<b className="font-bold text-accent">O</b>)
      </p>
      <dl className={`mt-6 grid gap-6 text-[15px] ${compact ? "" : "md:grid-cols-2 md:gap-8"}`}>
        <div>
          <dt className="font-semibold text-fg">A, affinity</dt>
          <dd className="mt-1.5 max-w-[62ch] leading-relaxed text-fg-2">
            Qloo&apos;s affinity of the podcast among the brand&apos;s fans (<code className="font-mono text-[13px]">/v2/insights</code>, podcast type, brand as signal),
            min-max normalised across the {compact ? "" : "30 "}podcasts Qloo returns.
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-fg">O, taste overlap</dt>
          <dd className="mt-1.5 max-w-[62ch] leading-relaxed text-fg-2">
            For the brand fans&apos; top 20 favourites in film, TV, music, books and food &amp; drink, Qloo scores how much each show&apos;s listeners like every one. A weighted
            Jaccard compares the two sets of affinities, averaged across domains and min-max normalised within the shortlist.
          </dd>
        </div>
      </dl>
      <p className="mt-6 border-t border-border-soft pt-4 text-[13px] leading-relaxed text-muted">
        <span className="block max-w-[72ch]">
          No LLM is involved: the ranking, the evidence and the outreach note all come from Qloo data and deterministic code. A fit score is a relative ranking within one
          brand&apos;s shortlist, not a prediction of reach, CPM or conversion.
        </span>
      </p>
    </div>
  );
}
