# HostRead — finalist pitch (Nov 5)

Audience: Jason Calacanis, Cedric the Entertainer, Alex Elias, plus investors watching live. Keep it human, concrete and fast. Show the product early.

> Numbers below have sources at the end. Re-check them the day before; don't add any figure that isn't on that list.

---

## 10-second hook

"Every podcast in a genre pitches the same five sponsors. HostRead finds the brands *your* listeners already love — using what they watch, eat, read and listen to — and writes the pitch for you."

---

## 2-minute pitch

**The problem (25 s).**
There are roughly half a million active podcasts, and almost none of them have an ad-sales team. When an independent host wants a sponsor, they guess — and the guess is always the brands bigger shows in their genre already run. Ask a chatbot who should sponsor a true-crime show and you'll get the same answer for every true-crime show on Earth. That's the problem: a show's *topic* is not its *audience*.

**The insight (20 s).**
Listeners are specific. The people who love one comedy podcast also love particular films, artists, restaurants and books — and so do the fans of brands that have nothing to do with comedy. If you can see both taste profiles, you can find sponsors no one else is pitching, and you can prove the fit.

**The product (40 s).** _(switch to the demo here — see script below)_
HostRead is an agent. You type a show. It uses Qloo's taste graph to map what the listeners love across seven domains, pulls the brands they over-index on, profiles each brand's fans, and measures the overlap. You get a ranked sponsor deck: a fit score, the evidence — "your listeners and this brand's fans both love these three things" — a pitch email, and a 45-to-60-second host-read script whose cultural references come only from the data. Next to it, what a plain LLM would have guessed. The brands it missed get a "Surprise fit" badge. That's the part only Qloo makes possible.

**Why now / why us (15 s).**
Host-read ads are the premium inventory in podcasting — around half of podcast ad spend by one industry benchmark — and they only work when the host genuinely fits the brand. HostRead turns "fit" from a gut feeling into evidence a brand manager can forward to their boss.

**Business (20 s).**
Free for independent shows — that's our supply. A paid tier for networks and agencies: multi-show workspaces, CRM export, white-label media kits. And a brand-side marketplace: brands search for the small, loyal shows whose audiences already love them, book host-reads through HostRead, and we take a cut of each booking.

**Close (5 s).**
"HostRead: find the sponsors your listeners already love — and get the pitch written."

---

## Live demo script (≈ 90 s)

Pre-flight (5 minutes before): open the demo in a clean browser window; run each demo show once so it's cached; have the deck tab and a backup tab (the cached share link) ready; turn off notifications.

1. **Landing (10 s).** "One promise, one box." Point at the tagline. Start typing a well-known show — autocomplete shows it's a real entity in the taste graph. Pick it.
2. **Agent trace (20 s).** "On the left you're watching the agent think." Point at a tool call: `brand_candidates`, then `brand_fan_profile` with the agent's stated reason — "it chose these eight brands and skipped the duplicates." Point at "code" steps: "Scoring is deterministic code. The LLM never touches the numbers."
3. **Deck (25 s).** Open the #1 card. "Fit score, and the *why*: these listeners and this brand's fans both love _[read the three chips]_." Click **Evidence** to show the per-domain overlap. Click **Ad script**: "45 to 60 seconds, ready to read. Every cultural reference in here came from the data for this show — we check it in code and make the model rewrite if it invents anything." Hit **Copy pitch email**.
4. **Obvious vs. Surprising (20 s).** Scroll. "Left: what a plain LLM guesses from the show's name. Right: what the taste graph found. The terracotta badges are brands the LLM never thought of." Read one surprise pick aloud and its evidence chip.
5. **Media kit (10 s).** Click **Media kit**. "And the host gets a one-page media kit to attach to the email." Done.

Fallbacks: if the network is slow, open the cached share link (instant). If the LLM endpoint is down, the guardrails still produce the deck and template pitches — say "this is the guardrail path" and keep going.

---

## 10 likely judge questions

1. **"How big is the market?"**
   US podcast advertising was about $2.9 billion in 2025 (IAB/PwC), and host-read ads are roughly half of podcast ad spend by Magellan AI's benchmark. The long tail — hundreds of thousands of active shows — is mostly unsold. We start where the pain is sharpest: shows with real audiences and no sales team.

2. **"Who pays?"**
   Networks and agencies pay a subscription to run every show they manage; brands pay a take rate when they book through the marketplace. Independent hosts are free — they're the supply that makes the marketplace valuable.

3. **"What's the moat? Couldn't anyone call Qloo?"**
   The API is the input, not the product. Our moat is the workflow and the loop: evidence-backed decks, grounded pitches, and — as campaigns run — outcome data on which pitches got replies and which reads converted. That feedback improves ranking in a way a raw API call can't, and the two-sided marketplace compounds it.

4. **"Why do you need Qloo? Isn't this just ChatGPT?"**
   We show the difference on every run. A plain LLM only knows the show's topic, so it suggests the category defaults. Qloo knows what the audience does across film, TV, music, dining, books and places, and which brands' fans share those tastes. Without Qloo we have no candidates, no evidence, no score and nothing we're allowed to cite.

5. **"How do you know the fit score means anything?"**
   It's transparent: half audience affinity from Qloo, about a third taste overlap between listeners and brand fans, and a small bonus for non-obvious picks. We're explicit that it's a relative ranking, not a revenue forecast. The next step is calibrating it against real campaign outcomes.

6. **"What stops the AI from making things up in the pitch?"**
   Code. Every proper noun in the email and script is checked against the entities the API returned for that show; if the model invents one, it has to rewrite, and if it keeps doing it we fall back to a template. The card shows how many grounded references it used.

7. **"Why would a brand trust a small show?"**
   Because the pitch comes with evidence a brand manager can forward: specific shared tastes, not "our audience is engaged." Small shows also tend to have the tightest host–listener trust, which is exactly what host-read ads sell.

8. **"Is this agentic or a pipeline with a chatbot on top?"**
   The LLM plans the run and chooses tools and brands — you can see its reasons in the trace — while guardrails cap steps, API calls and time, and finish the plan if the model stalls. Deterministic parts (scoring, grounding) are deliberately not left to the model.

9. **"What about brand safety?"**
   Hosts toggle off categories — alcohol, gambling, tobacco, cannabis, crypto, firearms, adult — before ranking, and the deck says how many brands were removed.

10. **"What's next?"**
    Brand-side mode (enter a brand, get the podcasts whose listeners love it), campaign memory to learn from outcomes, an MCP server so any agent — a network's CRM assistant or a brand's media-buying agent — can call HostRead, and a network dashboard to find sponsors that fit several shows at once.

---

## Sources for the numbers

- US podcast ad revenue 2025 ≈ $2.86B (+17.6% vs 2024): IAB/PwC Internet Advertising Revenue Report, full-year 2025 (published April 2026) — https://www.iab.com
- Host-read ≈ 46% of podcast ad spend in Q3 2025: Magellan AI quarterly benchmark (as reported secondhand; verify on magellan.ai before quoting)
- ~480k podcasts published an episode in the last 90 days: Podcast Index — https://podcastindex.org (check the live stats page)
