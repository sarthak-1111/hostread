# Qloo Agentic Hackathon — compliance checklist

Source: https://qloo.devpost.com (Overview, Rules, Resources), read 2026-10-28,
plus the Qloo hackathon developer guide and https://github.com/qloo/qloo-hackathon-kit.

**Deadline:** Oct 30 2026, 11:45 pm ET (= Oct 31 2026, 12:45 JST).
**Our target:** submitted by Oct 31 2026, 09:00 JST.
**Judging period:** Nov 2 12:00 pm ET – Nov 5 11:45 pm ET. Top 3 present live on Nov 5.

## Submission requirements (Rules §4 "Submission Requirements" + Overview "What to submit")

| # | Requirement (from the rules) | How HostRead meets it | Status |
|---|---|---|---|
| 1 | "A link to a functional demo application" — a live, working app judges can try end-to-end | Hosted Next.js app. Landing → search a podcast → live agent run → sponsor deck | ☐ deployed ☐ tested end-to-end with live data |
| 2 | "Your demo must be hosted and fully published externally … Submissions that only run locally or rely on private access will not qualify." | Public URL, no login. LLM switched from the local Ollama to a public OpenAI-compatible endpoint before deploy | ☐ public URL ☐ works in a private window ☐ works on mobile ☐ no localhost dependency |
| 3 | "A URL to a public code repository (GitHub, GitLab, or Bitbucket)" that "must contain all necessary source code, assets, and instructions required for the project to be functional" | `github.com/sarthak-1111/hostread` (public). README has setup, env vars, deploy steps | ☐ repo public ☐ README run instructions verified from a clean clone |
| 4 | "The repository must be public and open source by including an open source license file. This license should be detectable and visible at the top of the repository page (in the About section)." | `LICENSE` = standard MIT text at repo root (GitHub auto-detects it) | ☑ file added ☐ "MIT license" visible in the About sidebar after push |
| 5 | "Include a text description that should explain the features and functionality of your Project" (incl. what makes it "Qloo-powered") | `DESCRIPTION.md`, paste-ready for the Devpost form | ☐ written ☐ pasted into Devpost |
| 6 | Must be agentic: "(a) functions as an agentic tool, (b) is built using an agent framework, or (c) integrates the Qloo API into an existing agent" | HostRead is an agentic tool: an LLM tool-calling loop (any OpenAI-compatible endpoint) that plans and calls Qloo-backed tools (`resolve_podcast`, `audience_profile`, `brand_candidates`, `brand_fan_profile`, `overlap_evidence`, `demographics`, …), with a live trace in the UI | ☐ verified in the hosted demo |
| 7 | "Integrates the Qloo API" and Qloo must be the differentiator: "If your submission would work the same without Qloo, you're building the wrong thing." | Every recommendation, score and cited reference comes from Qloo results for that run. The "Obvious vs. Surprising" panel shows a plain-LLM baseline (no Qloo) next to the taste-grounded picks, so the difference is visible in the product | ☐ verified with live data |
| 8 | Testing: "The Entrant must make the Project available free of charge and without any restriction, for testing, evaluation and use by the Sponsor, Administrator and Judges until the Judging Period ends." | No login, no paywall. Per-IP rate limits and a daily global cap are generous, cached runs are free, and limits show friendly messages. Hosting + keys must stay up through at least Nov 5 (target: mid-November) | ☐ limits tuned ☐ host plan has no expiry before mid-Nov |
| 9 | Language: all materials in English | All docs and UI in English | ☑ |
| 10 | Demo video not required ("we're requiring something judges can actually use") | Optional; screenshots in `/docs` | ☐ 3–5 screenshots from live data |
| 11 | New project, or an existing one significantly updated during the submission period (Sep 30 – Oct 30) | Created from scratch on Oct 28 2026; git history shows it | ☑ |
| 12 | Original work, solely owned; open-source deps used per their licences; third-party APIs used per their terms | Own code (MIT). Deps are permissive OSS. Qloo used via the event key under its terms; LLM endpoint used under its provider's terms | ☐ dependency licences checked |

## Qloo API terms and data handling (developer guide + hackathon kit)

| Rule | How we comply | Status |
|---|---|---|
| Hackathon key works only on `https://hackathon.api.qloo.com`, header `X-Api-Key` (not a query param, not Bearer) | `QLOO_BASE_URL` defaults to that host; key sent only in the `X-Api-Key` header from server-side code | ☐ verified |
| Never put the key in source control, a browser app or a demo recording | Key read from `QLOO_API_KEY` env var on the server only; `.env*` files gitignored; pre-push secret scan | ☐ secret scan clean |
| "Private server-side caching is allowed with no time limit. Do not store Qloo response data in a public repository." | Runtime cache in memory / optional KV only. No raw payloads committed; SAMPLE fixtures are synthetic and generated in code | ☐ verified repo contains no API payloads |
| Responses are verbose and fields can't be filtered by the API | Client normalises responses to the few fields we use | ☐ |
| Results describe aggregate affinities, not individuals; don't send personal data to Qloo | Only public entity IDs (podcasts, brands) are sent. UI says fit scores are relative rankings, not revenue predictions | ☐ |
| Present results with their source and limits; distinguish Qloo results from our interpretation | Evidence chips are labelled as Qloo affinity data; generated pitch text is grounding-checked and labelled as AI-written | ☐ |
| Bounded retries, smallest request that answers the question, no bulk scraping | Max steps, max API calls per run, max 4 concurrent requests, timeouts, backoff | ☐ |
| Legacy `/recommendations` endpoints are not supported | We use `/search` and `/v2/insights` (and `/v2/tags` if needed) only | ☑ |

## Judging criteria (equally weighted, Rules §6 Stage Two)

Stage One is pass/fail: the project "reasonably fits the theme and reasonably applies the required APIs/SDKs".

1. **Technological Implementation** — "How thoroughly and skillfully does the project use Qloo? Does the code reflect genuine effort and a working, non-trivial implementation?"
2. **Design** — "Does the project deliver a complete, coherent product experience, not just a technical proof of concept?"
3. **Potential Impact** — "Does the project make a credible, specific case for solving a real problem for a real audience and does the solution actually address that problem based on what's demonstrated?"
4. **Quality of the Idea** — "Is this a creative, non-obvious use of Qloo and does the team demonstrate genuine understanding of the problem space they're working in?"

Ties are broken by the criteria in the order above, so Technological Implementation matters most.

## Final pre-submit checklist

- [ ] Demo URL works end to end with **live** Qloo data (no SAMPLE banner) in a private window
- [ ] Demo works on a phone-width screen
- [ ] Three quick back-to-back runs succeed (cache + rate limits behave)
- [ ] LLM env vars point at a public endpoint, not `localhost`
- [ ] Repo is public, has `LICENSE` (MIT) shown in About, README with run instructions
- [ ] Secret scan clean (no keys in history)
- [ ] No raw Qloo payloads in the repo
- [ ] Tag `v1.0-hackathon` pushed
- [ ] Devpost form: demo URL, repo URL, description text — filled in and **Submit** pressed by the entrant
