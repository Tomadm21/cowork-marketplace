---
name: onboarding
description: >-
  First-time Trendfinder setup AND avatar-first creation. Use when the user says "richte Trendfinder ein", "set up trendfinder", "trendfinder setup", "Avatar anlegen", "Avatar erstellen", "create an avatar", "neue Persona", "Marke anlegen", "Themen neu ableiten", "Hashtags verbessern" — or whenever any Trendfinder skill is invoked and {workspace}/.trendfinder/config.json is missing. Walks the user avatar-first: access → Apify connector → avatar (brand+persona+DNA) → niche(s) derived from the avatar with AI-derived scrape topics (the user never types hashtags) → Cockpit. Also re-derives topics for existing niches. 24/7 scheduled scraping is an optional add-on.
---

# Trendfinder Onboarding

Goal: connect this workspace to the customer's Trendfinder tenant (once), then walk the user **avatar-first**: create or extend an avatar (Marke + Persona + DNA), let Claude derive the niche(s) it covers and the scrape topics for each niche from the avatar's own DNA, show the derived topics for a light confirm, attach the niche(s) to the avatar, and end on the Cockpit artifact. **The user never types a hashtag** — Claude derives, self-checks, and shows; the user only confirms or nudges. The same flow also lets an existing avatar be extended with a new niche, and re-derives topics for an existing niche (e.g. to fix an old, over-broad hashtag list).

Read `${CLAUDE_PLUGIN_ROOT}/reference/api-contract.md` before starting — it is the single source of truth for all endpoints, ID rules, and the DNA body shape (§ "Avatars — Brands, Personas & DNA"). Before deriving any topics (Step 6/7), read `${CLAUDE_PLUGIN_ROOT}/reference/niche-hashtags.md` — the derivation ruleset Claude applies to itself. All API calls use `bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh ...`. Never call the API with raw curl or an inline key.

