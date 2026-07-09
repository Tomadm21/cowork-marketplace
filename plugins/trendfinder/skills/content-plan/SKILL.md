---
name: content-plan
description: Propose a batch of concrete content ideas for a Trendfinder avatar — natively in Claude, from the avatar's DNA + current trends — and save the chosen ones as idea-pieces on the shared content board. Use when the user says "Content-Plan", "Ideen für <Avatar>", "was könnte <Avatar> posten", "Themenplan", "plan meinen content", "gib mir Post-Ideen", "content ideas", "Wochenplan". Proposes ideas as clickable options; saves selected ideas as content pieces (stage=idea). Never scrapes, never spends Apify or backend-LLM budget.
---

# Trendfinder — Content-Plan

Goal: turn an avatar's DNA + the niche's current trends into a short list of **concrete post ideas**, let the user pick which to keep with a select-block, and persist each kept idea as a `content_piece` (stage `idea`) on the shared board — the same rows the frontend and Cockpit show. All ideation is **native in Claude**; the backend only stores. Read `${CLAUDE_PLUGIN_ROOT}/reference/api-contract.md` (§ "Content pieces") first. All API calls go through `bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh`.

## Step 0 — Self-check (config required)

1. Check `{workspace}/.trendfinder/config.json` exists.
2. If it does, `bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh GET /health`.

If either fails → "Trendfinder ist noch nicht eingerichtet. Starte bitte zuerst das Onboarding." → route to `onboarding`. Else continue.

## Step 1 — Pick the avatar + load its DNA

```
bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh GET /api/brands
bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh GET /api/brands/<brand_id>/personas
```

Present avatars as a numbered list (Cowork renders it clickable):

```
Für welchen Avatar soll ich Ideen planen?

1) Lena   (Marke: Lena Beauty)
2) Mia    (Marke: Lena Beauty)
✏️  Anderer / neuen Avatar anlegen (→ onboarding)
```

If the tenant has **no** avatars → say so and route to `onboarding`. Then load full DNA:

```
bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh GET /api/personas/<persona_id>
```

Hold `content_pillars`, `interests`, `tone_of_voice`, `persona_profile`, `system_prompt`.

## Step 2 — Pull current trends (no persona_id)

Resolve the niche only from `GET /api/niches/config` (never a guessed slug). One niche → use it; several → ask which (numbered).

```
bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh GET /api/niches/config
bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh GET /api/trends/<niche_id>
```

- Trends present → continue to Step 3.
- Empty / 404 → no trends yet: say so honestly and offer `scrape-now`. You MAY still propose DNA-only ideas (no `trend_cluster_id`), but never invent trends.

Keep per cluster: `cluster_id`, `trend_label`, `hook_type`, `description`, `dominant_hashtags`, `lifecycle`.

## Step 3 — Propose ideas natively (from DNA × trends)

This is Claude's judgment — say so. Propose **5–7 concrete ideas**, each anchored in a real DNA field and (where possible) a real trend. For each idea decide: `title` (the post topic, ≤500 chars), `pillar` (an actual `content_pillars[].name`), `format` (e.g. `Reel`, `Story`, `Carousel`), `hook_type` (from the trend or DNA), and `trend_cluster_id` (the real `cluster_id` if the idea rests on a trend, else omit).

Show them as a numbered multi-select block with a one-line reason each, grounded in a named DNA field/trend:

```
Ideen für Lena (K-Beauty) — meine Einschätzung aus DNA + aktuellen Trends, kein Backend-Score. Wähle die, die ich als Ideen speichern soll (mehrere möglich):

1) „Abendroutine mit 3 Produkten" — Pillar „K-Beauty Abendroutine", Trend Evening Routines (steigt), Hook How-To
2) „Inhaltsstoff-Mythos: Niacinamid" — Pillar „Inhaltsstoffe erklärt", Trend Ingredient Deep-Dives, Hook Mythos-Bust
3) „Glow-up in 7 Tagen" — Pillar „Glow-up", Trend Before-After (Peak), Hook Transformation
...
✏️  Eigene Idee ergänzen
```

Ground every reason in an actual DNA field or trend — never fabricate a pillar to justify an idea; "kein starkes DNA-Signal" is a valid reason to drop one.

## Step 4 — Persist the chosen ideas as content pieces

For EACH selected idea, POST it (write the body to a temp file to avoid quoting issues):

```
IDEA_BODY=$(mktemp)   # real temp dir, NOT the synced workspace
echo '{"title":"<title>","pillar":"<pillar>","format":"<format>","hook_type":"<hook_type>","trend_cluster_id":<id or omit>,"stage":"idea"}' > "$IDEA_BODY"
bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh POST /api/personas/<persona_id>/content-pieces @"$IDEA_BODY"; rm -f "$IDEA_BODY" 2>/dev/null || : > "$IDEA_BODY"
```

Interpret: **201** created (keep the returned `id`) · **404** persona not this tenant's (re-resolve the avatar) · **422** bad field (fix `title`/`stage`). Omit `trend_cluster_id` entirely for DNA-only ideas — do not send `null` guesses of other fields.

**Read-back (honesty rule):** after saving, `GET /api/personas/<persona_id>/content-pieces?stage=idea` and confirm the new titles are there. Report exactly how many ideas were saved — never claim more than the API confirmed.

## Step 5 — Deliver + hand off

Summarise: which avatar, how many ideas saved (real count), which niche/trends they rest on. Offer to write a script for one now (→ `script-studio`).

## Honesty & safety rules

- Ideas are **Claude's native judgment from DNA + real trends** — say so; never present them as a backend plan. The ops route `content-pieces/generate` is NOT used (native only).
- Never invent trends; empty trends → route to `scrape-now`. Only real `cluster_id` values go into `trend_cluster_id`.
- Never claim an idea was saved unless the POST returned 201 and the read-back shows it.
- Use `tf.sh`; never print the API key; clean up `mktemp` files.

## Done means

- Config present, `/health` 200.
- Avatar chosen, full DNA loaded; niche resolved from `GET /api/niches/config`.
- Trends fetched (no `persona_id`); empty → honest cold-start + scrape-now offer.
- 5–7 ideas proposed natively with DNA/trend-grounded reasons, shown as a multi-select block.
- Selected ideas persisted as `stage:"idea"` pieces; read-back confirms them; real count reported.
- No `content-pieces/generate` call, no Apify call, no key printed.

## Abschluss (PFLICHT) — Next-Steps-Auswahlblock

Beende deine Antwort IMMER mit dem interaktiven **Auswahlblock** aus `${CLAUDE_PLUGIN_ROOT}/reference/next-steps.md`. Nach dem Speichern von Ideen ist die ⭐-Empfehlung in der Regel „✍️ Skript schreiben" (→ script-studio) für eine der neuen Ideen.
