---
name: scrape-now
description: On-demand Trendfinder scrape for one niche + platform. Use when the user says "jetzt scrapen", "scrape now", "run a scrape", "hol neue Trends", "manuelle Scrape", or similar. Requires config present (routes to onboarding if not). Spends real Apify credits — NEVER runs without explicit user confirmation after cost disclosure.
---

# Trendfinder — Scrape Now

Goal: run one on-demand Apify scrape for a tenant-owned niche and platform, then hand the finished run's **dataset id** to the backend (`POST /api/ingest/from-apify`). The backend fetches and normalises the items server-side with the tenant's deposited Apify token — **raw dataset items never travel through the model context or a subagent** (400 raw items once blew a whole session limit; the item count must never affect session cost).

All Trendfinder-API calls use the **`tf_request` tool** of the plugin's `trendfinder` MCP server (returns `{ok, status, body}` for every HTTP status — 4xx/5xx are data to branch on). Never call the API via curl/bash or with an inline key. Read `${CLAUDE_PLUGIN_ROOT}/reference/api-contract.md` before starting — it is the single source of truth.

---

## Step 0 — Self-check (config required)

Before doing anything else, call `tf_health {}` (no arguments).

If the result is not `ok: true` with `status: 200` (config error or unreachable backend) → do NOT proceed. Tell the user:

> "Trendfinder ist noch nicht eingerichtet. Starte bitte zuerst das Onboarding."

Then route to the `onboarding` skill.

If it passes → continue to Step 1.

---

## Step 1 — Confirm target + COST HARD GATE

Fetch the tenant's niche list:

```
tf_request { "method": "GET", "endpoint": "/api/niches/config" }
```

Present the niches as an interactive select-block (AskUserQuestion tool — Mechanik: `${CLAUDE_PLUGIN_ROOT}/reference/next-steps.md` § Auswahl-Mechanik). Option content:

```
Für welche Niche soll der Scrape laufen?

1) acme Beauty     (niche_id: acme-beauty)
2) acme Fashion    (niche_id: acme-fashion)
✏️  Andere niche_id eingeben
```

**Always use the `niche_id` values returned by the API — never accept a free-text slug without resolving it against this list first.**

Then ask for the platform:

```
Welche Plattform?

1) TikTok
2) Instagram
```

Then ask for the results limit (interactive select-block, same Mechanik). **The limit applies PER HASHTAG, not in total** — both actors (`resultsPerPage` for TikTok, `resultsLimit` for Instagram) fetch up to the limit for EACH hashtag in the niche config. Resolve the hashtag count `H` for the chosen platform from the Step-1 niche config response (`tiktok_hashtags` / `instagram_hashtags`) and show the real total:

```
Wie viele Ergebnisse pro Hashtag? (deine Niche hat {H} {Platform}-Hashtags)

1) 25    — ≈ {25×H} Videos gesamt
2) 50    — ≈ {50×H} Videos gesamt
3) 100   — ≈ {100×H} Videos gesamt
✏️  Eigene Zahl
```

**Before proceeding, state the cost honestly — based on the TOTAL (limit × H), never on the per-hashtag limit alone.** (A "50er"-Scrape über 8 Hashtags sind ~400 Items — der frühere Fehler, nur das Limit zu bepreisen, hat die Kosten um Faktor 8 untertrieben.)

For **TikTok** (`clockworks/tiktok-scraper`):
> "TikTok-Scrape: {limit} pro Hashtag × {H} Hashtags ≈ **{limit×H} Videos**, kostet ca. **${limit×H×0.0017:.2f}** auf deinem Apify-Account (≈ $1.70 pro 1.000 Posts)."

For **Instagram** (`apify/instagram-hashtag-scraper`):
> "Instagram-Scrape: {limit} pro Hashtag × {H} Hashtags ≈ **{limit×H} Items**, kostet ca. **${limit×H×0.0004:.2f}** auf deinem Apify-Account (≈ $0.0004 pro Item)."

Then ask for **explicit confirmation** — this is a HARD GATE and may NOT be bypassed:

```
Möchtest du diesen Scrape starten?

1) Ja, jetzt starten (kostet Apify-Credits)
2) Nein, abbrechen
```

