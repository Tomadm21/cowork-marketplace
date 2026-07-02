---
name: intake
description: Single drop-zone intake for the Command Center — the entry point when files are dropped without naming a process, or the user says "verarbeite alles", "ich hab was in den Eingang gelegt", "bearbeite die Ressourcen", "alles sortieren", "mach was draus", "ich hab Sachen reingedroppt". Reads every new file in the shared inbox `_eingang/`, classifies each by its ACTUAL content (Beleg/Rechnung, Baustellenfoto, ACHIM-Tagesbericht, Stundenzettel, Montage-/Servicebericht-Scan), de-duplicates, asks only the unavoidable questions (Fotos: welche Baustelle + Datum — einmal pro Stapel; Belege und Tagesbericht: keine), runs the right process for each group, and opens one interactive review board. Use whenever a mix of resources is dropped at once or the user wants the whole inbox handled.
---

# Intake — ein Eingang für alles

Ein einziger Drop-Ordner, aus dem heraus das Command Center selbst erkennt, **was** jede Datei ist und **welcher Prozess** sie bearbeitet — egal ob nur Belege, nur Fotos, nur ein Tagesbericht oder alles gemischt. Read `${CLAUDE_PLUGIN_ROOT}/reference/firm-config-contract.md` first.

> Leitidee: Der Nutzer wirft Ressourcen rein und sagt höchstens „verarbeite alles". Die KI klassifiziert, stellt **sofort und gebündelt** nur die wirklich nötigen Rückfragen, arbeitet alles durch und legt am Ende **ein** interaktives Review-Board vor.

## Step 0 — Self-verify (route, don't error) + Eingang-Mapping
Read `workspace_root` + `company-context.md`. Fehlen sie → *„Ich richte das Command Center zuerst kurz ein"* und `firm-onboarding`. Stelle sicher, dass `_firma/apply.py` existiert (sonst `firm-onboarding` Step 2b) und das Löschrecht geholt ist (`mcp__cowork__allow_cowork_file_delete`, einmalig).

**Eingang-Mapping:** Lies `_firma/config/intake.json`. Daraus ergeben sich die zu scannenden Quellen — `inbox_roots` (Default `_eingang`), `externe_eingaenge` (separate Ordner außerhalb des Workspace) und `ordner_routing` (Ordnername → Prozess als explizites Ziel). Fehlt die Datei, nimm `_eingang/` und biete an, das Mapping in `firm-onboarding` Step 2b zu hinterlegen.

**Gate (hart):** Ergibt die Klassifikation einen Prozess **ohne** `_firma/config/<prozess>.json`, dann diesen Prozess **nicht** still verarbeiten — sammle seine Dateien, route in die Onboarding-Sub-Flow dieses Prozesses (Config anlegen, inkl. Zielordner/N:-Pfade) und mach mit den übrigen Prozessen weiter. Kein Lauf auf Annahmen.

## Step 1 — Sammle neue Dateien (dedupe zuerst)
Liste alle Dateien unter `_eingang/` (rekursiv). Eine Quelldatei gilt als **schon erledigt** und wird übersprungen, wenn ihr workspace-relativer Pfad in einer offenen Queue (`_firma/_review/`), im Journal (`_firma/_journal/*.jsonl`) oder in einer `_firma/_state/seen-<prozess>.json` steht.

Scanne **alle** in `intake.json` definierten Quellen (`inbox_roots` + `externe_eingaenge`), nicht nur `_eingang/`. Eine Quelldatei gilt zusätzlich als **schon abgelegt**, wenn ihre Inhalts-Prüfsumme bereits in `_firma/_state/filed-md5.json` steht (gleicher Inhalt wurde an einem früheren Tag freigegeben) → dann **nicht erneut einreihen** (verhindert genau die `_2`-Re-Lauf-Duplikate).

Für die verbleibenden NEUEN Dateien zuerst **Dubletten erkennen**: bilde je Datei eine Inhalts-Prüfsumme (`md5sum`; wo es fehlt — z. B. macOS — portabel `python3 -c "import hashlib,sys;print(hashlib.md5(open(sys.argv[1],'rb').read()).hexdigest())" <datei>`). Gleiche Prüfsumme = dieselbe Datei (auch über Ordner/Endungen hinweg) → nur **eine** verarbeiten, die übrigen als Dublette markieren. Prüfe außerdem **Magic-Bytes gegen Endung**: eine als `.pdf` benannte JPEG ist ein Bild, kein PDF — nach Inhalt behandeln, nie nach Endung. Portabel (auf Windows/Git Bash gibt es kein `file -b`): `python3 -c "import sys;print(open(sys.argv[1],'rb').read(8).hex())" <datei>` — `25504446`=PDF, `ffd8ff`=JPEG, `89504e47`=PNG; wo `file -b` existiert, ist es gleichwertig.

