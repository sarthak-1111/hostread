// Pre-demo check for a HostRead deployment. Needs no keys: it uses the public API.
//
//   npm run health                 # https://hostread.vercel.app
//   npm run health -- <origin>     # another deployment
//
// Checks /api/status, then that every landing example (shows and brands) is
// served from cache. Asking for an example that isn't cached starts its run,
// so this also warms it: a show's run is followed to the end (1-2 minutes,
// needs the LLM), a brand match takes about 10 s (no LLM).
import { readFileSync } from "node:fs";

const origin = (process.argv[2] ?? "https://hostread.vercel.app").replace(/\/+$/, "");

// Example names come from the app's own list, so this stays in sync with the landing pages.
const src = readFileSync(new URL("../src/lib/examples.ts", import.meta.url), "utf8");
const namesIn = (constName) => [...(src.split(`export const ${constName}`)[1]?.split("];")[0] ?? "").matchAll(/name:\s*"([^"]+)"/g)].map((m) => m[1]);
const shows = namesIn("LIVE_EXAMPLES");
const brands = namesIn("BRAND_EXAMPLES");

let problems = 0;
const bad = (msg) => {
  problems++;
  console.log(`  FAIL  ${msg}`);
};
const ok = (msg) => console.log(`  ok    ${msg}`);
const secs = (t0) => `${((Date.now() - t0) / 1000).toFixed(1)} s`;

console.log(`HostRead health check: ${origin}\n`);

const status = await fetch(`${origin}/api/status`).then((r) => r.json()).catch(() => null);
if (!status) bad("/api/status unreachable");
else {
  (status.mode === "live" ? ok : bad)(`data mode: ${status.mode}`);
  (status.configured?.qlooKey ? ok : bad)("Qloo key configured");
  (status.configured?.llmKey ? ok : bad)(`LLM key configured (${status.llm})`);
  (status.deckArchive && status.deckArchive !== "none" ? ok : bad)(`deck archive: ${status.deckArchive}`);
  if (typeof status.qlooMonthlyRemaining === "number") ok(`Qloo calls left this month: ${status.qlooMonthlyRemaining}`);
}

/** Read a run's NDJSON stream to the end; returns the finished deck or an error message. */
async function follow(res) {
  const decoder = new TextDecoder();
  let buf = "";
  for await (const chunk of res.body) {
    buf += decoder.decode(chunk, { stream: true });
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line) continue;
      const e = JSON.parse(line);
      if (e.type === "done") return { result: e.result };
      if (e.type === "error") return { error: e.message };
    }
  }
  return { error: "stream ended early" };
}

console.log("\nExample shows");
for (const name of shows) {
  const t0 = Date.now();
  const res = await fetch(`${origin}/api/run?q=${encodeURIComponent(name)}`, { method: "POST" }).catch(() => null);
  if (!res) {
    bad(`${name}: unreachable`);
    continue;
  }
  if ((res.headers.get("content-type") ?? "").includes("ndjson")) {
    const { result, error } = await follow(res);
    if (error) bad(`${name}: not cached, and the warm-up run failed: ${error}`);
    else {
      const fallbacks = result.stats.fallbacks.length ? `, fallbacks: ${result.stats.fallbacks.join(", ")}` : "";
      (fallbacks ? bad : ok)(`${name}: was not cached, warmed in ${secs(t0)} (#1 ${result.deck[0]?.brand.name} ${result.deck[0]?.fit}${fallbacks})`);
    }
    continue;
  }
  const json = await res.json().catch(() => ({}));
  if (json.result) ok(`${name}: cached (${secs(t0)}), #1 ${json.result.deck[0]?.brand.name} ${json.result.deck[0]?.fit}`);
  else bad(`${name}: ${json.error ?? `HTTP ${res.status}`}`);
}

console.log("\nExample brands");
for (const name of brands) {
  const t0 = Date.now();
  const json = await fetch(`${origin}/api/brand?q=${encodeURIComponent(name)}`)
    .then((r) => r.json())
    .catch(() => ({ error: "unreachable" }));
  if (!json.result) bad(`${name}: ${json.error}`);
  else ok(`${name}: ${json.cached ? "cached" : "was not cached, computed"} (${secs(t0)}), #1 ${json.result.matches[0]?.podcast.name} ${json.result.matches[0]?.fit}`);
}

console.log(problems ? `\n${problems} problem(s). See above.` : "\nAll good.");
process.exitCode = problems ? 1 : 0;
