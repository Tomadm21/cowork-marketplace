---
name: onboarding
description: First-time Trendfinder setup. Use when the user says "richte Trendfinder ein", "set up trendfinder", "trendfinder setup", "verbinde mein trendfinder" — or whenever any Trendfinder skill is invoked and `{workspace}/.trendfinder/config.json` is missing. Walks the user through API key connection, Apify connector setup (on-demand) and optional backend credential (24/7 scheduled scrapes), niche configuration, and first schedule creation, then hands off to the Cockpit.
---

# Trendfinder Onboarding

Goal: connect this workspace to the customer's Trendfinder tenant exactly once, set up Apify access for on-demand scrapes (via the Cowork Apify MCP connector), optionally deposit a backend Apify credential for 24/7 unattended scheduled scrapes, configure at least one niche, optionally create the first scrape schedule (only if a backend Apify credential was deposited), and end on the Cockpit artifact. Read `${CLAUDE_PLUGIN_ROOT}/reference/api-contract.md` before starting — it is the single source of truth for all endpoints and platform limits.

All API calls use `bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh ...`. Never call the API with raw curl or an inline key.

---

## Credential model — understand this before proceeding

There are TWO distinct Apify credential paths:

| Path | Who holds the credential | When it's used |
|------|--------------------------|----------------|
| **Cowork Apify MCP connector** | Cowork (OAuth, per-user) | On-demand scrapes via the `scrape-now` skill — runs while a Cowork session is active |
| **Backend Apify key** (deposited via `POST /api/tenant/settings`) | The Trendfinder backend server | 24/7 unattended scheduled scrapes — runs independently of any Cowork session |

This split is intentional, not a gap. On-demand scrapes never touch the backend Apify credential; scheduled scrapes never use the Cowork connector.

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

## Step 1 — API key + connection proof

Tell the user (German, one sentence):

> "Gib deinen Trendfinder API-Key ein — du hast ihn von Tom erhalten, als dein Tenant angelegt wurde."

Capture the key via ✏️ free-text input (it is inherently an open value). Do NOT echo it back in full; confirm receipt by showing the last 4 characters only: `"Key empfangen — endet auf …XXXX"`.

Write the config file:

```json
{ "base_url": "https://api-production-78bb.up.railway.app", "api_key": "<key>" }
```

to `{workspace}/.trendfinder/config.json`.

Then immediately prove the connection — run both checks:

```
bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh GET /health
bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh GET /api/niches/config
```

**On 401 from either call:** tell the user the key is incorrect, delete the config file so it does not persist an invalid state, re-ask for the key, and do NOT proceed. Repeat until connection succeeds or the user aborts.

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

## Step 2 — Apify access

Apify access is split into two sub-steps. The on-demand connector is always needed; the backend credential is optional and only needed for scheduled (24/7) scrapes.

### Step 2a — Cowork Apify MCP connector (required for on-demand scrapes)

Tell the user:

> "Für On-Demand-Scrapes (wenn du hier in Cowork sagst 'scrape jetzt') nutzen wir den Apify-Connector in Cowork — du verbindest dich einmal per OAuth, danach kann Claude Apify-Actors direkt aufrufen, ohne dass ein Token hinterlegt wird."

Instruct the user to connect the Apify connector in Cowork if not already done:

> "Falls du den Apify-Connector noch nicht verbunden hast: gehe in Cowork zu Einstellungen → Connectoren, suche nach 'Apify', und klicke 'Verbinden' (OAuth bei `https://mcp.apify.com`). Sobald der Connector aktiv ist, sind On-Demand-Scrapes mit dem `scrape-now`-Befehl möglich."

Ask the user to confirm:

```
Ist der Apify-Connector in Cowork verbunden?

1) Ja, Connector ist aktiv
2) Nein, ich möchte das später einrichten
✏️  Ich bin mir nicht sicher
```

- **Option 1:** Continue to Step 2b.
- **Option 2 or uncertain:** Acknowledge and continue — the connector is not required to finish onboarding; on-demand scrapes simply won't work until it is connected. Tell the user they can connect it anytime, then continue to Step 2b.

