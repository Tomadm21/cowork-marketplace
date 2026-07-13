---
name: scheduler
description: Manage Trendfinder scrape schedules — create, view, pause, resume, change frequency, or delete. Use when the user says "schedule einrichten", "wie oft läuft der scraper", "schedule ändern", "schedule pausieren", "schedule löschen", "automatisch scrapen", "scrape-zeitplan", "interval ändern", or any phrase about recurring/automatic scraping frequency. Requires config present (routes to onboarding if not).
---

# Trendfinder — Scheduler

Goal: let the tenant view and manage their per-niche scrape schedules (create, update frequency, pause/resume, delete) over the backend's tenant-scoped schedule CRUD. All actions use the **`tf_request` tool** of the plugin's `trendfinder` MCP server (returns `{ok, status, body}` for every HTTP status — 4xx/5xx are data to branch on). Never call the API via curl/bash or with an inline key. Read `${CLAUDE_PLUGIN_ROOT}/reference/api-contract.md` before starting — it is the single source of truth for all endpoints.

---

## Honesty note — scheduled vs. on-demand scrapes

Scheduled scrapes (managed here) run on the **backend server scheduler** (60-second tick). They use an **Apify token deposited on the backend** (`POST /api/tenant/settings` — see onboarding → „24/7-Automatik (optional)"), not the Cowork Apify MCP connector. This means schedules continue running 24/7 even when no Cowork session is open.

On-demand scrapes (`scrape-now` skill) are different: they use the **Cowork Apify MCP connector** and run only while a Cowork session is active.

**There is NO fallback to an operator key.** If no Apify token is deposited for this tenant, every scheduled run hard-fails on the server ("scraping refused") and no data ever arrives — while the schedule row still looks alive, because `last_run_at` is set when a run is *triggered*, not when it succeeds. A schedule without a deposited token is a silent failure. That is why Step 2a gates creation on the token.

---

## Step 0 — Self-check (config required)

Before doing anything else, call `tf_health {}` (no arguments).

If the result is not `ok: true` with `status: 200` (config error or unreachable backend) → do NOT proceed. Tell the user:

> "Trendfinder ist noch nicht eingerichtet. Starte bitte zuerst das Onboarding."

Then route to the `onboarding` skill.

If it passes → continue to Step 1.

---

## Step 1 — Detect-first: show current schedules

Fetch the current schedules and the tenant's niches in parallel:

```
tf_request { "method": "GET", "endpoint": "/api/schedules" }
tf_request { "method": "GET", "endpoint": "/api/niches/config" }
```

Use the niche list to resolve `niche_id` → `display_name` for display. Never show raw slugs alone.

### If schedules exist — present them plainly

For each schedule:

```
Niche:      {display_name} ({niche_id})
Frequenz:   {interval_in_words}
Status:     {Aktiv | Pausiert}
Zuletzt angestoßen: {last_run_at formatted as "DD.MM.YYYY HH:MM Uhr (UTC)" | "noch nie"}   ← the API returns UTC; label it as UTC, do not present it as local time
```

`last_run_at` means "last **triggered** by the scheduler" — it does NOT prove the scrape succeeded. If trends stay empty despite a fresh timestamp, the runs are failing server-side (most likely: no Apify token deposited — offer the token gate from Step 2a).

**interval_in_words mapping** (use the closest match; be precise for common values):

| interval_hours | Plain German |
|---|---|
| 1 | stündlich |
| 2 | alle 2 Stunden |
| 3 | alle 3 Stunden |
| 6 | alle 6 Stunden |
| 12 | alle 12 Stunden |
| 24 | täglich |
| 48 | alle 2 Tage |
| 72 | alle 3 Tage |
| 168 | wöchentlich |
| other N | alle N Stunden |

Then offer:

```
Was möchtest du tun?

1) Neuen Zeitplan erstellen
2) Frequenz ändern
3) Zeitplan pausieren / reaktivieren
4) Zeitplan löschen
✏️  Etwas anderes
```

### If no schedules exist — cold-start

Tell the user:

> "Du hast noch keine aktiven Scrape-Zeitpläne. Soll ich einen erstellen?"

```
1) Ja, Zeitplan erstellen
2) Nein, Abbrechen
```

If "Ja" → go to Step 2a (create).

---

## Step 2a — Create a schedule

### Backend-Apify-Token sicherstellen (Pflicht vor jedem Create)

Scheduled runs need an Apify token deposited on the backend (see Honesty note). The backend has no read endpoint for it, so track it locally:

1. Read `{workspace}/.trendfinder/config.json`. If it contains `"backend_apify_token_deposited": true` → token confirmed, continue to "Resolve target niche".
2. Otherwise ask:

```
Für automatische 24/7-Scrapes braucht der Server einmalig einen eigenen Apify-Token.
(Ohne ihn würde jeder geplante Lauf fehlschlagen — es kämen nie Daten an.)

1) Token jetzt hinterlegen — ich führe dich durch (empfohlen)
2) Ich habe schon einen Token hinterlegt
3) Später — Zeitplan erstmal pausiert anlegen
```

- **Option 1:** Tell the user where the token lives: „Auf apify.com anmelden → Settings → API & Integrations → Personal API token kopieren." Ask them to paste it here, then deposit it:

  ```
  tf_request { "method": "POST", "endpoint": "/api/tenant/settings", "body": { "apify_api_key": "<token>" } }
  ```

  Expect a 2xx `status` with body `{"ok": true, ...}`. On success: add `"backend_apify_token_deposited": true` to `{workspace}/.trendfinder/config.json` (keep all existing keys), confirm briefly, continue. On any error: show it verbatim and do NOT create an enabled schedule.
- **Option 2:** Accept it, write the marker into config.json, continue. (If in doubt, offer to deposit again — the POST simply overwrites, that is harmless.)
- **Option 3:** Continue with niche + interval, but create the schedule with `"enabled": false` and say: „Der Zeitplan ist angelegt, aber pausiert. Sag ‚Apify-Token hinterlegen', sobald du so weit bist — dann aktiviere ich ihn."

### Resolve target niche

Fetch the niche list (if not already fetched):

```
tf_request { "method": "GET", "endpoint": "/api/niches/config" }
```

If the user has already named a niche, resolve it against this list. If the named niche does NOT appear in the returned list, stop and show the real list:

> "Die Niche „{user_input}" ist nicht auf deinem Account. Deine verfügbaren Niches:"

Present the tenant's niches as an interactive select-block (AskUserQuestion tool — Mechanik: `${CLAUDE_PLUGIN_ROOT}/reference/next-steps.md` § Auswahl-Mechanik). Option content:

```
Für welche Niche soll der Zeitplan laufen?

1) {display_name}   (niche_id: {niche_id})
...
✏️  Andere Niche aus der Liste oben
```

**Always continue with the `niche_id` value returned by the API — never accept a free-text slug without resolving it first.**

If the tenant has no niches: route to `onboarding` to create one first.

### Choose interval

Ask:

```
Wie oft soll der Scraper laufen?

1) Alle 6 Stunden    — empfohlen (4×/Tag)
2) Alle 12 Stunden   — moderat   (2×/Tag)
3) Täglich           — minimal   (1×/Tag)
✏️  Eigener Wert: Phrase oder Zahl zwischen 1 und 168 Stunden
```

Map the user's answer to `interval_hours` using the natural-language table:

| User phrase | interval_hours |
|---|---|
| "stündlich" / "jede Stunde" | 1 |
| "alle N Stunden" (e.g. "alle 3 Stunden") | N (1 ≤ N ≤ 168) |
| "täglich" / "jeden Tag" / "einmal täglich" | 24 |
| "alle 2 Tage" | 48 |
| "alle 3 Tage" | 72 |
| "wöchentlich" / "einmal pro Woche" / "jede Woche" | 168 |
| bare integer N | N (clamped to 1–168) |

**Clamp to 1–168.** If the user enters a value below 1, use 1 and say so. If above 168, use 168 and say so. If the user names an interval in **minutes** (e.g. "alle 30 Minuten"), explain that the minimum granularity is 1 hour and re-ask — never silently round to a fractional or zero hour.

### Create

```
tf_request { "method": "POST", "endpoint": "/api/schedules",
             "body": { "type": "scrape", "niche_id": "<resolved niche_id>", "interval_hours": <N>, "enabled": true } }
```

If the token gate ended with Option 3 (no token yet), send `"enabled": false` instead of `true`.

Expect `status: 201`. On 404 `{"error": "niche not found for this tenant"}`: the niche_id does not match this tenant — do NOT retry with a guessed slug; re-confirm the niche_id from `GET /api/niches/config` and resubmit.

Then go to Step 3 (read-back confirmation).

---

## Step 2b — Change frequency

Show existing schedules if more than one; ask which to update (interactive select-block). Then ask for the new interval using the same phrase table as Step 2a.

Patch:

```
tf_request { "method": "PATCH", "endpoint": "/api/schedules/{id}", "body": { "interval_hours": <N> } }
```

On 404: the schedule no longer exists; refresh the list and inform the user.

Then go to Step 3 (read-back confirmation).

---

## Step 2c — Pause or resume

Show existing schedules (with enabled status). Ask which to toggle.

- To **pause** (enabled → false): `PATCH /api/schedules/{id}` with `{"enabled":false}`
- To **resume** (false → enabled): `PATCH /api/schedules/{id}` with `{"enabled":true}`

```
tf_request { "method": "PATCH", "endpoint": "/api/schedules/{id}", "body": { "enabled": <true|false> } }
```

On 404: schedule no longer exists; refresh list.

Then go to Step 3 (read-back confirmation).

---

## Step 2d — Delete a schedule

Show existing schedules. Ask which to delete with explicit confirmation:

```
Zeitplan für „{display_name}" löschen?

1) Ja, löschen
2) Abbrechen
```

On confirmation:

```
tf_request { "method": "DELETE", "endpoint": "/api/schedules/{id}" }
```

Expect `status: 204` (no body). On 404: already gone — inform the user and refresh the list.

After deletion, tell the user plainly:
> "Zeitplan gelöscht. Neue automatische Scrapes werden nicht mehr für diese Niche geplant."

Do NOT route to Step 3 (there is nothing to read back after deletion).

---

## Step 3 — Read-back confirmation

After every create or PATCH, confirm the resulting state in plain words:

- After create: `"Erstellt — läuft jetzt {interval_in_words}."`
- After frequency change: `"Geändert — läuft jetzt {interval_in_words}."`
- After pause: `"Pausiert. Der Scraper läuft nicht mehr automatisch für diese Niche."`
- After resume: `"Reaktiviert — läuft jetzt wieder {interval_in_words}."`

Use the same interval_in_words mapping from Step 1. Do NOT invent the frequency — derive it from the API response field `interval_hours`.

Note honestly (create only, if enabled):

> "Der Zeitplan feuert ab jetzt automatisch. Ob ein Lauf wirklich Daten geliefert hat, siehst du an neuen Trends — sag einfach „zeig mir die Trends". (`last_run_at` zeigt nur, dass ein Lauf angestoßen wurde, nicht dass er erfolgreich war.)"

For a schedule created paused (token gate Option 3): confirm it is paused and repeat what activates it (deposit token → resume).

---

## Tenant isolation and honesty rules

- **Only ever use `niche_id` values previously obtained from `GET /api/niches/config` in this tenant context.** Never accept a free-text niche slug from the user without resolving it against the API list first.
- **Never create an enabled schedule before the backend Apify token is confirmed** (config marker or explicit user confirmation via Step 2a's gate). Without the token every scheduled run hard-fails server-side — the operator's key is never used as a fallback.
- **On any 404 for a schedule id:** do not retry with guessed ids; refresh `GET /api/schedules` and re-ask.
- **Never invent schedule ids or niche slugs.** All values must come from the API.
- **No brands or personas.** This skill does not touch `/api/brands` or `/api/personas`.
- **No scrapes triggered here.** This skill manages schedule metadata only. No Apify actor is called.

---

## Done means

- `tf_health` returns 200.
- Current schedules fetched and shown in plain German (niche name, frequency in words, status, last run).
- Any create/patch derives `niche_id` from `GET /api/niches/config` for this tenant — never guessed.
- `interval_hours` is within 1–168 and matches the user's intent after natural-language mapping.
- Every mutation confirmed back to the user in plain words.
- No key, no slug guessing, no brands/personas, no actor calls.

---

## Abschluss (PFLICHT) — Next-Steps-Auswahlblock

Beende deine Antwort IMMER mit dem interaktiven **Auswahlblock** (die selektierbaren Options-UI-Blöcke, die Cowork rendert) — Spezifikation: `${CLAUDE_PLUGIN_ROOT}/reference/next-steps.md`. Zeige alle im aktuellen Zustand sinnvollen Optionen und markiere **genau eine** als ⭐ Empfehlung, passend zu dem, was du gerade getan hast. Nutze die ⭐-Kontext-Tabelle und die Zustands-Regeln aus dieser Datei.
