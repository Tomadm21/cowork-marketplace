---
name: scrape-now
description: On-demand Trendfinder scrape for one niche + platform. Use when the user says "jetzt scrapen", "scrape now", "run a scrape", "hol neue Trends", "manuelle Scrape", or similar. Requires config present (routes to onboarding if not). Spends real Apify credits — NEVER runs without explicit user confirmation after cost disclosure.
---

# Trendfinder — Scrape Now

Goal: run one on-demand Apify scrape for a tenant-owned niche and platform, then persist the raw dataset items to the backend ingest endpoint. The backend normalises items; the skill passes them through UNCHANGED.

All API calls use `bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh ...`. Never call tf.sh or curl with an inline key. Read `${CLAUDE_PLUGIN_ROOT}/reference/api-contract.md` before starting — it is the single source of truth.

---

## Step 0 — Self-check (config required)

Before doing anything else:

1. Check whether `{workspace}/.trendfinder/config.json` exists.
2. If it exists, call `bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh GET /health`.

If **either** check fails → do NOT proceed. Tell the user:

> "Trendfinder ist noch nicht eingerichtet. Starte bitte zuerst das Onboarding."

Then route to the `onboarding` skill.

If both pass → continue to Step 1.

---

## Step 1 — Confirm target + COST HARD GATE

Fetch the tenant's niche list:

```
bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh GET /api/niches/config
```

Present the niches as a numbered list. Ask the user to choose:

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

Then ask for the results limit:

```
Wie viele Ergebnisse? (empfohlen: 50–200)

1) 50    — schnell, günstig
2) 100   — Standard
3) 200   — gründlich
✏️  Eigene Zahl (max 500 — API-Limit)
```

**Before proceeding, state the cost honestly.** Use the confirmed platform and limit:

For **TikTok** (`clockworks/tiktok-scraper`):
> "TikTok-Scrape mit ~{N} Ergebnissen kostet ca. **${:.4f}** auf deinem Apify-Account (≈ $1.70 pro 1.000 Posts)."

For **Instagram** (`apify/instagram-hashtag-scraper`):
> "Instagram-Scrape mit ~{N} Ergebnissen kostet ca. **${:.4f}** auf deinem Apify-Account (≈ $0.0004 pro Item)."

Then ask for **explicit confirmation** — this is a HARD GATE and may NOT be bypassed:

```
Möchtest du diesen Scrape starten?

1) Ja, jetzt starten (kostet Apify-Credits)
2) Nein, abbrechen
```

**If the user does not choose option 1 explicitly → abort. Do NOT call any Apify actor.**

### Preflight — backend ingest MUST be reachable BEFORE the paid scrape

A scrape costs real Apify credits. If `/api/ingest` is not deployed, the scraped data would be discarded (404) — money burned for nothing. So AFTER the user confirms but BEFORE calling the actor, probe ingest with a **zero-item** request (no cost):

```
echo '{"niche_id":"<confirmed niche_id>","platform":"<tiktok|instagram>","items":[]}' > {workspace}/.trendfinder/ingest-preflight.json
bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh POST /api/ingest @{workspace}/.trendfinder/ingest-preflight.json
```

Interpret the result:
- **HTTP 201** (`{"inserted":0,...}`) → ingest is deployed and the niche is owned → proceed to Step 2.
- **HTTP 404 with body `{"error":"niche not found for this tenant"}`** → route IS deployed but the niche is wrong → go back and re-resolve the niche from `/api/niches/config`; do NOT scrape.
- **HTTP 404 "Not Found" (no `"niche not found"` error key), or any 5xx / connection failure** → `/api/ingest` is **NOT deployed yet**. STOP. Tell the user the backend ingest endpoint isn't live yet, so a scrape would be wasted. Do NOT call the Apify actor. (This is expected until the Phase-3 backend deploy lands.)

Delete `ingest-preflight.json` after the probe.

---

## Step 2 — Run via the Cowork Apify MCP connector

Once the user has confirmed, run the actor via the **Cowork Apify MCP connector** (not tf.sh — the connector holds the Apify credential; no backend Apify token is used here).

### TikTok

Resolve the hashtags for the confirmed niche from the API response in Step 1 (`tiktok_hashtags` field, bare tags without `#`). Then call:

```
Apify MCP tool: call-actor
  actor_id: "clockworks/tiktok-scraper"
  input:
    hashtags: [<bare tags from niche config, no # prefix>]
    resultsPerPage: <confirmed limit>
    shouldDownloadVideos: false
```

### Instagram

Resolve the hashtags for the confirmed niche from the API response in Step 1 (`instagram_hashtags` field, bare tags without `#`). Then call:

```
Apify MCP tool: call-actor
  actor_id: "apify/instagram-hashtag-scraper"
  input:
    hashtags: [<bare tags from niche config, no # prefix>]
    resultsLimit: <confirmed limit>
```

### Fetch dataset items

After the actor run completes, fetch its dataset:

```
Apify MCP tool: get-dataset-items
  run_id: <run_id returned by call-actor>
```

**Critical: do NOT reshape or transform the items in any way.** The backend normaliser is hard-coded to the raw field names produced by these actors (e.g. `playCount`, `diggCount`, `videoPlayCount`, `likesCount` for TikTok; `likesCount`, `commentsCount`, `videoPlayCount` for Instagram). Any transformation will silently corrupt ingestion.

