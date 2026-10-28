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
