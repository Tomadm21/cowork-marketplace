---
name: onboarding
description: First-time Trendfinder setup. Use when the user says "richte Trendfinder ein", "set up trendfinder", "trendfinder setup", "verbinde mein trendfinder" — or whenever any Trendfinder skill is invoked and `{workspace}/.trendfinder/config.json` is missing. Walks the user through API key connection, Apify token deposit, niche configuration, and first schedule creation, then hands off to the Cockpit.
---

# Trendfinder Onboarding

Goal: connect this workspace to the customer's Trendfinder tenant exactly once, deposit the Apify token (mandatory before any schedule), configure at least one niche, create the first scrape schedule, and end on the Cockpit artifact. Read `${CLAUDE_PLUGIN_ROOT}/reference/api-contract.md` before starting — it is the single source of truth for all endpoints and platform limits.

All API calls use `bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh ...`. Never call the API with raw curl or an inline key.

---

## Step 0 — Self-check (never re-run a completed setup)

Before doing anything else:

1. Check whether `{workspace}/.trendfinder/config.json` exists.
2. If it exists, call `bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh GET /health`.

If **both** pass → setup is already complete. Tell the user:

> "Trendfinder ist bereits eingerichtet und verbunden. Möchtest du direkt zum Cockpit?"

Then offer:
```
1) Ja, Cockpit öffnen
2) Trotzdem neu einrichten (überschreibt die bestehende Konfiguration)
✏️  Etwas anderes
```

Only continue with setup if the user explicitly chooses option 2 or types a matching intent. Default path → route to the `cockpit` skill.

---

## Step 1 — API key + connection proof

Tell the user (German, one sentence):

> "Gib deinen Trendfinder API-Key ein — du hast ihn von Tom erhalten, als dein Tenant angelegt wurde."

Capture the key via ✏️ free-text input (it is inherently an open value). Do NOT echo it back in full; confirm receipt by showing the last 4 characters only: `"Key empfangen — endet auf …XXXX"`.

Write the config file:

```json
{ "base_url": "https://api-production-78bb.up.railway.app", "api_key": "<key>" }
```

to `{workspace}/.trendfinder/config.json`.

Then immediately prove the connection — run both checks:

```
bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh GET /health
bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh GET /api/niches/config
```

**On 401 from either call:** tell the user the key is incorrect, delete the config file so it does not persist an invalid state, re-ask for the key, and do NOT proceed. Repeat until connection succeeds or the user aborts.

**On any non-2xx response that is NOT a 401 (5xx, timeout/network error):** report the error verbatim, leave the config file in place, and ask the user whether to retry or abort — do NOT proceed to Step 2.

**On success:** `/api/niches/config` returns the tenant's existing niches. Present them as detected state — for example:

> "Verbindung erfolgreich. Ich sehe bereits folgende Niches auf deinem Account:"
>
> ```
> 1) acme Beauty  (niche_id: acme-beauty)
> 2) acme Fashion (niche_id: acme-fashion)
> ```

Carry these `niche_id` values forward to Step 3.

---

## Step 2 — Apify token (HARD GATE)

Explain honestly in one sentence:

> "Die Scrapes laufen 24/7 auf deinem eigenen Apify-Account — der Token wird einmalig hinterlegt, damit das Backend deine Quota verwendet, nicht die des Operators."

Capture the Apify token via ✏️ free-text input (open value by nature). Confirm receipt with last 4 characters only.

Deposit via:

```
bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh POST /api/tenant/settings '{"apify_api_key":"<token>"}'
```

Expect `{"ok": true, ...}`. On any non-ok response, report the error and re-ask.

**Gate sentence — must not be bypassed under any circumstance:**
> No schedule is ever created before this step succeeds — if the user wants to skip the Apify token, onboarding stops here and Step 4 is not executed.

If the user explicitly says they want to skip or do this later: acknowledge, summarise what is already saved (API key + config file), and end onboarding. Do NOT create any schedule.

---

## Step 3 — Niches (detect-first)

Present the niches already returned in Step 1 as a confirm-by-exception list. Label each as a detected guess, not confirmed fact:

```
Ich vermute, diese Niches gehören zu dir (aus deinem Account):

1) acme Beauty    (niche_id: acme-beauty)     ✓ behalten
2) acme Fashion   (niche_id: acme-fashion)    ✓ behalten
✏️  Niche umbenennen / löschen / neue hinzufügen
```

If the user confirms (replies with the number or "alles ok"), proceed with the existing list.

**Adding a new niche:**

Ask for:
- Display name (`✏️` free-text)
- Hashtags to track (`✏️` free-text, comma-separated, optional — can be added later)

