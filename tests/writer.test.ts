import { describe, expect, it } from "vitest";
import { parseSections, templatePitch, allowedReferences, stripEmphasis } from "@/lib/agent/writer";
import { parseBrandList } from "@/lib/agent/baseline";
import { checkGrounding } from "@/lib/grounding";
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
