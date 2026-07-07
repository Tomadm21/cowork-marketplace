---
name: trend-radar
description: Read and synthesise current trend data for a tenant-owned niche. Use when the user says "zeig mir Trends", "show trends", "was läuft gerade", "trend radar", "trend analyse", "what's trending", "current trends", "velocity", or any phrase implying reading existing trend data. Answers in chat — for the persistent HTML briefing artifact use trend-briefing, for the all-niches dashboard use cockpit. Requires config present (routes to onboarding if not). Does NOT trigger scrapes — for that, route to scrape-now.
---

# Trendfinder — Trend Radar

Goal: fetch the tenant's current trend clusters and velocity data for one niche, then synthesise the results natively — ranking rising patterns, naming hooks and accelerating signals, and giving the user an honest read of what the data actually says. The synthesis is pure Claude intelligence applied to the returned data — no additional server calls are made during synthesis.

**Avatar-personalised?** Trend-radar is niche-wide by design and does NOT pass `persona_id`. When the user wants trends matched to a specific avatar, or finished scripts in that avatar's voice, route to the `script-studio` skill — it matches trends to the avatar's DNA natively and writes hooks/scripts.

All API calls use `bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh ...`. Never call tf.sh or curl with an inline key. Read `${CLAUDE_PLUGIN_ROOT}/reference/api-contract.md` before starting — it is the single source of truth for all endpoints and platform limits.

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

## Step 1 — Resolve scope and fetch

### 1a — Resolve tenant-owned niches

Fetch the niche list:

```
bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh GET /api/niches/config
```

This is the **only authoritative source of niche slugs for this tenant.** The `/api/trends/*` routes are tenant-scoped server-side since 2026-06-16 (foreign slugs 404) — still, only query slugs that appear in this response (defense-in-depth + better error messages).

**If the user has already named a niche:** resolve it against this list. If the named niche does NOT appear in the returned list, stop and show the user the real list — never proceed with an unresolved slug:

> "Die Niche „{user_input}" ist nicht auf deinem Account. Deine verfügbaren Niches:"
>
> ```
> 1) acme Beauty     (niche_id: acme-beauty)
> 2) acme Fashion    (niche_id: acme-fashion)
> ```

**If no niche was named and the tenant has exactly one niche:** use it directly without asking.

**If no niche was named and the tenant has more than one niche:** present the list and ask:

```
Für welche Niche soll der Trend-Radar laufen?

1) acme Beauty     (niche_id: acme-beauty)
2) acme Fashion    (niche_id: acme-fashion)
✏️  Andere Niche aus der Liste oben
```

**Always continue with the `niche_id` value from the API response — never a locally guessed slug.**

### 1b — Fetch trend data

Once the target `niche_id` is confirmed, fetch both endpoints in sequence:

```
bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh GET /api/trends/{niche_id}
bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh GET /api/trends/{niche_id}/velocity
```

