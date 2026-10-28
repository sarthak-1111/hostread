"use client";

import { useState } from "react";
import { ChevronDown, FileText, LoaderCircle, Mail, PenLine, ScanSearch, ShieldCheck, Sparkles } from "lucide-react";
import { DOMAIN_META, EntityImage, EvidenceChip } from "../domain";
import { CopyButton } from "./CopyButton";
import type { DomainKey, PitchPack, SponsorCard } from "@/lib/types";

/** Fit score: the number plus a single-hue meter on a lighter track of the same hue. */
function FitScore({ value }: { value: number }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="w-[84px] shrink-0 border border-border-soft bg-bg px-2.5 pb-2.5 pt-2" role="img" aria-label={`Fit ${v} out of 100, a relative ranking within this deck`}>
      <div className="eyebrow" aria-hidden="true">
        Fit
      </div>
      <div className="mt-1 font-display text-[34px] leading-none tabular" aria-hidden="true">
        {v}
      </div>
      <div className="mt-2 h-1 bg-accent-track" aria-hidden="true">
        <div className="h-full bg-accent" style={{ width: `${v}%` }} />
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
    <dl className="grid grid-cols-3 gap-4 sm:gap-6">
      {parts.map((p) => (
        <div key={p.label} title={p.hint}>
          <dt className="eyebrow">{p.label}</dt>
          <dd className="mt-1 text-sm font-semibold tabular">
            {p.value.toFixed(0)}
            <span className="font-normal text-muted">/{p.max}</span>
          </dd>
          <div className="mt-1.5 h-1.5 bg-accent-track" aria-hidden="true">
            <div className="h-full bg-accent" style={{ width: `${(p.value / p.max) * 100}%` }} />
          </div>
        </div>
      ))}
    </dl>
  );
}

type Tab = "evidence" | "email" | "script";

const tabBtn = (active: boolean) =>
  `inline-flex min-h-10 items-center gap-1.5 border-b-2 font-mono text-[12px] font-bold uppercase tracking-[0.08em] transition-colors duration-150 ${
    active ? "border-accent text-fg" : "border-transparent text-muted hover:text-fg"
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
    <article className="frame rise print-avoid" aria-labelledby={`card-${card.brand.id}-name`}>
      <div className="p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <EntityImage src={card.brand.image} name={card.brand.name} className="size-12" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="eyebrow tabular">No. {String(card.rank).padStart(2, "0")}</span>
              {card.surpriseFit && (
                <span className="tag tag-accent" title="A plain LLM didn't suggest this brand from the show's name and topic">
                  <Sparkles className="size-3" strokeWidth={2.25} aria-hidden="true" /> Surprise fit
                </span>
              )}
              {card.brand.sample && <span className="tag tag-warn">Sample</span>}
            </div>
            <h3 id={`card-${card.brand.id}-name`} className="mt-1.5 font-display text-[22px] leading-tight">
              {card.brand.name}
            </h3>
            {card.brand.category && <div className="mt-0.5 text-sm text-muted">{card.brand.category}</div>}
          </div>
          <FitScore value={card.fit} />
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
      </div>

      <div className="no-print flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-border-soft px-5 sm:px-6">
        <div className="flex flex-wrap items-center gap-x-4">
          <button type="button" onClick={() => toggle("evidence")} aria-expanded={tab === "evidence"} aria-controls={panelId} className={tabBtn(tab === "evidence")}>
            <ScanSearch className="size-3.5" strokeWidth={2} aria-hidden="true" /> Evidence
            <ChevronDown className={`size-3.5 transition-transform duration-150 ${tab === "evidence" ? "rotate-180" : ""}`} aria-hidden="true" />
          </button>
          {pitch && (
            <>
              <button type="button" onClick={() => toggle("email")} aria-expanded={tab === "email"} aria-controls={panelId} className={tabBtn(tab === "email")}>
                <Mail className="size-3.5" strokeWidth={2} aria-hidden="true" /> Email
              </button>
              <button type="button" onClick={() => toggle("script")} aria-expanded={tab === "script"} aria-controls={panelId} className={tabBtn(tab === "script")}>
                <FileText className="size-3.5" strokeWidth={2} aria-hidden="true" /> Script
              </button>
            </>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 py-2.5">
          {pitch ? (
            <>
              <CopyButton text={emailText} label="Copy pitch email" />
              <CopyButton text={pitch.adScript} label="Copy ad script" />
            </>
          ) : pitchPending ? (
            <span className="inline-flex items-center gap-1.5 text-[13px] text-muted" role="status">
              <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" /> Writing pitch and script…
            </span>
          ) : (
            <button type="button" onClick={onWritePitch} disabled={writing} className="btn btn-secondary btn-sm">
              {writing ? <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" /> : <PenLine className="size-3.5" strokeWidth={2} aria-hidden="true" />}
              {writing ? "Writing…" : "Write pitch and script"}
            </button>
          )}
        </div>
      </div>

      {tab === "evidence" && (
        <div id={panelId} className="border-t border-border-soft bg-bg px-5 py-5 sm:px-6">
          <div className="grid gap-5 sm:grid-cols-2">
            {[...byDomain.entries()].map(([d, list]) => {
              const M = DOMAIN_META[d];
              return (
                <div key={d}>
                  <div className="flex items-center justify-between gap-2 border-b border-border-soft pb-1.5 text-[13px] font-semibold">
                    <span className="inline-flex items-center gap-1.5">
                      <M.Icon className="size-3.5 text-muted" strokeWidth={2} aria-hidden="true" /> {M.label}
                    </span>
                    <span className="font-mono text-label font-normal text-muted tabular">{((card.perDomain[d] ?? 0) * 100).toFixed(1)}% overlap</span>
                  </div>
                  <table className="mt-1.5 w-full text-[13px]">
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
        <div id={panelId} className="border-t border-border-soft bg-bg px-5 py-5 sm:px-6">
          <div className="mb-4 flex flex-wrap items-center gap-1.5">
            <span className="tag tag-success">
              <ShieldCheck className="size-3" strokeWidth={2.25} aria-hidden="true" /> Grounded: {pitch.references.length} reference{pitch.references.length === 1 ? "" : "s"}
            </span>
            <span className="tag">{pitch.source === "llm" ? "AI-written, checked in code" : "Template"}</span>
            {pitch.rejected?.length ? (
              <span className="tag tag-warn" title={pitch.rejected.join(", ")}>
                Rewrote to drop {pitch.rejected.length} invented
              </span>
            ) : null}
          </div>
          {tab === "email" ? (
            <div>
              <div className="eyebrow">Subject</div>
              <div className="mb-3 mt-1 font-semibold">{pitch.subject}</div>
              <div className="whitespace-pre-wrap border border-border-soft bg-surface p-4 text-[15px] leading-relaxed sm:p-5">{pitch.email}</div>
            </div>
          ) : (
            <div>
              <div className="eyebrow tabular">
                {pitch.adWords} words, about {pitch.adSeconds} s read aloud
              </div>
              <div className="mt-2 whitespace-pre-wrap border border-border-soft bg-surface p-4 text-[17px] leading-relaxed sm:p-5">{pitch.adScript}</div>
            </div>
          )}
        </div>
      )}
    </article>
  );
}
