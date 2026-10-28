// Grounding check for generated pitch emails and ad scripts.
//
// Rule: generated text may only cite cultural entities the taste API returned
// for this run. We extract every candidate proper-noun reference (quoted
// titles, capitalised phrases) and reject any that isn't in the allowed set.
// The writer regenerates on failure and falls back to a template if needed.
import { escapeRe, normName, titleVariants } from "./names";

/** Words that may appear capitalised without being a cultural reference. */
const COMMON = new Set(
  (
    "i i'm i've i'd i'll you we our us your my me he she they it its this that these those there here hi hey hello dear thanks thank best cheers regards warmly sincerely " +
    "subject re fwd ps p.s. note quick question host hosts listener listeners audience fans fan show shows episode episodes podcast podcasts sponsor sponsors sponsorship partnership partnerships " +
    "team teams ad ads read reads host-read script spot spots promo code offer link bio website site page today tonight tomorrow week weekly month monthly year years season " +
    "monday tuesday wednesday thursday friday saturday sunday january february march april may june july august september october november december " +
    "and or but so if when what why how who where which with without for from to of in on at by about after before because while yes no not one two three four five first second third next last " +
    "new now just also more most every each all both many some any few great big small little real really truly honestly literally actually " +
    "let's lets let here's there's it's that's what's who's you're we're they're don't can't won't isn't aren't doesn't didn't " +
    "brand brands company product products customer customers people folks friends everyone anyone someone nobody " +
    "music film films movie movies tv television books book dining restaurants restaurant places place travel destinations destination artists artist " +
    "data taste profile profiles graph insight insights overlap affinity evidence qloo hostread " +
    "intro outro cta call action okay ok ah oh well look listen picture imagine remember trust believe check head visit go try get grab use start join " +
    "free off percent discount deal limited time only exclusive special early"
  ).split(/\s+/),
);

/** Platforms can be named as distribution, not as taste references. */
const PLATFORMS = ["Apple Podcasts", "Spotify", "YouTube", "Overcast", "Pocket Casts"];

export interface GroundingResult {
  ok: boolean;
  offenders: string[];
  /** Allowed references that actually appear in the text. */
  cited: string[];
}

function buildAllowed(allowed: string[]): { phrases: string[]; tokens: Set<string> } {
  const phrases = new Set<string>();
  const tokens = new Set<string>();
  for (const a of [...allowed, ...PLATFORMS]) {
    for (const v of titleVariants(a)) {
      const n = normName(v);
      if (!n) continue;
      phrases.add(n);
      for (const t of n.split(" ")) if (t.length > 1) tokens.add(t);
    }
  }
  return { phrases: [...phrases], tokens };
}

const CONNECTORS = new Set(["of", "the", "and", "de", "la", "le", "du", "des", "von", "van", "a", "an", "in", "on"]);

function containsWords(hay: string, needle: string): boolean {
  return new RegExp(`(^| )${escapeRe(needle)}( |$)`).test(hay);
}

function isAllowedPhrase(phrase: string, allowed: { phrases: string[]; tokens: Set<string> }): boolean {
  const n = normName(phrase);
  if (!n) return true;
  // the candidate is (part of) an allowed name, on word boundaries
  if (allowed.phrases.some((p) => p === n || containsWords(p, n))) return true;
  // otherwise remove allowed names it contains; whatever is left must be ordinary words
  let rest = ` ${n} `;
  for (const p of [...allowed.phrases].sort((a, b) => b.length - a.length)) {
    if (containsWords(rest.trim(), p)) rest = rest.replace(new RegExp(` ${escapeRe(p)} `, "g"), "  ");
  }
  return rest
    .split(" ")
    .filter(Boolean)
    .every((w) => COMMON.has(w) || CONNECTORS.has(w) || /^\d+$/.test(w));
}

