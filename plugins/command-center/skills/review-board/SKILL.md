---
name: review-board
description: Sequential, process-by-process review of prepared Command Center work. The firm drops everything at once and intake prepares ALL processes together; this board then reviews them ONE process at a time. For the current process it shows, per item, a rich editable card (Dateiname, Speicherort/Ziel, alle Werte, Begründung, Stufe — all editable) and, directly beneath it, native clickable file boxes (Cowork present_files) that open the Ergebnis (output) and Quelle (input) in Claude Cowork's right sidebar. One "Freigeben (Prozess)" click saves that process's items and immediately shows the next process. Use after intake/a Sammellauf, or when the user says "Review-Board", "freigaben", "zeig offene Freigaben", "was liegt zur Freigabe", "freigeben". Saves to N:/S: if connected, else the workspace _ausgang with the intended path noted. Never saves on its own.
---

# Review-Board — ein Prozess nach dem anderen

Alles wird **gemeinsam** vorbereitet (intake), aber **nacheinander** freigegeben: Belege, dann Fotos, dann Tagesbericht … Pro Posten eine **vollständige, editierbare** Karte und **darunter** die nativen Datei-Boxen (📄 Ergebnis + 📎 Quelle), die direkt in Coworks rechter Sidebar öffnen. Read `${CLAUDE_PLUGIN_ROOT}/reference/review-queue.md` + `${CLAUDE_PLUGIN_ROOT}/reference/chat-review.md`.

## Step 1 — Offene Posten laden + Reihenfolge
```
python3 <workspace_root>/_firma/apply.py <workspace_root> list
```
(kanonische Workspace-Engine — reines Python3, immer vorhanden. `bun ${CLAUDE_PLUGIN_ROOT}/skills/dashboard/scripts/apply.ts` nur als Option. Fehlt `_firma/apply.py`, richte es per `firm-onboarding` Step 2b ein.)
Bestimme die offenen Prozesse und ihre Reihenfolge aus `${CLAUDE_PLUGIN_ROOT}/reference/workflows.json` (`order`: receipt-filing → photo-sorting → daily-report → invoicing). Der **erste** offene Prozess ist „dran".

## Step 2 — Kurz Bescheid geben + sichere Posten anbieten
Biete einmal an: **„Alle eindeutig sicheren Posten sofort freigeben?"** Wenn ja:
```
python3 <workspace_root>/_firma/apply.py <workspace_root> approve-safe
```
(speichert alle `sicher`-Posten über alle offenen Queues; `prüfen`/`folgenreich` bleiben). Den Rest dann Prozess für Prozess prüfen.

