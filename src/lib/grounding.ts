// Grounding check for generated pitch emails and ad scripts.
//
// Rule: generated text may only cite cultural entities the taste API returned
// for this run. We extract every candidate proper-noun reference (quoted or
// emphasised titles, capitalised phrases) and reject any that isn't in the
// allowed set. The writer regenerates on failure and falls back to a template.
import { escapeRe, normName, titleVariants } from "./names";

/** Words that may appear capitalised without being a cultural reference. */
const COMMON = new Set(
  (
    "i i'm i've i'd i'll you we our us your yours my me mine he she they them it its this that these those there here " +
    "hi hey hello dear thanks thank best cheers regards warmly sincerely kind all " +
    "subject re fwd ps p.s. note quick question host hosts hosting listener listeners audience audiences fans fan community show shows episode episodes podcast podcasts " +
    "sponsor sponsors sponsorship sponsored partnership partnerships partner partners marketing growth brand brands team teams " +
    "ad ads read reads host-read script spot spots mid-roll mid-rolls midroll pre-roll promo code codes offer offers link bio website site page " +
    "today tonight tomorrow week weekly month monthly year years season seasons morning evening weekend " +
    "monday tuesday wednesday thursday friday saturday sunday january february march april may june july august september october november december " +
    "and or but so if when what why how who where which with without for from to of in on at by about after before because while yes no not " +
    "one two three four five six seven eight nine ten first second third next last " +
    "new now just also more most every each both many some any few great big small little real really truly honestly literally actually " +
    "let's lets let here's there's it's that's what's who's you're we're they're don't can't won't isn't aren't doesn't didn't you've we've you'll we'll " +
    "company product products customer customers people folks friends everyone anyone someone nobody " +
    "music film films movie movies tv television books book dining restaurants restaurant places place travel destinations destination artists artist " +
    "data taste tastes profile profiles graph insight insights overlap affinity evidence fit score qloo hostread " +
    "intro outro cta call action okay ok ah oh well look listen picture imagine remember trust believe " +
    "check head visit go try get grab use start join give take make see hear find keep love enjoy discover meet say tell ask want need share imagine " +
    "free off percent discount deal limited time only exclusive special early quick simple easy " +
    "gen z millennials millennial boomers"
  )
    .split(/\s+/)
    .map((w) => normName(w))
    .filter(Boolean),
);

const CONNECTORS = new Set(["of", "the", "and", "de", "la", "le", "du", "des", "von", "van", "a", "an", "in", "on", "at", "for", "to", "with", "from", "by"]);
const CONNECTOR_RE = /^(of|the|and|&|de|la|le|du|des|von|van|a|an|in|on|at|for|to|with|from|by)$/i;

/** Platforms can be named as distribution, not as taste references. */
const PLATFORMS = ["Apple Podcasts", "Spotify", "YouTube", "Overcast", "Pocket Casts"];

