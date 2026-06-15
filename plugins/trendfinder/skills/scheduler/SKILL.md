---
name: scheduler
description: Manage Trendfinder scrape schedules — create, view, pause, resume, change frequency, or delete. Use when the user says "schedule einrichten", "wie oft läuft der scraper", "schedule ändern", "schedule pausieren", "schedule löschen", "automatisch scrapen", "scrape-zeitplan", "interval ändern", or any phrase about recurring/automatic scraping frequency. Requires config present (routes to onboarding if not).
---

# Trendfinder — Scheduler

Goal: let the tenant view and manage their per-niche scrape schedules (create, update frequency, pause/resume, delete) over the backend's tenant-scoped schedule CRUD. All actions use `bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh ...`. Never call the API with raw curl or an inline key. Read `${CLAUDE_PLUGIN_ROOT}/reference/api-contract.md` before starting — it is the single source of truth for all endpoints.

---

## Honesty note — scheduled vs. on-demand scrapes

Scheduled scrapes (managed here) run on the **backend server scheduler** (60-second tick). They use the **Apify API key deposited on the backend via onboarding Step 2** — the backend's own credential, not the Cowork Apify MCP connector. This means schedules continue running 24/7 even when no Cowork session is open.

On-demand scrapes (`scrape-now` skill) are different: they use the **Cowork Apify MCP connector** and run only while a Cowork session is active.

If the Apify key has never been deposited via onboarding, the backend falls back to the operator's shared key — explain this honestly if the user has not completed onboarding Step 2.

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

## Step 1 — Detect-first: show current schedules

Fetch the current schedules and the tenant's niches in parallel:

```
bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh GET /api/schedules
bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh GET /api/niches/config
```

Use the niche list to resolve `niche_id` → `display_name` for display. Never show raw slugs alone.

### If schedules exist — present them plainly

For each schedule:

```
Niche:      {display_name} ({niche_id})
Frequenz:   {interval_in_words}
Status:     {Aktiv | Pausiert}
Letzter Run: {last_run_at formatted as "DD.MM.YYYY HH:MM Uhr" | "noch nie"}
```

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

### Resolve target niche

Fetch the niche list (if not already fetched):

```
bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh GET /api/niches/config
```

If the user has already named a niche, resolve it against this list. If the named niche does NOT appear in the returned list, stop and show the real list:

> "Die Niche „{user_input}" ist nicht auf deinem Account. Deine verfügbaren Niches:"

Present the tenant's niches as a numbered list and ask:

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
bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh POST /api/schedules '{"type":"scrape","niche_id":"<resolved niche_id>","interval_hours":<N>,"enabled":true}'
```

Expect HTTP 201. On 404 `{"error": "niche not found for this tenant"}`: the niche_id does not match this tenant — do NOT retry with a guessed slug; re-confirm the niche_id from `GET /api/niches/config` and resubmit.

Then go to Step 3 (read-back confirmation).

---

## Step 2b — Change frequency

Show existing schedules if more than one; ask which to update (numbered list). Then ask for the new interval using the same phrase table as Step 2a.

Patch:

```
bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh PATCH /api/schedules/{id} '{"interval_hours":<N>}'
```

On 404: the schedule no longer exists; refresh the list and inform the user.

Then go to Step 3 (read-back confirmation).

---

## Step 2c — Pause or resume

Show existing schedules (with enabled status). Ask which to toggle.

- To **pause** (enabled → false): `PATCH /api/schedules/{id}` with `{"enabled":false}`
- To **resume** (false → enabled): `PATCH /api/schedules/{id}` with `{"enabled":true}`

```
bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh PATCH /api/schedules/{id} '{"enabled":<true|false>}'
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
bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh DELETE /api/schedules/{id}
```

Expect 204 (no body). On 404: already gone — inform the user and refresh the list.

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

Note honestly (create only):

> "`last_run_at` ist noch leer — das füllt sich nach dem ersten Backend-Tick (~60 Sekunden)."

---

## Tenant isolation and honesty rules

- **Only ever use `niche_id` values previously obtained from `GET /api/niches/config` in this tenant context.** Never accept a free-text niche slug from the user without resolving it against the API list first.
- **Never create an enabled schedule before the Apify token is confirmed.** If you have reason to believe the token has not been deposited (onboarding incomplete), warn the user before creating.
- **On any 404 for a schedule id:** do not retry with guessed ids; refresh `GET /api/schedules` and re-ask.
- **Never invent schedule ids or niche slugs.** All values must come from the API.
- **No brands or personas.** This skill does not touch `/api/brands` or `/api/personas`.
- **No scrapes triggered here.** This skill manages schedule metadata only. No Apify actor is called.

---

## Done means

- Config present and `/health` returns 200.
- Current schedules fetched and shown in plain German (niche name, frequency in words, status, last run).
- Any create/patch derives `niche_id` from `GET /api/niches/config` for this tenant — never guessed.
- `interval_hours` is within 1–168 and matches the user's intent after natural-language mapping.
- Every mutation confirmed back to the user in plain words.
- No key, no slug guessing, no brands/personas, no actor calls.
