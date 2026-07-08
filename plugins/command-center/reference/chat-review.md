# Chat-Review — Freigeben, Bearbeiten, Nochmal, Ablehnen im Chat

Das Dashboard ist **reine Übersicht** (read-only). Die eigentliche Freigabe-Interaktion läuft im **Chat**: die KI legt die vorbereiteten Posten vor, du antwortest in normaler Sprache, die KI führt aus. Nur die Apply-Engine (`_firma/apply.py`, kanonisch) bewegt am Ende Dateien — und nur auf deinen ausdrücklichen Zuruf.

Dieser Vertrag beschreibt, wie die `dashboard`-Skill natürliche Sprache auf Aktionen abbildet. Queue-Format: `reference/review-queue.md`. Engine: `_firma/apply.py` (kanonisch; `apply.ts` optional).

---

## Einstieg — offene Freigaben zeigen

Trigger: „zeig offene Freigaben", „was liegt zur Freigabe", „freigaben", „review", oder direkt nach einem Sammellauf, der etwas vorbereitet hat.

```
python3 <workspace_root>/_firma/apply.py <workspace_root> list
```

Gibt JSON zurück: `{ ok, stand, total, ns, np, nf, groups[] }` — offene Queues, gruppiert pro Prozess. Lege es **pro Prozess** vor, jeden Posten **nummeriert**, mit:
- den VORSCHLAG-Feldern aus `values` (z. B. `lieferant`, `betrag`, `kategorie`, `entity`, `nummer`),
- der BEGRÜNDUNG (`reason`),
- der Stufe: `sicher` / `prüfen` / `folgenreich`,
- Zielordner(n) (`targets`) und Dateiname (`filename`).

Halte die Vorlage kurz und menschlich; nenne `runid` + `id` nur, wenn nötig (du brauchst sie intern für die Befehle).

---

## Die vier Intents

### 1. Annehmen / Freigeben
Phrasen: „Beleg 2 passt", „nimm 2 an", „freigeben", „alle sicheren freigeben", „passt alles".

```
# einen Posten:
python3 <workspace_root>/_firma/apply.py <workspace_root> approve <runid> <id>
# alle (oder gelistete) Posten EINES Laufs in einem Engine-Start (Prozess-Freigabe):
python3 <workspace_root>/_firma/apply.py <workspace_root> approve-run <runid> [id …]
# alle sicher-Posten über alle offenen Queues:
python3 <workspace_root>/_firma/apply.py <workspace_root> approve-safe
# Nutzer hat die Datei selbst kopiert (langsames Ziel): Größe+md5 prüfen + journalen:
python3 <workspace_root>/_firma/apply.py <workspace_root> manual-confirm <runid> <id>
# Vorschau ohne Schreiben:
python3 <workspace_root>/_firma/apply.py <workspace_root> approve <runid> <id> --dry
```

`approve`/`approve-run` kopiert kollisionssicher in **jeden** Zielordner und schreibt eine umkehrbare Journal-Zeile. `prüfen`/`folgenreich` immer einzeln bestätigen (bei der Prozess-Freigabe zählt der Board-Klick als Bestätigung der verbliebenen Karten); `approve-safe` nur für `sicher`. **Dies ist der einzige Schritt, der Dateien bewegt.**

### 2. Bearbeiten (voll) — Feld, Ziel oder Dateiname korrigieren
Phrasen: „bei 3 die Kategorie auf Kfz", „Lieferant ist eigentlich Müller GmbH", „leg das nach 05-26/Ausgaben", „nenn die Datei … ", „Betrag stimmt nicht, 476,00 EUR".

Editieren heißt: die betroffene Aktion **in ihrer Queue-Datei** `_firma/_review/R-…json` patchen — **kein** Datei-Move. Vorgehen:
1. Queue-Datei zur `runid` öffnen, die Aktion per `id` finden.
2. Felder ändern, je nach Wunsch:
   - **Wert** → in `values` (z. B. `kategorie`, `lieferant`, `betrag`, `nummer`, `entity`).
   - **Zielordner** → `targets` (Array workspace-relativer Ordner). Muss **innerhalb des Workspace** bleiben.
   - **Dateiname** → `filename` (Zielname; Endung beibehalten).
   - Wenn ein „prüfen"-Grund dadurch ausgeräumt ist, darf `tier` auf `sicher` und `confidence` entfernt werden — nur wenn wirklich geklärt.
