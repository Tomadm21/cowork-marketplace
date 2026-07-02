# Automation — Prozesse als stündliche Loops

Wie jeder Command-Center-Prozess in Claude Cowork automatisch **vorbereitet** wird — und die ehrlichen Grenzen.

## Wie Cowork-Automation funktioniert (2026)

Cowork führt wiederkehrende Arbeit über **geplante Tasks** aus:
- Anlegen mit **`/schedule`** in einem Task-Chat, oder über die **Scheduled**-Seite in der Seitenleiste (**+ New task**).
- Jeder geplante Task ist eine eigene Cowork-Session mit Zugriff auf deine installierten Plugins und Skills.
- Zeitplan als Cron — für das Command Center **stündlich** (`0 * * * *`).

### Die Grenze, die die Firma kennen muss

> **Geplante Tasks laufen nur, während dein Computer wach und die Claude-Desktop-App offen ist.** Schläft die Maschine oder ist die App zu, wird der Lauf übersprungen und beim nächsten Wachwerden / Öffnen nachgeholt.

Das ist **kein** serverseitiger 24/7-Cron. Für echte unbeaufsichtigte Automation:
1. ein dauerhaft laufender „Back-Office-Mac" mit offener App, oder
2. der dokumentierte **manuelle Trigger** — die Prozesse sind schnell; du startest sie im Chat, wenn du die Inputs hast.

Verspricht der Firma nie unbeaufsichtigte 24/7-Automation vom normalen Laptop.

> **Engine:** Dateien bewegt am Ende ausschließlich die kanonische Workspace-Engine `_firma/apply.py` (reines Python3, vom Onboarding installiert, md5-idempotent + atomar). Der Sammel-Task **bereitet nur vor** und ruft sie nie.

## Das Modell: EIN stündlicher Sammel-Task

