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
(kanonische Workspace-Engine — reines Python3, immer vorhanden; die **einzige**, die freigeben kann. `bun ${CLAUDE_PLUGIN_ROOT}/skills/dashboard/scripts/apply.ts` ist nur ein Read-only-Lister. Fehlt `_firma/apply.py`, richte es per `firm-onboarding` Step 2b ein.)
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
Nur für den aktuellen Prozess: pro Posten die Output-Vorschau unter `_firma/_review/_preview/` erzeugen (Vorschau-Ort, nicht final), damit die **Ergebnis**-Box eine echte, korrekt benannte Datei hat: daily-report → DOCX (+optional PDF); receipt-filing → korrekt benannte/aufbereitete Datei (JPEG-„PDF" → echtes PDF); invoicing → XLSX. **Quelle** = `source` aus `_eingang/`.

**Keine Doppelkopie für unveränderte Dateien.** Eine Vorschau-Datei wird NUR erzeugt, wenn das Ergebnis inhaltlich **transformiert** ist (DOCX/XLSX erzeugt, PDF konvertiert, Beleg aufbereitet). Bei reinem **Umbenennen/Kopieren** — photo-sorting Modus A und Modus B (Bericht-Scans), unveränderte Beleg-PDFs — ist die „Vorschau" byte-identisch mit der Quelle: dann **keine** Kopie nach `_preview/` schreiben, sondern die **Quelldatei direkt** als Ergebnis-Box präsentieren (`present_files` mit `source`); der Zielname steht auf der Karte (`filename`). Auf langsamen Netz-Workspaces ist das Preview-Duplikat großer Fotos sonst der teuerste Einzelschritt des ganzen Laufs — und bei der Freigabe wird dieselbe Datei ein zweites Mal kopiert.

## Step 4 — Aktueller Prozess: pro Posten Karte + Boxen darunter
Für JEDEN Posten des aktuellen Prozesses, in Reihenfolge:
1. **Volle editierbare Karte** (visualize `show_widget`; `read_me` `interactive` einmal vorab) — siehe `${CLAUDE_PLUGIN_ROOT}/skills/review-board/reference/board-ui.md`. Sie zeigt **alle** Infos und macht sie **bearbeitbar**:
   - **Dateiname** (`filename`), **Speicherort/Ziel** (`targets` — wohin gespeichert wird), die typrelevanten **Werte** (`values`: Belege `lieferant,nummer,datum,betrag,belegtyp,kategorie,entity`; Fotos `standort,datum,taetigkeit`; Bericht-Scans `jahr,kw,bv,monteure,suffix`; Bericht `projekt,kw`), **Begründung** (`reason`), **Stufe**-Badge.
   - Buttons: **„Übernehmen"** (schickt geänderte Felder) und **„Ablehnen"**.
2. **Direkt darunter** die nativen Boxen via EIN `present_files`-Aufruf für diesen Posten: `present_files([ <_firma/_review/_preview/Ergebnis>, <source Quelle> ])` → 1–2 klickbare Boxen, Klick öffnet rechts in der Sidebar. Nur Quelle, wenn kein Ergebnis.

Nach allen Posten des Prozesses **ein** kleines Freigabe-Widget: **„Freigeben — <Prozess> speichern (<N>)"** (+ Zeile „bei Bedarf einzelne oben mit Ablehnen rausnehmen").

## Step 5 — Intents
- **Bearbeiten**: `bearbeite <runid> <id>: <feld>=<wert>; …` → Aktion in der Queue patchen (`filename`/`targets`/`values`), `rechecked` setzen, nichts bewegen. **Round-Trip-Pflicht:** nach dem Schreiben die Queue-Datei sofort erneut vollständig einlesen und `json.load`-Validität bestätigen — erst dann die Karte als „gespeichert" melden (Netzlaufwerke können kurzzeitig einen abgeschnittenen Zwischenstand liefern). Betroffene Karte neu rendern.
- **Ablehnen**: `lehne ab: <runid> <id>` → `python3 <workspace_root>/_firma/apply.py <workspace_root> reject <runid> <id>`; Karte verschwindet.
- **Prozess freigeben (Hauptklick)**: `freigeben prozess <process>` → **alle verbliebenen** Posten dieses Prozesses in EINEM Engine-Lauf speichern (Step 6, `approve-run`), Queue archivieren, dann **sofort den nächsten offenen Prozess** rendern (zurück zu Step 3). Gibt es keinen mehr → Abschluss-Zusammenfassung.
- **Manuell erledigt**: `manuell erledigt: <runid> <id>` → `python3 <workspace_root>/_firma/apply.py <workspace_root> manual-confirm <runid> <id>`. Für den Fall, dass der Nutzer die Datei selbst kopiert hat (z. B. strukturell langsames Ziel): die Engine prüft Größe+md5 am Ziel, journaled `copied-manually` und räumt die Karte ab — kein improvisiertes Journal-Nachtragen mehr.
- Vorschau passiert in den nativen Boxen (kein Chat).