**Default path (this skill):** Zugang → Apify-Connector → Avatar (Marke + Persona + DNA) → Niche(s) mit KI-abgeleiteten Themen → Cockpit. Zugang und Apify-Connector laufen nur beim allerersten Mal (Step 0 erkennt das automatisch und überspringt sie sonst). On-demand-Scrapes (du sagst „jetzt scrapen") laufen über den Apify-Connector.

**Optional, später:** unattended 24/7 scraping on a schedule. Das braucht einen Backend-Apify-Token und einen Zeitplan — jederzeit einrichtbar über den `scheduler`-Skill. Siehe die kurze „24/7-Automatik (optional)"-Notiz weiter unten. Bewusst NICHT Teil der Ersteinrichtung.

---

## Step 0 — Self-check (drei Zustände)

Bevor irgendetwas anderes passiert, bestimme, in welchem der drei Zustände sich dieser Workspace befindet — ein abgelaufener Schlüssel bei Wiedereinstieg ist dabei ein **normaler** Fall, kein Randfall:

1. Prüfe, ob `{workspace}/.trendfinder/config.json` existiert.
2. Falls ja, rufe `bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh GET /health` auf.

**Zustand A — Config fehlt (First-Run).** Kein `config.json` vorhanden: durchlaufe Step 1 (Zugang einfügen) und Step 2 (Apify-Connector), dann weiter in den Avatar-Flow (Step 3).

**Zustand B — Config vorhanden UND `/health` liefert 200.** Zugang und Connector komplett überspringen — direkt in den Avatar-Flow (Step 3). Das ist der Weg, über den „Avatar anlegen" / „noch einen Avatar" jederzeit wieder einsteigt. Sag dem Nutzer NICHT, er solle das Onboarding neu durchlaufen — erkenne stattdessen den bestehenden Zustand (das übernimmt Step 3) und biete an: neuer Avatar / bestehenden erweitern / Themen neu ableiten.

**Zustand C — Config vorhanden, ABER `/health` liefert NICHT 200** (abgelaufener/widerrufener Schlüssel). Behandle nur den Zugangsteil wie einen Erstlauf: wiederhole Step 1's Zugangs-Erfassung (dieselbe 401/non-2xx-Behandlung — Config löschen, „Dein Zugang"-Block erneut erfragen), bis `/health` 200 liefert. Der Apify-Connector (Step 2) muss dabei NICHT erneut bestätigt werden — er ist Cowork-seitiger Zustand, unabhängig vom Trendfinder-API-Schlüssel. Erst danach in den Avatar-Flow (Step 3) weitergehen. **Bei kaputter Verbindung niemals in den Avatar-Flow weitergehen.**

---

## Step 1 — Zugang einfügen (einmal)

*(Nur im Erstlauf — Zustand A aus Step 0.)*

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

**On 401 from either call:** the key is wrong — delete the config file so no invalid state persists, ask for the access block again, and do NOT proceed. Repeat until connection succeeds or the user aborts. (This exact handling is what Step 0's Zustand C reuses on stale-key re-entry.)

**On any non-2xx response that is NOT a 401 (5xx, timeout/network error):** report the error verbatim, leave the config file in place, and ask the user whether to retry or abort — do NOT proceed to Step 2.

**On success:** the connection is proven. Continue to Step 2 (Apify-Connector) — Step 3 presents the full detected state (avatars + niches) right after. (außerhalb eines Zustand-C-Wiedereintritts — dort geht es nach erfolgreicher Zugangs-Erfassung direkt zu Step 3.)

---

## Step 2 — Apify-Connector verbinden

*(Nur im Erstlauf — Zustand A aus Step 0.)*

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

## Step 3 — Avatare & Niches erkennen (detect-first)

Egal ob frisch verbunden (Step 1+2) oder direkt hierher gesprungen (Step 0, Zustand B/C) — ab hier läuft für beide Fälle derselbe Einstieg.

Fetch:

```
bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh GET /api/brands
bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh GET /api/niches/config
```

`GET /api/niches/config` liefert pro Niche jetzt zusätzlich ein `personas: [{persona_id, display_name}]`-Array — nutze es, um zu zeigen, zu welchem Avatar/welchen Avataren eine Niche gehört. Ruf außerdem pro Marke `GET /api/brands/<brand_id>/personas` ab (liefert die Persona-Namen unter jeder Marke) — diese Liste brauchst du gleich in Step 4a, um einen Avatar nummeriert auswählen zu lassen.

**Hat der Tenant null Marken** → Menü überspringen, direkt weiter zu Step 4 (Avatar anlegen). Kurz sagen, dass noch kein Avatar existiert und du gleich einen anlegst.

Andernfalls den erkannten Zustand zeigen, zum Beispiel:

```
Du hast aktuell:

Avatare:
  1) Anna (Marke: Tom Beauty)
  2) Lena (Marke: Tom Beauty)

Niches:
  1) acme Beauty   (niche_id: acme-beauty)   → Avatar: Anna
  2) acme Fashion  (niche_id: acme-fashion)  → Avatar: Lena
```

Dann nummeriert anbieten:

```
Was möchtest du tun?

1) 🎭 Neuen Avatar anlegen
2) ➕ Bestehenden Avatar um eine Niche erweitern
3) 🔁 Themen einer bestehenden Niche neu ableiten
✏️  Etwas anderes (z. B. Niche umbenennen/trennen, Cockpit ansehen, bestehende Avatar-DNA/Marke bearbeiten)
```

**Option 2 nur zeigen, wenn ≥1 Avatar (Persona) existiert** (sonst hat eine Marke mit null Personas nichts, das sich in Step 4a auswählen ließe). **Option 3 nur zeigen, wenn ≥1 Niche existiert** (sonst sinnlos).

Routing: **1 → Step 4** · **2 → Step 4a** · **3 → Step 7** · **✏️** → frei interpretieren: Umbenennen/Trennen → Step 9; reines Bearbeiten einer bestehenden Avatar-DNA/Marke (kein neuer/erweiterter Avatar, keine Niche) → route to the `avatar-studio` skill; sonst passend zu einem anderen Skill wechseln.

---

## Step 4 — Avatar anlegen: Fragebogen → DNA → Marke + Persona

Dies ist der Kern des neuen Flows und läuft **nativ in Claude** — das Backend erfindet nie DNA, es speichert und embedded nur.

**Fragebogen (4–6 fokussierte Fragen, kein Verhör):**

- Wie heißt der Avatar, welche Persönlichkeit/welches Alter?
- Welche Nische(n)/Themen (werden zu `content_pillars`)?
- Welcher Ton (locker/seriös), welche Sprache, welche Energie? Was soll vermieden werden?
- Plattform-Fokus (TikTok / Instagram / YouTube Shorts)?
- **Fokussiert oder breit?** — explizit fragen, das bestimmt die DNA-Tiefe: „Soll [Name] ein klares Einzelthema haben oder ein breites Themenspektrum abdecken?" Bei **breit**: synthetisiere 4–6 reichhaltige `content_pillars` statt 1–2, jede mit eigener `description` + `topics`.

**Marke wählen oder anlegen (nummeriert, nie ein stiller Auto-Attach).** Hat der Tenant bereits Marken, zeige sie nummeriert plus die Option „neue Marke". Bei „neue Marke" (oder null Marken): Anzeigename slugifizieren → `brand_id` (klein schreiben, Leerzeichen → `-`, alles außer `[a-z0-9-]` entfernen, zur globalen Eindeutigkeit präfixen), dann:

```
BRAND_BODY=$(mktemp)   # real temp dir, NOT the synced workspace
echo '{"brand_id":"<slug>","display_name":"<Name>","mission":"...","target_audience":"..."}' > "$BRAND_BODY"
bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh POST /api/brands @"$BRAND_BODY"; rm -f "$BRAND_BODY" 2>/dev/null || : > "$BRAND_BODY"
```

Interpretieren: **201** angelegt · **409** Slug bereits vergeben (global eindeutig) → neu slugifizieren und erneut versuchen · **422** Feld fehlerhaft → korrigieren · **401/400** Tenant-Fehler → zurück zum Zugang (Step 0, Zustand C).

Existiert die Marke schon, einfach ihre `brand_id` weiterverwenden.

**Claude synthetisiert die DNA selbst.** ⚠️ **Die DNA-Felder sind VERSCHACHTELTE OBJEKTE, keine Strings** — ein String statt eines Objekts liefert **422** (das ist der primäre Anlege-Pfad, hier keinen Fehler machen). Die exakten Formen (identisch zu dem, was Avatar-Studio heute verwendet — siehe `${CLAUDE_PLUGIN_ROOT}/reference/api-contract.md` § „Avatars — Brands, Personas & DNA"):

- `persona_profile` = `{name, age, background, location, appearance, personality, style}`
- `tone_of_voice` = `{tone, language, attitude, energy, avoid_words, example_openers}`
- `content_pillars` = **Liste** von `{name, description, topics}`
- plus die skalaren Felder `system_prompt` (String), `interests` (String), `origin_story` (String)

Jedes DNA-Feld ist optional — eine unvollständige DNA ist völlig in Ordnung — aber jedes Feld, das du sendest, muss exakt seiner Form entsprechen.

**Zeig die synthetisierte DNA und lass den Nutzer bestätigen, bevor du sie schreibst.** Dann die Persona anlegen (`persona_id` = slugifizierter Name, mit der Marke präfixt — z. B. `tom-beauty-anna`) — den vollständig bestätigten Body in die Temp-Datei schreiben, dann:

```
PERSONA_BODY=$(mktemp)   # real temp dir, NOT the synced workspace
# body = {"persona_id":"<brand>-<name>","display_name":"<Name>","persona_profile":{...},"tone_of_voice":{...},"content_pillars":[{...}],"system_prompt":"...","interests":"...","origin_story":"..."}
bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh POST /api/brands/<brand_id>/personas @"$PERSONA_BODY"; rm -f "$PERSONA_BODY" 2>/dev/null || : > "$PERSONA_BODY"
```

Interpretieren: **201** angelegt · **409** `persona_id` bereits vergeben → neu slugifizieren und erneut versuchen · **404** Marke gehört nicht diesem Tenant → Marke oben neu auflösen · **422** Feld fehlerhaft.

**Read-back (Ehrlichkeitsregel):** `GET /api/personas/<persona_id>` aufrufen und bestätigen, dass die gesendeten DNA-Felder tatsächlich in der Antwort stehen — BEVOR du fortfährst. Ein 201, das die DNA-Felder still verworfen hat, zählt nicht als angelegt.

Dann embedden:

```
bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh POST /api/personas/<persona_id>/embed-dna
```

Ehrlich berichten: **200** `{"status":"embedded", "vector_dims":N}` → DNA ist durchsuchbar · **503** → kein Google-Embedder auf dem Backend konfiguriert — der Avatar existiert und ist trotzdem voll nutzbar, nur noch nicht vektor-gematcht, sag das genau so · **400** → noch keine DNA vorhanden.

Weiter mit **Step 5**, um die passende(n) Niche(s) für diesen Avatar zu bestimmen.

---

## Step 4a — Bestehenden Avatar um eine Niche erweitern (Einstieg: Option 2 aus Step 3)

Der Avatar hat schon eine DNA — der Step-4-Fragebogen entfällt komplett.

1. Avatar (Persona) aus der in Step 3 gezeigten Liste nummeriert auswählen lassen (bei Bedarf `GET /api/brands/<brand_id>/personas` nachladen).
2. DNA nachladen, falls die `content_pillars` noch nicht vorliegen: `GET /api/personas/<persona_id>`.
3. Fragen, welches Thema/welche Niche dazukommen soll.
   - **Liegt das Thema bereits in einem bestehenden `content_pillar`?** → diesen Pillar direkt in Step 5 einspeisen, fertig.
   - **Ist das Thema wirklich neu** (z. B. ein „Fitness"-Avatar soll jetzt auch „Ernährung" abdecken)? → den Nutzer bitten, es in 1–2 Sätzen zu beschreiben, das Ganze als zusätzlichen `content_pillar` behandeln (optional per `PUT /api/personas/<persona_id>` zur DNA hinzufügen, damit künftiges Matching es sieht), dann **Step 5 nur für diesen einen neuen Pillar** durchlaufen.

**Keine erneute volle DNA-Befragung** für einen Avatar, der schon eine hat.

---

## Step 5 — Niche(s) aus dem Avatar ableiten

Aus den `content_pillars` des Avatars (bzw. dem einen neuen Pillar aus Step 4a) bestimmt Claude, welche Niche(s) er abdeckt: mono-thematischer Avatar → 1 Niche; breiter Avatar → mehrere (z. B. „Skincare" + „Longevity").

**Vor dem Anlegen einer neuen Niche** die bestehende Liste aus `GET /api/niches/config` prüfen (aus Step 3 vorhanden, sonst neu abrufen): überschneidet sich ein Thema mit einer bestehenden Niche, anbieten, **an sie anzuhängen** (geteilt) statt zu duplizieren.

Den Split mit dem Nutzer bestätigen — „eine Niche, oder in diese zwei splitten?".

Für jede resultierende Niche danach in Step 6: **neu** → Ableitung + Create-and-Attach; **bereits bestehend/geteilt** → nur Attach-Existing, keine Ableitung.

---

## Step 6 — Themen pro neuer Niche ableiten + anhängen

Der Nutzer tippt an keiner Stelle einen Hashtag ein — er sieht die abgeleitete Liste nur zur Bestätigung. Für jede NEUE Niche gilt das Ableitungs-Regelwerk aus `${CLAUDE_PLUGIN_ROOT}/reference/niche-hashtags.md` — die Regeln und der Selbst-Check stehen dort ausführlich, hier nur die Mechanik:

1. **Ableiten:** 5–10 präzise TikTok/IG-Hashtags + YouTube-Suchanfragen aus Nischen-Thema + Avatar-DNA + Sprache/Region (DACH → deutsch).
2. **Selbst-Check VOR dem Zeigen:** die abgeleitete Liste gegen das Regelwerk + den Selbst-Check aus `niche-hashtags.md` prüfen und alles verwerfen, was durchfällt — **bevor** der Nutzer sie sieht.
3. **Zeigen + leichtes Bestätigen/Nudge:** die Liste gruppiert nach Plattform zeigen, mit einer Zeile Begründung. Bei einer unsicheren Niche lieber EINE gezielte Rückfrage stellen, statt schlecht zu raten.
4. **Der Selbst-Check läuft bei JEDER erneut gezeigten Liste**, nicht nur beim ersten Mal — auch bei einer durch einen Nutzer-Nudge angepassten Liste. Schlägt ein Nudge selbst einen geblockten Tag vor (z. B. „nimm stattdessen #mindset"), **nicht ungeprüft übernehmen**: mit der `niche-hashtags.md`-Begründung gegensteuern (warum das Fremd-Content zieht) und eine konkrete, on-topic Alternative vorschlagen.

**Anhängen nach Bestätigung:**

Neue Niche (Create-and-Attach):

```
NICHE_BODY=$(mktemp)   # real temp dir, NOT the synced workspace
echo '{"display_name":"<prefixed niche name>","tiktok_hashtags":["..."],"instagram_hashtags":["..."],"youtube_search_queries":["..."],"instagram_enabled":true,"youtube_enabled":true}' > "$NICHE_BODY"
bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh POST /api/personas/<persona_id>/niches @"$NICHE_BODY"; rm -f "$NICHE_BODY" 2>/dev/null || : > "$NICHE_BODY"
```

(Niche-Slugs sind global eindeutig — den Anzeigenamen wie gehabt mit Tenant/Marke präfixen.)

Bestehende (geteilte) Niche — Attach-Existing (KEINE Themen-Ableitung, die geteilte Niche behält ihre Konfiguration):

```
bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh POST /api/personas/<persona_id>/niches '{"niche_id":"<existing niche_id>"}'
```

Interpretieren: **200** verknüpft (liefert die Niche inkl. Scrape-Konfiguration zurück) · **409** — zwei mögliche Ursachen: bereits verknüpft (dem Nutzer sagen, dass sie schon verknüpft ist) ODER der abgeleitete Niche-Slug existiert schon (Anzeigename neu präfixen/slugifizieren und erneut versuchen, wie bei Marke/Persona) · **404** fremde Persona oder Niche · **422** fehlerhaft, oder beide/keins der Felder `niche_id`/`display_name` gesetzt.

**Read-back (Ehrlichkeitsregel):** die Antwort lesen und bestätigen, dass die Hashtags nicht leer angekommen sind. Die zurückgegebene `niche_id` immer weitertragen. Für jede Niche wiederholen.

→ Weiter mit Step 8 (Cockpit + erster Scrape).

---

## Step 7 — Themen einer bestehenden Niche neu ableiten (Einstieg: Option 3 aus Step 3, oder „Themen neu ableiten")

1. **Niche wählen** aus `GET /api/niches/config`.
2. **Ableitungs-Linse = die verknüpfte Avatar-DNA** (aus dem `personas[]`-Array der Niche). Mehrere verknüpfte Avatare → fragen, welcher, oder das Nischen-Thema selbst nutzen. **Avatar-lose Niche** → erst anbieten, einen Avatar zu verknüpfen (Attach-Existing aus Step 6), dann weiter.
3. **Themen ableiten** — identisch zu Step 6 (Regelwerk + Selbst-Check aus `niche-hashtags.md`).
4. **Diff zeigen: aktuell vs. Vorschlag** — die aktuellen `tiktok_hashtags`/`instagram_hashtags`/`youtube_search_queries` der Niche neben die neu abgeleiteten stellen → bestätigen/nudgen. **Dieselbe Regel wie in Step 6 gilt auch hier:** der Selbst-Check läuft bei jeder erneut gezeigten Liste, und ein Nudge, der einen geblockten/falschsprachigen Tag vorschlägt, wird nicht ungeprüft übernommen.
5. Nach Bestätigung:
   ```
   bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh PUT /api/niches/config/<niche_id> '{"tiktok_hashtags":["..."],"instagram_hashtags":["..."],"youtube_search_queries":["..."]}'
   ```
6. **Read-back** — per erneutem `GET` auf die Niche oder einfach anhand der `PUT`-Antwort, je nachdem was sauber zurückkommt — und bestätigen, dass die neuen Werte angekommen sind.
7. **Ehrlich sagen:** ein Config-Update scrapt NICHT von selbst — die alten, bereits gescrapten Videos bleiben stehen. Einen frischen Scrape anbieten (→ `scrape-now`), damit die besseren Tags wirken.

→ Weiter mit dem Next-Steps-Block (Step 9). (Ein reiner Re-Ableiten-Lauf berührt Step 8/Cockpit nicht — es gibt nichts neu zu generieren.)

---

## Step 8 — Cockpit + erster Scrape (Abschluss)

Cockpit generieren, damit der Nutzer selbst im Cold-Start-Zustand auf dem Artifact landet:

```
if command -v bun >/dev/null 2>&1; then bun ${CLAUDE_PLUGIN_ROOT}/skills/cockpit/scripts/cockpit.ts <workspace_root>; else node --experimental-strip-types ${CLAUDE_PLUGIN_ROOT}/skills/cockpit/scripts/cockpit.ts <workspace_root>; fi
```

Eine frische Niche hat noch keine Trends — ehrlich sagen:

> "Eingerichtet ✅ — dein Cockpit ist da. Noch keine Trends drin: die erscheinen nach deinem ersten Scrape."

Dann den ersten Scrape anbieten:

```
Willst du gleich deinen ersten Scrape starten?

1) 🔥 Ja, jetzt scrapen   → ich starte den `scrape-now`-Befehl
2) Später — erstmal nur das Cockpit ansehen
```

- **Option 1** → route to the `scrape-now` skill (zeigt eine Kostenschätzung, fragt nach Bestätigung, scrapt dann über den Apify-Connector). Nach ~1–2 Min erscheinen die Trends im Cockpit.
- **Option 2** → fertig; der Nutzer kann jederzeit "jetzt scrapen" sagen.

---

## Step 9 — Niche umbenennen/trennen + Next-Steps-Auswahlblock (Abschluss)

*(Einstieg: über Step 3's ✏️-Escape, oder jederzeit auf Zuruf.)*

**Umbenennen** — nur der Anzeigename, der `niche_id`-Slug ist unveränderlich:

```
bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh PUT /api/niches/config/<niche_id> '{"display_name":"<neuer Name>"}'
```

**Von einem Avatar trennen** (falls die Niche mehrere Avatare hat, zuerst auswählen lassen, von welchem):

```
bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh DELETE /api/personas/<persona_id>/niches/<niche_id>
```

- **204** → die Niche hat noch andere Avatare (nur die Verknüpfung entfernt, Daten bleiben erhalten).
- **409 `last_avatar`** → es ist der letzte Avatar der Niche. NUR nach expliziter Nutzer-Bestätigung erneut aufrufen, mit `?confirm_delete=true`:
  ```
  bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh DELETE "/api/personas/<persona_id>/niches/<niche_id>?confirm_delete=true"
  ```
  Das löscht die Niche inklusive ihrer Trends/Videos/Zeitpläne/Jobs und liefert **`200 {"status":"deleted", ...}`** zurück (kein 204). Kann selbst nochmal **409** liefern, wenn gerade ein Scrape aktiv läuft — dann dem Nutzer sagen, kurz zu warten und es erneut zu versuchen.

**Es gibt keinen eigenständigen „Niche direkt anlegen"-Pfad mehr** — jede Niche entsteht ausschließlich über einen Avatar (Step 4/4a → 5 → 6).

**Next-Steps-Auswahlblock (einmal, ganz am Ende der gesamten Antwort):** Erst jetzt — nach Abschluss von Step 6, 7 oder 8, ganz am Schluss — den interaktiven Auswahlblock aus `${CLAUDE_PLUGIN_ROOT}/reference/next-steps.md` zeigen. Die einzelnen nummerierten Schritt-Auswahlen oben führen durch den Flow; der große Next-Steps-Block kommt NICHT nach jedem Schritt, sondern nur dieses eine Mal. Markiere genau eine Option als ⭐ Empfehlung (frisch eingerichtet, noch kein Scrape → in der Regel 🔥 „Jetzt scrapen").

---

## 24/7-Automatik (optional, später)

Im Default-Onboarding nicht nötig — nur falls die Kundin später automatische Scrapes im Hintergrund will (auch wenn Cowork zu ist):

1. Einen Apify-Token im Backend hinterlegen: `bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh POST /api/tenant/settings '{"apify_api_key":"<token>"}'` (erwartet `{"ok": true}`). Danach `"backend_apify_token_deposited": true` in `{workspace}/.trendfinder/config.json` ergänzen (bestehende Schlüssel behalten) — der `scheduler`-Skill liest diesen Marker, bevor er Zeitpläne aktiviert.
2. Dann einen Zeitplan anlegen — am einfachsten über den **`scheduler`-Skill** ("stell einen Zeitplan ein"). Er erstellt den Schedule und erklärt die Apify-Kosten.

**Ohne hinterlegten Token schlägt jeder geplante Lauf serverseitig fehl** (kein Fallback auf einen Operator-Key) — deshalb niemals einen aktiven Zeitplan ohne Token anlegen.

On-demand-Scrapes (`scrape-now`) brauchen das alles NICHT — der Connector aus Step 2 reicht. Erwähne diesen Block nur, wenn die Kundin nach automatischem/24-7-Scraping fragt.

---

## Done means

- `{workspace}/.trendfinder/config.json` vorhanden, `GET /health` liefert 200 (First-Run-Zweig, Step 0/1/2).
- Mindestens ein Avatar (Marke + Persona, per Read-back bestätigt) angelegt ODER ein bestehender um eine Niche erweitert.
- Jede Niche über den Attach-Endpunkt angelegt, mit nicht-leeren, abgeleiteten und bestätigten Themen (Read-back).
- Das DNA-Embed-Ergebnis ehrlich berichtet (200 embedded / 503 not-configured-still-usable / 400 no-DNA).
- Cockpit regeneriert (bei Avatar-/Niche-Erstellung) bzw. Niche-Config aktualisiert (bei Re-Ableiten); erster Scrape angeboten.
- **Keine handgetippten Hashtags irgendwo im Flow.**
- **Kein direkter Niche-Anlege-Pfad verwendet** — jede Niche kam über einen Avatar rein.
- Kein API-Key ausgegeben oder committet; Temp-Dateien (`mktemp`) nach jedem Schreiben aufgeräumt.
- No backend Apify token or schedule is required for onboarding to count as complete — those are the optional 24/7 add-on.
- No firm data written inside the plugin directory; all persistent state lives in `{workspace}/.trendfinder/`.

Niemals eine Niche-/Persona-/Marken-ID erfinden. Bei Unsicherheit erneut über die API nachfragen statt zu raten.
