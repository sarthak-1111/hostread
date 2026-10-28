import { MapPin, Users } from "lucide-react";
import { DOMAIN_META } from "../domain";
import type { Demographics, DomainProfile, GeoPoint } from "@/lib/types";

const AGE_LABEL: Record<string, string> = {
  "24_and_younger": "≤24",
  "25_to_29": "25–29",
  "30_to_34": "30–34",
  "35_to_44": "35–44",
  "45_to_54": "45–54",
  "55_and_older": "55+",
};

function SkewBar({ label, value }: { label: string; value: number }) {
  const v = Math.max(-1, Math.min(1, value));
  const pct = Math.abs(v) * 50;
  return (
    <div className="grid grid-cols-[48px_1fr_44px] items-center gap-2 text-[12.5px]">
      <span className="text-ink-2">{label}</span>
      <div className="relative h-2.5 rounded-full bg-surface-2">
        <span className="absolute inset-y-0 left-1/2 w-px bg-line-2" />
        <span className={`absolute inset-y-0 rounded-full ${v >= 0 ? "bg-accent" : "bg-ink-3/50"}`} style={v >= 0 ? { left: "50%", width: `${pct}%` } : { right: "50%", width: `${pct}%` }} />
      </div>
      <span className="text-right font-mono text-[11px] text-ink-3 tabular">
        {v > 0 ? "+" : ""}
        {(v * 100).toFixed(0)}
      </span>
    </div>
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
    <section aria-labelledby="snap" className="rounded-2xl border border-line bg-surface">
      <div className="flex flex-wrap items-end justify-between gap-2 border-b border-line p-5">
        <div>
          <h2 id="snap" className="font-serif text-[28px] leading-tight">
            Audience snapshot
          </h2>
          <p className="mt-1 text-sm text-ink-2">{podcastName ? `What ${podcastName} listeners over-index on` : "What listeners over-index on"}, across domains.</p>
        </div>
        <span className="text-[11.5px] text-ink-3">Aggregate Qloo affinities — not data about individuals.</span>
      </div>
      {!profile ? (
        <div className="grid gap-4 p-5 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-36" />
          ))}
        </div>
      ) : (
        <div className="grid gap-x-6 gap-y-6 p-5 sm:grid-cols-2 lg:grid-cols-3">
          {domains.map((p) => {
            const M = DOMAIN_META[p.domain];
            return (
              <div key={p.domain} className="print-avoid">
                <div className="flex items-center gap-1.5 text-[13px] font-semibold">
                  <M.Icon className={`size-4 ${M.tint}`} aria-hidden="true" /> {M.label}
                </div>
                <ol className="mt-2 space-y-1">
                  {p.entities.slice(0, 5).map((e, i) => (
                    <li key={e.id} className="flex items-baseline gap-2 text-[13.5px]">
                      <span className="w-3 shrink-0 font-mono text-[10.5px] text-ink-3">{i + 1}</span>
                      <span className="min-w-0 truncate">{e.name}</span>
                      {e.subtitle && <span className="hidden shrink-0 truncate text-[11.5px] text-ink-3 sm:inline">{e.subtitle}</span>}
                    </li>
                  ))}
                </ol>
              </div>
            );
          })}
          {domains.length === 0 && <p className="text-sm text-ink-3">No taste profile was returned for this show.</p>}
        </div>
      )}
      {(demographics || (geography && geography.length > 0)) && (
        <div className="grid gap-6 border-t border-line p-5 sm:grid-cols-2">
          {demographics && (
            <div className="print-avoid">
              <div className="flex items-center gap-1.5 text-[13px] font-semibold">
                <Users className="size-4 text-ink-2" aria-hidden="true" /> Age &amp; gender skew
              </div>
              <p className="mt-0.5 text-[11.5px] text-ink-3">Relative to the average audience (0 = average).</p>
              <div className="mt-3 space-y-1.5">
                {Object.entries(demographics.age).map(([k, v]) => (
                  <SkewBar key={k} label={AGE_LABEL[k] ?? k.replace(/_/g, " ")} value={v} />
                ))}
                {Object.entries(demographics.gender).map(([k, v]) => (
                  <SkewBar key={k} label={k[0].toUpperCase() + k.slice(1)} value={v} />
                ))}
              </div>
            </div>
          )}
          {geography && geography.length > 0 && (
            <div className="print-avoid">
              <div className="flex items-center gap-1.5 text-[13px] font-semibold">
                <MapPin className="size-4 text-ink-2" aria-hidden="true" /> Where listeners over-index
              </div>
              <ol className="mt-3 space-y-1.5">
                {geography.slice(0, 6).map((g, i) => (
                  <li key={`${g.name}-${i}`} className="flex items-center justify-between text-[13.5px]">
                    <span>
                      <span className="mr-2 font-mono text-[10.5px] text-ink-3">{i + 1}</span>
                      {g.name}
                    </span>
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
