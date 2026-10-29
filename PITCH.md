# HostRead — finalist pitch (Nov 5)

Audience: Jason Calacanis, Cedric the Entertainer, Alex Elias, plus investors watching live. Tell one host's story, show the product early, and save the market numbers for the zoom-out.

> **Dana is a composite, not a customer.** Say "imagine" when you introduce her, never give her results or revenue, and switch to a real show for the demo. If a real independent host gives you a quote before Nov 5, use it in place of Dana; a real voice beats a persona.
>
> Numbers have sources at the end. Re-check them the day before; don't add any figure that isn't on that list.

---

## 10-second hook

"Every true-crime podcast pitches the same five sponsors. HostRead finds the brands your listeners actually love, and writes the pitch."

---

## 2-minute pitch

**Dana (25 s).**
"Imagine Dana. She hosts a true-crime podcast with a few thousand loyal listeners and no ad-sales team. She asks a chatbot who should sponsor her. It says home security, mattresses, meal kits: the list it gives every true-crime show. She pitches them anyway. Nobody answers, because her email reads like a hundred others."

**What she's missing (10 s).**
"Her topic isn't her audience. Her listeners share particular films, artists, restaurants and books, and so do the fans of brands she'd never think to pitch. Qloo sees both sides."

**Dana tries HostRead (45 s).** _(switch to the demo here; see the script below)_
"Dana's show is made up, so here's a real one." Type the show. "The agent maps what these listeners love, pulls the brands they over-index on, and checks whose fans love the same things." Point at the #1 card. "Top pick: Loopycases, a phone-case brand. The chatbot never mentioned it. Listeners and its fans both love Big Time Adolescence, Great News and Walker Hayes." Click **Copy pitch email**. "That's a pitch with proof in it, one a brand manager can forward to their boss. And every reference in the ad script comes from this data; we check it in code."

**Why it matters (20 s).**
"About half a million podcasts are active, and almost none have anyone selling ads. Host-read ads are around half of podcast ad spend by one benchmark, and they only work when the host fits the brand. HostRead turns that fit from a guess into evidence."

**Business (15 s).**
"Dana uses it free; independent hosts are our supply. Networks and agencies pay for multi-show workspaces and white-label media kits. And brands get the mirror image, already live: they find the shows whose listeners already love them, book the read through HostRead, and we take a cut."

**Close (5 s).**
"Dana doesn't need an ad-sales team. She needs to know what her listeners love. HostRead: find the sponsors your listeners already love, and get the pitch written."

---

## Live demo script (≈ 90 s)

This is the "Dana tries HostRead" beat at full length, for when the demo slot is separate from the pitch. Keep narrating it as Dana's afternoon.

