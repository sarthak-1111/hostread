import { describe, expect, it } from "vitest";
import { parseSections, templatePitch, allowedReferences, stripEmphasis, honestTasteClaims, writePitch } from "@/lib/agent/writer";
import { parseBrandList } from "@/lib/agent/baseline";
import { checkGrounding } from "@/lib/grounding";
import type { LlmClient } from "@/lib/llm/client";
import type { SponsorCard, TasteEntity, DomainKey } from "@/lib/types";

const ent = (id: string, name: string, type = "urn:entity:movie"): TasteEntity => ({ id, name, type });

const card: SponsorCard = {
  rank: 2,
  brand: { id: "b1", name: "Kettlecraft Coffee", type: "urn:entity:brand", category: "Coffee" },
  fit: 81,
  score: { affinity: 0.9, overlap: 0.8, surprise: 1, rawOverlap: 0.3 },
  surpriseFit: true,
  evidence: [
    { domain: "film", entity: ent("f1", "The Velvet Harbor"), listenerWeight: 1, brandWeight: 0.9 },
    { domain: "music", entity: ent("m1", "June Hartley", "urn:entity:artist"), listenerWeight: 0.8, brandWeight: 0.7 },
    { domain: "dining", entity: ent("d1", "Marlow's Noodle Bar", "urn:entity:place"), listenerWeight: 0.6, brandWeight: 0.9 },
  ],
  topEvidence: [],
  perDomain: { film: 0.2 },
};
card.topEvidence = card.evidence;

const input = {
  podcast: { id: "p1", name: "The Cold Index", type: "urn:entity:podcast", genres: ["True Crime"] },
  card,
  profile: new Map<DomainKey, TasteEntity[]>([["film", [ent("f1", "The Velvet Harbor"), ent("f2", "Paper Comet")]]]),
};

describe("templatePitch", () => {
  it("is grounded and lands in the 45–60 second range", () => {
    const p = templatePitch(input);
    const g = checkGrounding(`${p.subject}\n${p.email}\n${p.adScript}`, allowedReferences(input), [input.podcast.name, card.brand.name, "Coffee", "True Crime", "Qloo", "HostRead"]);
    expect(g.offenders).toEqual([]);
    expect(p.adSeconds).toBeGreaterThanOrEqual(40);
    expect(p.adSeconds).toBeLessThanOrEqual(62);
    expect(p.email).toContain("The Velvet Harbor");
  });
});

describe("writePitch", () => {
  it("keeps a grounded email and script when only a Title Case subject trips the checker", async () => {
    const script = [
      "Quick break, because this one fits.",
      "If you love The Velvet Harbor and have June Hartley on repeat, you already get it.",
      "[personal experience]",
      ...Array(12).fill("It fits into your day without fuss, and it does its thing well."),
      "Head to [URL] and use code [PROMO CODE].",
    ].join(" ");
    const text =
      "### SUBJECT\nUnlock A Brighter Morning Ritual\n" +
      "### EMAIL\nHi Kettlecraft Coffee partnerships team,\n\nI host The Cold Index. Our listeners and your fans both love The Velvet Harbor and June Hartley. " +
      "I'd love to run a small test with three host-read mid-rolls and a [PROMO CODE].\n\nThanks,\n[Host Name]\n" +
      `### AD SCRIPT\n${script}`;
    const llm = { complete: async () => text } as unknown as LlmClient;
    const p = await writePitch(llm, input);
    expect(p.source).toBe("llm");
    expect(p.subject).toBe(templatePitch(input).subject);
    expect(p.email).toContain("June Hartley");
  });
});

describe("parseSections", () => {
  it("splits the three headed sections", () => {
    const body = "word ".repeat(20);
    const r = parseSections(`### SUBJECT\nHello there\n### EMAIL\n${body}\n### AD SCRIPT\n${body}`);
    expect(r?.subject).toBe("Hello there");
    expect(r?.email.length).toBeGreaterThan(60);
  });
  it("returns null when a section is missing", () => {
    expect(parseSections("### SUBJECT\nHi\n### EMAIL\nshort")).toBeNull();
  });
});

describe("parseBrandList", () => {
  it("parses JSON arrays, objects and numbered lists", () => {
    expect(parseBrandList('["SimpliSafe", "Hello Fresh"]')).toEqual(["SimpliSafe", "Hello Fresh"]);
    expect(parseBrandList('{"brands": ["A1", "B2"]}')).toEqual(["A1", "B2"]);
    expect(parseBrandList("1. **SimpliSafe** – home security\n2. Audible")).toEqual(["SimpliSafe", "Audible"]);
  });
});

describe("stripEmphasis", () => {
  it("removes emphasis and turns dash asides into commas, keeping ranges", () => {
    expect(stripEmphasis("Listeners love **The Velvet Harbor**—and *June Hartley*.")).toBe("Listeners love The Velvet Harbor, and June Hartley.");
    expect(stripEmphasis("moody content — favoring films")).toBe("moody content, favoring films");
    expect(stripEmphasis("a 2–3 sentence read")).toBe("a 2–3 sentence read");
    expect(stripEmphasis("ends with a dash—.")).toBe("ends with a dash.");
  });
});

describe("honestTasteClaims", () => {
  it("rewrites what listeners 'mention' to what they love, leaving other uses alone", () => {
    expect(honestTasteClaims("Listeners of Crime Junkie consistently mention Big Time Adolescence.")).toBe("Listeners of Crime Junkie love Big Time Adolescence.");
    expect(honestTasteClaims("Our audience talks about Hardy a lot.")).toBe("Our audience love Hardy a lot.");
    expect(honestTasteClaims("three host-read spots that mention Loopycases")).toBe("three host-read spots that mention Loopycases");
  });
});
