---
name: review
description: Review the scripts waiting for approval on a Trendfinder avatar's content board and approve or reject them with a click. Use when the user says "Review", "Freigabe", "Skripte freigeben", "was steht zur Freigabe", "welche Skripte sind fertig", "content freigeben", "approve scripts", "review meine Skripte". Lists pieces at stage=script and advances approved ones to done. Never scrapes, never spends budget.
---

# Trendfinder — Review / Freigabe

Goal: show the scripts that are written but not yet approved (stage `script`) for an avatar, and let the user **approve** (→ stage `done`) or **reject** (keep at `script`, or discard) each with a select-block. Pure state transitions on the shared board — no synthesis, no scraping. Read `${CLAUDE_PLUGIN_ROOT}/reference/api-contract.md` (§ "Content pieces") first. All API calls via `bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh`.

## Step 0 — Self-check (config required)

1. Check `{workspace}/.trendfinder/config.json` exists.
2. If it does, `bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh GET /health`.

If either fails → route to `onboarding`. Else continue.

## Step 1 — Pick the avatar

```
bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh GET /api/brands
bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh GET /api/brands/<brand_id>/personas
```

Numbered list to choose (clickable). No avatars → route to `onboarding`.

## Step 2 — List scripts awaiting approval

```
bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh GET "/api/personas/<persona_id>/content-pieces?stage=script"
```

- **Empty** → say honestly "Keine Skripte zur Freigabe für <Avatar>." and offer to write one (→ `script-studio`) or plan ideas (→ `content-plan`). Do NOT invent pieces.
- **Non-empty** → for each piece show a compact preview from its `script_data` (Hook + CTA + Ziel), keyed by `id` and `title`. Never fabricate content that isn't in `script_data`.

## Step 3 — Approve / reject per piece (select-block)

Present a select-block per piece (or a batch block if several):

```
„Abendroutine mit 3 Produkten" (Lena) — Hook: „Diese 3 Produkte …" · Ziel: 🚀 Reichweite

1) ✅ Freigeben  → Stage „done"
2) ↩︎ Zurück in Skript lassen (nochmal überarbeiten)
3) 🗑️ Verwerfen (löschen)
```

- **Freigeben** → advance stage:
  ```
  bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh PATCH /api/content-pieces/<piece_id> '{"stage":"done"}'
  ```
  **200** approved · **404** foreign/unknown piece (re-resolve).
- **Zurück lassen** → no API call; it stays at `script`. Optionally offer to hand off to `script-studio` to rewrite.
- **Verwerfen** → confirm first (destructive), then:
  ```
  bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh DELETE /api/content-pieces/<piece_id>
  ```
  **204** deleted · **404** foreign/unknown. Only delete after an explicit user confirm.

**Read-back (honesty rule):** after approvals, `GET /api/personas/<persona_id>/content-pieces?stage=done` (or re-list `stage=script`) and report the real counts — how many approved, how many still waiting. Never claim an approval the API didn't confirm.

## Step 4 — Summary

State the real outcome: N freigegeben, M noch offen, K verworfen. Offer the next natural step (write another script, or view the Cockpit Content tab).

## Honesty & safety rules

- Only ever show/act on pieces the API returned; never invent a piece or its content.
- Delete is destructive → always confirm before `DELETE`.
- Never advance a stage the user didn't choose; never claim a transition the API didn't confirm (read-back).
- Use `tf.sh`; never print the API key.

## Done means

- Config present, `/health` 200; avatar chosen.
- `stage=script` pieces listed (or honest "none"); previews only from real `script_data`.
- User choices applied: approve → `PATCH stage=done`; reject → keep or (confirmed) `DELETE`.
- Read-back confirms transitions; real counts reported.

## Abschluss (PFLICHT) — Next-Steps-Auswahlblock

Beende IMMER mit dem Auswahlblock aus `${CLAUDE_PLUGIN_ROOT}/reference/next-steps.md`. Nach Freigaben ist die ⭐-Empfehlung meist „✍️ Nächstes Skript" oder „📈 Trends ansehen" (bzw. „Content-Plan", wenn keine Ideen offen sind).