**If the user does not choose option 1 explicitly → abort. Do NOT call any Apify actor.**

### Preflight — backend ingest MUST be ready BEFORE the paid scrape

A scrape costs real Apify credits. Ingestion now runs server-side: the backend fetches the dataset with the **tenant's deposited Apify token** (`POST /api/tenant/settings` — the same token gate as the scheduler skill). If the route is missing or no token is deposited, the scraped data could not be saved. So AFTER the user confirms but BEFORE calling the actor, probe with a deliberately-invalid dataset id (costs nothing — no credits are consumed by a failed dataset lookup):

```
tf_request { "method": "POST", "endpoint": "/api/ingest/from-apify",
             "body": { "niche_id": "<confirmed niche_id>", "platform": "<tiktok|instagram>", "dataset_id": "preflight-probe" } }
```

Interpret `result.status` — this one probe checks route, niche, and token at once:
- **502** (`{"error":"apify dataset fetch failed ..."}`) → EXPECTED and good: route is deployed, the niche is owned, the token is deposited (the backend got far enough to attempt the fetch) → proceed to Step 2.
- **409** (`{"error":"no Apify token deposited ..."}`) → route is deployed but the tenant has no backend Apify token. Run the token gate exactly like the scheduler skill (Step 2a there): explain, ask the user for their Apify token („apify.com → Settings → API & Integrations → Personal API token"), deposit via `tf_request POST /api/tenant/settings {"apify_api_key": "<token>"}`, on success add `"backend_apify_token_deposited": true` to `{workspace}/.trendfinder/config.json`, then re-run this probe. Do NOT scrape before the probe returns 502.
- **404 with body `{"error":"niche not found for this tenant"}`** → route IS deployed but the niche is wrong → go back and re-resolve the niche from `/api/niches/config`; do NOT scrape.
- **404 "Not Found" (no `"niche not found"` error key)** → the backend does not have `/api/ingest/from-apify` yet (pre-v0.12.1 deployment). STOP. Tell the user the backend needs an update and do NOT call the Apify actor.
- **Any other 5xx / transport error** → backend not reachable right now. STOP, show the error verbatim, do NOT call the Apify actor. Offer to retry in a few minutes.

---

## Step 2 — Run via the Cowork Apify MCP connector

Once the user has confirmed, run the actor via the **Cowork Apify MCP connector** (not `tf_request` — the connector holds the Apify credential; no backend Apify token is used here).

**Empty-hashtag guard:** if the resolved hashtag list for the chosen platform is empty, STOP before any actor call — the run would only burn credits and return nothing. Tell the user the niche has no hashtags for this platform and offer to add some (`PUT /api/niches/config/{niche_id}`).

**Off-topic-hashtag guard (BEFORE the cost gate):** scan the niche's resolved hashtags. If they are dominated by **generic English mega-tags** (`mindset`, `motivation`, `transformation`, `success`, `highperformer`, `viral`, `fyp`, `foryou`) — especially for a DACH/German niche — warn the user *before* spending credits: „Diese Hashtags sind sehr breit/englisch und ziehen erfahrungsgemäß themenfremden Content (Tech, Gaming, Hustle). Der Scrape kostet trotzdem. Willst du die Hashtags erst verfeinern (empfohlen) oder trotzdem scrapen?" Offer to refine them (`PUT /api/niches/config/{niche_id}`) with 5–8 specific, native-language tags. See `${CLAUDE_PLUGIN_ROOT}/reference/niche-hashtags.md`. Only proceed to the paid scrape if the user chooses to.

### TikTok

Resolve the hashtags for the confirmed niche from the API response in Step 1 (`tiktok_hashtags` field, bare tags without `#`). Then call:

```
Apify MCP tool: call-actor
  actor: "clockworks/tiktok-scraper"
  input:
    hashtags: [<bare tags from niche config, no # prefix>]
    resultsPerPage: <confirmed limit>
    shouldDownloadVideos: false
```

### Instagram

Resolve the hashtags for the confirmed niche from the API response in Step 1 (`instagram_hashtags` field, bare tags without `#`). Then call:

```
Apify MCP tool: call-actor
  actor: "apify/instagram-hashtag-scraper"
  input:
    hashtags: [<bare tags from niche config, no # prefix>]
    resultsLimit: <confirmed limit>
```

### Wait for the run, then take ONLY the dataset id

`call-actor` waits a bounded time (~45s) and may return while the run is still in progress. If the returned run status is not terminal (`SUCCEEDED`), poll with `get-actor-run` (the run id from the call-actor result) every ~20–30s until it is — a multi-hundred-item scrape typically needs a few polls. Exact parameter names can vary with connector versions — read the tool's own schema and prefer it over this sketch.

From the terminal run result, extract the **`defaultDatasetId`** (NOT the run id). That single string is ALL you carry forward.

**Do NOT fetch the dataset items** (no `get-dataset-items`, no subagent, no temp file). The backend fetches them itself in Step 3 — pulling hundreds of raw items into the model context is exactly the failure this design removes.

If the actor run fails → report the failure honestly, do NOT attempt ingest, and stop. (Zero items in a SUCCEEDED run is fine to ingest — the backend simply reports `inserted: 0`.)

---

## Step 3 — Persist via /api/ingest/from-apify

POST only the identifiers — the backend fetches the dataset server-side with the tenant's deposited Apify token and normalises the raw items itself (cap: 5000 items):

```
tf_request { "method": "POST", "endpoint": "/api/ingest/from-apify",
             "body": { "niche_id": "<confirmed niche_id from API>", "platform": "<tiktok|instagram>",
                       "dataset_id": "<defaultDatasetId from the run result>" } }
```

The backend returns `status: 201` with `{"inserted": N, "updated": N, "rejected": N, "errors": [...]}`.

**Interpret the response honestly:**

- `inserted` > 0 → new trends have been added.
- `updated` > 0 → existing records were refreshed.
- `rejected` > 0 → items fell below the backend's virality threshold. This is **normal filtering**, not an error. Do NOT alarm the user about rejections.
- `status: 400` `{"error": "tenant key required"}` → the API key in config is invalid; route to onboarding.
- `status: 404` `{"error": "niche not found for this tenant"}` → the `niche_id` does not belong to this tenant; re-confirm from `GET /api/niches/config` and do NOT retry with a guessed slug.
- `status: 409` (no Apify token deposited) → should not happen after the preflight, but if it does: run the token gate (see Preflight), then **retry this same POST with the same `dataset_id`** — the scraped data is safe in the Apify dataset, nothing needs re-scraping.
- `status: 502` (apify dataset fetch failed) → show verbatim. The dataset id may be wrong or Apify was briefly unreachable. Retry ONCE after ~20s with the same `dataset_id`; if it fails again, stop and tell the user the run's data is still stored on Apify (datasets are retained for days) — the ingest can be retried later without paying for a new scrape.
- Other 5xx or transport error in the result → report verbatim; do NOT retry automatically.

Report the result to the user:

> "Scrape abgeschlossen:
> - Neu hinzugefügt: {inserted}
> - Aktualisiert: {updated}
> - Gefiltert (unter Virality-Schwelle, normal): {rejected}"

On ingest failure, show the returned `status` + `body` verbatim so the cause is debuggable (the request carries only identifiers — there is nothing else to inspect client-side).

---

## Step 4 — Wait for auto-clustering, then regenerate the artifact

Ingested videos do NOT appear as trends instantly. The backend automatically embeds the new videos and clusters the niche on its background loop (≈ every 10s) — **no extra API call is needed to trigger it.** But the Cockpit/Briefing artifact is a regenerated snapshot, so after clustering completes you must regenerate it for the user to see the new trends.

After a successful ingest (`inserted` or `updated` > 0), tell the user:

> "Die Videos sind drin. Das Backend embedded + clustert die Nische jetzt automatisch — das dauert meist 10–30 Sekunden. Ich warte kurz und aktualisiere dann das Cockpit."

Then **poll** until trends appear, bounded:

```
tf_request { "method": "GET", "endpoint": "/api/trends/<niche_id>" }
```

- Poll up to **6 times with ~10s between tries** (≈60s total). Between tries, wait before re-polling.
- **As soon as the response is a non-empty cluster list** → stop polling and regenerate the artifact: follow the `cockpit` skill's snapshot procedure (fetch via `tf_request`, write the snapshot JSON, run `cockpit.ts --data <snapshot.json> <workspace_root>`).
  Present the regenerated Cockpit as the Live Artifact (canonical procedure incl. chat fallback: `${CLAUDE_PLUGIN_ROOT}/reference/artifact-presentation.md`) and name the top 1–2 trends from the data the generator actually wrote.
  - **Relevance check:** look at the new clusters' `dominant_hashtags`. If the top clusters are clearly off-topic vs. the niche (e.g. `techtok`/`gaming`/`setup` for a personal-development niche — none of the niche's own tags appear) → say so honestly instead of celebrating: „Die gefundenen Trends passen nicht zu deiner Nische — die Hashtags waren vermutlich zu breit/englisch. Empfehlung: verfeinern und neu scrapen." Then propose better tags. See `${CLAUDE_PLUGIN_ROOT}/reference/niche-hashtags.md`.
