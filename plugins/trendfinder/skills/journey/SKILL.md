---
name: journey
description: The guided Trendfinder start — detects where you are and walks you step-by-step from avatar to finished, approved script, proposing exactly one recommended next step each time. Use when the user says "Los geht's", "Trendfinder starten", "wie fange ich an", "was soll ich als nächstes tun", "führ mich durch", "start", "guide me", "next step", or opens Trendfinder without a specific request. Delegates to onboarding, scrape-now, trend-radar, content-plan, script-studio, review, and cockpit — never writes data itself.
---

# Trendfinder — Journey (geführter Einstieg)

Goal: be the **spine** of the whole Avatar→Script flow. Detect the current state, tell the user in one line where they are, and offer exactly **one ⭐ recommended next step** (plus the other sensible options) as a select-block — then delegate to the matching skill. The single-purpose skills stay underneath; this one just orchestrates and never writes data. Read `${CLAUDE_PLUGIN_ROOT}/reference/api-contract.md` and `${CLAUDE_PLUGIN_ROOT}/reference/next-steps.md` first. All API calls via `bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh`.

## Step 0 — Config / connection gate

1. Check `{workspace}/.trendfinder/config.json` exists.
2. If it does, `bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh GET /health`.

Missing config or non-200 → state = **not set up** → ⭐ „⚙️ Einrichtung" → route to `onboarding`. Do not detect further.

## Step 1 — Detect state (read-only)

Fetch, tolerating empties (never invent):

```
bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh GET /api/brands
bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh GET /api/niches/config
```

Then, if ≥1 niche, check trends for the chosen niche (see Tie-Break below), and if ≥1 avatar, check the chosen avatar's open pieces:

```
bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh GET /api/trends/<niche_id>
bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh GET "/api/personas/<persona_id>/content-pieces?stage=idea"
bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh GET "/api/personas/<persona_id>/content-pieces?stage=script"
```

**Mehrere Avatare / Niches (Tie-Break):**

- **Genau 1 Avatar und ≤1 Niche** → direkt weiter mit der Leiter in Step 2.
- **Mehrere Avatare** → zuerst per nummeriertem Auswahl-Block fragen, für welchen Avatar die Journey laufen soll (Name + Marke zeigen, wie in `content-plan` Step 1). Die Leiter in Step 2 läuft dann NUR für den gewählten Avatar.
- **Mehrere Niches beim gewählten Avatar** → dieselbe Regel: nummeriert fragen, dann nur diese Niche prüfen.
- Niemals still den "ersten" Avatar/die "erste" Niche raten — eine falsche ⭐-Empfehlung (z. B. Content-Plan für Avatar A, während Avatar B im Review steht) ist schlimmer als eine kurze Rückfrage. Die Auswahl-Frage ist selbst ein Klick-Block, also bleibt der Flow geführt.

## Step 2 — Map state → the one ⭐ next step

Decide with this ladder (first match wins), name the state to the user, then show the select-block:

| Detected state | ⭐ Recommendation | Delegates to |
|---|---|---|
| Not set up / no config / health≠200 | ⚙️ Einrichtung | `onboarding` |
| No avatar (0 brands/personas) | 🎭 Avatar anlegen | `onboarding` |
| Avatar exists, niche has **no trends** | 🔥 Jetzt scrapen | `scrape-now` |
| Trends exist, **no idea pieces** | 🗂️ Content-Plan (Ideen) | `content-plan` |
| Idea pieces exist, **no script pieces** | ✍️ Skript schreiben | `script-studio` |
| Script pieces exist (awaiting approval) | ✅ Freigeben / Review | `review` |
| Everything approved / unclear | 📈 Trends ansehen | `cockpit` / `trend-radar` |

Always render the full sensible option set as a numbered block (per `next-steps.md`) with exactly one ⭐, e.g.:

```
Du hast einen Avatar (Lena) und frische Trends, aber noch keine Ideen geplant. Nächster Schritt:

1) 🗂️ Content-Plan — Ideen aus Lenas DNA + Trends  ⭐
2) ✍️ Direkt ein Skript schreiben
3) 🔥 Neu scrapen
4) 📈 Cockpit ansehen
```

On the user's pick, invoke the matching skill. After that skill finishes, its own Next-Steps block continues the journey — you do not need to re-run detection unless the user returns to you.

## Honesty & safety rules

- Detection is **read-only** — the journey never creates/patches/deletes; the delegated skills do that.
- Base the state on real API responses; an empty list is a real state ("noch keine Ideen"), never a reason to invent one.
- Config missing / health≠200 → always route to `onboarding`, never guess past a broken connection.
- Use `tf.sh`; never print the API key.

## Done means

- Connection gated (config + `/health`), else routed to onboarding.
- State detected from real API responses (brands, niches, trends, idea/script pieces).
- Exactly one ⭐ next step shown in a select-block, with the other sensible options; correct skill invoked on pick.

## Abschluss (PFLICHT) — Next-Steps-Auswahlblock

Dieser Skill IST der Next-Steps-Block — er endet immer mit genau einem ⭐ und delegiert. Spezifikation: `${CLAUDE_PLUGIN_ROOT}/reference/next-steps.md`.
