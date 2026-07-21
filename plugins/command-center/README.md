# Command Center — Cowork plugin

Turn any firm into a Cowork-automated operation. Onboard the company **once**, and every business process runs in plain language inside Claude Cowork — and can be put on a schedule.

This is the productized version of the Command Center skeleton: a generic plugin that any firm installs and stands up itself, in chat, with no developer work.

## How it works (onboard once, then run, then watch)

00. **Geführter Rundgang für Erstnutzer** (`guided-setup` skill / `/command-center:start`) — wer Cowork/KI zum ersten Mal nutzt, wird **einmal warm durch alles** geführt: kurze Cowork-Grundlagen (Chat = Bedienung, Ordner = Aktenschrank, reinwerfen/freigeben/Dashboard), dann die Firmen-Einrichtung, dann ein **echter Probelauf** mit einem Beispiel-Beleg (reinlegen → „verarbeite alles" → im Chat freigeben → Ergebnis → Dashboard). Am Ende kennt der Nutzer alle Funktionen — weil er sie einmal selbst gemacht hat. Erklären durch Tun; jederzeit überspringbar.

0. **Alles reinwerfen** (`intake` skill) — der Alltagsweg: leg jede Datei (Belege, Fotos, Tagesbericht — gemischt) in den **einen** Eingang `_eingang/` und sag „verarbeite alles". Die intake-Skill erkennt jeden Typ selbst, fragt nur das Nötige und öffnet ein interaktives Review-Board.

1. **Firm onboarding** (`firm-onboarding` skill / `/command-center:setup`)
   A friendly chat interview collects everything about the firm — identity, locations, team, tools, bank, accounting, file conventions, which processes they run. It then scaffolds a standardized workspace folder structure and writes one `company-context.md` that gives Cowork 100% context. Every process reads this.

2. **Process skills** — one per business process, each self-contained
   - `invoicing` — pro-forma invoices from timesheets (deterministic money math); optional **Montagebau/Service-Report-Preset** (`reference/montagebau-preset.md`) for firms billing skilled-trade crews — separate Montage-/Fahrt-Sätze, independent Sa-/So-Zuschlag, per-vehicle Geräte-Abrechnung
   - `daily-report` — fill the firm's daily/weekly report template
   - `photo-sorting` — rename + file site/job photos by date and activity (verbatim from the Bautagesbericht when one exists); Modus B archives scanned Montage-/Serviceberichte as `JJJJ KWnn BV V.Nachname …` into `KWnn` folders
   - `receipt-filing` — read receipts/invoices and file them to the right folders
   - `intake` — one shared inbox; auto-detects each file's type and routes it to the right process above
   - `review-board` — interactive cards (preview + editable fields), collect approvals, save in one click
   Each one onboards itself the first time you use it (asking only its own questions), then runs on demand.

3. **Automation** (`reference/automation.md`)
   Put any process on a Cowork schedule (`/schedule`). Honest about the limits: Cowork scheduled tasks only run while the app is open and the machine is awake, and consequential writes always pause for your approval.

4. **Dashboard** (`dashboard` skill / `/command-center:dashboard`)
   A live overview — generated as a Cowork **Live Artifact** — showing how much time the firm has saved, every workflow *with plain steps for how it works*, what's already been done, and the one recommended next step. Built for someone using AI for the first time: it answers „bringt das was?", „was kann es?" and „was mache ich jetzt?" at a glance. Refresh anytime with *"zeig das Dashboard"*.

## Install (in Claude Cowork or Claude Code)

```
/plugin marketplace add ~/cowork-marketplace      # or: add from the GitHub repo
/plugin install command-center@command-center
```

Then, in the firm's Cowork workspace:

```
/command-center:setup
```

…or just say *"richte mein Command Center ein"* / *"set up my command center"*.

**Runtime requirements (honest):** the review/apply path needs only **Python 3** — `_firma/apply.py` is pure stdlib and the **only** engine that applies approvals. The TypeScript helpers (`dashboard.ts`, `compute.ts`, and the read-only lister `apply.ts`) are written for **bun**, but plain **Node ≥ 22.6** runs them too (Node 24 executes `.ts` directly: `node skills/dashboard/scripts/dashboard.ts …`) — bun is not required on Windows.

## How it's built (for the operator/developer)

- **Skill-first.** Most processes are SKILL.md instructions + bundled reference rules + templates, using Cowork's native abilities (vision, docx/xlsx/pdf, file ops). Determinism is reserved for money/legal math — `invoicing` ships a `compute.ts` helper and the skill is forbidden from doing the arithmetic itself.
- **Context is the product.** `company-context.md` is the single firm-level source of truth; each process keeps its own `config/<process>.json`. Process config may only *add* to the firm context, never restate it.
- **Firm-agnostic.** Galant is just firm #1 — no client data is hardcoded here. Master-data registers (sites/people/vendors) are optional; processes fall back to manual fields.

See `reference/architecture.md` for the design rationale and the Phase-2 path (per-process deterministic engines + MCP, the way `jan-kapitalfluss` does it).

## Status

**v0.16.1 — Nummerierung nach der Auswahl (lückenlos).** `lfd` wird erst über die GEWÄHLTEN Bilder vergeben: je Tätigkeit lückenlos ab 1, chronologisch; bei vorhandenen Bildern derselben Tätigkeit im Ziel ab der nächsten freien Nummer (kollisionssicher, nie Lücken wie „3, 9, 14" aus der Zuordnungszählung).

**v0.16.0 — photo-sorting: Best-5-Auswahl je Tätigkeit (Arbeiter fotografieren zu viel).** Weiterhin werden ALLE Fotos eines Stapels gesichtet und zugeordnet (Wortliste/Steckbriefe unverändert) — ausgegeben werden aber je Bericht-Tätigkeit nur noch die besten `max_bilder_je_taetigkeit` (Default **5**, `0` = aus; nur Modus A, Bericht-Scans nie gedeckelt). Auswahl-Rangfolge in `rules.md` §B4: sichere Zuordnung > Aussagekraft (Arbeit als dominantes Motiv) > Vielfalt (verschiedene Phasen/Perspektiven; aus Serien/Dubletten höchstens eine) — nie mit unsicheren auffüllen, mindestens ein Bild je Tätigkeit. Review zeigt die Quote („5 von 27 gewählt"), Nachlegen/Tauschen auf Zuruf; nicht Gewählte bleiben in der Quelle und wandern in die seen-Liste (kein Wiedereinreihen im Sammellauf).

**v0.15.0 — receipt-filing: Direktablage statt Freigabe-Gate.** Belege werden im selben Lauf geparkt statt zur Freigabe gestoppt: der Skill schreibt die Queue (Audit + Engine-Input, `runid` mit Zeit-Suffix) und führt sie **sofort** über `_firma/apply.py approve-run` aus. `sicher` → direkt in alle Routing-Ziele; `prüfen` (unbekannter Lieferant, unscharfer Betrag, unklares Routing) → in den **Kontrolle-Ordner** (Config-Key `kontrolle`, Default `_ausgang/belege/Kontrolle`) mit Zeile in `Kontrolle-Notizen.md` und vermuteten Endzielen in `values.ziel_vermutung`. Kontrolliert wird **im Ordner** (umbenennen/verschieben; „Beleg X passt → ablegen" legt aus der Kontrolle nach). Gilt auch im stündlichen Sammellauf — die Nicht-verhandelbar-Regel in `reference/automation.md` und der Review-Queue-Vertrag tragen die präzise Ausnahme (nur kopieren, nur Engine, Originale bleiben, nie buchen/zahlen/senden); Activity-Log `status: done`, Intake-Dedupe über `filed-md5.json` bleibt intakt. Rückfall auf das alte Verhalten: `"ablage": "review"` in `config/receipt-filing.json`. Review-Board/intake entsprechend angepasst (Board startet i. d. R. mit Fotos).

**v0.14.1 — photo-sorting: kein stiller Katalog-Fallback im Bericht-Betrieb.** Ist eine `bericht_quelle` konfiguriert und der Bautagesbericht zum Stapel nicht auffindbar, wird gefragt (bzw. im Sammel-Modus als `prüfen` mit Rückfrage eingereiht) statt still mit Katalog-Namen zu benennen — Bericht-Benennung ist dann garantiert die einzige Namensquelle.

**v0.14.0 — photo-sorting: treffsicherer zuordnen + aus Korrekturen lernen (Follow-up zum KW-24-Praxistest, 20.07.2026).** Vier Mechanismen in `skills/photo-sorting/`:
1. **Steckbrief + Indizien-Abgleich** (`rules.md` §B0/§B): Vor dem ersten Foto wird je Bericht-Tätigkeit notiert, woran man sie erkennt (Objekt, Werkzeug-Indizien wie Steinknacker→zuschneiden / Wasserwaage→setzen, Zustand in-Arbeit vs. fertig); pro Foto werden erst die Indizien benannt, dann gegen die Steckbriefe gehalten — „aktive Arbeit schlägt Endzustand".
2. **Bildwörterbuch + Lernschleife** (`reference/bildwoerterbuch.md`, `stammdaten/bildwoerterbuch.json`): firmenspezifische Unterscheidungsmerkmale + Referenzfotos, gespeist aus Review-Korrekturen UND dem neuen **Nachlauf-Abgleich** (Journal-Ziele vs. Ist-Dateinamen — nachträgliche Umbenennungen der Firma werden als stille Korrektur erkannt, nie zurückkorrigiert). Jeder Eintrag geht durch die Freigabe; kein Modell-Training, sondern gepflegte Stammdaten.
3. **Serien-Regel** (§B2): WhatsApp-Bursts (Sekunden-Abstand, gleiches Motiv) erben die Zuordnung des voll geprüften Serien-Ankers — konsistent statt N Einzelentscheidungen.
4. **Dubletten-Hinweis** (§B3): praktisch identische Aufnahmen werden in der Review als Gruppe gekennzeichnet; gelöscht wird nichts.

**v0.13.0 — photo-sorting: Bautagesbericht = geschlossene Tätigkeits-Wortliste (Lernpunkte aus dem Galant-Praxistest, KW-24-Fotostapel, 20.07.2026).** Der Firmentest zeigte Paraphrasen statt Berichtswortlaut („E-Auto Platte verlegt" statt „E-Park Platten verlegt", „Radstopper verlegt" statt „Radstopper eingebaut") — die bisherige „Bautagesbericht zuerst"-Regel war zu weich formuliert. Antwort in `skills/photo-sorting/` (SKILL.md + `reference/rules.md`):
1. **Wochenliste VOR dem ersten Foto:** Tageszeilen der „Ausgeführten Arbeiten" an Kommas in einzelne Tätigkeiten zerlegen, Fortschritts-Marker („begonnen"/„fortgeführt"/„abgeschlossen"/„fertiggestellt") derselben Arbeit zu EINER Tätigkeit mit Tagesspanne verschmelzen, Mengen/Maße streichen — **alle übrigen Wörter exakt wie im Bericht** (Substantiv UND Verb, keine Synonyme). Existiert ein Bericht, ist diese Liste die **einzige** erlaubte Namensquelle; Katalog und freie Vision-Benennung sind tabu.
2. **Dominanz-Regel für unscharfe Fotos:** dominantestes Merkmal bestimmen → am ehesten passende Listen-Tätigkeit. Visuell ähnliche Tätigkeiten (z. B. zwei Sorten länglicher Betonelemente) über Kontext-Merkmale entscheiden, sonst tier `prüfen`; nie einen Namen erfinden.
3. **Foto-Datum ist KEIN Zuordnungskriterium** (Handys senden gesammelt — ein Donnerstags-Foto zeigt oft Dienstags-Arbeit); das Dateinamen-Datum ist der Berichtstag der zugeordneten Tätigkeit (Foto-Tag nur, wenn er in der Spanne liegt).
4. **Abdeckungs-Check in der Review:** Berichts-Tätigkeiten ohne ein einziges Foto werden ausgewiesen — die Bild-Doku soll alle Arbeiten des Berichts wiedergeben.

**v0.12.0 — Pflicht-Bestätigungen statt stiller Defaults (Lernpunkte aus dem ALBA-Referenzrechnungs-Abgleich, 08.07.2026).** Ein Erstentwurf wich 592,26 EUR von der Referenzrechnung ab — verursacht durch drei verschiedene *stille* Annahmen, die alle nur als Fließtext-Prüfhinweis sichtbar waren. Antwort: ein maschinell erzwungener Bestätigungs-Mechanismus.
1. **Neues Queue-Feld `bestaetigen[]`** (`reference/review-queue.md`): offene Rückfragen, die der Reviewer beantworten MUSS — je Eintrag `feld`, `frage`, optional `quelle_auszug` (was wirklich im Dokument steht). Die Engine (`apply.py`) wendet Posten mit offenem Eintrag **nie** an: `approve`/`approve-run`/`manual-confirm` liefern `needs-confirmation`, für `approve-safe`/Anzeige zählt der Posten als `prüfen` — auch wenn seine Stufe `sicher` sagt.
2. **Review-Board rendert Pflicht-Bestätigungen unübersehbar**: eigener hervorgehobener Frage-Block ganz oben auf der Karte (Frage + Quelle-Auszug + Antwortfeld), neuer Intent `bestätige <runid> <id>: <feld>=<wert>`; bei Geld-Werten wird `compute.ts` mit dem bestätigten Wert neu ausgeführt statt Summen nachzuziehen.
3. **invoicing erzeugt die Einträge in drei Erfassungs-Situationen**, in denen der Report die Antwort prinzipiell nicht enthält: (a) **Hotelbetrag** bei `hotel_cost: 0`/spitz — der Report zeigt nur Übernachtung ja/nein, ein still mit 0 EUR durchgereichter Hotel-Posten ist eine falsche Rechnung (`compute.ts` warnt jetzt zusätzlich deterministisch); (b) **Fahrt-Aufteilung bei überlappenden Zeitfenstern** — „Fahrt=0 statt raten" ist selbst ein stiller Ratefehler: die Aufteilung Montage/Fahrt ändert den Betrag auch bei exakt stimmenden Gesamtstunden; (c) **schwer lesbare handschriftliche Zahlen** (km, Uhrzeiten) — gleiche Bestätigungspflicht wie unklare Kennzeichen, gelesener Wert + Alternativen werden vorgelegt. Kontrakt: `reference/review-queue.md`; Erfassungsregeln: `skills/invoicing/reference/montagebau-preset.md`.

**v0.11.0 — Engine-Zuverlässigkeit + Tempo (Befunde aus dem ersten Galant-Echtlauf, 07.07.2026).** Fünf Engine-Verbesserungen in `apply.py` (kanonisch, wird vom Onboarding als `_firma/apply.py` in den Workspace geschrieben — bestehende Workspaces müssen die Datei einmal austauschen):
1. **Verifiziertes Schreiben:** Kopien laufen in Chunks nach `<name>.part`, werden gefsynct, größenverifiziert und erst dann atomar umbenannt — eine abgebrochene Kopie auf ein langsames Netzlaufwerk hinterlässt nie mehr ein plausibel aussehendes Fragment unter finalem Namen (real passiert: 281-KB-Quelle als 98–204-KB-Fragmente). Optional `verify:"md5"` pro Aktion als Endkontrolle.
2. **Quell-Bindung `source_md5`:** Queue-Builder hashen die Quelle beim Queue-Aufbau; die Engine verweigert die Freigabe, wenn der Quellinhalt nicht mehr passt — blockt Verwechslungen ähnlich benannter Dateien (real passiert: Hamm-Trimet-Karte mit Dortmund-Jolt-Quellpfad) hart ab.
3. **`manual-confirm`-Intent:** „Nutzer hat selbst kopiert" ist jetzt ein offizieller Pfad — Engine prüft Größe+md5 am Ziel, journaled `copied-manually`, räumt die Karte ab. Board-Regel dazu: Fail-fast — max. ein automatischer Wiederholungsversuch, dann manuellen Pfad anbieten.
4. **`approve-run`-Batch:** die Prozess-Freigabe des Boards läuft in EINEM Engine-Start (ein Journal-Read, ein Config-Parse) statt einem Prozess-Spawn pro Karte.
5. **Skalierung:** Journal-Index einmal pro Lauf statt Zeilen-Scan pro Ziel; Quell-md5 lazy (ein Re-Lauf mit lauter journalten Zielen liest null Quellbytes); Größenvergleich vor md5-Vergleich am Ziel.
6. **`.part`-Resume:** Ein abgebrochenes Ausführungsfenster heißt oft „Kopie fertig, Rename fehlte" (beobachtet: 4 von 8 Fotos kamen trotz Timeout vollständig an). Eine `.part`, die in Größe UND md5 zur Quelle passt, wird beim nächsten Anlauf nur noch umbenannt statt neu kopiert — aus 40–90 s Netz-Schreibzeit wird ~1 s.
7. **Keine Preview-Doppelkopie:** Bei reinem Umbenennen/Kopieren (Fotos Modus A/B, unveränderte PDFs) wird kein byte-identisches Duplikat mehr nach `_review/_preview/` geschrieben — die Ergebnis-Box zeigt die Quelle direkt, der Zielname steht auf der Karte. Auf langsamen Netz-Workspaces war das Preview-Duplikat großer Fotos der teuerste Einzelschritt des Laufs (jede Datei wurde effektiv zweimal geschrieben).
8. **Hintergrund-Freigabe:** `approve-run` für Prozesse mit großen Dateien läuft im Hintergrund (Kontrolle über stdout-JSON/Journal) statt synchron — 8 Fotos sprengen sonst jedes Ausführungsfenster.
Dazu: Round-Trip-Lesekontrolle nach jedem Queue-Edit (Netzlaufwerk-Zwischenstände), proaktives Anbieten von `request_cowork_directory`, wenn der Nutzer ein Ziel außerhalb des Workspace nennt, und `source_md5`-Pflicht jetzt auch für daily-report-Entwürfe. Kontrakt: `reference/review-queue.md`.

**v0.10.3 — geführter Rundgang für Erstnutzer.** Neue `guided-setup`-Skill + `/command-center:start`: ein einziger warmer Durchlauf, der Cowork **und** das Plugin erklärt (neue `reference/cowork-basics.md`) und den Nutzer **einmal komplett durch einen echten Zyklus** führt — Beispiel-Beleg reinlegen → „verarbeite alles" → im Chat freigeben → Ergebnis → Dashboard. Prinzip: erklären durch Tun, ein Häppchen pro Station, jederzeit überspringbar; am Ende kennt der Nutzer alle Funktionen und die drei Zauberformeln. `firm-onboarding`/`setup` bieten den Rundgang für Erstnutzer aktiv an. Firm-neutrale Demo-Datei zum gefahrlosen Üben (auf Wunsch danach entfernt).

**v0.10.2 — security & correctness hardening** (full-plugin review, all findings fixed):
- **Apply engine containment** (`_firma/apply.py`): sources, relative targets and filenames from queue JSON can no longer escape the workspace (`../` → `skipped-unsafe`, action stays open); absolute targets are honoured only if configured as `output_paths` in `_firma/config/*.json`, otherwise they fall back to `_ausgang/<process>`. Structured errors instead of tracebacks; `reject` errors on unknown ids instead of claiming success; corrupt journal lines no longer blind the replay guard; garbled queues surface in `queue_warnings`. **Re-run onboarding Step 2b (or re-copy apply.py) in existing workspaces to get the fix.**
- **`apply.ts` demoted to a read-only lister** — its apply commands (which lacked the journal guard, md5 idempotency and the missing-source refusal) were removed; `_firma/apply.py` is the only engine that applies approvals. Tier display is fail-closed (unknown tier ≠ "sicher").
- **`compute.ts` validates hard**: legacy config shapes (single rate per tier), non-numeric/negative hour fields and the legacy `reisezeit_h` row field abort with a clear message instead of silently computing wrong (or null) totals; duplicate person+date rows, Schlechtwetter hotel days, spesen/hotel gaps and year mismatches warn; km without a vehicle appear as a visible `(kein Fahrzeug)` position instead of being dropped. New test suite (`compute.test.ts`) plus apply.py integration tests — 130+ tests green.
- **Review-board widget escaping** is now mandatory (HTML-escape all queue values; single-line sendPrompt composition), injection guards restated at every file-read site, and a new **`reference/datenschutz.md`** (DSGVO): storage map, retention periods (signals 12 months, journal 24), deletion routines, Art.-30 building block.

**v0.10.1** — two additions on top of v0.10.0: (1) **Anreise-km ab Firmensitz** in the Montagebau-Preset — arrival/departure trips are always billed as the Firmensitz→Baustelle distance (`sites.<baustelle>.anreise_km`, asked once per site), never the reported odometer value; deviations surface as "prüfen". (2) **Speed pass** — a plugin-wide Tempo contract (`reference/firm-config-contract.md` §8): batched reads, each dropped file read exactly once (classify + extract in one pass), one batched checksum command instead of per-file spawns, lazy reference loading, and the dashboard artifact regenerates once per review session instead of after every single approval.

**v0.10.0** — `invoicing` gained the **Montagebau/Service-Report-Preset**: separate Montage-/Fahrt-Sätze per tier, independent Samstags-/Sonntags-Zuschlag (instead of one blended weekend rate), per-vehicle Geräte-/KFZ-Abrechnung, and an `pause_pre_applied` mode for firms whose hour extraction already nets out breaks (Fahrt-h = Pendelanteil, not the full travel window). All of it stays inside `compute.ts`'s hard rule — the skill still never calculates by hand; every new edge case (unresolved vehicle, over-cap day, spesen/hotel-flag mismatch) surfaces as a `warnings[]` line instead of a silent guess. See `skills/invoicing/reference/montagebau-preset.md`.

Plus everything from v0.9.2: dashboard is a pure statistics & history artifact (fully static: hero stats, Verlauf, Zuletzt abgelegt aus dem Journal — no open items, no buttons; reviewing lives entirely in chat via the review board). Plus v0.9.1: unified drop-zone intake + sequential interactive review board (incl. Modus B report scans) on top of onboarding and the business processes; canonical pure-Python apply engine (`_firma/apply.py`, md5-idempotent, journal-guarded, multi-target-safe, BOM-tolerant).

| Capability | Depth |
|---|---|
| **Firm onboarding** | Full — detect-first interview, workspace scaffold, one source-of-truth context file |
| **Invoicing** | Full — deterministic `compute.ts` for every figure (hours, tiers, per-diems, VAT, Geräte) + a documented end-to-end dry-run; simple single-rate mode or the Montagebau-Preset (getrennte Montage-/Fahrt-Sätze, Sa/So-Zuschlag, Fahrzeug-Abrechnung) |
| **Dashboard** | Full — live time-saved artifact, workflow transparency, work log |
| **Daily report · Photo sorting · Receipt filing** | Skill-complete — self-onboarding, reference rules, review-gated output, running on Cowork's native vision/document abilities |

Every process is review-gated (nothing is written, sent, or booked without your approval). Phase 2 adds a per-process deterministic engine where a process outgrows skill-level instructions — the path `jan-kapitalfluss` already follows. See `reference/architecture.md` and the walkthrough in `docs/end-to-end-dry-run.md`.