- **If still empty after all 6 tries** → do NOT claim trends exist. Say honestly:
  > "Nach dem Scrape sind noch keine Trends entstanden. Das kann zwei Gründe haben: (1) zu wenige Videos über der Virality-Schwelle, um Cluster zu bilden, oder (2) das Clustering läuft noch. Probier in ein paar Minuten erneut ‚zeig mir die Trends', oder scrape mit höherem Limit für mehr Datenpunkte."

Never fabricate trends to fill the wait. `inserted > 0` means data landed; only a non-empty `/api/trends/{niche_id}` means trends formed.

---

## Honesty rules

- Never claim trends have appeared until `GET /api/trends/{niche_id}` returns a non-empty cluster list. `inserted > 0` only means raw videos landed — embedding + clustering happen automatically afterwards on the backend loop (~10–30s), and a niche can have ingested videos but zero trends (too few above the virality threshold to cluster).
- `rejected` items are normal virality filtering by the backend — they are not scrape failures or bad data.
- Never run an actor on a global/Tom operator token. The Cowork Apify MCP connector (actor run) and the backend-deposited token (dataset fetch) are both the tenant's OWN credentials — the backend hard-refuses without a deposited token (409), there is no operator fallback.
- Tenant isolation is mandatory: only pass `niche_id` values previously obtained from `GET /api/niches/config` in this tenant context. Never accept a free-text niche slug from the user without API resolution first.
- Never fetch brands or personas — avatars are out of scope for scraping. This skill does not touch `/api/brands` or `/api/personas`.
- **Never move raw dataset items through the model context** — no `get-dataset-items`, no subagent fetch-and-ingest, no `items[]` bodies. Only the `dataset_id` travels; the backend caps its server-side fetch at 5000 items.
- Cost disclosure is always based on limit × hashtag count — the per-hashtag limit alone understates the real cost by the number of hashtags.

