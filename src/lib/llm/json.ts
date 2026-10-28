// Tolerant JSON extraction for LLM output (code fences, prose around JSON,
// trailing commas). Used by the text-mode tool-call fallback and the baseline.

export function extractJson(text: string): unknown {
  if (!text) return undefined;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidates = [fenced?.[1], text].filter(Boolean) as string[];
  for (const c of candidates) {
    const direct = tryParse(c.trim());
    if (direct !== undefined) return direct;
    const obj = firstBalanced(c, "{", "}");
    if (obj) {
      const v = tryParse(obj);
      if (v !== undefined) return v;
    }
    const arr = firstBalanced(c, "[", "]");
    if (arr) {
      const v = tryParse(arr);
      if (v !== undefined) return v;
    }
  }
  return undefined;
}

function tryParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    try {
      return JSON.parse(s.replace(/,\s*([}\]])/g, "$1"));
    } catch {
      return undefined;
    }
  }
}

function firstBalanced(s: string, open: string, close: string): string | undefined {
  const start = s.indexOf(open);
  if (start < 0) return undefined;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return undefined;
}