### Bescheid geben
Beim Einstieg (direkt nach intake) eine knappe Klartext-Nachricht: was insgesamt vorbereitet wurde (z. B. „3 Belege, 4 Fotos, 1 Tagesbericht — fertig vorbereitet") und dass ihr **Prozess für Prozess** durchgeht. Dann mit dem ersten Prozess starten. (Eine echte Push-Benachrichtigung gibt es nicht; diese Chat-Nachricht ist der Hinweis.)

## Step 3 — Ergebnis-Vorschaudatei je Posten des AKTUELLEN Prozesses
Nur für den aktuellen Prozess: pro Posten die Output-Vorschau unter `_firma/_review/_preview/` erzeugen (Vorschau-Ort, nicht final), damit die **Ergebnis**-Box eine echte, korrekt benannte Datei hat: daily-report → DOCX (+optional PDF); receipt-filing → korrekt benannte/aufbereitete Datei (JPEG-„PDF" → echtes PDF); photo-sorting → Foto unter Zielnamen; invoicing → XLSX. **Quelle** = `source` aus `_eingang/`.

## Step 4 — Aktueller Prozess: pro Posten Karte + Boxen darunter
Für JEDEN Posten des aktuellen Prozesses, in Reihenfolge:
1. **Volle editierbare Karte** (visualize `show_widget`; `read_me` `interactive` einmal vorab) — siehe `${CLAUDE_PLUGIN_ROOT}/skills/review-board/reference/board-ui.md`. Sie zeigt **alle** Infos und macht sie **bearbeitbar**:
   - **Dateiname** (`filename`), **Speicherort/Ziel** (`targets` — wohin gespeichert wird), die typrelevanten **Werte** (`values`: Belege `lieferant,nummer,datum,betrag,belegtyp,kategorie,entity`; Fotos `standort,datum,taetigkeit`; Montagebericht-Scans `jahr,kw,bv,monteure`; Bericht `projekt,kw`), **Begründung** (`reason`), **Stufe**-Badge.
   - Buttons: **„Übernehmen"** (schickt geänderte Felder) und **„Ablehnen"**.
2. **Direkt darunter** die nativen Boxen via EIN `present_files`-Aufruf für diesen Posten: `present_files([ <_firma/_review/_preview/Ergebnis>, <source Quelle> ])` → 1–2 klickbare Boxen, Klick öffnet rechts in der Sidebar. Nur Quelle, wenn kein Ergebnis.

Nach allen Posten des Prozesses **ein** kleines Freigabe-Widget: **„Freigeben — <Prozess> speichern (<N>)"** (+ Zeile „bei Bedarf einzelne oben mit Ablehnen rausnehmen").

## Step 5 — Intents
- **Bearbeiten**: `bearbeite <runid> <id>: <feld>=<wert>; …` → Aktion in der Queue patchen (`filename`/`targets`/`values`), `rechecked` setzen, nichts bewegen. Betroffene Karte neu rendern.
- **Ablehnen**: `lehne ab: <runid> <id>` → `apply.ts reject`; Karte verschwindet.
- **Prozess freigeben (Hauptklick)**: `freigeben prozess <process>` → **alle verbliebenen** Posten dieses Prozesses speichern (Step 6), Queue archivieren, dann **sofort den nächsten offenen Prozess** rendern (zurück zu Step 3). Gibt es keinen mehr → Abschluss-Zusammenfassung.
- Vorschau passiert in den nativen Boxen (kein Chat).

## Step 6 — Speichern (beim Prozess-Freigeben): N:/S: wenn verbunden, sonst Workspace
Je Posten echtes Ziel auflösen (`targets`/Entscheidungsbaum): N:/S: als Cowork-Ordner **verbunden** → kollisionssicher dorthin; sonst `_ausgang/<prozess>/` (kollisionssicher) + vorgesehenen N:/S:-Pfad nennen (und `values.zielpfad_vorgesehen`). Immer: Original unangetastet, umkehrbare **Journal-Zeile**, Aktion aus Queue, leere Queue → `_firma/_review/_erledigt/`, Activity-Log `status: done` (gleiche `run_id`). Workspace-interne Ziele über `python3 <workspace_root>/_firma/apply.py <workspace_root> approve <runid> <id>` — die Engine ist **md5-idempotent** (identische Datei wird nie als `_2` geklont, Status `skipped-identical`), **journal-geschützt** und **atomar**; sie räumt zudem die Vorschau-/Staging-Dateien des `runid` auf. Verbundene Fremdlaufwerke (N:/S:) direkt kopieren + gleiche Journal-Zeile.

**Lernschleife (Fakt → Stammdaten).** Trug ein gerade freigegebener Posten einen `fact:`-Hinweis (neue Baustelle/neuer Lieferant, „nicht in Stammdaten"), frag **einmal** kompakt: „Als feste Stammdaten übernehmen?" Bei Ja in `stammdaten/projekte.json` bzw. `lieferanten.json` schreiben und das `fact`-Signal als bestätigt markieren. Das schließt die Schleife — derselbe Fall ist künftig `sicher` statt `prüfen`.

Danach den nächsten offenen Prozess zeigen.

## Robustheit & Firewall
`present_files` für eine Datei nicht möglich → Pfad als Klartext. `show_widget` nicht renderbar → getippte Chat-Review (`${CLAUDE_PLUGIN_ROOT}/reference/chat-review.md`), gleiche Engine. Gespeichert wird nur auf **deinen** „Freigeben (Prozess)"-Klick — nie durch Hintergrund/Sammel-Task. Editieren/Ablehnen ändert nur die Queue.
