# HostRead — submission text

_Paste-ready for the Devpost form. Sections follow the form's usual order._

## Tagline

Find the sponsors your listeners already love. Get the pitch written.

## The problem

Imagine Dana. (She's a composite of the hosts we built this for, not a customer.) She hosts a true-crime podcast with a few thousand loyal listeners and no ad-sales team. When she wants a sponsor, she asks a chatbot who to pitch, and it gives her the list it gives every true-crime show: home security, mattresses, meal kits. She pitches them anyway. Those brands are crowded, she has no evidence that her particular listeners care, and her email reads like a hundred others in their inbox. Nobody answers.

Dana is one of hundreds of thousands of active podcasts, and almost none of them have anyone selling ads. A host who wants a sponsor can join a marketplace and take whatever programmatic spot comes along, or guess which brands to pitch directly. Guessing usually means copying what bigger shows in the same genre already run.

Brands have the mirror-image problem: they buy the same handful of big shows because finding the small, loyal audiences that already love them is slow and manual.

What both sides are missing is evidence about **taste**: not what a show is about, but what its listeners love — the films, artists, restaurants, books and places — and which brands' fans love the same things.

## What it does

Dana types her show's name (with autocomplete) and watches HostRead's agent work:

1. Maps the show's audience across **film, TV, music, food & drink, books, places and other podcasts** using Qloo's taste graph.
2. Pulls the **brands those listeners over-index on**, minus any categories the host excludes (alcohol, gambling, tobacco, cannabis, crypto, firearms, adult).
3. Chooses which brands to investigate, profiles **each brand's fans** across the same domains, and measures how much the two taste profiles overlap.
4. Scores every brand with a transparent, deterministic formula and returns a **ranked sponsor deck**. Each card shows the fit score, the evidence ("Listeners and this brand's fans both love: _a film_, _an artist_, _a restaurant_"), and buttons to copy a **pitch email** and a **45–60 second host-read ad script**.
5. Shows an **Obvious vs. Surprising** panel: what a plain LLM guesses from the show's name and topic, next to the taste-grounded picks. Brands the LLM never thought of get a **Surprise fit** badge.
6. Produces an **audience snapshot** that doubles as a one-page, print-ready **media kit**, and a shareable link to the deck.

About a minute and a half later, Dana has a first pitch she would never have found, three shared tastes that prove the fit, an email and a script ready to send, and a media kit to attach.

The whole run streams live: you watch the agent choose tools, see each call's parameters, timing and result counts, and see where guardrails stepped in.

**Brands get the same evidence the other way round.** On `/brands`, a brand types its name and gets the podcasts whose listeners already love it: Qloo ranks podcasts for the brand's fans, and HostRead checks how much each top show's listeners love those fans' favourite films, shows, artists, books and food brands. Each match has a fit score, the shared tastes, a template outreach note, and a link to that show's own sponsor deck, so a brand and a host can look at the same match from both sides. Patagonia, for example, gets The Rich Roll Podcast first, sharing _180° South_ and _Mysteries at the Museum_ with its fans.

**Any agent can use it.** A small MCP server exposes `search_podcasts`, `sponsor_deck`, `write_pitch`, `search_brands` and `podcasts_for_brand`, so a network's CRM assistant or a brand's media-buying agent can call HostRead directly.

## Why it needs Qloo

The hackathon's rule is "if your submission would work the same without Qloo, you're building the wrong thing." HostRead makes that test visible in the product. A plain LLM only knows a show's topic, so it suggests the category defaults. HostRead's picks come from Qloo's cross-domain affinity data — which brands this audience actually over-indexes on, and which of those brands have fans with the same taste in film, TV, music, books and food & drink. The Obvious vs. Surprising panel puts the two side by side on every run and resolves the LLM's guesses back into Qloo to show how they score with this audience.

Qloo powers every number and every reference on the page:

- `/search` (podcast) — autocomplete and show resolution
- `/v2/insights` with the show as signal — brand candidates with affinity, and the audience's taste across seven domains
- `/v2/insights` with each brand as signal — the brand's fan profile, for the overlap and the evidence
- `/v2/insights` with `filter.results.entities` — how the plain LLM's guesses actually score with this audience
- `/v2/insights` demographics and heatmap — the age/gender skew and geography in the media kit
- `/v2/insights` with a brand as signal and podcasts as the type, then each show as signal with `filter.results.entities` — brand-side mode

Remove Qloo and HostRead has no candidates, no evidence, no score and nothing it is allowed to cite.

## How the agent works

HostRead is an agentic tool: an LLM in a tool-calling loop (any OpenAI-compatible endpoint) with eight tools — `resolve_podcast`, `audience_profile`, `brand_candidates`, `brand_fan_profile`, `overlap_evidence`, `demographics`, `geography` and `rank_sponsors`. The agent decides the order, which brands are worth a deep dive (varied categories, no near-duplicate sub-brands, plausible podcast sponsors), and writes a short read on the audience.

What the LLM is **not** allowed to do is just as important:

- **Scores are code.** Fit = 100 × (0.50·A + 0.35·O + 0.15·S), where A is Qloo's brand affinity for the audience (normalised across candidates), O is a weighted Jaccard over the listeners' top 20 favourites per domain, comparing the listeners' Qloo affinity for each item with the brand fans' affinity for the same item, and S is 1 when the plain-LLM baseline missed the brand. The formula is on the page under "How we score". Scores are relative rankings, not revenue predictions, and the UI says so.
- **Generated text is grounded.** The pitch email and ad script may only cite entities the API returned in this run. Code extracts every proper-noun reference, rejects anything else, and makes the model rewrite; if it keeps inventing, a deterministic template takes over. The card shows how many grounded references were used and whether a rewrite was needed.
- **Guardrails.** Maximum steps, a per-run API-call budget, a run time budget, timeouts, retries with backoff, at most four concurrent Qloo requests, and validated tool arguments. If the LLM stops early or is unavailable, the guardrails finish the plan with the same tools, and the trace says so.

## How we built it

- **Next.js 15 + TypeScript** web app with server-side API routes. A run is a job whose trace events go to a job log; on Vercel the request that starts the run streams those events back as NDJSON inside one 300-second function, and other hosts poll the log or hand the job to a background function.
- **One data-access module** for Qloo (`TasteClient`), with a runtime cache (memory, optional Upstash Redis), request de-duplication and a private Vercel Blob archive of finished decks, so repeat demos are instant. Raw API payloads are never stored or committed.
- **LLM-agnostic agent loop** over the OpenAI chat-completions API: we developed against `gpt-oss:120b` on a local Ollama server and deploy against a hosted endpoint by changing three env vars.
- **Deterministic scoring and grounding** with unit tests.
- **Brand-side mode** reuses the same client, overlap measure and cache with a second formula, Fit = 100 × (0.60·A + 0.40·O), and no LLM: 47 Qloo calls and about 10 seconds per fresh brand.
- **An MCP server** (official TypeScript SDK, stdio) over the hosted API, so it needs no keys of its own.
- **Per-IP rate limits, a daily cap and a Qloo quota guard** so the hosted demo stays up for every judge; cached decks never count.
- **Tailwind CSS** UI on the `tom-modern` style from Open Design (Geist type, a neutral canvas, one vermillion accent, sharp corners, hard shadows), reviewed against the Vercel Web Interface Guidelines and checked in Playwright on desktop, phone and dark mode. The media kit has a print stylesheet.

## Challenges we ran into

- **Making an open-weights model a reliable agent.** Ollama occasionally returns HTTP 500 "error parsing tool call" for gpt-oss. The client retries, then switches to a text tool mode where the model writes the call as JSON and our code parses it.
- **Grounding without false alarms.** A naive proper-noun check flags "I'm", "Hi Partnerships Team" and possessives. We built a reference extractor that understands sentence starts, contractions, possessives, show and brand names, and joined phrases, so it catches an invented "Taylor Swift" or "Spanish" but not ordinary English.
- **Building before the key arrived.** We built the whole product against clearly labelled synthetic fixtures behind the same client interface, then switched to live data with a config change.
- **Real data broke our first overlap measure.** Comparing the listeners' top 40 films, shows, artists and books with each brand's fans' top 40 found almost nothing in common (overlaps of 0.00 to 0.04), so every score came from food brands. We now ask Qloo how much each brand's fans like the listeners' own top 20 favourites (`filter.results.entities`) and compare the two sets of affinities with a weighted Jaccard. Same number of calls, dense signal, and the evidence chips became films, shows and artists both audiences actually share.
- **Geography without place names.** The heatmap needs a location, and its city boundary returned about 16,000 cities with outline polygons (around 360 MB) for one show. Geohash cells come back in 2 seconds but carry only coordinates, so code groups them under the nearest US metro. Crime Junkie, made in Indianapolis, comes out Indianapolis first.
- **Dining was local.** Place results without a location cluster around one city, which is weak evidence for a national show, so "dining" became food and drink brands.
- **Keeping the model honest about the data.** Even when told not to, the model wrote that listeners "mention" things. Qloo measures affinity, not mentions, so code rewrites those claims to "love", and only shared favourites are attributed to a brand's fans.
- **A quota every server sees.** The key allows 50,000 calls a month and a fresh run makes about 60. Serverless instances don't share counters, so the app reads Qloo's own remaining-quota header and stops fresh runs before the reserve; cached decks keep working.
- **Honest comparison.** The baseline only sees the show's name and topic, and when it is unavailable no brand gets a surprise bonus — we never claim a surprise we can't show.

## What's next

- **Campaign memory:** track which pitches got replies and which reads converted, and feed that back into the ranking.
- **Network dashboard:** run every show in a network at once and find sponsors that fit several shows.
- **Two-sided matching:** when a brand's match list and a show's deck point at each other, introduce them, with the evidence both sides already saw.
- **Agent-written brand outreach:** the same grounded writer for the brand side, in place of today's template note.

## Business model

- **Free for independent shows:** a few decks a month, pitch emails and scripts included — the top of the funnel and the supply side of the marketplace.
- **Paid tier for networks and agencies:** multi-show workspaces, saved decks, CRM export, white-label media kits and unlimited runs.
- **Brand-side marketplace with a take rate:** brands discover small, high-fit shows (with the same evidence), book host-read campaigns through HostRead, and we take a percentage of each booking. The demo's brand-side mode is the discovery half of this today.

## Built with

Qloo Insights API (Taste Analysis) and Search, Next.js, React, TypeScript, Tailwind CSS, zod, an OpenAI-compatible LLM (gpt-oss-120b), Vercel (Functions with streaming responses, Blob), Model Context Protocol (TypeScript SDK).

## Links

- Live demo: https://hostread.vercel.app
- Code (MIT): https://github.com/sarthak-1111/hostread