/** Extract candidate references: quoted titles and capitalised phrases. */
export function extractReferences(text: string): string[] {
  const out: string[] = [];
  const clean = text.replace(/\[[^\]]*\]/g, " "); // [PLACEHOLDERS] are fine

  // 1) quoted or emphasised titles
  for (const m of clean.matchAll(/["“”]([^"“”\n]{2,80})["“”]|\*([^*\n]{2,80})\*|_([^_\n]{2,80})_/g)) {
    const s = (m[1] ?? m[2] ?? m[3] ?? "").trim();
    if (s && /[A-Za-z]/.test(s) && s.split(/\s+/).length <= 10) out.push(s);
  }

  // 2) capitalised phrases (allow short connectors inside)
  const lines = clean.split(/\n+/);
  for (const line of lines) {
    const words = line.split(/(\s+)/);
    let i = 0;
    let atSentenceStart = true;
    let current: string[] = [];
    let currentStartsSentence = false;
    const flush = () => {
      // drop trailing connectors
      while (current.length && /^(of|the|and|&|de|la|le|du|des|von|van|a|an|in|on)$/i.test(current[current.length - 1])) current.pop();
      if (current.length) {
        const phrase = current.join(" ");
        // A single capitalised word at the start of a sentence is usually just grammar.
        if (!(currentStartsSentence && current.length === 1)) out.push(phrase);
      }
      current = [];
    };
    for (; i < words.length; i++) {
      const raw = words[i];
      if (/^\s+$/.test(raw) || raw === "") continue;
      const leadPunct = /^[("'“‘\-—–•*>#]+/.test(raw);
      const word = raw.replace(/^[("'“‘\-—–•*>#]+/, "").replace(/[)"'”’.,!?;:…—–-]+$/, "");
      const endsSentence = /[.!?…:]["'”’)]*$/.test(raw);
      const isCap = /^[A-Z0-9][\p{L}\p{N}'’&.-]*$/u.test(word) && /[A-Za-z]/.test(word);
      const isConnector = current.length > 0 && /^(of|the|and|&|de|la|le|du|des|von|van|a|an|in|on)$/i.test(word);
      if (isCap || isConnector) {
        if (current.length === 0) currentStartsSentence = atSentenceStart;
        current.push(word);
        if (leadPunct && current.length > 1) {
          // a new quoted/parenthesised chunk starts a new phrase
          const last = current.pop()!;
          flush();
          current = [last];
          currentStartsSentence = false;
        }
      } else {
        flush();
      }
      if (endsSentence) {
        flush();
        atSentenceStart = true;
      } else {
        atSentenceStart = false;
      }
    }
    flush();
  }
  return [...new Set(out.map((s) => s.trim()).filter(Boolean))];
}

export function checkGrounding(text: string, allowedRefs: string[], alwaysAllowed: string[] = []): GroundingResult {
  const allowed = buildAllowed([...allowedRefs, ...alwaysAllowed]);
  const refs = extractReferences(text);
  const offenders = new Set<string>();
  for (const r of refs) {
    if (isAllowedPhrase(r, allowed)) continue;
    // "The Velvet Harbor and Taylor Swift" -> report only the unknown part
    const parts = r.split(/\s+(?:and|&)\s+/i);
    const bad = parts.filter((x) => !isAllowedPhrase(x, allowed));
    for (const b of bad.length ? bad : [r]) offenders.add(b);
  }
  const lower = normName(text);
  const cited = allowedRefs.filter((a) => {
    const n = normName(a);
    return n.length > 1 && new RegExp(`(^| )${escapeRe(n)}( |$)`).test(lower);
  });
  return { ok: offenders.size === 0, offenders: [...offenders], cited };
}

export function wordCount(s: string): number {
  return (s.match(/[A-Za-z0-9’']+/g) ?? []).length;
}

/** Typical host-read pace ≈ 2.6 words per second. */
export function readSeconds(words: number): number {
  return Math.round(words / 2.6);
}
