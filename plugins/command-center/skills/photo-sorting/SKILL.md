---
name: photo-sorting
description: Rename and file construction-site documentation — jobsite photos AND Montagebericht/service-report scans — into the firm's structure. Use when the user drops jobsite photos or scans, or says "sortier die Baustellenfotos", "benenne die Bilder um", "file these photos", "Bautagesbericht-Bilder einsortieren", "benenne die Höcker-/Montageberichte um", "Montagebericht-Scans sortieren", "lose Bilder im KW-Ordner aufräumen". Modus A — photos → `YYYY-MM-DD_Ort_Tätigkeit_NN` from the Bautagesbericht (with morning/afternoon heuristic + Vision content-check). Modus B — Montagebericht scans (Höcker etc.) → `JJJJ KWnn BV V.Nachname` with the exact Galant Monteur spellings. Modus C — de-duplicate loose files by hash and sort them into KW folders by ISO week. Same Cowork flow: proposes, you review + approve, only then files.
---

# Baustellen-Doku sortieren (Fotos + Montagebericht-Scans)

Ein Skill für die gesamte Baustellen-Bild-Ablage, in **drei Modi** — alle über denselben Cowork-Flow (intake klassifiziert → review-board Karte + 📄/📎-Boxen → apply speichert). Read `${CLAUDE_PLUGIN_ROOT}/reference/firm-config-contract.md` + `${CLAUDE_PLUGIN_ROOT}/skills/photo-sorting/reference/rules.md` first.

**Modus-Wahl aus dem Input:**
- Quell-Dateien sind reale Baustellen-Szenen (`IMG-…`, `WhatsApp Image…`, Maschinen/Graben/Pflaster) → **Modus A**.
- Quell-Dateien sind Foto/Scan von handschriftlich ausgefüllten Bericht-Vordrucken (Höcker-Vordruck, Team-Zeile, Unterschrift) → **Modus B**.
- Aufgabe ist „lose Bilder im Bilder-Wurzelordner aufräumen / entdubletten / in KW-Ordner" → **Modus C**.

Im Zweifel kurz nachfragen, welcher Modus gemeint ist.

## Step 0 — Self-verify (route, don't error)
Read `workspace_root` + `company-context.md`, then `_firma/config/photo-sorting.json`. If missing/incomplete, say *"Ich habe die Foto-Einrichtung (Tätigkeiten, Namensschema, Zielordner) noch nicht — jetzt einrichten?"* and run onboarding (`reference/rules.md` §Onboarding, asking per `${CLAUDE_PLUGIN_ROOT}/reference/onboarding-ux.md`). Für Modus B zusätzlich `montagebericht.enabled` + `stammdaten/monteure.json` prüfen; fehlt es → Modus-B-Onboarding (rules.md §Onboarding Punkt 7).

---

## Modus A — Baustellen-Fotos

### Step A1 — Read each photo + den Bautagesbericht
Für Fotos in `_eingang/photo-sorting/` (oder von der **intake**-Skill aus dem gemeinsamen `_eingang/` hierher geroutet; or attached): bestimme das **Datum** (Dateiname zuerst per `reference/rules.md`; Tageszeit-Heuristik anwenden; sonst Bild lesen / fragen). **Lies den zugehörigen Bautagesbericht** (PDF/DOCX), um die **wörtlichen Tages-Tätigkeiten** zu extrahieren — er ist die Quelle der Wahrheit für die Tätigkeit (der Katalog ist nur Fallback). Ermittle **Baustelle** (gegen `stammdaten/projekte.json`).

### Step A2 — Inhalt vs. Name verifizieren
Lade **5–10 repräsentative Bilder per Read/Vision** und prüfe, ob der Inhalt zur Tätigkeit/zum Bericht passt (TerraTest ≠ Pflaster etc.). Widerspruch → `tier: "prüfen"` mit Begründung.

### Step A3 — Propose names
Baue `<datum>_<site-slug>_<taetigkeit>_<lfd:02d>.<ext>`. Zeige vollständigen Namen + Zielordner je Foto. Low-confidence als „prüfen".

## Modus B — Montagebericht-Scans

### Step B1 — Pro Scan den Bericht lesen
Lies jeden Scan (Vision) und leite ab (rules.md §Modus B): **Jahr + KW** (aus den Datum-Spalten; KW endet sonntags), **BV** = `Ort Kunde` aus dem Bericht-Kopf, **Monteure** aus Team-Zeile + Unterschrift (exakte Schreibweise aus `stammdaten/monteure.json`).

### Step B2 — Mehrdeutigkeit klären
Handschrift mehrdeutig (welcher Hamrol? P.Hamrol vs. P. Drgas?) → **AskUserQuestion**, nie raten. Mehrere Berichte zur selben KW+BV+Crew → Suffix `_2`/`_Anreise`/`_Heimfahrt`.

### Step B3 — Propose names
Baue `JJJJ KWnn BV V.Nachname [V.Nachname ...].ext` (KW zweistellig, Leerzeichen als Trenner). Zielordner = konfigurierter Scan-Ordner (`montagebericht.scan_output_base`, z. B. `…/Montageberichte ‹BV›/`). Die umbenannten Scans sind später Eingang für `invoicing`.

---

