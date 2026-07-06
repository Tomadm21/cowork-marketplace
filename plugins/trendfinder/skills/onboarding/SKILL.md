---
name: onboarding
description: First-time Trendfinder setup. Use when the user says "richte Trendfinder ein", "set up trendfinder", "trendfinder setup", "verbinde mein trendfinder" — or whenever any Trendfinder skill is invoked and `{workspace}/.trendfinder/config.json` is missing. Walks the user through connecting their access, the Apify connector (for scraping), configuring a niche, and ends on the Cockpit. 24/7 automatic scraping is an optional add-on, not part of the default setup.
---

# Trendfinder Onboarding

Goal: connect this workspace to the customer's Trendfinder tenant exactly once, connect the Apify connector so scrapes work, configure at least one niche, and end on the Cockpit artifact. That's the whole default path — nothing more is required to start finding trends and writing scripts.

Read `${CLAUDE_PLUGIN_ROOT}/reference/api-contract.md` before starting — it is the single source of truth for all endpoints and platform limits. All API calls use `bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh ...`. Never call the API with raw curl or an inline key.

**Default path (this skill):** Zugang → Apify-Connector → Niche → Cockpit. On-demand scrapes (you say "jetzt scrapen") run through the Apify connector — that is all you need.

**Optional, later:** unattended 24/7 scraping on a schedule. That needs a backend Apify token and a schedule — set it up anytime via the `scheduler` skill. See the short "24/7-Automatik (optional)" note at the end. It is deliberately NOT part of first-time setup.

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

## Step 1 — Zugang einfügen (einmal)

The customer has their access in their Anleitung/PDF: a **server URL** plus an **API key**, shown together as one short "Dein Zugang" block they can copy in one go. Ask (German):

> "Füg deinen Trendfinder-Zugang ein — du findest ihn in deiner Anleitung. Kopier einfach den ganzen ‚Dein Zugang'-Block (Server + Schlüssel) hierher."

Capture the pasted text via ✏️ free-text. **Extract `base_url` and `api_key` from it.** The block looks like:

```
Server: https://… — Schlüssel: <key>
```

Parse the URL (the `https://…` value after "Server:") and the key (the value after "Schlüssel:"). If the user pastes only a bare key without a URL, ask once for the server URL too. **Validate** you have both a plausible `https://` URL and a non-empty key, then write them to `{workspace}/.trendfinder/config.json` as `{ "base_url": "...", "api_key": "..." }`. Do NOT echo the key back; confirm only: `"Zugang erkannt — Key endet auf …XXXX"`.

**If the key is missing or empty:** tell the user the access block looks incomplete and ask them to paste the whole block again. Do NOT proceed and do NOT write a partial config. Never hardcode a backend URL in the plugin — it always comes from the pasted access block.

Then immediately prove the connection — run both checks:

```
bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh GET /health
bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh GET /api/niches/config
```

**On 401 from either call:** the key is wrong — delete the config file so no invalid state persists, ask for the access block again, and do NOT proceed. Repeat until connection succeeds or the user aborts.

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

## Step 2 — Apify-Connector verbinden

This is the only Apify step you need. It lets Claude run scrapes on demand (when you say "jetzt scrapen") using your own Apify account, authorised once via OAuth. No token is ever pasted anywhere.

Tell the user:

> "Trendfinder holt die Trends über den Dienst Apify. Du verbindest deinen eigenen Apify-Account einmal per OAuth — danach kann Claude direkt für dich scrapen, ohne dass du je einen Token eintippst. Ein kostenloser Apify-Account reicht zum Starten."

Instruct the user to connect the Apify connector in Cowork if not already done:

> "Falls du den Apify-Connector noch nicht verbunden hast: gehe in Cowork zu Einstellungen → Connectoren, suche nach 'Apify', und klicke 'Verbinden' (OAuth bei `https://mcp.apify.com`)."

Ask the user to confirm:

```
Ist der Apify-Connector in Cowork verbunden?

1) Ja, Connector ist aktiv
2) Nein, ich richte das gleich/später ein
✏️  Ich bin mir nicht sicher
```

- **Option 1:** Continue to Step 3.
- **Option 2 or uncertain:** Acknowledge and continue — the connector is not required to *finish* onboarding; on-demand scrapes simply won't work until it is connected. Tell the user they can connect it anytime, then continue to Step 3.

---

## Step 3 — Niche (detect-first)

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
- Which platforms to track (numbered: 1: TikTok, 2: Instagram, 3: YouTube Shorts — multiple allowed) and the hashtags/queries per platform (`✏️` free-text, comma-separated).

Platform limit (api-contract §2): niche slugs are globally unique across all tenants. Prefix the display name with the tenant id to avoid collisions — for example, if the tenant is `acme`, suggest `"acme <Name>"`. Remind the user of this with one sentence.

