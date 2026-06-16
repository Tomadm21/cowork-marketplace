---
name: script-studio
description: Generate hooks + short-video scripts in a Trendfinder avatar's voice, matched to current trends. Use when the user says "schreib mir Skripte", "Skript für Lena/Mia", "Hooks für meinen Avatar", "Content für <Avatar>", "was soll <Avatar> posten", "mach mir ein Skript zum Trend". Matches trends to the avatar's DNA NATIVELY in Claude and writes in the avatar's voice. Never scrapes, never spends Apify credits.
---

# Trendfinder — Script Studio

Goal: turn a current trend + an avatar's DNA into ready-to-shoot **hooks and a short-video script in that avatar's voice**. This is the payoff of the avatars: two different avatars produce two different scripts from the same trend.

All matching and writing happens **natively in Claude** (the plugin axiom: the backend only stores + scrapes). Read `${CLAUDE_PLUGIN_ROOT}/reference/api-contract.md` first. All API calls go through `bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh ...` — never inline-key curl.

**Important — do NOT use the backend `?persona_id=` param.** It currently returns **0 clusters** (the backend has no persona-scoped clustering pipeline yet, and `persona_fit_score` is always null). Trend↔avatar matching is done here, in Claude, from the avatar's DNA — not by the backend. This skill costs nothing: it never calls an Apify actor.

---

## Step 0 — Self-check (config required)

1. Check `{workspace}/.trendfinder/config.json` exists.
2. If it does, call `bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh GET /health`.

If either fails → tell the user "Trendfinder ist noch nicht eingerichtet. Starte bitte zuerst das Onboarding." and route to `onboarding`. Else continue.

---

## Step 1 — Pick the avatar + load its DNA

Fetch the tenant's brands and their personas (tenant-scoped):

```
bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh GET /api/brands
bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh GET /api/brands/<brand_id>/personas
```

Present the avatars as a numbered list and let the user choose (Cowork has no buttons):

```
Für welchen Avatar soll ich Content schreiben?

1) Lena   (Marke: Lena Beauty)
2) Mia    (Marke: Lena Beauty)
✏️  Anderer / neuen Avatar anlegen (→ avatar-studio)
```

If the tenant has **no** avatars → say so and route to `avatar-studio` to create one first.

Then load the chosen avatar's **full DNA** (the list endpoint only carries name — the DNA is on the detail route):

```
bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh GET /api/personas/<persona_id>
```

Hold onto `persona_profile`, `tone_of_voice`, `content_pillars`, `interests`, `origin_story`, and especially `system_prompt` — these define the voice you will write in.

---

## Step 2 — Pull the current trends (no persona_id)

Resolve the niche(s) and fetch trends. **Do not pass `persona_id`** (it returns empty):

```
bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh GET /api/niches/config
bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh GET /api/trends/<niche_id>
```

- If the niche has trends → continue to Step 3.
- If the response is empty / 404 → no trends yet. Say so honestly and offer to run `scrape-now` first. Do NOT invent trends.

For each cluster keep: `trend_label`, `description`, `hook_type`, `hook_examples`, `visual_style`, `dominant_hashtags`, `dominant_audio_type`, `lifecycle`, `avg_engagement_rate`.

---

## Step 3 — Match trends to the avatar's DNA (native, with reasons)

This is Claude's judgment, not a backend score — **state that to the user.** Rank the niche's trends by how well each fits THIS avatar, using the DNA you loaded:

- Does the trend's topic overlap the avatar's `content_pillars` / `interests`?
- Does the `hook_type` / `visual_style` suit the avatar's `tone_of_voice` and `persona_profile`?
- Would this avatar plausibly post this?

Present the top 3–4 matches with a one-line reason each:

```
Für Lena (K-Beauty, locker-expertenhaft) passen aktuell am besten — meine Einschätzung aus ihrer DNA, kein Backend-Score:

1) Korean Beauty Evening Skincare Routines — trifft Lenas Pillar „K-Beauty Abendroutine" direkt, Hook-Typ How-To passt zu ihrem Experten-Ton
2) Dramatic Before-After Transformations — passt zu „Glow-up", aber visuell reißerischer als Lenas Stil
3) Ingredient Deep-Dives — deckt „Inhaltsstoffe erklärt", ruhiger Ton

Welchen Trend soll ich verskripten? (Nummer, oder ✏️ eigener Fokus)
```

Be honest when a trend fits poorly ("passt nur mittel, weil …") — don't force-fit all of them.

---

## Step 4 — Write hooks + script in the avatar's voice

For the chosen trend, write **natively in the avatar's voice** (drive the voice from `system_prompt` + `tone_of_voice` — match `tone`, `energy`, `language`, respect `avoid_words`, echo `example_openers` style):

1. **3–5 hooks** (first 1–2 seconds) — anchored on the trend's `hook_type` and `hook_examples`, but rewritten in the avatar's words.
2. **One full short-video script** — structured: Hook → 2–4 Beats (the value/story) → CTA. Reference the trend's `visual_style` and `dominant_audio_type` as shooting notes. Keep it to a realistic 20–45s.
3. **Caption + hashtags** — a caption in the avatar's voice + a tight hashtag set drawn from the trend's `dominant_hashtags` and the avatar's pillars.

Two different avatars MUST yield visibly different hooks/scripts for the same trend — that is the whole point. If the chosen avatar's DNA is thin (few pillars, no system_prompt), say so and write from what's there, suggesting the user enrich the avatar in `avatar-studio`.

---

## Step 5 — Deliver

Output the hooks + script + caption as clean, copyable **markdown directly in the chat** (no generator needed — this is native text). Lead with which avatar + which trend it's for.

Optionally, if the user wants to keep it, offer to save it to `{workspace}/.trendfinder/scripts/<persona_id>-<trend-slug>.md`.

---

## Honesty & safety rules

- The trend↔avatar match is **Claude's native judgment from the DNA** — say so. Never present it as a backend `persona_fit_score` (that field is null; the backend has no persona-scoped matching yet).
- Never pass `?persona_id=` to `/api/trends` — it returns 0 clusters and would make it look like there are no trends.
- Never fabricate performance numbers ("dieser Hook macht 100k Views"). You can cite the trend's real `avg_engagement_rate` if present, labelled as the trend's data, not a prediction for this script.
- Never claim trends exist if `/api/trends/{niche}` was empty — route to `scrape-now` instead.
- Never call an Apify actor / never spend credits. For new trend data, route to `scrape-now`.
- Use `tf.sh`; never print or commit the API key. If you save a script file, it goes under `{workspace}/.trendfinder/` (gitignored).

---

## Done means

- Config present, `/health` 200.
- An avatar chosen and its full DNA loaded via `GET /api/personas/{id}`.
- Niche trends fetched (without persona_id); empty → honest cold-start + route to scrape-now.
- Trends ranked against the avatar's DNA with per-trend reasons, labelled as native judgment.
- Hooks + a full short-video script + caption written in the avatar's voice for the chosen trend.
- Delivered as copyable markdown; optionally saved under `.trendfinder/`.
- No `?persona_id=` sent, no Apify call, no key printed.
