---
name: script-studio
description: Generate hooks + short-video scripts in a Trendfinder avatar's voice, matched to current trends and steered by a chosen Ziel (Verkauf, Reichweite/viral, Engagement, Follower, Vertrauen). Use when the user says "schreib mir Skripte", "Skript für Lena/Mia", "Hooks für meinen Avatar", "Content für <Avatar>", "was soll <Avatar> posten", "mach mir ein Skript zum Trend", "Verkaufsskript", "Skript das viral gehen soll", "Skript für mehr Engagement/Follower". Matches trends to the avatar's DNA NATIVELY in Claude and writes in the avatar's voice. Never scrapes, never spends Apify credits. Saves the finished script to the shared content board (content piece, stage=script) so it appears in the Cockpit and Review.
---

# Trendfinder — Script Studio

Goal: turn a current trend + an avatar's DNA into ready-to-shoot **hooks and a short-video script in that avatar's voice**. This is the payoff of the avatars: two different avatars produce two different scripts from the same trend. Every script is additionally steered by a **Ziel** (🚀 Reichweite · 💬 Engagement · 🛒 Verkauf · ➕ Follower · 🤝 Vertrauen): the avatar owns the voice, the Ziel owns structure + CTA.

All matching and writing happens **natively in Claude** (the plugin axiom: the backend only stores + scrapes). Read `${CLAUDE_PLUGIN_ROOT}/reference/api-contract.md` first. All API calls go through `bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh ...` — never inline-key curl.

**Important — this skill does the matching itself, not the backend.** Trend↔avatar matching happens here, in Claude, from the avatar's full DNA — fetch trends WITHOUT `?persona_id=`. (The backend's `?persona_id=` fit-scoring exists since 2026-06-16 and returns cosine-based `persona_fit_score` values, but they are vector heuristics — the native DNA matching in this skill is the product's deliberate, richer path. Do not mix the two: fit reasons must come from real DNA fields, not from a backend score.) This skill costs nothing: it never calls an Apify actor.

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

Resolve the niche from the tenant's niche list — **only ever use a `niche_id` returned by `GET /api/niches/config`, never a guessed or assumed slug** (a wrong slug returns 0 trends — the exact failure we are avoiding; the brand name is NOT automatically a niche_id). If the tenant has more than one niche, ask which one (numbered list); if exactly one, use it. Then fetch trends — **do not pass `persona_id`** (the backend's cosine ranking works, but this skill's fit reasons must come from the native DNA matching in Step 3, not a backend score):

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

Welchen Trend soll ich verskripten? (Nummer, oder ✏️ eigenes Thema)

Und was ist das Ziel des Skripts?

