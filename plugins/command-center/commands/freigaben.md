---
description: Offene Freigaben als interaktives Review-Board zeigen — ein Prozess zur Zeit, pro Posten eine editierbare Karte mit Vorschau, ein Klick „Freigeben (Prozess)" speichert.
---

# /command-center:freigaben

Zeigt die vorbereitete, noch offene Arbeit als interaktives Review-Board.

Invoke the **`review-board`** skill. Sie lädt die offenen Queues (`_firma/_review/` über `python3 <workspace_root>/_firma/apply.py <workspace_root> list` — die kanonische Workspace-Engine) und reviewt **einen Prozess zur Zeit**: pro Posten eine volle, **editierbare Karte** (Dateiname, Speicherort, Werte) mit **Übernehmen/Ablehnen**-Buttons, darunter die nativen Vorschau-Boxen (Ergebnis/Quelle, öffnen rechts in der Sidebar). Am Ende des Prozesses **ein** Klick **„Freigeben (Prozess)"** — er legt die verbliebenen Posten dieses Prozesses am Zielort ab (konfigurierte N:/S:-Pfade wenn verbunden, sonst Workspace-`_ausgang/` mit Pfadnotiz), schreibt das Journal und rendert sofort den nächsten vorbereiteten Prozess. Details: `${CLAUDE_PLUGIN_ROOT}/skills/review-board/reference/board-ui.md`.

Reine Übersicht ohne Aktion gewünscht? Dann die `dashboard`-Skill. Freigabe per Tippen statt Karten? Siehe `${CLAUDE_PLUGIN_ROOT}/reference/chat-review.md`.
