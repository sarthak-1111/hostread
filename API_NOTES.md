# Qloo API notes (hackathon key)

Verified on 2026-10-29 against `https://hackathon.api.qloo.com` with the event key in the `X-Api-Key` header, server-side only. About 120 calls in total. Raw responses were inspected in a temporary folder outside the repo and deleted; nothing below is response data beyond counts, field names and parameter behaviour.

## Verdict

Podcast coverage is strong, so HostRead runs on podcasts as planned (no TV/film fallback needed).

- `/search` with `types=urn:entity:podcast` returned the right show as the top hit for 15 of 16 well-known shows across true crime, comedy, business, health, sports, news, science, tech and culture. The miss was a generic title ("The Daily"), where autocomplete shows the alternatives.
- `/v2/insights` with a podcast as the signal returned full pages with `query.affinity` on every result in all nine domains tried (27 of 27 calls for three shows).
- Brand candidates differ sharply from genre defaults. For a large true-crime show the top 50 were mostly fashion, accessories and lifestyle retail; for a cybersecurity show they were the expected security vendors. That contrast is exactly what the Obvious vs. Surprising panel shows.

## Limits and latency

| | |
|---|---|
| Per second | 10 requests (`x-second-ratelimit-*` headers) |
| Per month | 50,000 requests (`x-month-ratelimit-limit`, `-remaining`, `-reset`); the window started at the first call |
| `take` | default 20, maximum 50 |
| `/search` latency | p50 ≈ 0.37 s, p90 ≈ 0.55 s |
| `/v2/insights` latency | p50 ≈ 0.5–1.7 s, p90 ≈ 3.4 s; artist and movie queries are the slowest (≈ 3 s) |
| Concurrency | 4 parallel requests, twice: all 200, 0.7–4.4 s, no 429s |

A fresh HostRead run makes about 60 Qloo calls, so the month allows roughly 800 fresh runs. The app reads `x-month-ratelimit-remaining` from every response and stops starting fresh runs below `QLOO_MONTHLY_RESERVE` (default 2,500); cached decks keep working.

## Endpoints and parameters used

| Purpose | Call | Notes |
|---|---|---|
| Autocomplete, resolve show | `GET /search?query=…&types=urn:entity:podcast&take=8` | Results: `name`, `entity_id`, `types`, `properties` (`short_description`, `image`, `akas`, `external`), `popularity`, `disambiguation`, `tags`. Genres are `urn:tag:genre:media` tags, plus a generic "Podcasts" tag we drop. |
| Show by id | `GET /entities?entity_ids=…` | Works; used when a share link carries only the id. |
| Audience taste per domain | `GET /v2/insights?filter.type=<type>&signal.interests.entities=<show>&take=40` | Types: `urn:entity:movie`, `tv_show`, `artist`, `book`, `destination`, `podcast` (with `filter.exclude.entities=<show>`). |
| Brand candidates | `filter.type=urn:entity:brand`, `take=50` | Brand results add `type`, `subtype`, `properties.industry`, and tags (`urn:tag:genre:brand`, `brand_subtype`, `brand_type`, `lifestyle`, `aesthetic_property`, `competitor_brand`, `core_value`). We take the category from `properties.industry`, falling back to the subtype and genre tags. |
| Brand fan profile | same insights call with the **brand** as the signal | Works for every domain. One check: a show and its top brand's fans shared 10 of their top 40 films, so the overlap score has real signal. |
| Affinity of named brands | `filter.results.entities=<ids>` | Returns exactly those brands with this audience's affinity; used to score the plain-LLM baseline's guesses. |
| Age and gender | `filter.type=urn:demographics` | `results.demographics[0].query.age` (six buckets, `24_and_younger` … `55_and_older`) and `.gender` (`male`, `female`); values are skews in −1…1 with float noise, so the UI rounds. |
| Geography | `filter.type=urn:heatmap`, `filter.location.query=United States`, `output.heatmap.boundary=urn:geohash` | See below. |
| Tag lookup | `GET /v2/tags?filter.query=…` | Used once to find the food and drink brand tag. |

## Things that didn't work as first written

- **Heatmap.** Without a location it returns 400 ("at least one valid signal and filter.location or filter.location.query is required"), and `output.heatmap.boundary` only accepts `urn:geohash` or `urn:entity:locality`. The locality boundary is unusable for us: it ignored `take` and returned about 16,000 localities with outline polygons (≈ 360 MB, 165 s). The geohash boundary returned about 6,900 cells for the US (≈ 1.9 MB, 2.4 s) with `latitude`, `longitude` and `query.affinity` but no place names, so HostRead groups cells under the nearest large US metro (`src/lib/metros.ts`) and shows the top metros by mean affinity.
- **Dining as places.** `filter.type=urn:entity:place` without a location returns venues clustered around one metro (apparently the show's home region), and `filter.tags=urn:tag:category:place:restaurant` still mixes in event venues and bars. For national shows that's weak evidence, so the dining domain became **food & drink brands**: `filter.type=urn:entity:brand&filter.tags=urn:tag:genre:brand:food_and_beverage`, which returns national snack, drink and food brands for both listeners and brand fans.
- **Explainability.** `feature.explainability=true` adds `query.explainability` per result, but with a single-entity signal every result credits that one signal with score 1, so it adds nothing to a one-show query. Not used. Results also carry `query.measurements.audience_growth`.

## Data handling

- Only normalised, trimmed shapes are cached (memory, and a private Vercel Blob store for finished decks). Qloo's hackathon guide allows private server-side caching and asks that response data stay out of public repositories.
- No responses, entity IDs or fixtures derived from live data are committed. The landing page's example shows are names only and are resolved through `/search` at run time.
- `QLOO_API_KEY` lives only in the gitignored `.env.local` and the host's secret settings.
