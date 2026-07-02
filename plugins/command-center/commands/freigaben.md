---
description: Offene Freigaben als interaktive Karten zeigen — Vorschau, Felder bearbeiten, Freigaben sammeln und gebündelt speichern.
---

# /command-center:freigaben

Zeigt die vorbereitete, noch offene Arbeit als interaktives Review-Board.

Invoke the **`review-board`** skill. Sie lädt die offenen Queues (`_firma/_review/` über `python3 <workspace_root>/_firma/apply.py <workspace_root> list` — die kanonische Workspace-Engine) und rendert pro Posten eine Karte: Vorschau öffnen, Felder (Dateiname, Speicherort, Werte) bearbeiten, „Freigeben" ankreuzen. Ein Klick auf **„Freigegebene speichern"** legt alle ausgewählten Posten gebündelt am Zielort ab (N:/S: wenn verbunden, sonst Workspace-`_ausgang/` mit Pfadnotiz), schreibt das Journal und aktualisiert das Board.

Reine Übersicht ohne Aktion gewünscht? Dann die `dashboard`-Skill. Freigabe per Tippen statt Karten? Siehe `${CLAUDE_PLUGIN_ROOT}/reference/chat-review.md`.
