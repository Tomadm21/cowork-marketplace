# Formulare ohne Platzhalter — die Anker-Technik (paraId)

Manche Bautagesbericht-Vorlagen sind **keine** Vorlagen im technischen Sinn, sondern echte,
bereits gefüllte Formulare des Auftraggebers (GU). Praxisfall: das **EWE/Hochtief
ARBEITSEINSATZ-Formular** (Bautagesbericht). Erkennungsmerkmale:

- **Keine `{{platzhalter}}`** — die Zellen enthalten echte Werte der letzten Woche (oder sind leer).
- **Die gesamte Formularstruktur liegt DOPPELT in `word/document.xml`** — zwei aufeinanderfolgende,
  inhaltlich identische Kopien (Kontrolle: `grep -c "ARBEITSEINSATZ" document.xml` → `2`,
  ebenso „KW xx", Wochentage usw. je 2×). Wer nur die erste Kopie füllt, produziert ein
  Dokument, dessen sichtbare Seite die **alte** Woche zeigt.
- Kopfdaten (Adresse, Projekt, Bauleiter) stehen fest im Dokument, nicht in Feldern.

Ein generisches Platzhalter-Mapping (SKILL Step 4 Standardweg) **scheitert hier zwangsläufig.**
Stattdessen:

## Vorgehen

1. **Basis = letzter gefüllter KW-Bericht des Projekts** (nie eine leere Fremd-/Muster-Vorlage —
   die trägt die falsche Adresse/Projektdaten). Datei kopieren, unter neuem KW-Namen weiterarbeiten.
2. **DOCX entpacken** (docx-Skill `unpack.py`; auf Windows `PYTHONUTF8=1 PYTHONIOENCODING=utf-8`
   setzen).
3. **Zellen über Anker finden, nicht über Position.** Jeder Absatz trägt ein eindeutiges
   `w14:paraId="…"`-Attribut — die beiden Formular-Kopien haben **unterschiedliche** paraIds.
   Zwei gleichwertige Wege:
   - **paraId-Anker:** Ziel-Absätze beider Kopien über ihre paraIds lokalisieren und die
     `<w:t>`-Inhalte dort ersetzen/einfügen (robust, positionsunabhängig).
   - **Wert-Replace:** die alten Wochenwerte (z. B. „KW 23", „Montag 01.06.2026", alte
     Beschreibungstexte) per Python-`str.replace` gegen die neuen tauschen — ersetzt
     automatisch **beide** Kopien, weil der alte Wert in beiden steht. Nur verwenden, wenn der
     alte Wert eindeutig ist (nicht bei leeren Zellen oder Allerweltswerten wie „8").
4. **Beide Kopien verifizieren:** nach dem Editieren `grep -c "<neuer Wert>" document.xml` → muss
   `2` sein (bzw. pro Vorkommen im Formular ×2).
5. **Packen** (`pack.py`) und **rendern zur Kontrolle:** LibreOffice fehlt oft — auf Windows Word
   per COM (PowerShell: `$doc.ExportAsFixedFormat($pdf, 17)`), dann PDF→PNG via PyMuPDF (fitz)
   und Sichtprüfung: 1 Seite, neue KW, richtige Tage/Texte.

## Onboarding-Konsequenz

Beim daily-report-Onboarding (Frage 1 Template + Frage 5 Felder, `reference/rules.md`) prüfen,
ob die Vorlage Platzhalter enthält. Wenn **nein**: in `_firma/config/daily-report.json`
`"template_mode": "anchor"` setzen und als `template_path` den **Ordner der gefüllten
KW-Berichte** (bzw. den jeweils letzten Bericht) hinterlegen statt einer leeren Vorlage.
Der Lauf wählt dann als Basis immer den jüngsten gefüllten Bericht des Projekts.