Platform limit (api-contract §2): niche slugs are globally unique across all tenants. Prefix the display name with the tenant id to avoid collisions — for example, if the tenant is `acme`, suggest `"acme <Name>"`. Remind the user of this with one sentence.

Ask which platforms the niche should track (numbered: 1: TikTok, 2: Instagram, 3: YouTube Shorts — multiple allowed) and the hashtags/queries per platform (✏️ free-text). **There is NO generic `hashtags` field — the API silently ignores unknown fields.** Use the per-platform fields and disable unused platforms:

```
bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh POST /api/niches/config '{"display_name":"<prefixed name>","tiktok_hashtags":["..."],"instagram_hashtags":["..."],"youtube_search_queries":["..."],"instagram_enabled":false,"youtube_enabled":false}'
```

After creating, read the response back and confirm the hashtags actually landed in the per-platform fields — empty hashtag lists mean every scrape will find nothing.

**Always continue with the `niche_id` the API returned in the response — never use a locally guessed slug.**

Repeat until the user is satisfied with their niche list.

**Renaming or deleting a niche (✏️ path):**

- **Rename** — change only the display name; the slug (`niche_id`) is immutable:
  ```
  bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh PUT /api/niches/config/<niche_id> '{"display_name":"<neuer Name>"}'
  ```
  The `niche_id` slug stays the same after a rename; only the display name changes.

- **Delete** — always confirm with the user before executing:
  ```
  1) Ja, Niche löschen
  2) Abbrechen
  ```
  Warn the user that any schedules pointing at this niche will stop making sense and should also be deleted (`bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh DELETE /api/schedules/<id>` for each schedule whose `niche_id` matches). On confirmation:
  ```
  bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh DELETE /api/niches/config/<niche_id>
  ```

---

## Step 4 — First schedule (cost honesty)

Ask which scrape interval the customer wants:

```
Wie oft soll der Scraper laufen?

1) Alle 6 Stunden   — empfohlen (4×/Tag)
2) Alle 12 Stunden  — moderat   (2×/Tag)
3) Täglich          — minimal   (1×/Tag)
✏️  Eigener Wert: Zahl zwischen 1 und 168 (Stunden)
```

**Before creating the schedule, state clearly:**

> "Die Scrape-Kosten entstehen auf deinem Apify-Account — ungefähr proportional zu Anzahl Runs pro Tag × Anzahl Hashtags. Das ist eine Schätzung; genaue Beträge findest du in deinem Apify-Dashboard."

Then ask which niche this schedule is for (numbered list of the confirmed niche_ids from Step 3).

Create via:

```
bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh POST /api/schedules '{"type":"scrape","niche_id":"<returned niche_id>","interval_hours":<N>,"enabled":true}'
```

Expect HTTP 201. On 404 `{"error": "niche not found for this tenant"}`: the niche_id does not match — do not retry with a guessed slug; re-confirm the niche_id from `GET /api/niches/config` and resubmit.

---

## Step 5 — Proof + Cockpit hand-off

Run:

```
bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh GET /api/schedules
```

For each `niche_id` from the confirmed niche list (Step 3), fetch trends individually:

```
bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh GET /api/trends/<niche_id>
```

Show the schedule entry to the user. `last_run_at` will be `null` until the backend's 60-second scheduler tick fires — say so honestly:

> "Der Zeitplan wurde angelegt. `last_run_at` ist noch leer — das füllt sich nach dem ersten Backend-Tick (~60 Sekunden)."

For trends: a fresh niche returns an empty list or 404 — both mean no data yet. Say:

> "Noch keine Trends vorhanden — die erscheinen nach dem ersten abgeschlossenen Scrape."

Finish by generating the Cockpit so the user ends on the artifact even in cold-start state:

```
bun ${CLAUDE_PLUGIN_ROOT}/skills/cockpit/scripts/cockpit.ts <workspace_root>
```

---

## Done means

- `{workspace}/.trendfinder/config.json` exists, `GET /health` returns 200.
- Apify token deposited and `POST /api/tenant/settings` returned `{"ok": true, ...}`.
- At least one niche confirmed or created; all `niche_id` values came from the API, never guessed locally.
- At least one schedule created (HTTP 201) with interval chosen by the user after cost disclosure.
- `GET /api/schedules` shows the schedule entry; user informed about first-run latency.
- Cockpit artifact generated.
- No firm data written inside the plugin directory; all state lives in `{workspace}/.trendfinder/`.

Never invent niche slugs or schedule ids. Never create a schedule before the Apify token is confirmed. If uncertain about any value, re-query the API rather than guessing.