**Do not pass the `persona_id` query param here** — the radar reads niche-level data by design; avatar-personalised ranking lives in `script-studio` (native DNA matching). (The backend's `persona_id` fit-scoring is live since 2026-06-16, but this skill stays niche-level.)

**Empty or 404 on both responses** → both mean no data exists for this niche yet. Go directly to Step 3 (cold-start). Do not proceed to Step 2.

**Empty or 404 on the velocity endpoint only** → proceed to Step 2 with trend clusters only; note that velocity data is unavailable.

**Non-2xx and non-404 on either call** → report the error verbatim and stop. Do not attempt synthesis on partial data.

---

## Step 2 — Native synthesis (Claude intelligence, not a server call)

**This step happens entirely in Claude. No additional API calls are made.**

The backend returns raw scored clusters. Claude's job is to interpret them — ranking patterns, naming the signal, and surfacing what the user should actually care about.

### What the data contains

Each trend cluster from `/api/trends/{niche}` has:

| Field | What it means |
|---|---|
| `trend_score` | Backend score (0–1) for virality; use as primary rank signal |
| `trend_label` | Human-readable cluster name |
| `description` | What this cluster represents |
| `hook_type` | The content hook category |
| `hook_examples` | Concrete example hooks to use |
| `visual_style` | Dominant visual format |
| `avg_engagement_rate` | Engagement per view ratio |
| `video_count` | Total videos in cluster |
| `velocity` | Rate of growth (positive = accelerating, negative = declining) |
| `video_count_delta` | Absolute change in video count over observed trajectory |
| `lifecycle` | object `{stage, age_days, days_since_peak}` — stage: `emerging` / `rising` / `peak` / `declining` / `unknown` |
| `trajectory_counts` | Sparkline of daily video counts (up to 30 points) |
| `dominant_hashtags` | Top hashtags in the cluster |
| `dominant_audio_type` | Audio pattern |
| `top_sounds` | Specific sounds trending in the cluster |
| `scripted_count` | Number of scripts already created for this trend |
| `dismissed` | Whether the user previously dismissed this cluster |

Each velocity entry from `/api/trends/{niche}/velocity` has:

| Field | What it means |
|---|---|
| `cluster_id` | Join key to match trend clusters |
| `velocity` | Latest computed velocity |
| `trajectory` | Full trajectory data points |

### How to synthesise

Work through the following steps natively:

0. **Relevanz-Gate zuerst (vor allem Ranking).** Vergleiche die `dominant_hashtags` der Top-Cluster mit den Nischen-Hashtags aus Schritt 1a (`tiktok_hashtags`/`instagram_hashtags`) und dem Nischen-Thema. Trägt **keiner** der Top-3-Cluster in seinen `dominant_hashtags` einen Nischen-Tag oder ein klar themenverwandtes Wort — z. B. Cluster voller `techtok`/`gaming`/`setup`, aber die Nische ist „Persönlichkeitsentwicklung" — dann ist der Scrape themenfremd. **Leite die Antwort mit einer ehrlichen Warnung ein**, statt die Fremd-Trends als „deine Trends" zu ranken:
   > „⚠️ Die aktuell gespeicherten Trends passen nicht zu deiner Nische — die dominanten Hashtags (`techtok`, `gaming`, …) kommen aus einer fremden Ecke. Ursache ist fast immer: die Nischen-Hashtags sind zu breit oder englisch und haben globalen Fremd-Content gezogen."
   Dann 5–8 bessere, spezifische (bei DACH: deutsche) Hashtags vorschlagen — aus Nischen-Name/Avatar-DNA abgeleitet — und anbieten, sie zu setzen (`PUT /api/niches/config/{niche_id}`) und neu zu scrapen (`scrape-now`). Siehe `${CLAUDE_PLUGIN_ROOT}/reference/niche-hashtags.md`. Zeig die Fremd-Cluster höchstens als „das wurde fälschlich gefunden"-Beleg, nie als Empfehlung.

1. **Rank by signal strength:** Sort clusters by `trend_score` descending, then break ties by `velocity` descending. Skip any cluster where `dismissed == true` unless the user explicitly asked to see everything.

2. **Identify rising patterns:** From the sorted list, extract the top 3–5 by trend score. For each:
   - Name the pattern using `trend_label` and `description`
   - Classify its trajectory: use the `lifecycle.stage` field (`emerging`, `rising`, `peak`, `declining`; `unknown` = not enough data yet)
   - Note velocity direction: positive `velocity` + `rising`/`emerging` stage = actively accelerating; negative + `declining` = winding down

3. **Cross-reference velocity:** Join the velocity data by `cluster_id`. Any cluster with a high `trend_score` but negative `velocity` is a peak-or-declining trend — say so plainly. Clusters with moderate `trend_score` but strongly positive `velocity` are rising sleepers worth calling out.

4. **Surface hooks and formats:** For the top 2–3 clusters, name the `hook_type`, quote one `hook_example`, and describe the `visual_style` and `dominant_audio_type`. These are actionable for content creation.

5. **Flag acceleration signals:** Look across all clusters for patterns where `video_count_delta` is high relative to `video_count` (rapid recent growth) combined with positive `velocity`. Name these explicitly — they represent the fastest-moving opportunities.

6. **Note scripted trends:** If any top-ranked cluster has `scripted_count > 0`, mention it so the user knows they have already captured it. Do not recommend re-scripting unless the trend is still growing.

### Output format

Present the synthesis in three sections — no padding, no filler sentences:

**Aktuelle Top-Trends — {niche display_name}**

For each top cluster (3–5):
```
#{rank} {trend_label}  [{lifecycle.stage}]
Score: {trend_score}  |  Velocity: {velocity:+.2f}  |  Videos: {video_count} (+{video_count_delta})
{description}
Hook: {hook_type} — "{hook_example}"
Format: {visual_style} · Audio: {dominant_audio_type}
Hashtags: {top 3 from dominant_hashtags}
```

**Schnellste Aufsteiger** (velocity leaders not already in the top list):
Brief list of 1–3 clusters with the highest positive velocity.

**Auslaufende Trends** (any top-10-by-score cluster with `lifecycle.stage == "declining"` and negative velocity):
Brief list. Do not feature these as opportunities — they are at the end of their curve.

Conclude with a one-sentence synthesis summary (what is the dominant direction of this niche right now).

---

## Step 3 — Honest cold-start

If `/api/trends/{niche_id}` returns an empty list or 404, say so plainly:

> "Noch keine Trend-Daten für „{niche display_name}". Die Analyse ist erst möglich, nachdem ein Scrape gelaufen ist und der Backend-Clusterer die Daten verarbeitet hat."

Then offer:

```
1) Jetzt einen Scrape starten (scrape-now skill)
2) Fertig
```

Do NOT render placeholder analysis, example trends, or fabricated cluster data. If there is no data, there is no analysis — say so and route to scrape-now.

---

## Honesty and tenant isolation rules

- **Only ever query tenant-owned niche slugs.** Resolve the slug list from `GET /api/niches/config` at the start of every invocation. Never accept a free-text niche slug from the user without resolving it against this API response first.
- **Never fetch or display brands or personas.** Avatars are out of scope for the radar — avatar context lives in `script-studio`, `avatar-studio` and the Cockpit. This skill does not call `/api/brands` or `/api/personas`.
- **Empty data = no analysis.** If the trend or velocity response is empty or 404, route to scrape-now. Never fabricate, estimate, or placeholder-fill an analysis when no clusters exist.
- **Synthesis is native, not a server feature.** The ranking, pattern naming, and hook interpretation happen in Claude using the returned data. Make this clear if the user asks — the backend does not generate the synthesis text.
- **Dismissed clusters are excluded by default.** If a cluster has `dismissed == true`, skip it unless the user explicitly asks to see all clusters.
- **No data ever written to disk.** Trend data is ephemeral (response-only). Nothing is written to `{workspace}/.trendfinder/` or anywhere else during a read.
- **Score is relative, not absolute.** `trend_score` and `velocity` reflect the clusters observed in this tenant's scraped data set. They are relative signals within the niche, not absolute truth claims about what is trending globally. Say "im Datensatz" not "im Internet" when referencing scores.
- **Themen-Bruch offen ansagen (Relevanz-Gate, siehe Step 2.0).** Wenn die Top-Cluster themenfremd sind (Hashtags aus einer anderen Domäne als die Nische), niemals so tun, als wären das die Trends des Nutzers — Ursache benennen (zu breite/englische Hashtags), bessere Tags vorschlagen, zu `scrape-now` mit verfeinerten Hashtags leiten. `${CLAUDE_PLUGIN_ROOT}/reference/niche-hashtags.md`.

---

## Done means

- Config present and `/health` returns 200.
- Tenant's niche list fetched from `GET /api/niches/config`; target niche confirmed from that list.
- Both `/api/trends/{niche_id}` and `/api/trends/{niche_id}/velocity` called; responses inspected.
- If data exists: native synthesis delivered with top patterns, velocity leaders, and declining trends called out honestly.
- If data is empty or 404: cold-start message delivered and user offered route to scrape-now.
- No brands or personas fetched. No data written to disk. No niche slug accepted without API resolution.

---

## Abschluss (PFLICHT) — Next-Steps-Auswahlblock

Beende deine Antwort IMMER mit dem interaktiven **Auswahlblock** (die selektierbaren Options-UI-Blöcke, die Cowork rendert) — Spezifikation: `${CLAUDE_PLUGIN_ROOT}/reference/next-steps.md`. Zeige alle im aktuellen Zustand sinnvollen Optionen und markiere **genau eine** als ⭐ Empfehlung, passend zu dem, was du gerade getan hast. Nutze die ⭐-Kontext-Tabelle und die Zustands-Regeln aus dieser Datei.