Statt eines Tasks pro Prozess legt das Command Center **einen** stündlichen Sammel-Task an („Collector"). Er schaut in alle aktiven Eingänge, bereitet neue Arbeit vor und legt sie zur Freigabe — **bewegt aber nichts**.

Jeder Lauf:
1. scannt den **gemeinsamen Eingang** `_eingang/` (rekursiv); die **intake**-Skill klassifiziert jede neue Datei nach Inhalt und routet sie an den richtigen Prozess (per-Prozess-Unterordner `_eingang/<prozess>/` werden weiter als explizites Ziel erkannt),
2. überspringt alles, was schon gesehen / vorbereitet / abgelegt wurde (Dedupe, siehe unten),
3. lässt für jeden Prozess mit neuem Input den Skill im **Loop-/Sammel-Modus** laufen — bündelt alle neuen Dateien in **eine** Review-Queue pro Prozess,
4. schreibt Activity-Log `status: prepared`,
5. ist nichts Neues da: **sofort beenden** (billig — kaum Verbrauch).

### Dedupe-/Watermark-Vertrag

Damit der stündliche Lauf nichts doppelt vorbereitet, gilt eine Quelldatei als „schon erledigt", wenn ihr workspace-relativer Pfad in einem von dreien steht:
- eine offene Queue unter `_firma/_review/`,
- das Journal `_firma/_journal/*.jsonl` (bereits abgelegt),
- die Merkliste `_firma/_state/seen-<prozess>.json` (bereits vorbereitet).

Nach dem Vorbereiten ergänzt der Skill die neuen Quellpfade in `seen-<prozess>.json` (JSON-Array; Datei/Ordner anlegen, falls fehlend). Best-effort, nie blockierend. Details im jeweiligen `skills/<prozess>/SKILL.md` → „Loop- / Sammel-Modus".

## Die nicht verhandelbare Regel: automatisch ≠ unbeaufsichtigt schreiben

Command-Center-Prozesse nutzen Vision/LLM-Extraktion — nicht deterministisch. Ein geplanter Lauf:
- **bereitet** die Arbeit vor und **landet im Review-Zustand** (eine vorgeschlagene Rechnung, ein vorgeschlagener Satz Umbenennungen),
- **committet nie** folgenreiche Schreibvorgänge (Dateien verschieben/umbenennen, eine Rechnung finalisieren, irgendetwas senden),
- wartet auf deine Freigabe.

„Automatisch" heißt „die Vorbereitung ist für dich erledigt", nicht „während du weg warst, ist etwas Unumkehrbares passiert".

## Freigabe passiert im Chat — nicht im Dashboard

Das Dashboard (`skills/dashboard/`) ist **reine Übersicht**: es zeigt, was lief, wie viel Zeit gespart wurde und wie viele Posten warten — löst aber **nichts** aus. **Annehmen, Bearbeiten, Nochmal-Rechnen und Ablehnen machst du im Chat.** Sag „**zeig offene Freigaben**". Vollständiger Ablauf: `reference/chat-review.md`. Nur die Apply-Engine (`_firma/apply.py`, kanonisch) bewegt am Ende Dateien — ausgelöst durch dein Wort im Chat, nie durch Task oder Dashboard.

## Der Sammel-Task: genauer Prompt

`/command-center:setup` bietet an, diesen Task anzulegen (stündlich, Cron `0 * * * *`). Der Prompt ist selbst-enthalten (jeder Lauf startet ohne Gedächtnis):

> *„Command-Center-Sammellauf. Scanne den gemeinsamen Eingang `_eingang/` (rekursiv) im Workspace `<WORKSPACE_ROOT>`. Verarbeite nur Dateien, die noch NICHT in `_firma/_review/`, `_firma/_journal/` oder einer `_firma/_state/seen-<prozess>.json` stehen. Lass die intake-Skill im Loop-/Sammel-Modus laufen: klassifiziere jede neue Datei nach Inhalt (Beleg, Foto, Tagesbericht, Stundenzettel), erkenne Dubletten, route an den richtigen Prozess, bündle pro Prozess in EINE Review-Queue und schreibe Activity-Log `status: prepared`. Stelle KEINE Rückfragen; fehlt einem Foto Baustelle/Datum, lege die Aktion mit tier prüfen an. Bewege, buche, finalisiere oder sende NICHTS. Ist nichts Neues da, beende sofort. Wenn etwas vorbereitet wurde, gib mir eine kurze Notiz: ‚X neue Posten liegen zur Freigabe — sag zeig offene Freigaben.'"*

`<WORKSPACE_ROOT>` füllt setup mit dem echten absoluten Pfad.

## Empfohlene Taktung

| Task | Takt | Was der Lauf tut (dann Freigabe im Chat) |
|---|---|---|
| **Sammel-Task** (alle vier) | **stündlich** `0 * * * *` | neue Inputs erkennen, vorbereiten, in Review-Queues bündeln |

Einzelne Prozesse seltener gewünscht? Du kannst zusätzlich pro Prozess einen eigenen Task mit anderem Cron anlegen (z. B. `invoicing` wöchentlich montags). Der Standard ist der **eine** stündliche Sammel-Task — ein Zeitplan, den du im Blick behältst.

## Einrichten (Operator-Walkthrough)

1. Prozesse einmal manuell onboarden/laufen lassen, damit `_firma/config/<prozess>.json` existiert.
2. `/command-center:setup` → bietet den Sammel-Task an. Oder `/schedule` manuell mit dem Prompt oben.
3. Cron `0 * * * *` (**stündlich**), **Schedule** klicken.
4. Der Firma die App-offen-Grenze sagen.
5. Ab jetzt: Dashboard ansehen mit „zeig das Dashboard", freigeben mit „zeig offene Freigaben".

## Phase-2 (echte unbeaufsichtigte Läufe)

Für einen Prozess, der garantierten Determinismus oder echte headless-Läufe braucht: dem `jan-kapitalfluss`-Muster folgen (portable TS-Engine + dünner MCP-Adapter + Approval-Hook), siehe `reference/architecture.md`. Skill-Variante und Engine-Variante koexistieren.