If the actor run fails or returns zero items → report the failure honestly, do NOT attempt ingest, and stop.

---

## Step 3 — Persist via /api/ingest

Assemble the ingest payload:

```json
{
  "niche_id": "<confirmed niche_id from API>",
  "platform": "<tiktok|instagram>",
  "items": [<raw dataset items — unchanged from actor output>]
}
```

Write this to a temp file under the workspace `.trendfinder/` directory (gitignored, never committed):

```
{workspace}/.trendfinder/ingest-<niche_id>-<platform>-<timestamp>.json
```

Then POST:

```
bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh POST /api/ingest @{workspace}/.trendfinder/ingest-<niche_id>-<platform>-<timestamp>.json
```

The backend returns `201 {"inserted": N, "updated": N, "rejected": N, "errors": [...]}`.

**Interpret the response honestly:**

- `inserted` > 0 → new trends have been added.
- `updated` > 0 → existing records were refreshed.
- `rejected` > 0 → items fell below the backend's virality threshold. This is **normal filtering**, not an error. Do NOT alarm the user about rejections.
- HTTP 400 `{"error": "tenant key required"}` → the API key in config is invalid; route to onboarding.
- HTTP 404 `{"error": "niche not found for this tenant"}` → the `niche_id` does not belong to this tenant; re-confirm from `GET /api/niches/config` and do NOT retry with a guessed slug.
- HTTP 5xx or network error → report verbatim; do NOT retry automatically.

Report the result to the user:

> "Scrape abgeschlossen:
> - Neu hinzugefügt: {inserted}
> - Aktualisiert: {updated}
> - Gefiltert (unter Virality-Schwelle, normal): {rejected}"

Clean up the temp ingest file after a successful ingest (regardless of rejected count). On ingest failure, leave the file for debugging and tell the user its path.

---

## Step 4 — Wait for auto-clustering, then regenerate the artifact

Ingested videos do NOT appear as trends instantly. The backend automatically embeds the new videos and clusters the niche on its background loop (≈ every 10s) — **no extra API call is needed to trigger it.** But the Cockpit/Briefing artifact is a regenerated snapshot, so after clustering completes you must regenerate it for the user to see the new trends.

After a successful ingest (`inserted` or `updated` > 0), tell the user:

> "Die Videos sind drin. Das Backend embedded + clustert die Nische jetzt automatisch — das dauert meist 10–30 Sekunden. Ich warte kurz und aktualisiere dann das Cockpit."

Then **poll** `GET /api/trends/{niche_id}` until trends appear, bounded:

```
bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh GET /api/trends/<niche_id>
```

- Poll up to **6 times with ~10s between tries** (≈60s total). Between tries, wait before re-polling.
- **As soon as the response is a non-empty cluster list** → stop polling and regenerate the artifact:
  ```
  bun ${CLAUDE_PLUGIN_ROOT}/skills/cockpit/scripts/cockpit.ts <workspace_root>
  ```
  Present the regenerated Cockpit as the Live Artifact and name the top 1–2 trends from the data the generator actually wrote.
- **If still empty after all 6 tries** → do NOT claim trends exist. Say honestly:
  > "Nach dem Scrape sind noch keine Trends entstanden. Das kann zwei Gründe haben: (1) zu wenige Videos über der Virality-Schwelle, um Cluster zu bilden, oder (2) das Clustering läuft noch. Probier in ein paar Minuten erneut ‚zeig mir die Trends', oder scrape mit höherem Limit für mehr Datenpunkte."

Never fabricate trends to fill the wait. `inserted > 0` means data landed; only a non-empty `/api/trends/{niche_id}` means trends formed.

---

## Honesty rules

- Never claim trends have appeared until `GET /api/trends/{niche_id}` returns a non-empty cluster list. `inserted > 0` only means raw videos landed — embedding + clustering happen automatically afterwards on the backend loop (~10–30s), and a niche can have ingested videos but zero trends (too few above the virality threshold to cluster).
- `rejected` items are normal virality filtering by the backend — they are not scrape failures or bad data.
- Never run an actor on a global/Tom operator token. The Cowork Apify MCP connector always uses the tenant's own Apify credentials.
- Tenant isolation is mandatory: only pass `niche_id` values previously obtained from `GET /api/niches/config` in this tenant context. Never accept a free-text niche slug from the user without API resolution first.
- Never fetch brands or personas (Phase-2 platform limit 6 in api-contract.md). This skill does not touch `/api/brands` or `/api/personas`.
- Max 500 items per ingest request (API limit). If the actor returns more than 500 items, truncate to the first 500 and warn the user.

---

## Done means

- Config present and `/health` returns 200.
- User confirmed niche_id (from API), platform, limit, and cost — explicitly, via option 1.
- Actor ran via Cowork Apify MCP connector with the correct actor ID and input shape.
- Dataset items fetched and passed through UNCHANGED to `/api/ingest`.
- `/api/ingest` returned 201; result reported honestly including rejected count context.
- After a successful ingest: polled `GET /api/trends/{niche_id}` (bounded) for backend auto-clustering; on non-empty trends, regenerated the Cockpit artifact; on still-empty, gave the honest cold-start message — never fabricated trends.
- Temp ingest file cleaned up on success, left in place on failure with path reported.
- No key, no item data, and no `.trendfinder/` files ever committed or printed to the user.
