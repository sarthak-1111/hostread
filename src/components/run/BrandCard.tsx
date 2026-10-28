"use client";

import { useState } from "react";
import { ChevronDown, FileText, LoaderCircle, Mail, ScanSearch, ShieldCheck, Sparkles, WandSparkles } from "lucide-react";
import { DOMAIN_META, EntityImage, EvidenceChip } from "../domain";
import { CopyButton } from "./CopyButton";
import type { DomainKey, PitchPack, SponsorCard } from "@/lib/types";

function ScoreRing({ value }: { value: number }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="relative grid size-[60px] shrink-0 place-items-center" title={`Fit ${v}/100 — a relative ranking within this deck`}>
      <svg viewBox="0 0 56 56" className="absolute inset-0 -rotate-90">
        <circle cx="28" cy="28" r={r} fill="none" strokeWidth="5" className="stroke-line" />
        <circle cx="28" cy="28" r={r} fill="none" strokeWidth="5" strokeLinecap="round" className="stroke-accent" strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)} />
      </svg>
      <div className="text-center leading-none">
        <div className="text-lg font-semibold tabular">{v}</div>
        <div className="mt-0.5 text-[9px] font-medium uppercase tracking-wider text-ink-3">fit</div>
      </div>
    </div>
  );
}

function Breakdown({ card }: { card: SponsorCard }) {
  const a = 50 * card.score.affinity;
  const o = 35 * card.score.overlap;
  const s = 15 * card.score.surprise;
  return (
    <div>
      <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-surface-2" role="img" aria-label={`Affinity ${a.toFixed(0)}, overlap ${o.toFixed(0)}, surprise ${s.toFixed(0)} points`}>
        <span className="bg-accent" style={{ width: `${a}%` }} />
        <span className="bg-violet" style={{ width: `${o}%` }} />
        <span className="bg-green" style={{ width: `${s}%` }} />
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-[11px] text-ink-3 tabular">
        <span>
          <span className="text-accent-ink">A</span> {a.toFixed(0)}/50
        </span>
        <span>
          <span className="text-violet">O</span> {o.toFixed(0)}/35
        </span>
        <span>
          <span className="text-green">S</span> {s.toFixed(0)}/15
        </span>
        {card.score.rawAffinity !== undefined && <span>affinity {card.score.rawAffinity.toFixed(3)}</span>}
      </div>
    </div>
  );
}

