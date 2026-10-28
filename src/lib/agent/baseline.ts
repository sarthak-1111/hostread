// The plain-LLM baseline: what a model guesses from the show's name and topic
// alone, with NO taste data. Used for the "Obvious vs. Surprising" panel and
// the surprise component of the fit score.
import "server-only";
import { extractJson } from "../llm/json";
import type { LlmClient } from "../llm/client";
import type { PodcastEntity } from "../types";

export async function baselineGuess(llm: LlmClient, podcast: PodcastEntity, signal?: AbortSignal): Promise<string[]> {
  const topic = [podcast.genres?.join(", "), podcast.description].filter(Boolean).join(" — ");
  const content = await llm.complete(
    [
      { role: "system", content: "You are a podcast ad-sales assistant with no data access. Answer from general knowledge only." },
      {
        role: "user",
        content:
          `Podcast: "${podcast.name}"${topic ? `\nTopic: ${topic}` : ""}\n\n` +
          `List the 10 brands most likely to be a good sponsor fit for this show. ` +
          `Reply with ONLY a JSON array of brand names, e.g. ["Brand A", "Brand B"].`,
      },
    ],
    { temperature: 0.2, maxTokens: 1200, signal },
  );
  return parseBrandList(content);
}

export function parseBrandList(content: string): string[] {
  const v = extractJson(content);
  let list: unknown[] = [];
  if (Array.isArray(v)) list = v;
  else if (v && typeof v === "object") {
    const firstArray = Object.values(v as Record<string, unknown>).find(Array.isArray);
    if (firstArray) list = firstArray as unknown[];
  }
  if (!list.length) {
    list = content
      .split(/\n/)
      .map((l) => l.replace(/^\s*(\d+[.)]|[-*•])\s*/, "").replace(/\*\*/g, "").split(/\s[–—-]\s|:/)[0].trim())
      .filter((l) => l && l.length < 60);
  }
  const names = list
    .map((x) => (typeof x === "string" ? x : typeof x === "object" && x && "name" in x ? String((x as { name: unknown }).name) : ""))
    .map((s) => s.trim())
    .filter((s) => s.length > 1 && s.length < 60);
  return [...new Set(names)].slice(0, 10);
}