## Step 3 — Review → file (Modus A + B, gemeinsamer Flow)
Nach Freigabe **kopiert** die Engine (Original bleibt im Eingang) jede Datei unter dem neuen Namen in den Zielordner (Modus A: `_ausgang/bilder` bzw. Projekt-Subpfad; Modus B: Scan-Ordner). Kollisionssicher — nie überschreiben.

## Step 4 — Confirm
Liste, was abgelegt wurde, plus alle „prüfen"-Posten.

## Step 4b — Signal loggen (best-effort)
Append friction signals to `<workspace>/_firma/_state/signals.jsonl` per `${CLAUDE_PLUGIN_ROOT}/reference/signals.md` — one JSON line each, never blocking:
- unbekannte Baustelle, die der User benannt hat → `{type:"correction", key:"photo:unknown-site"}`
- korrigiertes Low-confidence-Datum → `{type:"correction", key:"photo:low-confidence-date"}`
- neuer Monteur (nicht in Stammdaten) → `{type:"fact", key:"fact:monteur-<slug>", severity:"folgenreich"}`
- Inhalt-vs-Name-Widerspruch entdeckt → `{type:"observation", key:"photo:content-mismatch", detail:"…"}`
- „wäre gut wenn…/merk dir…" → `{type:"observation", key:"observation:<slug>", detail:"…"}`
- Projektordner/Struktur geändert → `{type:"tech_change", key:"tech:pfad-geaendert", detail:"…"}`

## Step 5 — Log the run
Nach Freigabe + Ablage eine Zeile ans Activity-Log (`${CLAUDE_PLUGIN_ROOT}/reference/activity-log.md`): stabile `run_id` `photo-sorting-<YYYY-MM-DD>`, `process: photo-sorting`, `items` = Anzahl abgelegter Dateien, `summary` „<N> Fotos/Scans sortiert · <Projekt>", `status: done`. Geplanter, unreviewter Lauf → `status: prepared`. Best-effort, nie blockierend.

---

## Modus C — Lose-Datei-Bereinigung
Für „lose Bilder im `7.Bilder`-Wurzelordner aufräumen": nutze das Helfer-Skript und das **Freigabe-Gate** (rules.md §Modus C).

1. **Plan erzeugen:** `python3 ${CLAUDE_PLUGIN_ROOT}/skills/photo-sorting/scripts/loose-files.py plan --root "<Bilder-Root>"` → JSON: je lose Datei `duplicate` (Hash existiert schon in Subordner → löschen) oder `unique` (→ KW-Ordner per ISO-Woche verschieben).
2. **Plan zeigen + explizit freigeben lassen** (welche gelöscht, welche wohin). Ohne OK **nichts** ausführen. Löschrecht einmalig via `mcp__cowork__allow_cowork_file_delete`.
3. **Ausführen:** `… loose-files.py apply --root "<Bilder-Root>" --plan <plan.json>` — **löscht nur bestätigte Hash-Duplikate, verschiebt Unikate**, nie umgekehrt. Umbenennungen mit Kollision immer über Temp-Namen-Stage.
4. **Verifizieren:** danach Datei-Listen (lokal + Netzwerk) prüfen; beide Seiten identisch halten.

Modus C nutzt **nicht** die Copy-Engine (die kopiert nur) — Verschieben/Löschen laufen über das Helfer-Skript nach Freigabe.

---

## Loop- / Sammel-Modus (stündlich)
Vorschläge vorbereiten und im Review-State stoppen; nie unbeaufsichtigt bewegen. Dieser Prozess läuft stündlich über den gemeinsamen Sammel-Task (`${CLAUDE_PLUGIN_ROOT}/reference/automation.md`). Jeder Lauf ist idempotent:

- **Nur neuer Input.** Bevor eine Quelldatei eingereiht wird, prüfe, ob ihr workspace-relativer Pfad bereits (a) in einer offenen Queue `_firma/_review/`, (b) im Journal `_firma/_journal/*.jsonl`, oder (c) in `_firma/_state/seen-photo-sorting.json` steht → dann überspringen. Nichts Neues → sofort beenden ohne Queue.
- **Bündeln.** Alle neuen Quellen eines Laufs in EINE Queue (an heutige offene Queue anhängen, `rechecked` setzen). Nie pro Datei eine eigene Queue.
- **Merkliste pflegen.** Neu eingereihte Quellpfade in `_firma/_state/seen-photo-sorting.json` ergänzen. Modus C läuft nicht automatisch (destruktiv) — nur auf Ansage.

When a run is prepared but not reviewed inline, write/append one review-queue file per `${CLAUDE_PLUGIN_ROOT}/reference/review-queue.md` at `<workspace>/_firma/_review/R-<YYYY-MM-DD>-photo-sorting.json`. `runid` = `photo-sorting-<YYYY-MM-DD>`, `process: "photo-sorting"`. Jede Datei = eine Aktion mit `verb: "kopieren"`, `tier` (`sicher` nur bei durchweg sicherer Ableitung + gestützter Bild-Stichprobe, sonst `prüfen`), `reason` (was verifiziert, was unsicher), `source` = Eingangspfad, `filename` = kollisionssicherer Zielname, `targets` = Zielordner, und `values`:
- **Modus A (Foto):** `standort`, `datum`, `taetigkeit`.
- **Modus B (Scan):** `jahr`, `kw`, `bv`, `monteure`.

Das Activity-Log bleibt `status: prepared`; kopiert wird nur über review-board / `apply.py`.
