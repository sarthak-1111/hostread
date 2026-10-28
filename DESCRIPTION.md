# HostRead — submission text

_Paste-ready for the Devpost form. Sections follow the form's usual order._

## Tagline

Find the sponsors your listeners already love. Get the pitch written.

## The problem

There are hundreds of thousands of active podcasts, and almost none of them have an ad-sales team. An independent host who wants a sponsor has two options: join a marketplace and take whatever programmatic spot comes along, or pitch brands directly and guess which ones to pitch. Guessing usually means copying the sponsors that bigger shows in the same genre already run — so every true-crime show pitches the same home-security brand and every business show pitches the same accounting software. Those brands are crowded, the host has no evidence that their particular audience cares, and the pitch reads like everyone else's.

Brands have the mirror-image problem: they buy the same handful of big shows because finding the small, loyal audiences that already love them is slow and manual.

What both sides are missing is evidence about **taste**: not what a show is about, but what its listeners love — the films, artists, restaurants, books and places — and which brands' fans love the same things.

## What it does

Type a podcast's name (with autocomplete). HostRead's agent:

1. Maps the show's audience across **film, TV, music, dining, books, places and other podcasts** using Qloo's taste graph.
2. Pulls the **brands those listeners over-index on**, minus any categories the host excludes (alcohol, gambling, tobacco, cannabis, crypto, firearms, adult).
3. Chooses which brands to investigate, profiles **each brand's fans** across the same domains, and measures how much the two taste profiles overlap.
4. Scores every brand with a transparent, deterministic formula and returns a **ranked sponsor deck**. Each card shows the fit score, the evidence ("Listeners and this brand's fans both love: _a film_, _an artist_, _a restaurant_"), and buttons to copy a **pitch email** and a **45–60 second host-read ad script**.
5. Shows an **Obvious vs. Surprising** panel: what a plain LLM guesses from the show's name and topic, next to the taste-grounded picks. Brands the LLM never thought of get a **Surprise fit** badge.
6. Produces an **audience snapshot** that doubles as a one-page, print-ready **media kit**, and a shareable link to the deck.

The whole run streams live: you watch the agent choose tools, see each call's parameters, timing and result counts, and see where guardrails stepped in.

## Why it needs Qloo

The hackathon's rule is "if your submission would work the same without Qloo, you're building the wrong thing." HostRead makes that test visible in the product. A plain LLM only knows a show's topic, so it suggests the category defaults. HostRead's picks come from Qloo's cross-domain affinity data — which brands this audience actually over-indexes on, and which of those brands have fans with the same taste in film, TV, music, books and dining. The Obvious vs. Surprising panel puts the two side by side on every run and resolves the LLM's guesses back into Qloo to show how they score with this audience.

Qloo powers every number and every reference on the page:

- `/search` (podcast) — autocomplete and show resolution
- `/v2/insights` with the show as signal — brand candidates with affinity, and the audience's taste across seven domains
- `/v2/insights` with each brand as signal — the brand's fan profile, for the overlap and the evidence
- `/v2/insights` with `filter.results.entities` — how the plain LLM's guesses actually score with this audience
- `/v2/insights` demographics and heatmap — the age/gender skew and geography in the media kit

Remove Qloo and HostRead has no candidates, no evidence, no score and nothing it is allowed to cite.

## How the agent works

HostRead is an agentic tool: an LLM in a tool-calling loop (any OpenAI-compatible endpoint) with eight tools — `resolve_podcast`, `audience_profile`, `brand_candidates`, `brand_fan_profile`, `overlap_evidence`, `demographics`, `geography` and `rank_sponsors`. The agent decides the order, which brands are worth a deep dive (varied categories, no near-duplicate sub-brands, plausible podcast sponsors), and writes a short read on the audience.

What the LLM is **not** allowed to do is just as important:

- **Scores are code.** Fit = 100 × (0.50·A + 0.35·O + 0.15·S), where A is Qloo's brand affinity for the audience (normalised across candidates), O is the weighted Jaccard overlap between listeners' and brand fans' top-40 entities per domain, and S is 1 when the plain-LLM baseline missed the brand. The formula is on the page under "How we score". Scores are relative rankings, not revenue predictions, and the UI says so.
- **Generated text is grounded.** The pitch email and ad script may only cite entities the API returned in this run. Code extracts every proper-noun reference, rejects anything else, and makes the model rewrite; if it keeps inventing, a deterministic template takes over. The card shows how many grounded references were used and whether a rewrite was needed.
- **Guardrails.** Maximum steps, a per-run API-call budget, a run time budget, timeouts, retries with backoff, at most four concurrent Qloo requests, and validated tool arguments. If the LLM stops early or is unavailable, the guardrails finish the plan with the same tools, and the trace says so.

## How we built it

- **Next.js 15 + TypeScript** web app with server-side API routes; the run streams to the browser over Server-Sent Events.
- **One data-access module** for Qloo (`TasteClient`), with a runtime cache (memory, optional Redis-compatible KV) and request de-duplication, so repeat demos are instant. Raw API payloads are never stored or committed.
- **LLM-agnostic agent loop** over the OpenAI chat-completions API: we developed against `gpt-oss:120b` on a local Ollama server and deploy against a hosted endpoint by changing three env vars.
- **Deterministic scoring and grounding** with unit tests.
- **Per-IP rate limits and a daily global cap** so the hosted demo stays up for every judge; cached decks never count.
- **Tailwind CSS** UI with a print stylesheet for the media kit, dark mode, and a phone layout.

## Challenges we ran into

- **Making an open-weights model a reliable agent.** Ollama occasionally returns HTTP 500 "error parsing tool call" for gpt-oss. The client retries, then switches to a text tool mode where the model writes the call as JSON and our code parses it.
- **Grounding without false alarms.** A naive proper-noun check flags "I'm", "Hi Partnerships Team" and possessives. We built a reference extractor that understands sentence starts, contractions, possessives, show and brand names, and joined phrases, so it catches an invented "Taylor Swift" or "Spanish" but not ordinary English.
- **Building before the key arrived.** We built the whole product against clearly labelled synthetic fixtures behind the same client interface, then switched to live data with a config change.
- **Honest comparison.** The baseline only sees the show's name and topic, and when it is unavailable no brand gets a surprise bonus — we never claim a surprise we can't show.

## What's next

- **Brand-side mode:** enter a brand, get the podcasts whose listeners already love it, with the same evidence.
- **Campaign memory:** track which pitches got replies and which reads converted, and feed that back into the ranking.
- **MCP server:** expose HostRead's tools so any agent (a network's CRM assistant, a brand's media-buying agent) can call them.
- **Network dashboard:** run every show in a network at once and find sponsors that fit several shows.

## Business model

- **Free for independent shows:** a few decks a month, pitch emails and scripts included — the top of the funnel and the supply side of the marketplace.
- **Paid tier for networks and agencies:** multi-show workspaces, saved decks, CRM export, white-label media kits and unlimited runs.
- **Brand-side marketplace with a take rate:** brands discover small, high-fit shows (with the same evidence), book host-read campaigns through HostRead, and we take a percentage of each booking.

## Built with

Qloo Insights API (Taste Analysis) and Search, Next.js, React, TypeScript, Tailwind CSS, zod, an OpenAI-compatible LLM (gpt-oss-120b), Vercel.

## Links

- Live demo: _added at deploy_
- Code (MIT): https://github.com/sarthak-1111/hostread