type Tab = "evidence" | "email" | "script";

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

  const byDomain = new Map<DomainKey, typeof card.evidence>();
  for (const e of card.evidence) byDomain.set(e.domain, [...(byDomain.get(e.domain) ?? []), e]);

  return (
    <article className="rise print-avoid rounded-2xl border border-line bg-surface shadow-card">
      <div className="p-4 sm:p-5">
        <div className="flex items-start gap-3.5">
          <div className="relative">
            <EntityImage src={card.brand.image} name={card.brand.name} className="size-12" />
            <span className="absolute -left-2 -top-2 grid size-6 place-items-center rounded-full border-2 border-surface bg-ink text-[11px] font-semibold text-bg tabular">{card.rank}</span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h3 className="text-[17px] font-semibold leading-tight">{card.brand.name}</h3>
              {card.surpriseFit && (
                <span className="inline-flex items-center gap-1 rounded-full bg-violet-soft px-2 py-0.5 text-[11.5px] font-semibold text-violet" title="A plain LLM didn't suggest this brand from the show's name and topic">
                  <Sparkles className="size-3" aria-hidden="true" /> Surprise fit
                </span>
              )}
              {card.brand.sample && <span className="rounded bg-amber-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber">sample</span>}
            </div>
            {card.brand.category && <div className="mt-0.5 text-[13px] text-ink-3">{card.brand.category}</div>}
          </div>
          <ScoreRing value={card.fit} />
        </div>

        <div className="mt-4">
          <div className="mb-1.5 text-xs text-ink-3">Listeners and {card.brand.name} fans both love</div>
          {card.topEvidence.length ? (
            <div className="flex flex-wrap gap-1.5">
              {card.topEvidence.map((e) => (
                <EvidenceChip key={`${e.domain}-${e.entity.id}`} domain={e.domain} name={e.entity.name} />
              ))}
            </div>
          ) : (
            <div className="text-[13px] text-ink-3">No shared favourites in the top 40 — this pick rests on audience affinity.</div>
          )}
        </div>

        <div className="mt-4">
          <Breakdown card={card} />
        </div>

        <div className="no-print mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => toggle("evidence")}
            aria-expanded={tab === "evidence"}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition ${tab === "evidence" ? "bg-ink text-bg" : "bg-surface-2 hover:bg-line"}`}
          >
            <ScanSearch className="size-3.5" /> Evidence
            <ChevronDown className={`size-3.5 transition ${tab === "evidence" ? "rotate-180" : ""}`} />
          </button>
          {pitch ? (
            <>
              <button
                type="button"
                onClick={() => toggle("email")}
                aria-expanded={tab === "email"}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition ${tab === "email" ? "bg-ink text-bg" : "bg-surface-2 hover:bg-line"}`}
              >
                <Mail className="size-3.5" /> Pitch email
              </button>
              <button
                type="button"
                onClick={() => toggle("script")}
                aria-expanded={tab === "script"}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition ${tab === "script" ? "bg-ink text-bg" : "bg-surface-2 hover:bg-line"}`}
              >
                <FileText className="size-3.5" /> Ad script
              </button>
              <span className="mx-1 hidden h-5 w-px bg-line sm:block" />
              <CopyButton text={emailText} label="Copy pitch email" />
              <CopyButton text={pitch.adScript} label="Copy ad script" />
            </>
          ) : pitchPending ? (
            <span className="inline-flex items-center gap-1.5 px-2 text-[13px] text-ink-3">
              <LoaderCircle className="size-3.5 animate-spin" /> Writing pitch & script…
            </span>
          ) : (
            <button
              type="button"
              onClick={onWritePitch}
              disabled={writing}
              className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-3 py-1.5 text-[13px] font-medium text-bg transition hover:opacity-90 disabled:opacity-60"
            >
              {writing ? <LoaderCircle className="size-3.5 animate-spin" /> : <WandSparkles className="size-3.5" />}
              {writing ? "Writing…" : "Write pitch & script"}
            </button>
          )}
        </div>
      </div>

      {tab === "evidence" && (
        <div className="border-t border-line px-4 py-4 sm:px-5">
          <div className="grid gap-4 sm:grid-cols-2">
            {[...byDomain.entries()].map(([d, list]) => {
              const M = DOMAIN_META[d];
              return (
                <div key={d}>
                  <div className="flex items-center justify-between text-[13px] font-medium">
                    <span className="inline-flex items-center gap-1.5">
                      <M.Icon className={`size-3.5 ${M.tint}`} /> {M.label}
                    </span>
                    <span className="font-mono text-[11px] text-ink-3 tabular">overlap {((card.perDomain[d] ?? 0) * 100).toFixed(1)}%</span>
                  </div>
                  <ul className="mt-1.5 space-y-1">
                    {list.slice(0, 5).map((e) => (
                      <li key={e.entity.id} className="flex items-center justify-between gap-2 text-[13px]">
                        <span className="truncate">{e.entity.name}</span>
                        <span className="shrink-0 font-mono text-[10.5px] text-ink-3 tabular" title="Rank weight among listeners / among brand fans (1 = #1)">
                          L {e.listenerWeight.toFixed(2)} · B {e.brandWeight.toFixed(2)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
            {byDomain.size === 0 && <p className="text-[13px] text-ink-3">No shared entities in the top 40 of any domain.</p>}
          </div>
          <p className="mt-4 text-[11.5px] leading-relaxed text-ink-3">
            Source: Qloo /v2/insights — this show&apos;s listeners vs. {card.brand.name}&apos;s fans, top 40 per domain. L/B are rank weights (1.00 = #1).
          </p>
        </div>
      )}

      {pitch && (tab === "email" || tab === "script") && (
        <div className="border-t border-line px-4 py-4 sm:px-5">
          <div className="mb-3 flex flex-wrap items-center gap-2 text-[11.5px]">
            <span className="inline-flex items-center gap-1 rounded-full bg-green-soft px-2 py-0.5 font-medium text-green">
              <ShieldCheck className="size-3" /> Grounded: {pitch.references.length} reference{pitch.references.length === 1 ? "" : "s"} from this run
            </span>
            <span className="rounded-full bg-surface-2 px-2 py-0.5 text-ink-3">{pitch.source === "llm" ? "AI-written, checked in code" : "Template (deterministic)"}</span>
            {pitch.rejected?.length ? (
              <span className="rounded-full bg-amber-soft px-2 py-0.5 text-amber" title={pitch.rejected.join(", ")}>
                rewrote to drop {pitch.rejected.length} invented reference{pitch.rejected.length === 1 ? "" : "s"}
              </span>
            ) : null}
          </div>
          {tab === "email" ? (
            <div>
              <div className="text-[13px] text-ink-3">Subject</div>
              <div className="mb-3 font-medium">{pitch.subject}</div>
              <div className="whitespace-pre-wrap rounded-xl bg-surface-2 p-4 text-[14px] leading-relaxed">{pitch.email}</div>
              <div className="mt-3 flex justify-end">
                <CopyButton text={emailText} label="Copy pitch email" />
              </div>
            </div>
          ) : (
            <div>
              <div className="mb-2 font-mono text-[11.5px] text-ink-3 tabular">
                {pitch.adWords} words · ~{pitch.adSeconds}s read
              </div>
              <div className="whitespace-pre-wrap rounded-xl bg-surface-2 p-4 text-[14px] leading-relaxed">{pitch.adScript}</div>
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