## Step 6 — Speichern (beim Prozess-Freigeben): N:/S: wenn verbunden, sonst Workspace
Je Posten echtes Ziel auflösen (`targets`/Entscheidungsbaum): N:/S: als Cowork-Ordner **verbunden** → kollisionssicher dorthin; sonst `_ausgang/<prozess>/` (kollisionssicher) + vorgesehenen N:/S:-Pfad nennen (und `values.zielpfad_vorgesehen`). Immer: Original unangetastet, umkehrbare **Journal-Zeile**, Aktion aus Queue, leere Queue → `_firma/_review/_erledigt/`, Activity-Log `status: done` (gleiche `run_id`). Die Freigabe eines Prozesses läuft über **einen** Batch-Aufruf `python3 <workspace_root>/_firma/apply.py <workspace_root> approve-run <runid>` (statt N Einzel-`approve`-Prozessstarts — jeder Start scannt Journal + Configs übers Laufwerk neu); Einzelfälle weiter über `approve <runid> <id>`. Die Engine ist **md5-idempotent** (identische Datei wird nie als `_2` geklont, Status `skipped-identical`), **journal-geschützt**, **atomar** und schreibt **verifiziert** (Chunks → `.part` → Größencheck → Umbenennen; nie eine halbfertige Datei unter finalem Namen); sie räumt zudem die Vorschau-/Staging-Dateien des `runid` auf. Verbundene Fremdlaufwerke (N:/S:) direkt kopieren + gleiche Journal-Zeile.

**Große Dateien: Engine im Hintergrund laufen lassen.** Enthält der Prozess große Dateien (Fotos/Scans, grob >200 KB — auf Netz-Workspaces 40–90 s pro Datei), den `approve-run` **im Hintergrund** starten (Ausführung mit run_in_background/`&`), NICHT synchron im Vordergrund warten — 8 Fotos sprengen sonst jedes Ausführungsfenster. Ergebnis danach über das stdout-JSON bzw. die Journal-Zeilen des `runid` kontrollieren. Ein trotzdem abgebrochener Lauf ist harmlos: die Engine setzt fertige `.part`-Dateien beim nächsten Anlauf per Resume in Sekunden um, statt neu zu kopieren.

**Fail-fast statt Retry-Schleife.** Schlägt ein Kopiervorgang fehl (Timeout, `error` im Engine-Ergebnis), **nicht** automatisch wiederholen: genau EIN Wiederholungsversuch ist erlaubt (der dank `.part`-Resume meist nur noch das Umbenennen nachholt); danach dem Nutzer sofort den „Manuell erledigt"-Pfad anbieten (Quelle + Zielpfad nennen, Nutzer kopiert selbst, dann `manual-confirm`). Wiederholte automatische Kopierversuche auf ein strukturell langsames Ziel verbrennen nur Sitzungszeit.

**Externe Zielwünsche → Ordner verbinden anbieten.** Nennt der Nutzer beim Bearbeiten ein Ziel außerhalb des verbundenen Workspace (Engine-Ergebnis `fallback`/`skipped-unsafe` bzw. Pfad außerhalb), nicht nur still nach `_ausgang/` ausweichen: **einmal aktiv anbieten**, den übergeordneten Ordner zusätzlich mit Cowork zu verbinden (`request_cowork_directory`) und den Pfad in `_firma/config/<prozess>.json` unter `output_paths` einzutragen — analog zur Lernschleife für Stammdaten.

**Lernschleife (Fakt → Stammdaten).** Trug ein gerade freigegebener Posten einen `fact:`-Hinweis (neue Baustelle/neuer Lieferant, „nicht in Stammdaten"), frag **einmal** kompakt: „Als feste Stammdaten übernehmen?" Bei Ja in `stammdaten/projekte.json` bzw. `lieferanten.json` schreiben und das `fact`-Signal als bestätigt markieren. Das schließt die Schleife — derselbe Fall ist künftig `sicher` statt `prüfen`.

Danach den nächsten offenen Prozess zeigen.

## Robustheit & Firewall
`present_files` für eine Datei nicht möglich → Pfad als Klartext. `show_widget` nicht renderbar → getippte Chat-Review (`${CLAUDE_PLUGIN_ROOT}/reference/chat-review.md`), gleiche Engine. Gespeichert wird nur auf **deinen** „Freigeben (Prozess)"-Klick — nie durch Hintergrund/Sammel-Task. Editieren/Ablehnen ändert nur die Queue.
