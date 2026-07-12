---
name: review
description: Review the scripts waiting for approval on a Trendfinder avatar's content board and approve or reject them with a click. Use when the user says "Review", "Freigabe", "Skripte freigeben", "was steht zur Freigabe", "welche Skripte sind fertig", "content freigeben", "approve scripts", "review meine Skripte". Lists pieces at stage=script and advances approved ones to done. Never scrapes, never spends budget.
---

# Trendfinder — Review / Freigabe

Goal: show the scripts that are written but not yet approved (stage `script`) for an avatar, and let the user **approve** (→ stage `done`) or **reject** (keep at `script`, or discard) each with a select-block. Pure state transitions on the shared board — no synthesis, no scraping. Read `${CLAUDE_PLUGIN_ROOT}/reference/api-contract.md` (§ "Content pieces") first. All API calls via the **`tf_request` tool** of the plugin's `trendfinder` MCP server (returns `{ok, status, body}` for every HTTP status).

## Step 0 — Self-check (config required)

Call `tf_health {}`. If the result is not `ok: true` with `status: 200` → route to `onboarding`. Else continue.

## Step 1 — Pick the avatar

```
tf_request { "method": "GET", "endpoint": "/api/brands" }
tf_request { "method": "GET", "endpoint": "/api/brands/<brand_id>/personas" }
```

Numbered list to choose (clickable). No avatars → route to `onboarding`.

## Step 2 — List scripts awaiting approval

```
tf_request { "method": "GET", "endpoint": "/api/personas/<persona_id>/content-pieces?stage=script" }
```

- **Empty** → say honestly "Keine Skripte zur Freigabe für <Avatar>." and offer to write one (→ `script-studio`) or plan ideas (→ `content-plan`). Do NOT invent pieces.
- **Non-empty, one piece** → go straight to Step 3 (full script + decision).
- **Non-empty, several pieces** → first a compact numbered overview (title + Hook first line + Ziel per piece), then walk them **one at a time** through Step 3. Never fabricate content that isn't in `script_data`.

## Step 3 — Show the FULL script, then approve / reject (select-block)

**Hard rule — niemand gibt frei, was er nicht gesehen hat:** before EVERY decision block, render that piece's **complete script** from `script_data` as readable markdown directly above it — alle Hooks, das volle Skript (`body`), CTA, Caption, Hashtags, Ziel, Dreh-Notizen. A one-line preview is NOT enough. If `script_data` is missing/empty, say so honestly („dieses Piece hat noch keinen Skript-Text") instead of showing an empty approval.

Then the select-block for that piece:

```
## Abendroutine mit 3 Produkten (Lena · Ziel: 🚀 Reichweite)

**Hook:** Diese 3 Produkte reichen wirklich
**Alternative Hooks:** …
**Skript:**
<voller Skript-Text aus script_data.body>
**CTA:** …
**Caption:** …
**Hashtags:** #…

1) ✅ Freigeben  → Stage „done"
2) ↩︎ Zurück in Skript lassen (nochmal überarbeiten)
3) 🗑️ Verwerfen (löschen)
```

- **Freigeben** → advance stage:
  ```
  tf_request { "method": "PATCH", "endpoint": "/api/content-pieces/<piece_id>", "body": { "stage": "done" } }
  ```
  **200** approved · **404** foreign/unknown piece (re-resolve).
- **Zurück lassen** → no API call; it stays at `script`. Optionally offer to hand off to `script-studio` to rewrite.
- **Verwerfen** → confirm first (destructive), then:
  ```
  tf_request { "method": "DELETE", "endpoint": "/api/content-pieces/<piece_id>" }
  ```
  **204** deleted · **404** foreign/unknown. Only delete after an explicit user confirm.

**Read-back (honesty rule):** after approvals, `tf_request { "method": "GET", "endpoint": "/api/personas/<persona_id>/content-pieces?stage=done" }` (or re-list `stage=script`) and report the real counts — how many approved, how many still waiting. Never claim an approval the API didn't confirm.

## Step 4 — Summary

State the real outcome: N freigegeben, M noch offen, K verworfen. Offer the next natural step (write another script, or view the Cockpit Content tab).

## Honesty & safety rules

- Only ever show/act on pieces the API returned; never invent a piece or its content.
- Delete is destructive → always confirm before `DELETE`.
- Never advance a stage the user didn't choose; never claim a transition the API didn't confirm (read-back).
- Use `tf_request`; never print the API key.

## Done means

- `tf_health` 200; avatar chosen.
- `stage=script` pieces listed (or honest "none"); content only from real `script_data`.
- **Every decision block had the piece's complete script rendered directly above it** — no approval on unseen text.
- User choices applied: approve → `PATCH stage=done`; reject → keep or (confirmed) `DELETE`.
- Read-back confirms transitions; real counts reported.

## Abschluss (PFLICHT) — Next-Steps-Auswahlblock

Beende IMMER mit dem Auswahlblock aus `${CLAUDE_PLUGIN_ROOT}/reference/next-steps.md`. Nach Freigaben ist die ⭐-Empfehlung meist „✍️ Nächstes Skript" oder „📈 Trends ansehen" (bzw. „Content-Plan", wenn keine Ideen offen sind).