**There is NO generic `hashtags` field — the API silently ignores unknown fields.** Use the per-platform fields and disable unused platforms:

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
  On confirmation:
  ```
  bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh DELETE /api/niches/config/<niche_id>
  ```

---

## Step 4 — Cockpit + erster Scrape (Abschluss)

Generate the Cockpit so the user ends on the artifact even in cold-start state:

```
if command -v bun >/dev/null 2>&1; then bun ${CLAUDE_PLUGIN_ROOT}/skills/cockpit/scripts/cockpit.ts <workspace_root>; else node --experimental-strip-types ${CLAUDE_PLUGIN_ROOT}/skills/cockpit/scripts/cockpit.ts <workspace_root>; fi
```

A fresh niche has no trends yet — say so honestly:

> "Eingerichtet ✅ — dein Cockpit ist da. Noch keine Trends drin: die erscheinen nach deinem ersten Scrape."

Then offer the immediate first action (this is the natural next step right after setup):

```
Willst du gleich deinen ersten Scrape starten?

1) 🔥 Ja, jetzt scrapen   → ich starte den `scrape-now`-Befehl
2) Später — erstmal nur das Cockpit ansehen
```

- **Option 1** → route to the `scrape-now` skill (it shows a cost estimate, asks for confirmation, then scrapes via the Apify connector). After ~1–2 min the trends appear in the Cockpit.
- **Option 2** → finish; tell the user they can say "jetzt scrapen" anytime.

---

## Step 5 — Avatar anlegen (optional offer)

Avatars (brand + persona + DNA) personalise the trend matching, but they are **not required** to use Trendfinder — so this is an offer, never a gate. Ask once:

```
Möchtest du auch einen Avatar anlegen? Ein Avatar (Marke + Persona mit DNA) macht
die Trend-Empfehlungen persönlicher — du kannst das aber jederzeit später machen.

1) Ja, Avatar jetzt anlegen
2) Nein, später
```

- Option 1 → route to the `avatar-studio` skill (brand → persona → DNA → embed → Cockpit refresh).
- Option 2 (or anything else) → finish. Tell the user they can say "Avatar anlegen" anytime.

Do not block onboarding completion on this step.

---

## Step 6 — Next-Steps-Auswahlblock (einmal, ganz am Ende)

Erst **jetzt** — nach Cockpit, Scrape-Angebot und Avatar-Angebot, ganz am Schluss — präsentiere den interaktiven **Auswahlblock** aus `${CLAUDE_PLUGIN_ROOT}/reference/next-steps.md`. Während Step 0–5 führen die einzelnen nummerierten Schritt-Auswahlen; der große Next-Steps-Block kommt NICHT nach jedem Schritt, sondern nur dieses eine Mal zum Abschluss. Markiere genau eine Option als ⭐ Empfehlung (frisch eingerichtet, noch kein Scrape → in der Regel 🔥 „Jetzt scrapen").

---

## 24/7-Automatik (optional, später)

Im Default-Onboarding nicht nötig — nur falls die Kundin später automatische Scrapes im Hintergrund will (auch wenn Cowork zu ist):

1. Einen Apify-Token im Backend hinterlegen: `bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh POST /api/tenant/settings '{"apify_api_key":"<token>"}'` (erwartet `{"ok": true}`). Danach `"backend_apify_token_deposited": true` in `{workspace}/.trendfinder/config.json` ergänzen (bestehende Schlüssel behalten) — der `scheduler`-Skill liest diesen Marker, bevor er Zeitpläne aktiviert.
2. Dann einen Zeitplan anlegen — am einfachsten über den **`scheduler`-Skill** ("stell einen Zeitplan ein"). Er erstellt den Schedule und erklärt die Apify-Kosten.

**Ohne hinterlegten Token schlägt jeder geplante Lauf serverseitig fehl** (kein Fallback auf einen Operator-Key) — deshalb niemals einen aktiven Zeitplan ohne Token anlegen.

On-demand-Scrapes (`scrape-now`) brauchen das alles NICHT — der Connector aus Step 2 reicht. Erwähne diesen Block nur, wenn die Kundin nach automatischem/24-7-Scraping fragt.

---

## Done means

- `{workspace}/.trendfinder/config.json` exists, `GET /health` returns 200.
- User is informed about the Apify connector for on-demand scrapes (Step 2); user has either confirmed it is connected or acknowledged they will connect it.
- At least one niche confirmed or created; all `niche_id` values came from the API, never guessed locally.
- Cockpit artifact generated; user offered the first scrape.
- No backend Apify token or schedule is required for onboarding to count as complete — those are the optional 24/7 add-on.
- No firm data written inside the plugin directory; all state lives in `{workspace}/.trendfinder/`.

Never invent niche slugs. If uncertain about any value, re-query the API rather than guessing.