**Note for Tom (operator):** Tom's Cowork workspace already has the Apify connector active. For new customers, this is the step where they authorise their own Apify account via OAuth at `https://mcp.apify.com`. No token is ever pasted into the backend through this path.

### Step 2b — Backend Apify credential (OPTIONAL — only needed for 24/7 scheduled scrapes)

Tell the user:

> "Für automatische Scrapes im Hintergrund (24/7, auch wenn Cowork nicht offen ist) braucht das Backend einen eigenen Apify-Token. Das ist OPTIONAL — du kannst es überspringen, wenn du Scrapes nur manuell starten möchtest."

Ask:

```
Möchtest du einen Apify-Token für automatische Hintergrund-Scrapes hinterlegen?

1) Ja, Token jetzt hinterlegen (für 24/7-Zeitpläne)
2) Nein, später oder gar nicht (nur manuelle Scrapes via Connector)
```

**If the user chooses option 2 (skip):** Acknowledge and note clearly:

> "Verstanden. Du kannst Scrapes manuell mit dem `scrape-now`-Befehl starten. Automatische Zeitpläne können erst erstellt werden, wenn du den Token nachträglich über `POST /api/tenant/settings` hinterlegst."

Then continue to Step 3. Do NOT create a schedule in Step 4 — instead, skip to Step 5 (proof + Cockpit hand-off) with a note that no schedule was created because the backend credential is missing.

**If the user chooses option 1:** Capture the Apify token via ✏️ free-text input (open value by nature). Confirm receipt with last 4 characters only.

Deposit via:

```
bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh POST /api/tenant/settings '{"apify_api_key":"<token>"}'
```

Expect `{"ok": true, ...}`. On any non-ok response, report the error and re-ask.

**Schedule gate — applies only when a schedule will be created:**
> A schedule (Step 4) must not be created unless this deposit step has succeeded or the user has confirmed an existing token is in place. If the user skipped this step, do NOT create a schedule in Step 4.

---

## Step 3 — Niches (detect-first)

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
- Hashtags to track (`✏️` free-text, comma-separated, optional — can be added later)

Platform limit (api-contract §2): niche slugs are globally unique across all tenants. Prefix the display name with the tenant id to avoid collisions — for example, if the tenant is `acme`, suggest `"acme <Name>"`. Remind the user of this with one sentence.

Ask which platforms the niche should track (numbered: 1: TikTok, 2: Instagram, 3: YouTube Shorts — multiple allowed) and the hashtags/queries per platform (✏️ free-text). **There is NO generic `hashtags` field — the API silently ignores unknown fields.** Use the per-platform fields and disable unused platforms:

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
  Warn the user that any schedules pointing at this niche will stop making sense and should also be deleted (`bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh DELETE /api/schedules/<id>` for each schedule whose `niche_id` matches). On confirmation:
  ```
  bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh DELETE /api/niches/config/<niche_id>
  ```

---

## Step 4 — First schedule (cost honesty)

**Skip this step entirely if the user did not deposit a backend Apify credential in Step 2b.** Tell the user:

> "Da kein Backend-Apify-Token hinterlegt wurde, wird kein automatischer Zeitplan erstellt. Du kannst jederzeit mit dem `scheduler`-Befehl einen hinzufügen, nachdem du den Token über `POST /api/tenant/settings` hinterlegt hast."

Then proceed directly to Step 5.

**If the backend credential WAS deposited**, ask which scrape interval the customer wants:

```
Wie oft soll der Scraper laufen?

1) Alle 6 Stunden   — empfohlen (4×/Tag)
2) Alle 12 Stunden  — moderat   (2×/Tag)
3) Täglich          — minimal   (1×/Tag)
✏️  Eigener Wert: Zahl zwischen 1 und 168 (Stunden)
```

**Before creating the schedule, state clearly:**

