# Bericht-Scans (Modus B) — Montage-/Serviceberichte umbenennen & archivieren

Quelle: abfotografierte oder eingescannte, **handschriftlich ausgefüllte Bericht-Vordrucke** (Montagebericht, Servicebericht, Regie-Vordruck) mit kryptischen Original-Namen (`IMG-20260518-WA0042.jpg`, `Scan001.pdf`, …). Ziel: einheitlich benannt und in KW-Subordnern archiviert — als normaler photo-sorting-Posten über Review-Board + apply.py, Bedienung identisch zu Modus A.

Aktiv nur bei `bericht_scans: an` in `_firma/config/photo-sorting.json` (Onboarding-Frage 9 in `reference/rules.md`).

## Namensschema

```
JJJJ KWnn BV V.Nachname [V.Nachname …][_Suffix].ext
```

- **`JJJJ`** = vierstelliges ISO-Jahr (zur KW gehörig, nicht zum Scan-Datum)
- **`KWnn`** = Kalenderwoche, **immer zweistellig** (`KW09`, nie `KW9` — sortiert sonst falsch)
- **`BV`** = Baustellen-Kurzform **Ort + Kunde** (z. B. „Musterstadt Beispiel-GmbH") — nie der komplette Projekt-String
- **`V.Nachname`** = Monteur in der **exakten Schreibweise** aus `stammdaten/monteure.json`. Mehrere Monteure mit **einfachem Leerzeichen** getrennt — kein Komma, kein Unterstrich.
- **`_Suffix`** optional für Sonderberichte: `_Anreise`, `_Heimfahrt`, `_Nachtrag` (nachgereichte vollständige Endversion), `_2` … — direkt am letzten Namen anhängen.

Beispiele (fiktive Namen):
```
2026 KW19 Musterstadt Beispiel-GmbH M.Muster A.Beispiel.jpeg
2026 KW20 Musterstadt Beispiel-GmbH P. Probe_Anreise.jpeg
2025 KW35 Nordstadt Kundenwerk L.Lehr_Nachtrag.pdf
```

## KW-Ableitung

- Die **Datum-Spalten im Bericht** lesen (nicht den Dateinamen) → daraus ISO-Jahr + ISO-KW.
- Eine KW endet **sonntags**; eine **Sonntags-Anreise gehört noch zur laufenden KW**.
- Am Jahreswechsel zählt das **ISO-Jahr der KW** (`datetime.date(J,M,T).isocalendar()`), nicht das Kalenderjahr des Scans.
- Zeigt der Bericht-**Kopf** eine andere KW als die Tagesdaten innen, gewinnen die Tagesdaten (Header-Tippfehler häufig) → tier `prüfen`.

## Zielstruktur

```
<bericht_scans.zielordner>/
   KW19/   ← Subordner-Schema KWnn: OHNE Leerzeichen, führende Null
   KW20/
```

Pro im Mapping vorkommender KW den Subordner anlegen, falls er fehlt — Standard-Schritt, nicht optional (sonst wird der Wurzelordner über das Projekt unübersichtlich). Original bleibt unangetastet; gespeichert wird als Kopie über `apply.py` (kollisionssicher, Journal, md5-idempotent).

## Konflikte

Existiert zur selben KW + BV + Crew schon eine Datei (z. B. zwei Berichte derselben Crew in einer Woche) → **Suffix statt Überschreiben**: `_2`, `_Nachtrag`, `_Anreise`, `_Heimfahrt` je nach Inhalt.

## stammdaten/monteure.json

```json
{
  "monteure": [
    { "name": "Max Mustermann",  "schreibweise": "M.Mustermann", "hinweis": "ohne Leerzeichen nach dem Punkt" },
    { "name": "Paula Probe",     "schreibweise": "P. Probe",     "hinweis": "MIT Leerzeichen nach dem Punkt" }
  ]
}
```

- `schreibweise` = die **exakte** Form im Dateinamen, inklusive Leerzeichen-Eigenheiten (Firmen schreiben teils `M.Muster` ohne und `P. Probe` mit Leerzeichen — **nie normalisieren**, immer die hinterlegte Form übernehmen).
- **Gleiche Initialen im Team** (zwei „M.M.") oder mehrere Personen mit gleichem Nachnamen: bei mehrdeutiger Handschrift **IMMER** tier `prüfen` + Rückfrage — nie raten.

## Workflow

1. **Inventur** der Quell-Scans (aus `_eingang/` via intake oder direkt benannt).
2. **Pro Datei den Bericht per Vision lesen**: Datum-Spalten → Jahr + KW · Kopf/Adresse/Projekt → BV-Kurzform · Team-Zeile + Unterschriften → Monteure.
3. **Mehrdeutigkeiten** (Handschrift, Initialen, unbekannter Monteur) → tier `prüfen` + **gebündelte** Rückfrage; unbekannte Monteure nach Freigabe in `stammdaten/monteure.json` übernehmen (Lernschleife wie bei neuen Baustellen).
4. **Mapping** Original → Schema-Name bauen, Konflikt-Suffixe vergeben.
5. **Review-Queue-Posten schreiben** (`verb: "kopieren"`, `values`: `jahr, kw, bv, monteure, suffix`; `targets`: `<zielordner>/KWnn`; `filename`: Schema-Name) — Freigabe wie immer über das Review-Board.
6. Nach „Freigeben (Prozess)": apply.py kopiert kollisionssicher, Journal-Zeile, Activity-Log.

## Abgrenzung (drei Verwandte, drei Prozesse)

| Dokument | Prozess | Output |
|---|---|---|
| ACHIM-Rapport/Regiebericht (Rohdaten mit Tätigkeits-Beschreibungen) | `daily-report` | ausgefüllte Bautagesbericht-Vorlage |
| Handschriftlicher Bericht-**Scan** (Archivierung) | `photo-sorting` **Modus B** | umbenannte Kopie im KWnn-Ordner |
| Stunden einer Woche **zur Abrechnung** | `invoicing` | Pro-forma-Rechnung |

Derselbe Scan kann **zwei** Leben haben: Modus B archiviert ihn; enthält er Stunden zur Abrechnung, läuft **zusätzlich** invoicing mit derselben Quelldatei — zwei Posten in zwei Queues, ein unangetastetes Original (Routing: intake `reference/classify.md`). Das Namensschema wird von invoicing **nicht** geparst — es dient Übersicht und Archivsuche.

## Onboarding (einmalig, bei `bericht_scans: an` — detect-first per `onboarding-ux.md`)

1. **Zielordner** 🔍 Path-Picker — einen vorhandenen „Montageberichte"-/„Berichte"-Ordner vorschlagen; Default `_ausgang/bericht-scans`. *(gespeichert als `bericht_scans.zielordner`)*
2. **BV-Kurzformen** — aus `stammdaten/projekte.json` vorschlagen (Feld `bv_kurzform` je Projekt ergänzen) · ✏️.
3. **Monteur-Schreibweisen** — vorhandene Namen aus `stammdaten/personen.json` als nummerierte Vorschläge; je Person die **exakte** Dateinamen-Schreibweise erfragen → `stammdaten/monteure.json`.
4. **Suffix-Liste** — Default `_Anreise` · `_Heimfahrt` · `_Nachtrag` · ✏️.

## Anti-Patterns

- **Schreibweise raten** — bei mehrdeutiger Handschrift fragen, besonders bei gleichen Initialen.
- **Komma oder Unterstrich** als Trenner zwischen Monteuren (final: einfaches Leerzeichen).
- **KW ohne führende Null** (`KW9` statt `KW09`) — gilt auch für Subordner-Namen.
- **Kompletter Projekt-String als BV** — Kurzform Ort + Kunde reicht.
- **Scans lose im Wurzelordner lassen** — nach dem Benennen immer in den `KWnn`-Subordner.
- **Original umbenennen/verschieben** — es wird ausschließlich kopiert (Journal, umkehrbar).