3. `reason` knapp ergänzen („vom Nutzer korrigiert: …").
4. Auf Queue-Ebene `rechecked` auf jetzt (ISO 8601) setzen.
5. Korrigierten Vorschlag **erneut vorlegen**.
6. Best-effort einen `correction`-Signal anhängen (`reference/signals.md`), z. B. `{type:"correction", key:"receipt:unknown-vendor", detail:"<vendor>"}`.

Erst **freigeben**, wenn der Nutzer danach „passt / freigeben" sagt. Editieren allein bewegt nie etwas. Queue gültig halten (Schema: `reference/review-queue.md`); keine engine-fremden Felder erfinden.

### 3. Nochmal (KI neu rechnen)
Phrasen: „rechne 5 nochmal", „das Datum stimmt nicht, schau nochmal", „neu prüfen", „die Zuordnung ist falsch".

Die KI hat sich beim Lesen/Zuordnen geirrt — neu analysieren statt von Hand patchen:
1. Aus der Aktion den `source`-Pfad nehmen (eine Datei).
2. Den **zuständigen Prozess-Skill** (`process` der Queue) **nur auf diese eine Quelle** im Vorbereiten-Modus laufen lassen.
3. Das Ergebnis ersetzt die alte Aktion **an Ort und Stelle** (gleiche `id`), `values`/`reason`/`tier`/`filename`/`targets` neu; Queue-`rechecked` setzen.
4. Den frischen Vorschlag vorlegen. Nichts wurde bewegt.

Bei wiederkehrenden Fehlklassen best-effort `recurring_check`-Signal anhängen.

### 4. Ablehnen
Phrasen: „4 raus", „lehn das ab", „brauch ich nicht", „verwerfen".

```
python3 <workspace_root>/_firma/apply.py <workspace_root> reject <runid> <id>
```

Entfernt die Aktion aus der Queue; kopiert nichts. Die Quelldatei im Eingang bleibt unangetastet (und steht in `seen-<prozess>.json`, wird also nicht erneut eingereiht — sag dem Nutzer das, falls er sie doch neu verarbeiten will: dann Eintrag aus `seen` entfernen).

---

## Nach jeder Aktion
In klarem Deutsch **kurz im Chat** berichten: was wohin abgelegt, was korrigiert, was abgelehnt wurde — plus der neue Offen-Zähler (steht in der `apply.py`-Ausgabe, kein Extra-Lauf nötig).

**Das Dashboard-Artefakt NICHT nach jeder Aktion neu erzeugen** — das kostet pro Posten einen vollen Generator+Artifact-Roundtrip und bremst die Review-Session spürbar. Es veraltet auch nicht: der Generator rechnet beim Rendern frisch aus den Logs. Erst **am Ende der Review-Session** (oder wenn der Nutzer das Dashboard sehen will) einmal:

```
bun ${CLAUDE_PLUGIN_ROOT}/skills/dashboard/scripts/dashboard.ts <workspace_root>
```

(Ohne bun — z. B. Windows: `node …/dashboard.ts <workspace_root>`, Node ≥ 22.6.) Leert sich eine Queue vollständig, verschiebt die Engine sie nach `_firma/_review/_erledigt/`.

## Phrasen → Intent (Schnellreferenz)

| Nutzer sagt … | Intent |
|---|---|
| „passt", „freigeben", „nimm 2", „alle sicheren" | **Annehmen** (`approve` / `approve-safe`) |
| „Kategorie/Lieferant/Betrag/Ziel/Name ändern" | **Bearbeiten** (Queue patchen) |
| „nochmal", „neu rechnen", „schau nochmal", „falsch gelesen" | **Nochmal** (Skill auf die Quelle neu) |
| „raus", „ablehnen", „verwerfen" | **Ablehnen** (`reject`) |

## Rollen-Firewall (unverändert)
- **Skill / Chat** darf: Queues lesen, Queue-Aktionen patchen (Bearbeiten/Nochmal), `rechecked` setzen, Signale anhängen, und auf Nutzer-Zuruf die Engine-Befehle `approve`/`approve-run`/`reject`/`approve-safe`/`manual-confirm` aufrufen.
- **Apply-Engine** darf: Dateien kollisionssicher kopieren, Journal schreiben, leere Queues archivieren. Sie verweigert jede Quelle/jedes Ziel außerhalb des Workspace.
- **Dashboard & Sammel-Task** dürfen **nie** `approve` auslösen. Anwenden ist immer eine bewusste menschliche Handlung im Chat.