Pre-flight (5 minutes before): run `npm run health` from the repo (it checks the live site and warms any example that isn't cached; no keys needed), and open one show that isn't cached to confirm the LLM tunnel answers; open the demo in a clean browser window; have the deck tab and a backup tab (the cached share link) ready; turn off notifications. Demo show: **Crime Junkie** (Dana's genre, cached on the live site). As of Oct 29 its deck reads: #1 **Loopycases** (phone cases, fit 89, Surprise fit); chips **Big Time Adolescence** (film), **Great News** (TV), **Walker Hayes** (music); the plain LLM's list is Audible, LegalZoom, Allstate, Stitch Fix, Casper and similar, at a median Qloo affinity of 0.75 against 0.97 for HostRead's picks. Open the deck the day before and update these names if they changed.

1. **Landing (10 s).** "This is what Dana sees: one promise, one box." Start typing the show; autocomplete shows it's a real entity in the taste graph. Pick it.
2. **Agent trace (20 s).** "While she waits, she can watch the agent work." Point at a tool call: `brand_candidates`, then `brand_fan_profile` with the agent's stated reason ("it chose these eight brands and skipped the duplicates"). Point at the code steps: "Scoring is deterministic code. The LLM never touches the numbers."
3. **Her first pitch (25 s).** Open the #1 card. "Fit score, and the why: these listeners and this brand's fans both love _[read the three chips]_." Click **Evidence** to show the per-domain overlap. Click **Script**: "45 to 60 seconds, ready for Dana to read. Every cultural reference came from the data for this show; we check it in code and make the model rewrite if it invents anything." Hit **Copy pitch email**.
4. **The list she would have sent (20 s).** Scroll to Obvious vs. Surprising. "Left: the chatbot list Dana started with. Right: what the taste graph found. The orange badges are brands the chatbot never thought of." Read one surprise pick aloud and its evidence chip.
5. **What she attaches (10 s).** Click **Media kit**. "And Dana attaches a one-page media kit to the email." Done.
6. **Optional, the other side (15 s).** If there's time, click **For brands**, then **Patagonia** (cached). "Same evidence, other direction. A brand types its name and gets the shows whose listeners already love it: The Rich Roll Podcast first, sharing _180° South_ with Patagonia's fans. No LLM here at all; it's Qloo and arithmetic." Point at **Show's sponsor deck**: "and one click shows the same match from the host's side."

Also warm **Patagonia** on `/brands` in the pre-flight. As of Oct 29 it reads: #1 The Rich Roll Podcast (fit 100), #2 The Tim Ferriss Show (62).

Fallbacks: if the network is slow, open the cached share link (instant). If the LLM endpoint is down, the guardrails still produce the deck and template pitches; say "this is the guardrail path" and keep going.

---

## 10 likely judge questions

1. **"How big is the market?"**
   US podcast advertising was about $2.9 billion in 2025 (IAB/PwC), and host-read ads are roughly half of podcast ad spend by Magellan AI's benchmark. The long tail — hundreds of thousands of active shows — is mostly unsold. We start where the pain is sharpest: shows with real audiences and no sales team.

2. **"Who pays?"**
   Networks and agencies pay a subscription to run every show they manage; brands pay a take rate when they book through the marketplace. Independent hosts are free — they're the supply that makes the marketplace valuable.

3. **"What's the moat? Couldn't anyone call Qloo?"**
   The API is the input, not the product. Our moat is the workflow and the loop: evidence-backed decks, grounded pitches, and — as campaigns run — outcome data on which pitches got replies and which reads converted. That feedback improves ranking in a way a raw API call can't, and the two-sided marketplace compounds it.

4. **"Why do you need Qloo? Isn't this just ChatGPT?"**
   We show the difference on every run. A plain LLM only knows the show's topic, so it suggests the category defaults. Qloo knows what the audience does across film, TV, music, food & drink, books and places, and which brands' fans share those tastes. Without Qloo we have no candidates, no evidence, no score and nothing we're allowed to cite.

5. **"How do you know the fit score means anything?"**
   It's transparent: half audience affinity from Qloo, about a third taste overlap between listeners and brand fans, and a small bonus for non-obvious picks. We're explicit that it's a relative ranking, not a revenue forecast. The next step is calibrating it against real campaign outcomes.

6. **"What stops the AI from making things up in the pitch?"**
   Code. Every proper noun in the email and script is checked against the entities the API returned for that show; if the model invents one, it has to rewrite, and if it keeps doing it we fall back to a template. The card shows how many grounded references it used.

7. **"Why would a brand trust a small show?"**
   Because the pitch comes with evidence a brand manager can forward: specific shared tastes, not "our audience is engaged." Small shows also tend to have the tightest host–listener trust, which is exactly what host-read ads sell. And the brand can check it themselves: brand-side mode runs the same overlap from their side.

8. **"Is this agentic or a pipeline with a chatbot on top?"**
   The LLM plans the run and chooses tools and brands — you can see its reasons in the trace — while guardrails cap steps, API calls and time, and finish the plan if the model stalls. Deterministic parts (scoring, grounding) are deliberately not left to the model.

9. **"What about brand safety?"**
   Hosts toggle off categories — alcohol, gambling, tobacco, cannabis, crypto, firearms, adult — before ranking, and the deck says how many brands were removed.

10. **"What's next?"**
    Brand-side mode and an MCP server are already built: a brand gets the podcasts whose listeners love it, and any agent — a network's CRM assistant or a brand's media-buying agent — can call HostRead as a tool. Next is campaign memory to learn from outcomes, a network dashboard to find sponsors that fit several shows at once, and introducing a brand and a show when their two match lists point at each other.

---

## Sources for the numbers

- US podcast ad revenue 2025 ≈ $2.86B (+17.6% vs 2024): IAB/PwC Internet Advertising Revenue Report, full-year 2025 (published April 2026) — https://www.iab.com
- Host-read ≈ 46% of podcast ad spend in Q3 2025: Magellan AI quarterly benchmark (as reported secondhand; verify on magellan.ai before quoting)
- ~480k podcasts published an episode in the last 90 days: Podcast Index — https://podcastindex.org (check the live stats page)
