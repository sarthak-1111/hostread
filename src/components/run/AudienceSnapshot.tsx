import { MapPin, Users } from "lucide-react";
import { DOMAIN_META } from "../domain";
import type { Demographics, DomainProfile, GeoPoint } from "@/lib/types";

const AGE_LABEL: Record<string, string> = {
  "24_and_younger": "24 and under",
  "25_to_29": "25-29",
  "30_to_34": "30-34",
  "35_to_44": "35-44",
  "45_to_54": "45-54",
  "55_and_older": "55 and over",
};

/**
 * Skew vs. the average audience as a diverging bar table: one series, one hue.
 * Polarity is carried by direction from the zero line and the signed value,
 * so no second colour is needed; the table is also the accessible view.
 */
function SkewTable({ caption, rows }: { caption: string; rows: { label: string; value: number }[] }) {
  return (
    <table className="w-full text-[13px]">
      <caption className="sr-only">{caption}, relative to the average audience (0 is average, positive means over-index)</caption>
      <thead className="sr-only">
        <tr>
          <th scope="col">Group</th>
          <th scope="col">Skew chart</th>
          <th scope="col">Skew</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ label, value }) => {
          const v = Math.max(-1, Math.min(1, value));
          const pct = Math.abs(v) * 50;
          const shown = `${v > 0 ? "+" : ""}${(v * 100).toFixed(0)}`;
          return (
            <tr key={label} className="group" title={`${label}: ${shown} vs. average`}>
              <th scope="row" className="w-24 py-1 pr-3 text-left font-normal text-fg-2">
                {label}
              </th>
              <td className="py-1" aria-hidden="true">
                <div className="relative h-2.5">
                  <span className="absolute inset-y-[-3px] left-1/2 w-px bg-border-soft" />
                  <span
                    className={`absolute inset-y-0 bg-accent transition-opacity duration-150 group-hover:opacity-80 ${v >= 0 ? "rounded-r-[4px]" : "rounded-l-[4px]"}`}
                    style={v >= 0 ? { left: "50%", width: `${pct}%` } : { right: "50%", width: `${pct}%` }}
                  />
                </div>
              </td>
              <td className="w-12 py-1 pl-3 text-right text-label text-muted tabular">{shown}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function AudienceSnapshot({
  profile,
  demographics,
  geography,
  podcastName,
}: {
  profile?: DomainProfile[];
  demographics?: Demographics | null;
  geography?: GeoPoint[] | null;
  podcastName?: string;
}) {
  const domains = (profile ?? []).filter((p) => p.entities.length > 0);
  return (
    <section aria-labelledby="snap" className="rounded-lg bg-surface shadow-[0_0_0_1px_var(--border-soft)]">
      <div className="border-b border-border-soft p-5 sm:p-6">
        <h2 id="snap" className="scroll-mt-24 font-display text-[28px] leading-tight">
          Audience snapshot
        </h2>
        <p className="mt-1.5 max-w-[62ch] text-[15px] text-fg-2">
          {podcastName ? `What ${podcastName} listeners over-index on` : "What listeners over-index on"}, across domains. Aggregate Qloo affinities, not data about
          individuals.
        </p>
      </div>
      {!profile ? (
        <div className="grid gap-4 p-5 sm:grid-cols-3 sm:p-6">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-36" />
          ))}
        </div>
      ) : (
        <div className="grid gap-x-8 gap-y-7 p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-3">
          {domains.map((p) => {
            const M = DOMAIN_META[p.domain];
            return (
              <div key={p.domain} className="print-avoid">
                <h3 className="flex items-center gap-1.5 text-[14px] font-medium">
                  <M.Icon className="size-4 text-muted" strokeWidth={1.75} aria-hidden="true" /> {M.label}
                </h3>
                <ol className="mt-2.5 space-y-1.5">
                  {p.entities.slice(0, 5).map((e, i) => (
                    <li key={e.id} className="flex items-baseline gap-2.5 text-[14px] leading-snug">
                      <span className="w-3 shrink-0 text-label text-muted tabular">{i + 1}</span>
                      <span className="min-w-0 break-words">
                        {e.name}
                        {e.subtitle && <span className="block text-label text-muted">{e.subtitle}</span>}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            );
          })}
          {domains.length === 0 && <p className="text-sm text-muted">No taste profile was returned for this show.</p>}
        </div>
      )}
      {(demographics || (geography && geography.length > 0)) && (
        <div className="grid gap-8 border-t border-border-soft p-5 sm:grid-cols-2 sm:p-6">
          {demographics && (
            <div className="print-avoid">
              <h3 className="flex items-center gap-1.5 text-[14px] font-medium">
                <Users className="size-4 text-muted" strokeWidth={1.75} aria-hidden="true" /> Age and gender skew
              </h3>
              <p className="mt-0.5 text-label text-muted">Compared with the average audience. 0 is average; bars to the right over-index.</p>
              <div className="mt-3 space-y-3">
                <SkewTable caption="Age skew" rows={Object.entries(demographics.age).map(([k, v]) => ({ label: AGE_LABEL[k] ?? k.replace(/_/g, " "), value: v }))} />
                <SkewTable caption="Gender skew" rows={Object.entries(demographics.gender).map(([k, v]) => ({ label: k[0].toUpperCase() + k.slice(1), value: v }))} />
              </div>
            </div>
          )}
          {geography && geography.length > 0 && (
            <div className="print-avoid">
              <h3 className="flex items-center gap-1.5 text-[14px] font-medium">
                <MapPin className="size-4 text-muted" strokeWidth={1.75} aria-hidden="true" /> Where listeners over-index
              </h3>
              <ol className="mt-3 space-y-1.5">
                {geography.slice(0, 6).map((g, i) => (
                  <li key={`${g.name}-${i}`} className="flex items-baseline gap-2.5 text-[14px]">
                    <span className="w-3 shrink-0 text-label text-muted tabular">{i + 1}</span>
                    {g.name}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