## Step 2 — Klassifiziere jede Datei nach INHALT
Folge `${CLAUDE_PLUGIN_ROOT}/skills/intake/reference/classify.md`. Jede Datei bekommt genau ein Ziel:
`receipt-filing` (Beleg/Rechnung/Lieferschein) · `photo-sorting` (Baustellenfoto — oder **Modus B**: Scan eines handschriftlichen Montage-/Serviceberichts zur Archiv-Umbenennung, bei `bericht_scans: an`) · `daily-report` (ACHIM-Rapport/Regiebericht) · `invoicing` (Stundenzettel/Montagebericht zur Abrechnung) · `notiz/unklar` (handschriftliche Notiz, Skizze, nicht zuordenbar). Einzige Ausnahme vom Genau-ein-Ziel: ein Bericht-Scan mit Abrechnungs-Stunden bekommt die **Doppel-Route** photo-sorting Modus B + invoicing (classify.md A4).

Klassifiziere nach dem, was die Datei IST, nicht in welchem Unterordner sie liegt. Lies Bilder per Vision; lies PDFs per Text/Vision. Notiere je Datei eine kurze Begründung der Zuordnung.

`notiz/unklar` wird **nicht** in einen Prozess gezwängt: kurz sammeln und am Ende einmal nachfragen (Default-Vorschlag: liegen lassen bzw. zu den Prozess-Notizen). Aktiviert die Firma einen Prozess nicht (kein `_firma/config/<prozess>.json`), sammle die betroffenen Dateien und biete am Ende an, den Prozess einzurichten — blockiere die anderen nicht.

## Step 3 — Stelle SOFORT nur die nötigen Rückfragen (gebündelt)
Bevor du verarbeitest, frage in **einem** Schritt alles ab, was zum sauberen Bearbeiten fehlt — nutze dafür eine kompakte Auswahl (AskUserQuestion). Regeln:

- **Belege (`receipt-filing`): keine Rückfragen.** Lieferant, Nummer, Datum, Betrag, Typ werden ausgelesen; Firma (GB/GMB) aus `company-context.md`/Adressat abgeleitet; SEPA/Offene-Rechnungen wird als „prüfen" markiert, **nicht** gefragt.
- **Tagesbericht (`daily-report`): keine Rückfragen.** KW, Baustelle, Datum, Vorarbeiter kommen aus dem ACHIM-Rapport + `stammdaten/projekte.json`.
- **Fotos (`photo-sorting`): die einzigen Rückfragen — und gebündelt.** Gruppiere die Fotos nach erkennbarer Baustelle. Der häufigste Fall ist **ein großer Stapel einer Baustelle** → dann **eine** Frage für den ganzen Stapel:
  - **Baustelle?** Optionen aus `stammdaten/projekte.json` + freie Eingabe. (Wenn alle Fotos klar zu einer bekannten Baustelle gehören, nur bestätigen statt fragen.)
  - **Datum?** Nur fragen, wenn es sich nicht aus EXIF/Dateiname ergibt — Optionen: aus EXIF (falls vorhanden) · ein Datum eingeben · ohne Datum (Platzhalter). Wenn mehrere Baustellen-Stapel da sind, pro Stapel eine Zeile.
- **Bericht-Scans (`photo-sorting` Modus B): fast keine Rückfragen.** Jahr/KW/BV/Monteure kommen aus dem Bericht + `stammdaten/monteure.json`. Nur bei mehrdeutiger Handschrift (gleiche Initialen) gebündelt fragen; und **einmal** klären, ob die Berichte zusätzlich abgerechnet werden sollen (invoicing), falls das nicht aus dem Auftrag klar ist.
- **Notiz/unklar:** am Ende eine kurze Sammelfrage, was damit geschehen soll.

Stelle diese Fragen **einmal**, bevor die Verarbeitung läuft — nicht pro Datei.

