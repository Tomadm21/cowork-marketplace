# Datenschutz (DSGVO) — was wo liegt, wie lange, und wie man löscht

Kurzreferenz für die Firma und ihren Datenschutz-Verantwortlichen. Alle Skills halten sich daran;
die Löschpflichten führt der Operator beim `/command-center:review`-Rhythmus mit aus.

## Grundsätze (by design)

- **Alles lokal.** Sämtliche Firmen- und Personendaten liegen ausschließlich im Cowork-Workspace
  der Firma (bzw. auf deren konfigurierten N:/S:-Laufwerken). Das Plugin betreibt keine eigene
  Cloud, keine Drittanbieter-Datenbank, kein Tracking; es schreibt nie in sein eigenes Verzeichnis.
- **Datenminimierung.** Stammdaten enthalten nur, was das Matching braucht (Name/Kürzel, Stufe,
  Fahrzeug) — keine Privatadressen, keine Gesundheits- oder Vertragsdaten.
- **Dateien = Auskunft & Löschung trivial.** Jede Speicherung ist eine lesbare Datei; Auskunft
  (Art. 15) ist ein `grep`, Löschung (Art. 17) ein Zeilen-/Datei-Löschen.
- **Verarbeitung durch Claude:** Inhalte (Belege, Stundenzettel, Namen) werden zur Analyse an
  Anthropic übertragen. Voraussetzung für den Firmeneinsatz ist ein **kommerzieller
  Claude-Plan (Team/Enterprise) mit AVV/DPA** — dann kein Training auf den Daten,
  Standardvertragsklauseln inklusive. Das ist Vertragsebene, nicht Plugin-Ebene; beim Rollout
  einmal prüfen und im `company-context.md` unter `cc:tools` vermerken.

## Speicherorte mit Personenbezug

| Ort | Inhalt | Zweck | Aufbewahrung |
|---|---|---|---|
| `_firma/company-context.md` | Firmenfakten, Ansprechpartner | Prozess-Kontext | solange Zusammenarbeit läuft |
| `_firma/stammdaten/*.json` | Monteure/Personen (Name, Stufe), Lieferanten, Baustellen | Matching | solange aktiv; Austritt einer Person → Eintrag löschen |
| `_firma/_state/signals.jsonl` | Reibungs-Signale, `detail` kann Namen enthalten | Verbesserungs-Loop | **12 Monate** oder nach ausgewertetem Review — ältere Zeilen löschen |
| `_firma/_journal/*.jsonl` | Ablage-Protokoll (Dateinamen enthalten oft Namen) | Nachvollziehbarkeit/Idempotenz | **24 Monate** (Monatsdateien älter löschen); länger nur, wenn die Firma es als GoBD-Beleg führt |
| `_firma/_state/activity.jsonl` | Lauf-Protokoll (Zusammenfassungen) | Dashboard-Statistik | wie Journal |
| `_eingang/` / `_ausgang/` | die Dokumente selbst | Arbeitsdaten | Hoheit der Firma (steuerliche Fristen beachten — Belege NICHT vorschnell löschen) |

## Lösch-Routinen

- **Rotation (Operator, alle 2–4 Wochen mit `/command-center:review`):** `signals.jsonl`-Zeilen
  älter als 12 Monate entfernen; `_journal/`-Monatsdateien älter als 24 Monate löschen.
- **Betroffenen-Anfrage (eine Person will Auskunft/Löschung):** Namen über
  `stammdaten/`, `signals.jsonl`, `_journal/`, `activity.jsonl` suchen (`rg "<Name>" _firma/`),
  Auskunft aus den Treffern erstellen; bei Löschung die Zeilen/Einträge entfernen. Achtung:
  Einträge, die zugleich steuerlich relevante Ablagen dokumentieren, fallen unter Art. 17 Abs. 3
  (rechtliche Aufbewahrungspflicht) — dann nicht löschen, sondern vermerken.
- **Ende der Zusammenarbeit:** der gesamte Workspace-Ordner gehört der Firma; Plugin
  deinstallieren + `_firma/` löschen entfernt alles, was das Command Center je gespeichert hat.

## Für das Verzeichnis von Verarbeitungstätigkeiten (Art. 30)

Baustein zum Übernehmen: *Zweck:* Automatisierte Vorbereitung von Beleg-Ablage, Foto-Sortierung,
Berichten und Rechnungen mit menschlicher Freigabe. *Kategorien:* Beschäftigtendaten (Name, Stufe,
Arbeitszeiten), Lieferanten-/Kundendaten (Firmierung, Rechnungsdaten). *Empfänger:* Anthropic
(Auftragsverarbeiter, AVV). *Drittland:* USA — Absicherung über die AVV/SCC des kommerziellen
Claude-Plans. *Löschfristen:* siehe Tabelle oben. *TOM:* lokale Speicherung im Firmen-Workspace,
Freigabe-Gate vor jedem Schreiben, Journal.
