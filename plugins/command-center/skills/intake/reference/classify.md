# Klassifikation — welche Datei gehört zu welchem Prozess

Ziel: jede Datei aus dem gemeinsamen Eingang **nach Inhalt** genau einem Ziel zuordnen. Nie nach Dateiendung oder Unterordner allein entscheiden — der Eingang ist absichtlich gemischt.

## Vorab: technische Checks (immer zuerst)
1. **Inhalts-Prüfsumme** je Datei (`md5sum`). Gleiche Summe = identische Datei → nur eine verarbeiten, Rest als **Dublette** markieren (auch über Ordner/Endungen hinweg).
2. **Magic-Bytes vs. Endung** (`file -b`). Häufig: eine als `.pdf` benannte JPEG ist in Wahrheit ein Bild (oft ein abfotografierter Beleg) → als Bild lesen und nach Bildinhalt klassifizieren. Eine echte (Text-)PDF nach Text/Seiteninhalt.
3. **Bild vs. Dokument** entscheidet den ersten Ast (siehe unten), nicht die Endung.

## Entscheidungsbaum

### A) Datei ist ein BILD (JPEG/PNG/HEIC) oder eine bildbasierte „PDF" (gescannt/abfotografiert)
Lies das Bild (Vision) und unterscheide, was darauf zu sehen ist:

1. **Ein Dokument** (Briefkopf/Logo eines Lieferanten, Wörter wie „Rechnung", „Lieferschein", „Quittung", „Gutschrift", Positionen, Summen, Rechnungs-/Lieferschein-Nr., USt) → **`receipt-filing`**.
2. **Eine reale Baustellen-/Arbeitsszene** (Maschinen, Graben, Schacht, Pflaster, Material, Gelände, Personen bei der Arbeit) → **`photo-sorting`** (Modus A).
3. **Ein handschriftlicher Montagebericht / Service-Report-Vordruck** (Höcker-Polytechnik o. ä.: Bericht-Kopf mit BV/Adresse, Datum-Spalten, Team-Zeile, Unterschrift — zum **Umbenennen/Archivieren** nach KW + BV + Monteur) → **`photo-sorting`** (Modus B). Die umbenannten Scans sind später Eingang für `invoicing`.
4. **Eine handschriftliche Notiz / Skizze / Whiteboard / To-do / Regeln** (kein Lieferant, keine Beträge, kein Bericht-Vordruck; Heft/Block, Aufzählungen) → **`notiz/unklar`**. NICHT als Beleg oder Foto behandeln. Sammeln und am Ende fragen (Default: liegen lassen bzw. zu den Prozess-Notizen unter `.prozesse/` legen, falls vorhanden).
5. **Reiner Stundenzettel / Wochenstunden-Tabelle** (v. a. Namen + Stunden je Tag/Woche, Tarif/Spesen — direkt zur Abrechnung, kein Bericht-Vordruck) → **`invoicing`**.

### B) Datei ist eine TEXT-PDF (oder Office-Dokument)
Lies den Text und ordne zu:

1. **ACHIM „Rapport/Regiebericht"** oder Tagesbericht-Rohdaten — Marker: „Rapport", „Regiebericht", „ACHIM APP", „Arbeitserledigung durch", Projekt-Titel + Tag(e) mit Von/Bis/Pause + Tätigkeitsbeschreibung → **`daily-report`**.
2. **Reiner Stundenzettel / Wochenstunden zur Abrechnung** (echte Text-PDF) — Marker: Wochenübersicht mit Arbeiter-Stunden, Tarif/Stufen, Spesen, KW → **`invoicing`**. *(Ein abfotografierter/gescannter handschriftlicher Montagebericht-Vordruck ist ein Bild — er läuft über Ast A3 → `photo-sorting` Modus B zum Umbenennen.)*
3. **Beleg** — Marker: Lieferanten-Briefkopf, „Rechnung"/„Lieferschein"/„Gutschrift", Rechnungs-Nr., Datum, Netto/MwSt/Gesamt, Betrag → **`receipt-filing`**.

### C) Sonst
Spreadsheet/unbekannt: best-effort nach Inhalt; wenn weiterhin unklar → **`notiz/unklar`** und am Ende fragen.

## daily-report vs. invoicing (Abgrenzung)
- **daily-report**: dokumentiert, *was* an einem/mehreren Tagen auf EINER Baustelle getan wurde (Beschreibungen, Von/Bis je Person). Output = ausgefüllte Bautagesbericht-Vorlage.
- **invoicing**: aggregiert *Stunden einer Woche* je Arbeiter mit Sätzen/Spesen, um daraus eine **Rechnung** zu erstellen. Output = Pro-forma-Rechnung.
Im Zweifel: enthält das Dokument Tätigkeits-Beschreibungen pro Tag → daily-report; enthält es v. a. Stunden/Beträge zur Abrechnung → invoicing.
- **photo-sorting Modus B** (Abgrenzung): ein **abfotografierter/handschriftlicher Montagebericht-Vordruck** (Bild) wird zum **Umbenennen/Archivieren** nach `JJJJ KWnn BV V.Nachname` geroutet — nicht zum Auslesen von Stunden. Das Auslesen für die Rechnung passiert später on-demand in `invoicing` aus den fertig benannten Scans.

## receipt-filing: Beleg-Untertyp (für die spätere Verarbeitung, nicht zum Fragen)
- **RG** Rechnung · **LF** Lieferschein · **LS** Lastschrift. Aus dem Dokument ableiten (Überschrift/Inhalt). Baustellenbezug erkennen, wenn auf dem Beleg ein Ort/Projekt vermerkt ist (für Zusatzablage). SEPA-/„Offene-Rechnungen"-Status NICHT erfragen — als „prüfen" kennzeichnen.

## Ausgabe der Klassifikation
Erzeuge ein kurzes Manifest, gruppiert nach Ziel-Prozess, plus eine Liste `notiz/unklar` und eine Liste `dubletten` — je mit Quellpfad und Ein-Satz-Begründung. Dieses Manifest steuert Step 3 (Rückfragen) und Step 4 (Verarbeitung) der Intake-Skill.

## Beispiele (aus echten Galant-Eingängen)
- `Rechnung Hagebau scan.pdf` (Text-PDF, Lieferant + RG-Nr + Summe) → `receipt-filing` (RG).
- `scan_4407.pdf` (Magic-Bytes = JPEG, zeigt Wilmers-Rechnung) → `receipt-filing` (RG), als echtes PDF ablegen.
- `IMG_3304.jpeg` (reale Szene: EWE-GO-Platz, Pflaster) → `photo-sorting` (Modus A).
- `IMG-20260518-WA0042.jpg` (Foto eines handschriftlichen Höcker-Service-Reports: BV Andernach Assyx, Team-Zeile M.Hamrol/R.Hamrol, Unterschrift) → `photo-sorting` (Modus B, Umbenennen nach KW+BV+Monteur).
- `IMG_2048.jpg` / `scan_1190.pdf` / `scan_8852.pdf` (gleiche md5; handschriftliche Regel-Notiz) → `notiz/unklar` + Dublette.
- `ACHIM-Bericht_…_2026-04-21.pdf` („Rapport/Regiebericht", Von/Bis/Beschreibung) → `daily-report`.