## Step 4 — Verarbeite je Gruppe mit dem zuständigen Prozess
Für jede Zielgruppe die Regeln des jeweiligen Prozess-Skills anwenden (deren `reference/rules.md`):
- `receipt-filing` → Namensschema + Ablage-Entscheidungsbaum, je Beleg eine Aktion.
- `photo-sorting` → `<datum>_<baustelle>_<taetigkeit>_<lfd>` — Tätigkeit wörtlich aus dem Bautagesbericht, wenn einer zu Projekt+KW existiert, sonst Katalog; je Foto eine Aktion. **Modus B** (Bericht-Scans) → `JJJJ KWnn BV V.Nachname …` nach `skills/photo-sorting/reference/bericht-scans.md`, je Scan eine Aktion (`values`: `jahr, kw, bv, monteure, suffix`).
- `daily-report` → Vorlage füllen (nur Vorarbeiter, 17:00-Cap), je Bericht eine Aktion.
- `invoicing` → Pro-forma über das Pflicht-Skript, je Rechnung eine Aktion.

**Confidence-Kalibrierung je Aktion:** setze `tier: "sicher"` nur, wenn der Fall **eindeutig** ist — Datum sicher (EXIF/Dateiname/Beleg klar), Betrag scharf gelesen, Lieferant/Baustelle in `stammdaten/` gefunden, Zielordner eindeutig. Sonst `tier: "prüfen"` (bzw. `tier:"sicher"` + `confidence:"prüfen"`, wenn strukturell ok aber ein Punkt unklar). Nur `sicher`-Posten landen später im „alle sicheren freigeben". Neue Baustelle/neuer Lieferant (nicht in Stammdaten) → `prüfen` **und** ein `fact:`-Signal mit `severity:"folgenreich"` anhängen (Lernschleife).

Schreibe das Ergebnis als **Review-Queues** (eine pro Prozess) nach `_firma/_review/R-<YYYY-MM-DD>-<prozess>.json` exakt nach `${CLAUDE_PLUGIN_ROOT}/reference/review-queue.md`. Existiert heute schon eine offene Queue eines Prozesses, hänge an (fortlaufende `id`, `rechecked` setzen). Trage die neuen Quellpfade in `_firma/_state/seen-<prozess>.json` nach. **Es wird nichts kopiert, verschoben oder finalisiert** — nur vorbereitet.

Pro Prozess eine Activity-Log-Zeile `status: prepared` (siehe `${CLAUDE_PLUGIN_ROOT}/reference/activity-log.md`); Signale best-effort (`${CLAUDE_PLUGIN_ROOT}/reference/signals.md`), u. a. erkannte Dubletten, Endung≠Inhalt, Eingang enthielt Fremddateien.

## Step 5 — Alles ist vorbereitet → Review Prozess für Prozess
Wenn alle Queues geschrieben sind, gib **eine** kurze Klartext-Nachricht: wie viele Belege / Fotos / Berichte vorbereitet wurden, welche Dubletten/Notizen aussortiert wurden, was als „prüfen" markiert ist — und dass die Freigabe jetzt **Prozess für Prozess** läuft. (Eine echte Push-Benachrichtigung gibt es nicht; diese Nachricht ist der Hinweis.)

Rufe dann die **review-board**-Skill auf (`${CLAUDE_PLUGIN_ROOT}/skills/review-board/SKILL.md`). Sie reviewt **nur einen Prozess zur Zeit**: pro Posten eine volle, editierbare Karte und darunter die nativen Vorschau-Boxen (Ergebnis/Quelle); ein Klick „Freigeben (Prozess)" speichert und zeigt **sofort** den nächsten vorbereiteten Prozess. So bleibt der Überblick, obwohl intern schon alles fertig vorbereitet ist.

## Loop-/Sammel-Modus (stündlich)
Im geplanten Sammellauf identisch bis Step 4 (vorbereiten + Queues schreiben), aber **ohne** Rückfragen und **ohne** Board: fehlt einem Foto-Stapel die Baustelle/Datum, lege die Aktion mit `tier: "prüfen"` und einer klaren Begründung an (im Board später nachzutragen). Danach sofort beenden, kurze Notiz „X Posten liegen zur Freigabe — sag ‚zeig offene Freigaben'". Details: `${CLAUDE_PLUGIN_ROOT}/reference/automation.md`.

## Done means
- Jede neue Datei ist genau einem Prozess (oder „notiz/unklar") zugeordnet, Dubletten erkannt.
- Nur die nötigen Fragen wurden gestellt (Fotos gebündelt; Belege/Tagesbericht keine).
- Pro Prozess eine Review-Queue + `status: prepared`; nichts wurde bewegt.
- Ein interaktives Review-Board ist offen.
