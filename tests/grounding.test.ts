import { describe, expect, it } from "vitest";
import { checkGrounding, extractReferences, wordCount } from "@/lib/grounding";
import { sameBrand } from "@/lib/names";
import { extractJson } from "@/lib/llm/json";

const allowed = ["The Velvet Harbor", "June Hartley", "Marlow's Noodle Bar", "Kettlecraft Coffee", "The Cold Index"];

describe("checkGrounding", () => {
  it("accepts text that only cites allowed entities", () => {
    const text = `Hi Kettlecraft Coffee team,

Listeners of The Cold Index also love The Velvet Harbor, June Hartley and Marlow's Noodle Bar.
Best,
[Host Name]`;
    const r = checkGrounding(text, allowed);
    expect(r.offenders).toEqual([]);
    expect(r.ok).toBe(true);
    expect(r.cited).toContain("June Hartley");
  });

  it("flags invented references", () => {
    const text = "Our listeners love The Velvet Harbor and Taylor Swift, and they binge Breaking Bad.";
    const r = checkGrounding(text, allowed);
    expect(r.ok).toBe(false);
    expect(r.offenders).toEqual(expect.arrayContaining(["Taylor Swift", "Breaking Bad"]));
  });

  it("flags quoted titles that are not allowed", () => {
    const r = checkGrounding('Fans quote "Succession" daily.', allowed);
    expect(r.offenders).toContain("Succession");
  });

  it("ignores sentence-initial capitals and bracketed placeholders", () => {
    const r = checkGrounding("Today we have a treat. Grab yours at [URL] with code [PROMO CODE].", allowed);
    expect(r.ok).toBe(true);
  });

  it("allows a shortened version of an allowed title", () => {
    const r = checkGrounding("They watched Velvet Harbor twice.", allowed);
    expect(r.ok).toBe(true);
  });
});

describe("checkGrounding — real model output patterns", () => {
  const always = ["Dispatch at Dawn", "Marginalia Book Club", "Clearpath Languages", "Quillstack Notes"];
  it("accepts contractions, greetings, possessives and brand-name fragments", () => {
    const text = `Hi Marginalia Partnerships Team,

I’m the host of Dispatch at Dawn. I’ve noticed Dawn’s listeners love *The Velvet Harbor* and **June Hartley**.
Give Quillstack Notes a try. Clearpath’s community overlaps with ours: *Lantern Machines* or the lyrical vibe of *June Hartley*.`;
    const r = checkGrounding(text, [...allowed, "Lantern Machines"], always);
    expect(r.offenders).toEqual([]);
  });
  it("still catches a product claim the data didn't support", () => {
    const r = checkGrounding("Our listeners want to learn Spanish with Clearpath Languages.", allowed, always);
    expect(r.offenders).toEqual(["Spanish"]);
  });
  it("reports only the unknown part of a joined phrase", () => {
    const r = checkGrounding("They love Marginalia Book Club and Taylor Swift.", allowed, always);
    expect(r.offenders).toEqual(["Taylor Swift"]);
  });
});

describe("extractReferences", () => {
  it("captures multi-word capitalised phrases with connectors", () => {
    expect(extractReferences("we went to the Isle of Venn last year")).toContain("Isle of Venn");
  });
});

describe("sameBrand", () => {
  it("matches common variants", () => {
    expect(sameBrand("Squarespace", "Squarespace Inc.")).toBe(true);
    expect(sameBrand("AG1 by Athletic Greens", "Athletic Greens")).toBe(true);
    expect(sameBrand("BetterHelp", "Better Help")).toBe(true);
    expect(sameBrand("Nike", "Nikon")).toBe(false);
  });
});

describe("extractJson", () => {
  it("parses fenced and embedded JSON", () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJson('Sure! {"tool":"x","arguments":{"q":"y"}} done')).toEqual({ tool: "x", arguments: { q: "y" } });
    expect(extractJson('["A","B",]')).toEqual(["A", "B"]);
  });
});

describe("wordCount", () => {
  it("counts words", () => {
    expect(wordCount("It's a host-read ad.")).toBe(5);
  });
});
