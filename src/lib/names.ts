// Name normalisation and fuzzy matching (brand names from the LLM baseline vs
// Qloo entities, references in generated text vs allowed entities).

const CORPORATE = /\b(inc|llc|ltd|co|corp|corporation|company|the|app|com|brand|brands)\b/g;

export function normName(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’`]/g, "")
    .replace(/\.com\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function coreName(s: string): string {
  return normName(s).replace(CORPORATE, " ").replace(/\s+/g, " ").trim();
}

/** True when two brand names plausibly refer to the same brand. */
export function sameBrand(a: string, b: string): boolean {
  const x = coreName(a);
  const y = coreName(b);
  if (!x || !y) return false;
  if (x === y) return true;
  if (x.replace(/ /g, "") === y.replace(/ /g, "")) return true;
  // "Athletic Greens" vs "AG1 by Athletic Greens", "Squarespace" vs "Squarespace Inc"
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  return short.length >= 4 && new RegExp(`(^| )${escapeRe(short)}( |$)`).test(long);
}

export function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Strip subtitles like "Dune: Part Two" -> "Dune" for looser matching. */
export function titleVariants(name: string): string[] {
  const out = new Set<string>([name]);
  const colon = name.split(/[:(–—-]\s/)[0];
  if (colon && colon.length >= 3) out.add(colon.trim());
  const noThe = name.replace(/^the\s+/i, "");
  if (noThe !== name) out.add(noThe);
  return [...out];
}
