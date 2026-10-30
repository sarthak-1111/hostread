// Point the hosted demo at a new LLM endpoint, e.g. the new trycloudflare URL
// after the LLM machine restarts:
//
//   npm run llm-url -- https://<name>.trycloudflare.com
//   npm run llm-url -- --current     (re-check and re-sync the URL already in .env.local)
//
// Run it from a checkout whose .env.local has LLM_API_KEY and LLM_MODEL, with the
// Vercel CLI logged in. It checks that the endpoint lists the model and answers a
// short chat, writes LLM_BASE_URL to .env.local and to the Vercel project's
// production env, then redeploys production so the new value takes effect. The
// redeploy rebuilds the current production deployment, so no local files (and no
// .env.local) are uploaded. Keys are never printed. --skip-chat skips the chat check.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const SITE = process.env.HOSTREAD_SITE ?? "https://hostread.vercel.app";
const PROJECT = process.env.VERCEL_PROJECT ?? "hostread";
const SCOPE = process.env.VERCEL_SCOPE ?? "haven-tech-build";
const VERCEL = ["-y", "vercel@65.5.0"];

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const fail = (msg) => {
  console.error(`FAIL  ${msg}`);
  process.exit(1);
};
const ok = (msg) => console.log(`ok    ${msg}`);

if (!existsSync(".env.local")) fail("run this from the checkout that has .env.local");
const envText = readFileSync(".env.local", "utf8");
const env = Object.fromEntries(
  envText
    .split(/\r?\n/)
    .map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2].trim()]),
);

const raw = flag("--current") ? env.LLM_BASE_URL : args.find((a) => !a.startsWith("--"));
if (!raw) fail("usage: npm run llm-url -- https://<name>.trycloudflare.com   (or --current)");
let base;
try {
  const u = new URL(raw.trim());
  if (u.protocol !== "https:" || ["localhost", "127.0.0.1"].includes(u.hostname)) fail("the hosted demo needs a public https URL");
  base = `${u.origin}${u.pathname.replace(/\/+$/, "")}`;
  if (!base.endsWith("/v1")) base += "/v1";
} catch {
  fail(`not a URL: ${raw}`);
}
const host = new URL(base).hostname;
const model = env.LLM_MODEL;
if (!model) fail("LLM_MODEL is missing from .env.local");
const auth = { Authorization: `Bearer ${env.LLM_API_KEY ?? ""}` };

// 1. The endpoint is up and serves the model.
try {
  const res = await fetch(`${base}/models`, { headers: auth, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) fail(`${host} answered ${res.status} to /models`);
  const ids = ((await res.json()).data ?? []).map((m) => m.id);
  if (!ids.includes(model)) fail(`${host} doesn't list ${model} (has: ${ids.join(", ")})`);
  ok(`${host} lists ${model}`);
} catch (e) {
  fail(`${host} unreachable: ${e.message}`);
}

// 2. The model actually answers (the first call can take a minute or two while it loads).
if (!flag("--skip-chat")) {
  const t0 = Date.now();
  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages: [{ role: "user", content: "Reply with the single word: ok" }], max_tokens: 200, temperature: 0 }),
      signal: AbortSignal.timeout(300_000),
    });
    const body = await res.text();
    if (!res.ok) fail(`chat answered ${res.status}: ${body.slice(0, 200)}`);
    ok(`${model} answered a chat in ${Math.round((Date.now() - t0) / 1000)} s`);
  } catch (e) {
    fail(`chat failed after ${Math.round((Date.now() - t0) / 1000)} s: ${e.message}`);
  }
}

// 3. Local env file.
if (env.LLM_BASE_URL !== base) {
  const next = /^LLM_BASE_URL=.*$/m.test(envText) ? envText.replace(/^LLM_BASE_URL=.*$/m, `LLM_BASE_URL=${base}`) : `${envText.replace(/\s*$/, "\n")}LLM_BASE_URL=${base}\n`;
  writeFileSync(".env.local", next);
}
ok(".env.local has the new LLM_BASE_URL");

// 4. Vercel production env, then a redeploy so it takes effect.
const vercel = (cliArgs, input) => spawnSync("npx", [...VERCEL, ...cliArgs], { encoding: "utf8", shell: true, input });
if (!existsSync(".vercel/project.json")) {
  // `vercel link` appends `.env*` to .gitignore, which would re-ignore .env.example; .vercel/ is already ignored.
  const gitignore = existsSync(".gitignore") ? readFileSync(".gitignore", "utf8") : undefined;
  const link = vercel(["link", "--yes", "--project", PROJECT, "--scope", SCOPE]);
  if (gitignore !== undefined) writeFileSync(".gitignore", gitignore);
  if (link.status !== 0) fail(`vercel link: ${(link.stderr || link.stdout).trim().split("\n").at(-1)}`);
  ok(`linked this folder to ${SCOPE}/${PROJECT} (.vercel/ is gitignored)`);
}
const set = vercel(["env", "add", "LLM_BASE_URL", "production", "--force", "--yes", "--sensitive"], base);
if (set.status !== 0) fail(`vercel env add: ${(set.stderr || set.stdout).trim().split("\n").at(-1)}`);
ok("Vercel production LLM_BASE_URL updated");

console.log("..    redeploying production (about a minute)");
const dep = vercel(["redeploy", new URL(SITE).hostname, "--environment", "production"]);
if (dep.status !== 0) fail(`vercel redeploy: ${(dep.stderr || dep.stdout).trim().split("\n").at(-1)}`);
ok("production redeployed");

// 5. The site is up.
const status = await fetch(`${SITE}/api/status`, { signal: AbortSignal.timeout(20_000) })
  .then((r) => r.json())
  .catch(() => undefined);
if (!status) fail(`${SITE}/api/status didn't answer`);
ok(`${SITE} is up (data: ${status.mode}, LLM: ${status.llm})`);
console.log(`\nDone. Open a show that isn't cached on ${SITE} to see the agent write pitches again.`);