/** Like normName, but "Qloo's" / "Marlow's" compare equal to "Qloo" / "Marlow". */
function gnorm(s: string): string {
  return normName(s.replace(/['’]s(?=\s|$|[.,!?;:)*_"”])/g, ""));
}

export interface GroundingResult {
  ok: boolean;
  offenders: string[];
  /** Allowed references that actually appear in the text. */
  cited: string[];
}

interface Allowed {
  phrases: string[];
  /** Words from the show / brand names, safe to appear on their own. */
  safeTokens: Set<string>;
}

function buildAllowed(refs: string[], always: string[]): Allowed {
  const phrases = new Set<string>();
  const safeTokens = new Set<string>();
  for (const a of [...refs, ...always, ...PLATFORMS]) {
    for (const v of titleVariants(a)) {
      const n = gnorm(v);
      if (n) phrases.add(n);
    }
  }
  for (const a of always) for (const t of gnorm(a).split(" ")) if (t.length > 1) safeTokens.add(t);
  return { phrases: [...phrases].sort((a, b) => b.length - a.length), safeTokens };
}

function containsWords(hay: string, needle: string): boolean {
  return new RegExp(`(^| )${escapeRe(needle)}( |$)`).test(hay);
}

function isAllowedPhrase(phrase: string, allowed: Allowed): boolean {
  const n = gnorm(phrase);
  if (!n) return true;
  // the candidate is (part of) an allowed name, on word boundaries
  if (allowed.phrases.some((p) => p === n || containsWords(p, n))) return true;
  // otherwise remove the allowed names it contains; what's left must be ordinary words
  let rest = ` ${n} `;
  for (const p of allowed.phrases) {
    if (containsWords(rest.trim(), p)) rest = rest.replace(new RegExp(` ${escapeRe(p)} `, "g"), "  ");
  }
  return rest
    .split(" ")
    .filter(Boolean)
    .every((w) => COMMON.has(w) || CONNECTORS.has(w) || allowed.safeTokens.has(w) || /^\d+$/.test(w));
}

/** Extract candidate references: quoted / emphasised titles and capitalised phrases. */
export function extractReferences(text: string): string[] {
  const out: string[] = [];
  const clean = text.replace(/\[[^\]]*\]/g, " "); // [PLACEHOLDERS] are fine

  // 1) quoted or emphasised titles — only when they look like a title (capitalised)
  for (const m of clean.matchAll(/["“”]([^"“”\n]{2,80})["“”]|\*{1,2}([^*\n]{2,80})\*{1,2}|_([^_\n]{2,80})_/g)) {
    const s = (m[1] ?? m[2] ?? m[3] ?? "").trim();
    if (s && /^[A-Z0-9]/.test(s) && s.split(/\s+/).length <= 10) out.push(s);
  }

  // 2) capitalised phrases (short connectors allowed inside)
  for (const line of clean.split(/\n+/)) {
    const words = line.split(/\s+/).filter(Boolean);
    let atSentenceStart = true;
    let current: string[] = [];
    let currentStartsSentence = false;
    const flush = () => {
      while (current.length && CONNECTOR_RE.test(current[current.length - 1])) current.pop();
      if (current.length) {
        // A single capitalised word at the start of a sentence is usually just grammar.
        if (!(currentStartsSentence && current.length === 1)) out.push(current.join(" "));
      }
      current = [];
    };
    for (const raw of words) {
      const leadPunct = /^[("'“‘\-—–•*_>#]+/.test(raw);
      const word = raw.replace(/^[("'“‘\-—–•*_>#]+/, "").replace(/[)"'”’.,!?;:…—–*_-]+$/, "");
      const endsSentence = /[.!?…:]["'”’)*_]*$/.test(raw);
      const isCap = /^[A-Z0-9][\p{L}\p{N}'’&.-]*$/u.test(word) && /[A-Za-z]/.test(word);
      const isConnector = current.length > 0 && CONNECTOR_RE.test(word);
      if (isCap || isConnector) {
        if (current.length === 0) currentStartsSentence = atSentenceStart;
        else if (leadPunct && isCap) {
          // a new quoted / emphasised chunk starts a new phrase
          flush();
          currentStartsSentence = false;
        }
        current.push(word);
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
  const allowed = buildAllowed(allowedRefs, alwaysAllowed);
  const offenders = new Set<string>();
  for (const r of extractReferences(text)) {
    if (isAllowedPhrase(r, allowed)) continue;
    // "The Velvet Harbor and Taylor Swift" -> report only the unknown part
    const parts = r.split(/\s+(?:and|&|with|for|to|at|from|by)\s+/i);
    if (parts.length > 1) {
      for (const p of parts) if (!isAllowedPhrase(p, allowed)) offenders.add(p);
    } else {
      offenders.add(r);
    }
  }
  const lower = gnorm(text);
  const cited = allowedRefs.filter((a) => {
    const n = gnorm(a);
    return n.length > 1 && containsWords(lower, n);
  });
  return { ok: offenders.size === 0, offenders: [...offenders], cited };
}

export function wordCount(s: string): number {
  return (s.match(/[A-Za-z0-9’']+/g) ?? []).length;
}

/** Typical host-read pace ≈ 150 words a minute (2.5 words per second). */
export function readSeconds(words: number): number {
  return Math.round(words / 2.5);
}
