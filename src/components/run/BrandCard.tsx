"use client";

import { useState } from "react";
import { ChevronDown, FileText, LoaderCircle, Mail, PenLine, ScanSearch, ShieldCheck, Sparkles } from "lucide-react";
import { DOMAIN_META, EntityImage, EvidenceChip } from "../domain";
import { CopyButton } from "./CopyButton";
import type { DomainKey, PitchPack, SponsorCard } from "@/lib/types";

/** Fit score: a single-hue radial meter; the track is a lighter step of the same hue. */
function ScoreRing({ value }: { value: number }) {
  const r = 24;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="relative grid size-16 shrink-0 place-items-center" role="img" aria-label={`Fit ${v} out of 100, a relative ranking within this deck`}>
      <svg viewBox="0 0 60 60" className="absolute inset-0 -rotate-90" aria-hidden="true">
        <circle cx="30" cy="30" r={r} fill="none" strokeWidth="4" className="stroke-accent-track" />
        <circle cx="30" cy="30" r={r} fill="none" strokeWidth="4" strokeLinecap="round" className="stroke-accent" strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)} />
      </svg>
      <div className="text-center leading-none" aria-hidden="true">
        <div className={`${v >= 100 ? "text-base" : "text-xl"} font-semibold tabular`}>{v}</div>
        <div className="mt-1 text-label text-muted">fit</div>
      </div>
    </div>
  );
}

/** The three score components as labelled meters (value / max points). */
function Breakdown({ card }: { card: SponsorCard }) {
  const parts = [
    { label: "Affinity", value: 50 * card.score.affinity, max: 50, hint: "Qloo affinity of the brand among this show's listeners, normalised across candidates" },
    { label: "Overlap", value: 35 * card.score.overlap, max: 35, hint: "Shared tastes between listeners and the brand's fans, scaled to the deck's best" },
    { label: "Surprise", value: 15 * card.score.surprise, max: 15, hint: "15 when the plain-LLM baseline did not name this brand" },
  ];
  return (
    <dl className="grid grid-cols-3 gap-4">
      {parts.map((p) => (
        <div key={p.label} title={p.hint}>
          <dt className="text-label text-muted">{p.label}</dt>
          <dd className="mt-0.5 text-sm font-medium tabular">
            {p.value.toFixed(0)}
            <span className="font-normal text-muted">/{p.max}</span>
          </dd>
          <div className="mt-1.5 h-1 rounded-full bg-accent-track" aria-hidden="true">
            <div className="h-full rounded-full bg-accent" style={{ width: `${(p.value / p.max) * 100}%` }} />
          </div>
        </div>
      ))}
    </dl>
  );
}

type Tab = "evidence" | "email" | "script";

const tabBtn = (active: boolean) =>
  `inline-flex min-h-9 items-center gap-1.5 rounded-sm px-3 py-1.5 text-[13px] font-medium transition-colors duration-150 ${
    active ? "bg-fg text-bg" : "bg-surface-warm text-fg-2 hover:text-fg hover:shadow-[0_0_0_1px_var(--ring-warm)]"
  }`;