> "Die Scrape-Kosten entstehen auf deinem Apify-Account — ungefähr proportional zu Anzahl Runs pro Tag × Anzahl Hashtags. Das ist eine Schätzung; genaue Beträge findest du in deinem Apify-Dashboard."

Then ask which niche this schedule is for (numbered list of the confirmed niche_ids from Step 3).

Create via:

```
bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh POST /api/schedules '{"type":"scrape","niche_id":"<returned niche_id>","interval_hours":<N>,"enabled":true}'
```

Expect HTTP 201. On 404 `{"error": "niche not found for this tenant"}`: the niche_id does not match — do not retry with a guessed slug; re-confirm the niche_id from `GET /api/niches/config` and resubmit.

---

## Step 5 — Proof + Cockpit hand-off

Run:

```
bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh GET /api/schedules
```

For each `niche_id` from the confirmed niche list (Step 3), fetch trends individually:

```
bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh GET /api/trends/<niche_id>
```

Show the schedule entry to the user (if one was created). `last_run_at` will be `null` until the backend's 60-second scheduler tick fires — say so honestly:

> "Der Zeitplan wurde angelegt. `last_run_at` ist noch leer — das füllt sich nach dem ersten Backend-Tick (~60 Sekunden)."

If no schedule was created (Step 4 was skipped): omit the schedule display and tell the user instead:

> "Kein automatischer Zeitplan wurde eingerichtet. Du kannst jederzeit mit `scrape-now` manuell Trends holen oder mit dem `scheduler`-Befehl einen Zeitplan anlegen, sobald der Backend-Token hinterlegt ist."

For trends: a fresh niche returns an empty list or 404 — both mean no data yet. Say:

> "Noch keine Trends vorhanden — die erscheinen nach dem ersten abgeschlossenen Scrape."

Finish by generating the Cockpit so the user ends on the artifact even in cold-start state:

```
if command -v bun >/dev/null 2>&1; then bun ${CLAUDE_PLUGIN_ROOT}/skills/cockpit/scripts/cockpit.ts <workspace_root>; else node ${CLAUDE_PLUGIN_ROOT}/skills/cockpit/scripts/cockpit.ts <workspace_root>; fi
```

---

## Step 6 — Avatar anlegen (optional offer)

Avatars (brand + persona + DNA) personalise the trend matching, but they are **not required** to use Trendfinder — so this is an offer, never a gate. After the Cockpit hand-off, ask once:

```
Möchtest du jetzt auch deinen ersten Avatar anlegen? Ein Avatar (Marke + Persona
mit DNA) macht die Trend-Empfehlungen persönlicher — du kannst das aber jederzeit
später machen.

1) Ja, Avatar jetzt anlegen
2) Nein, später — fertig fürs Erste
```

- Option 1 → route to the `avatar-studio` skill (it does brand → persona → DNA → embed → Cockpit refresh).
- Option 2 (or anything else) → finish onboarding. Tell the user they can say "Avatar anlegen" anytime to start `avatar-studio`.

Do not block onboarding completion on this step.

---

## Done means

- `{workspace}/.trendfinder/config.json` exists, `GET /health` returns 200.
- User is informed about the Apify connector for on-demand scrapes (Step 2a); user has either confirmed it is connected or acknowledged they will connect it later.
- If the user chose to deposit a backend Apify token: `POST /api/tenant/settings` returned `{"ok": true, ...}`.
- At least one niche confirmed or created; all `niche_id` values came from the API, never guessed locally.
- If the backend Apify token was deposited: at least one schedule created (HTTP 201) with interval chosen by the user after cost disclosure; `GET /api/schedules` shows the schedule entry; user informed about first-run latency.
- If the backend Apify token was NOT deposited: no schedule created; user clearly informed of what is and isn't available.
- Cockpit artifact generated.
- No firm data written inside the plugin directory; all state lives in `{workspace}/.trendfinder/`.

Never invent niche slugs or schedule ids. Never create a schedule before the backend Apify token is confirmed deposited. If uncertain about any value, re-query the API rather than guessing.