---

## Done means

- `tf_health` returns 200.
- User confirmed niche_id (from API), platform, per-hashtag limit, and the TOTAL cost (limit × hashtag count) — explicitly, via option 1.
- Preflight probe returned 502 (route deployed, niche owned, backend token deposited) before any actor call.
- Actor ran via Cowork Apify MCP connector with the correct actor ID and input shape.
- Only the `defaultDatasetId` was carried forward — no raw items entered the model context.
- `/api/ingest/from-apify` returned 201; result reported honestly including rejected count context.
- After a successful ingest: polled `GET /api/trends/{niche_id}` (bounded) for backend auto-clustering; on non-empty trends, regenerated the Cockpit artifact; on still-empty, gave the honest cold-start message — never fabricated trends.
- On ingest failure the returned `status` + `body` were shown verbatim (no temp files anymore — the payload goes directly into `tf_request`).
- No key and no `.trendfinder/` files ever committed or printed to the user.

---

## Abschluss (PFLICHT) — Next-Steps-Auswahlblock

Beende deine Antwort IMMER mit dem interaktiven **Auswahlblock** (die selektierbaren Options-UI-Blöcke, die Cowork rendert) — Spezifikation: `${CLAUDE_PLUGIN_ROOT}/reference/next-steps.md`. Zeige alle im aktuellen Zustand sinnvollen Optionen und markiere **genau eine** als ⭐ Empfehlung, passend zu dem, was du gerade getan hast. Nutze die ⭐-Kontext-Tabelle und die Zustands-Regeln aus dieser Datei.