export function BrandCard({
  card,
  pitch,
  pitchPending,
  onWritePitch,
  writing,
}: {
  card: SponsorCard;
  pitch?: PitchPack;
  pitchPending: boolean;
  onWritePitch: () => void;
  writing: boolean;
}) {
  const [tab, setTab] = useState<Tab | null>(null);
  const toggle = (t: Tab) => setTab((cur) => (cur === t ? null : t));
  const emailText = pitch ? `Subject: ${pitch.subject}\n\n${pitch.email}` : "";
  const panelId = `card-${card.brand.id}-panel`;

  const byDomain = new Map<DomainKey, typeof card.evidence>();
  for (const e of card.evidence) byDomain.set(e.domain, [...(byDomain.get(e.domain) ?? []), e]);

  return (
    <article className="rise print-avoid rounded-lg bg-surface shadow-[0_0_0_1px_var(--border-soft)]" aria-labelledby={`card-${card.brand.id}-name`}>
      <div className="p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <div className="relative">
            <EntityImage src={card.brand.image} name={card.brand.name} className="size-12" />
            <span className="absolute -left-2 -top-2 grid size-6 place-items-center rounded-full bg-fg text-label font-semibold text-bg ring-2 ring-surface tabular">{card.rank}</span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <h3 id={`card-${card.brand.id}-name`} className="font-display text-[22px] leading-tight">
                {card.brand.name}
              </h3>
              {card.surpriseFit && (
                <span
                  className="inline-flex items-center gap-1 rounded-full bg-accent-wash px-2.5 py-0.5 text-label font-medium text-accent-text"
                  title="A plain LLM didn't suggest this brand from the show's name and topic"
                >
                  <Sparkles className="size-3" strokeWidth={2} aria-hidden="true" /> Surprise fit
                </span>
              )}
              {card.brand.sample && <span className="rounded-full bg-warn-wash px-2 py-0.5 text-label font-medium text-warn-ink">Sample</span>}
            </div>
            {card.brand.category && <div className="mt-1 text-sm text-muted">{card.brand.category}</div>}
          </div>
          <ScoreRing value={card.fit} />
        </div>

        <div className="mt-5">
          <p className="mb-2 text-[13px] text-fg-2">Listeners and {card.brand.name} fans both love</p>
          {card.topEvidence.length ? (
            <div className="flex flex-wrap gap-1.5">
              {card.topEvidence.map((e) => (
                <EvidenceChip key={`${e.domain}-${e.entity.id}`} domain={e.domain} name={e.entity.name} />
              ))}
            </div>
          ) : (
            <p className="text-[13px] text-muted">No shared favourites in the top 40, so this pick rests on audience affinity.</p>
          )}
        </div>

        <div className="mt-5">
          <Breakdown card={card} />
        </div>

        <div className="no-print mt-5 flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => toggle("evidence")} aria-expanded={tab === "evidence"} aria-controls={panelId} className={tabBtn(tab === "evidence")}>
            <ScanSearch className="size-3.5" strokeWidth={1.75} aria-hidden="true" /> Evidence
            <ChevronDown className={`size-3.5 transition-transform duration-150 ${tab === "evidence" ? "rotate-180" : ""}`} aria-hidden="true" />
          </button>
          {pitch ? (
            <>
              <button type="button" onClick={() => toggle("email")} aria-expanded={tab === "email"} aria-controls={panelId} className={tabBtn(tab === "email")}>
                <Mail className="size-3.5" strokeWidth={1.75} aria-hidden="true" /> Pitch email
              </button>
              <button type="button" onClick={() => toggle("script")} aria-expanded={tab === "script"} aria-controls={panelId} className={tabBtn(tab === "script")}>
                <FileText className="size-3.5" strokeWidth={1.75} aria-hidden="true" /> Ad script
              </button>
              <span className="mx-1 hidden h-5 w-px bg-border-soft sm:block" aria-hidden="true" />
              <CopyButton text={emailText} label="Copy pitch email" />
              <CopyButton text={pitch.adScript} label="Copy ad script" />
            </>
          ) : pitchPending ? (
            <span className="inline-flex items-center gap-1.5 px-2 text-[13px] text-muted" role="status">
              <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" /> Writing pitch and script…
            </span>
          ) : (
            <button type="button" onClick={onWritePitch} disabled={writing} className={`${tabBtn(false)} disabled:opacity-60`}>
              {writing ? <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" /> : <PenLine className="size-3.5" strokeWidth={1.75} aria-hidden="true" />}
              {writing ? "Writing…" : "Write pitch and script"}
            </button>
          )}
        </div>
      </div>

      {tab === "evidence" && (
        <div id={panelId} className="border-t border-border-soft px-5 py-5 sm:px-6">
          <div className="grid gap-5 sm:grid-cols-2">
            {[...byDomain.entries()].map(([d, list]) => {
              const M = DOMAIN_META[d];
              return (
                <div key={d}>
                  <div className="flex items-center justify-between gap-2 text-[13px] font-medium">
                    <span className="inline-flex items-center gap-1.5">
                      <M.Icon className="size-3.5 text-muted" strokeWidth={1.75} aria-hidden="true" /> {M.label}
                    </span>
                    <span className="font-normal text-muted tabular">{((card.perDomain[d] ?? 0) * 100).toFixed(1)}% overlap</span>
                  </div>
                  <table className="mt-2 w-full text-[13px]">
                    <caption className="sr-only">
                      {M.label} shared by listeners and {card.brand.name} fans, with rank weights
                    </caption>
                    <thead className="sr-only">
                      <tr>
                        <th scope="col">Title</th>
                        <th scope="col">Weight among listeners</th>
                        <th scope="col">Weight among brand fans</th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.slice(0, 5).map((e) => (
                        <tr key={e.entity.id}>
                          <td className="break-words py-0.5 pr-2 leading-snug">{e.entity.name}</td>
                          <td className="w-14 py-0.5 text-right font-mono text-label text-muted tabular" title="Rank weight among listeners (1.00 = #1)">
                            L {e.listenerWeight.toFixed(2)}
                          </td>
                          <td className="w-14 py-0.5 text-right font-mono text-label text-muted tabular" title="Rank weight among brand fans (1.00 = #1)">
                            B {e.brandWeight.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
            {byDomain.size === 0 && <p className="text-[13px] text-muted">No shared entities in the top 40 of any domain.</p>}
          </div>
          <p className="mt-5 text-label leading-relaxed text-muted">
            Source: Qloo /v2/insights, this show&apos;s listeners compared with {card.brand.name}&apos;s fans, top 40 per domain. L and B are rank weights (1.00 is #1).
          </p>
        </div>
      )}

      {pitch && (tab === "email" || tab === "script") && (
        <div id={panelId} className="border-t border-border-soft px-5 py-5 sm:px-6">
          <div className="mb-4 flex flex-wrap items-center gap-2 text-label">
            <span className="inline-flex items-center gap-1 rounded-full bg-success-wash px-2.5 py-0.5 font-medium text-success-text">
              <ShieldCheck className="size-3" strokeWidth={2} aria-hidden="true" /> Grounded: {pitch.references.length} reference{pitch.references.length === 1 ? "" : "s"} from
              this run
            </span>
            <span className="rounded-full bg-bg px-2.5 py-0.5 text-fg-2 shadow-[0_0_0_1px_var(--border-soft)]">
              {pitch.source === "llm" ? "AI-written, checked in code" : "Template (deterministic)"}
            </span>
            {pitch.rejected?.length ? (
              <span className="rounded-full bg-warn-wash px-2.5 py-0.5 text-warn-ink" title={pitch.rejected.join(", ")}>
                Rewrote to drop {pitch.rejected.length} invented reference{pitch.rejected.length === 1 ? "" : "s"}
              </span>
            ) : null}
          </div>
          {tab === "email" ? (
            <div>
              <div className="text-label text-muted">Subject</div>
              <div className="mb-3 font-medium">{pitch.subject}</div>
              <div className="whitespace-pre-wrap rounded-md bg-bg p-4 text-[15px] leading-relaxed sm:p-5">{pitch.email}</div>
              <div className="mt-3 flex justify-end">
                <CopyButton text={emailText} label="Copy pitch email" />
              </div>
            </div>
          ) : (
            <div>
              <div className="mb-2 text-label text-muted tabular">
                {pitch.adWords} words, about {pitch.adSeconds} s read aloud
              </div>
              <div className="whitespace-pre-wrap rounded-md bg-bg p-4 font-display text-[17px] leading-relaxed sm:p-5">{pitch.adScript}</div>
              <div className="mt-3 flex justify-end">
                <CopyButton text={pitch.adScript} label="Copy ad script" />
              </div>
            </div>
          )}
        </div>
      )}
    </article>
  );
}