1) 🚀 Reichweite — viral gehen, neue Leute erreichen  ⭐ (Trend steigt gerade — guter Reichweiten-Moment)
2) 💬 Engagement — Kommentare & Diskussion auslösen
3) 🛒 Verkauf — auf ein Produkt / Angebot hinführen
4) ➕ Follower — Leute zum Dranbleiben & Folgen bringen
5) 🤝 Vertrauen — Expertise zeigen, Autorität aufbauen
```

**Ground every fit reason in an actual DNA field you loaded** — name/quote the specific `content_pillar`, `interest`, `tone_of_voice`, or `persona_profile` trait it rests on. If a trend maps to nothing in the avatar's DNA, say "kein starkes DNA-Signal" and rank it low — **never invent a pillar/interest/trait to justify a fit.** Be honest when a trend fits only weakly; don't force-fit all of them.

**Ziel-Regeln:**

- Nennt die Anfrage das Ziel schon („Verkaufsskript", „soll viral gehen", „will mehr Kommentare") → Frage überspringen, Ziel übernehmen und im Output benennen.
- Sonst die Ziel-Frage mit stellen (wie oben, im selben Block wie die Trend-Wahl — kein extra Hin und Her) und genau **eine** ⭐-Empfehlung markieren, in einer Zeile begründet aus echten Daten: Avatar-DNA (produktnahe Pillars → 🛒 Verkauf) oder Trend-`lifecycle` (emerging/rising → 🚀 Reichweite; peak/declining eher 💬/🤝). Antwortet der Nutzer „egal" → ⭐-Empfehlung nehmen und das sagen.
- Mischwünsche sind ok („Verkauf, aber unterhaltsam") — es gibt trotzdem genau **ein Primärziel**, und das bestimmt den CTA.

---

## Step 4 — Write hooks + script: avatar voice × Ziel

For the chosen trend, write **natively in the avatar's voice** (drive the voice from `system_prompt` + `tone_of_voice` — match `tone`, `energy`, `language`, respect `avoid_words`, echo `example_openers` style):

1. **3–5 hooks** (first 1–2 seconds) — anchored on the trend's `hook_type` and `hook_examples`, but rewritten in the avatar's words and biased toward the Ziel (see table).
2. **One full short-video script** — structured: Hook → 2–4 Beats (the value/story) → CTA, shaped by the Ziel table below. Reference the trend's `visual_style` and `dominant_audio_type` as shooting notes. Keep it to a realistic 20–45s.
3. **Caption + hashtags** — a caption in the avatar's voice + a tight hashtag set drawn from the trend's `dominant_hashtags` and the avatar's pillars (🛒 Verkauf: wenige, spezifische Tags + Angebot in der Caption; 🚀 Reichweite: breitere Trend-Tags).

**Das Ziel steuert Struktur + CTA — die Stimme kommt immer vom Avatar** (das Ziel ändert nie `tone_of_voice` oder `avoid_words`; genau EIN CTA pro Skript, vom Primärziel bestimmt):

| Ziel | Hook-Bias | Beats | CTA |
|---|---|---|---|
| 🚀 Reichweite | Pattern-Interrupt, breit relatable | Open Loop, Payoff erst am Ende | „Speichern/Teilen" — **kein** Produkt-Pitch |
| 💬 Engagement | Meinung/Frage, leicht polarisierend (safe) | These → Gegenseite → offene Frage | Kommentar-Frage („Team A oder B?"), in der Caption wiederholt |
| 🛒 Verkauf | Schmerzpunkt/Wunsch der Zielgruppe | Problem → Zuspitzung → Lösung = Angebot, 1 konkreter Beweis | klare Handlung: Link in Bio / DM / Shop |
| ➕ Follower | Serien-/Identitäts-Hook („Teil 1", „für alle, die…") | Mehrwert + Versprechen auf mehr | „Folg mir für Teil 2 / mehr X" |
| 🤝 Vertrauen | Insider-Wissen, Expertise zeigen | ruhige Erklärung mit echtem Detail, ggf. Story/Beweis | weich („mehr dazu im Profil") |

**🛒 Verkauf braucht ein echtes Angebot:** das beworbene Produkt/Angebot muss aus der Brand-/Avatar-DNA kommen oder vom Nutzer genannt sein. Taucht nirgends ein Produkt auf → frag „Was genau soll das Skript verkaufen?" — **niemals ein Produkt erfinden.**

Two different avatars MUST yield visibly different hooks/scripts for the same trend — that is the whole point. If the chosen avatar's DNA is thin (few pillars, no system_prompt), say so and write from what's there, suggesting the user enrich the avatar in `avatar-studio`.

---

## Step 4.5 — Persist the script on the content board

The script you just wrote is native text — now store it as a `content_piece` so it shows on the shared board (frontend + Cockpit). **This is a PATCH of `script_data` + a stage bump — never the backend `generate-script` route.**

First, is there already an `idea` piece for this? Look:

```
bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh GET "/api/personas/<persona_id>/content-pieces?stage=idea"
```

- **A matching idea exists** (same trend/topic — match on `title` or `trend_cluster_id`) → use its `id`.
- **No matching idea** (ad-hoc script) → create one first:
  ```
  IDEA_BODY=$(mktemp)
  echo '{"title":"<trend/topic title>","pillar":"<pillar>","format":"<format>","hook_type":"<hook_type>","trend_cluster_id":<id or omit>,"stage":"idea"}' > "$IDEA_BODY"
  bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh POST /api/personas/<persona_id>/content-pieces @"$IDEA_BODY"; rm -f "$IDEA_BODY" 2>/dev/null || : > "$IDEA_BODY"
  ```
  Keep the returned `id`.

Then persist the script and advance the stage (write the body to a temp file — it contains the full script JSON):

```
SCRIPT_BODY=$(mktemp)
# script_data shape (plugin-owned, see api-contract § Content pieces):
echo '{"script_data":{"hook":"<chosen hook>","hooks":["..."],"body":"<beats>","cta":"<cta>","caption":"<caption>","hashtags":["..."],"ziel":"<reichweite|engagement|verkauf|follower|vertrauen>","visual_notes":"<shooting notes>","audio":"<audio type>"},"stage":"script"}' > "$SCRIPT_BODY"
bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh PATCH /api/content-pieces/<piece_id> @"$SCRIPT_BODY"; rm -f "$SCRIPT_BODY" 2>/dev/null || : > "$SCRIPT_BODY"
```

Interpret: **200** saved · **404** foreign/unknown piece (re-resolve) · **422** invalid stage.

**Read-back (honesty rule):** the PATCH returns the updated piece — confirm `stage == "script"` and `script_data.hook` is present before telling the user it's saved. If the save failed, deliver the script in chat anyway and say persistence didn't succeed — never claim it's on the board if the API didn't confirm.

---

## Step 5 — Deliver

Output the hooks + script + caption as clean, copyable **markdown directly in the chat** (no generator needed — this is native text). Lead with which avatar + which trend + which Ziel it's for (z. B. „Skript für Lena · Trend: Evening Routines · Ziel: 🛒 Verkauf").

Optionally, if the user wants to keep it, offer to save it to `{workspace}/.trendfinder/scripts/<persona_id>-<trend-slug>.md`.

---

## Honesty & safety rules

- The trend↔avatar match is **Claude's native judgment from the DNA** — say so. Never present it as a backend score. Ground each fit reason in a real DNA field (quote the pillar/interest/trait); never fabricate a DNA value to justify a match — "kein starkes DNA-Signal" is a valid, honest verdict.
- Never pass `?persona_id=` to `/api/trends` in this skill — the native DNA matching here is the deliberate path, and mixing a backend cosine score into the fit reasons would blur what the reasons are grounded in.
- Never fabricate performance numbers ("dieser Hook macht 100k Views"). You can cite the trend's real `avg_engagement_rate` if present, labelled as the trend's data, not a prediction for this script.
- Das Ziel steuert Aufbau und CTA — es ist **kein Erfolgsversprechen**. Nie „damit gehst du viral" / „das verkauft garantiert" behaupten.
- 🛒 Verkauf: nur ein real existierendes Angebot bewerben (aus Brand-/Avatar-DNA oder vom Nutzer genannt) — nie eins erfinden.
- Never claim trends exist if `/api/trends/{niche}` was empty — route to `scrape-now` instead.
- Never call an Apify actor / never spend credits. For new trend data, route to `scrape-now`.
- Use `tf.sh`; never print or commit the API key. If you save a script file, it goes under `{workspace}/.trendfinder/` (gitignored).

---

## Done means

- Config present, `/health` 200.
- An avatar chosen and its full DNA loaded via `GET /api/personas/{id}`.
- Niche trends fetched (without persona_id); empty → honest cold-start + route to scrape-now.
- Trends ranked against the avatar's DNA with per-trend reasons, labelled as native judgment.
- Ziel geklärt (aus der Anfrage übernommen oder mit ⭐-Empfehlung erfragt); Struktur + CTA folgen dem Primärziel; Ziel im Output benannt.
- Hooks + a full short-video script + caption written in the avatar's voice for the chosen trend.
- Script persisted as a content piece via `PATCH /api/content-pieces/{id}` (`script_data` set, `stage:"script"`); read-back confirmed. Backend `generate-script` route NOT used.
- If persistence failed, the script was still delivered in chat and the failure was stated honestly.
- Delivered as copyable markdown; optionally saved under `.trendfinder/`.
- No `?persona_id=` sent, no Apify call, no key printed.

---

## Abschluss (PFLICHT) — Next-Steps-Auswahlblock

Beende deine Antwort IMMER mit dem interaktiven **Auswahlblock** (die selektierbaren Options-UI-Blöcke, die Cowork rendert) — Spezifikation: `${CLAUDE_PLUGIN_ROOT}/reference/next-steps.md`. Zeige alle im aktuellen Zustand sinnvollen Optionen und markiere **genau eine** als ⭐ Empfehlung, passend zu dem, was du gerade getan hast. Nutze die ⭐-Kontext-Tabelle und die Zustands-Regeln aus dieser Datei.
