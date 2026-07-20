# Photo sorting — rules & onboarding

> **Modus B (Bericht-Scans):** Regeln für das Umbenennen/Archivieren abfotografierter Montage-/Serviceberichte stehen in `reference/bericht-scans.md` (aktiv bei `bericht_scans: an`).

## Date parsing (try in order)
1. **WhatsApp**: `... YYYY-MM-DD at HH.MM.SS` → date + time.
2. **IMG-YYYYMMDD-WA####** → date.
3. **Plain ISO** start `YYYY-MM-DD` / `YYYYMMDD`.
4. Else read the image's visible date or EXIF, or ask.

## Tageszeit-Heuristik (welcher Bautag wird dokumentiert?)
Das Datum im Dateinamen ist das Datum **des Versands/der Aufnahme**, nicht immer der gezeigten Arbeit:
- **Morgenbilder (07:00–10:59):** dokumentieren häufig den **Stand des Vortages** (der Vorarbeiter fotografiert beim Eintreffen den gestrigen Zustand) → auf den **Vortag** re-datieren. *(configurable on/off — `morning_heuristic`)*
- **Nachmittagsbilder (15:00–19:00):** dokumentieren i. d. R. die **Arbeit DES Tages** (Tagesende-Status) → Datum bleibt.

Beispiel: 20 Bilder alle vom `2026-05-12` → 9 von 08:33 morgens → `2026-05-11`; 11 von 16:20 nachmittags → bleiben `2026-05-12`.

## Inhalt schlägt Zeitstempel
Der Zeitstempel ist nur eine Heuristik. Liegt ein Bautagesbericht vor (§Site & activity matching), gilt: zeigt ein Foto eindeutig eine Tätigkeit, die der Bericht einem **anderen** Tag zuordnet, bekommt das Foto das Datum aus dem Bericht — egal wann es aufgenommen oder gesendet wurde. Widerspruch ohne klare Auflösung → tier `prüfen`.

## Naming convention
Default: `<datum>_<site-slug>_<taetigkeit>_<lfd:02d>.<ext>`. `lfd` is a per-day, per-site running number, zero-padded. Collision-safe: bump `lfd` rather than overwrite.

## Site & activity matching
- Site: match filename/image cues against `stammdaten/projekte.json` (`match` keyword → `name` + `ordner_name`). No register → ask.

### Tätigkeiten: Bautagesbericht = geschlossene Wortliste (Kernregel)

Existiert zum Projekt + Zeitraum des Foto-Stapels ein Bautagesbericht (suchen in `_ausgang/berichte/` — eigene daily-report-Ausgabe — und im konfigurierten `bericht_quelle`-Ordner), ist dessen Abschnitt „Ausgeführte Arbeiten"/„Beschreibung der Arbeiten" die **einzige** erlaubte Namensquelle für Tätigkeiten. Katalog, freie Vision-Benennung und Foto-Datum sind dann keine Namensquellen. Daran hängt der Bezug zur Abrechnung/Dokumentation: die Bild-Doku muss die Arbeiten des Berichts 1:1 wiedergeben. Ablauf zwingend in dieser Reihenfolge, VOR dem ersten Foto:

**A — Wochenliste bauen.**
1. Jede Tageszeile an Kommas in einzelne Tätigkeiten zerlegen — eine Zeile enthält oft 2–3 Arbeiten.
2. Fortschritts-Erwähnungen derselben Arbeit über mehrere Tage („begonnen" / „fortgeführt" / „abgeschlossen" / „fertiggestellt") zu EINER Tätigkeit zusammenfassen; Tagesspanne merken.
3. Namensform bilden: Mengen, Maße und Fortschritts-Marker streichen („6", „4 x", „(60 × 60 cm)", „nach Abschluss der Arbeiten", „begonnen") — **alle übrigen Wörter exakt wie im Bericht** (Substantiv UND Verb). Grammatische Umstellung auf die Partizipform ist erlaubt, solange nur Berichtswörter verwendet werden; nie ein Wort durch ein Synonym ersetzen.
4. Die Wochenliste (Tätigkeit + Tag/Spanne) gehört sichtbar in die Review-Ausgabe.

Beispiel (eine Woche, drei Berichtszeilen):

| Berichtszeile(n) | → Tätigkeit (Namensform) |
|---|---|
| Di: „6 E-Park Platten (60 × 60 cm) verlegt, 4 x Radstopper eingebaut, Arbeitsbereich nach Abschluss der Arbeiten gereinigt" | „E-Park Platten verlegt" · „Radstopper eingebaut" · „Arbeitsbereich gereinigt" — DREI Tätigkeiten |
| Mi: „Mit dem Einbau der Bremsschwellen begonnen" + Do: „Einbau der Bremsschwellen abgeschlossen" | „Bremsschwellen eingebaut" — EINE Tätigkeit, Spanne Mi–Do |
| Do: „Mit dem Setzen der Warnpoller begonnen" + Fr: „Warnpoller fertiggestellt" | „Warnpoller gesetzt" — Spanne Do–Fr |

**B0 — Steckbriefe bauen (nach der Wochenliste, VOR dem ersten Foto).** Zu jeder Listen-Tätigkeit kurz notieren, woran man sie auf einem Foto erkennt — das erzwingt, die Bericht-Tätigkeiten inhaltlich zu verstehen, bevor Bilder angesehen werden:
- **Objekt:** Wie sieht das Bauteil aus (Form, Größe, typische Einbausituation)? Was unterscheidet es von ähnlichen Listen-Tätigkeiten (Radstopper vs. Bremsschwelle)?
- **Werkzeug-Indizien:** Steinknacker/Trennschneider → zuschneiden · Wasserwaage/Richtwaage am Bauteil → setzen/ausrichten · Bohr-/Stemmhammer an offener Stelle → Ausbesserung · Besen/Kehrmaschine → reinigen · frische Vergussmasse/offene Fuge → gerade gesetzt.
- **Zustand:** Woran erkennt man „in Arbeit" (offene Bettung, Splitt, liegendes Werkzeug, Person arbeitet) vs. „fertig" (verfugt, gereinigt, Umfeld geschlossen)?
Existiert `stammdaten/bildwoerterbuch.json` (siehe `reference/bildwoerterbuch.md`), dessen Einträge in die Steckbriefe übernehmen und die hinterlegten **Referenzfotos ansehen** — sie schlagen generisches Bauwissen, weil sie zeigen, wie die Begriffe BEI DIESER FIRMA aussehen.

**B — Jedes Foto genau EINER Listen-Tätigkeit zuordnen. Bildinhalt entscheidet, nie das Datum.**
- **Indizien statt Bauchgefühl:** Pro Foto erst benennen, WAS zu sehen ist (Objekte, Werkzeuge, Arbeitsphase, Umfeld) — dann gegen die Steckbriefe halten. Die Tätigkeit mit den meisten belegten Indizien gewinnt; die Begründung nennt die Indizien, nicht nur das Ergebnis.
- **Aktive Arbeit schlägt Endzustand:** Ein Steinknacker AN der Bremsschwelle heißt „Pflastersteine … zugeschnitten", nicht „Bremsschwellen eingebaut" — die Tätigkeit ist das, was auf dem Foto PASSIERT. Zeigt das Foto nur einen fertigen Zustand, gilt die Tätigkeit, die diesen Zustand herstellt.
- **Dominanz-Regel für unscharfe Fotos:** Baustellenfotos passen oft nicht sauber auf eine Aufgabe (Übersicht, Zwischenstand, viel Umfeld). Dann: das dominanteste Merkmal des Bildes bestimmen (was füllt das Bild, worauf ist fokussiert?) und die Listen-Tätigkeit wählen, zu der es **am ehesten** passt. Die Liste ist kurz — „am ehesten" genügt; kein Foto bekommt einen Namen außerhalb der Liste.
- **Foto-Datum/Uhrzeit ist KEIN Zuordnungskriterium.** Handys senden gesammelt; ein Donnerstags-Foto zeigt oft Dienstags-Arbeit. Das Datum kommt erst NACH der inhaltlichen Zuordnung ins Spiel (Schritt C).
- Zeigen zwei Listen-Tätigkeiten visuell Ähnliches (z. B. zwei Sorten länglicher Betonelemente): Kontext-Merkmale entscheiden — Lage, Größe, Einbausituation, Umfeld; danach das Bildwörterbuch. Bleibt es mehrdeutig → tier `prüfen`, nicht raten — und die Frage an die Firma so stellen, dass die Antwort als Wörterbuch-Eintrag wiederverwendbar ist („Woran erkennt man bei euch X vs. Y?").
- Passt ein Foto zu KEINER Tätigkeit der Woche (fremdes Gewerk, reine Anlieferung) → `fallback`-Tätigkeit + tier `prüfen`. Niemals einen Namen erfinden.

**B2 — Serien-Regel (WhatsApp-Bursts).** Aufnahmen, deren Zeitstempel nur Sekunden auseinanderliegen und die dasselbe Motiv zeigen, bilden eine **Serie**: den Serien-Anker voll durchprüfen (B0/B-Ablauf), die übrigen erben Zuordnung + Tier. Jedes Serienmitglied trotzdem kurz ansehen — ein Motivwechsel bricht die Serie (neuer Anker). Das macht 20 Poller-Bilder konsistent statt 20-mal einzeln entschieden.

**B3 — Dubletten-Hinweis.** Nahezu identische Aufnahmen (gleiches Motiv, gleiche Perspektive, Sekunden auseinander) in der Review als Gruppe ausweisen („Nr. 4–8: praktisch identisch"). Es wird NICHTS weggelassen oder gelöscht — die Firma entscheidet selbst, ob sie alle braucht.

**C — Datum aus dem Bericht.** Dateinamen-Datum = Berichtstag der zugeordneten Tätigkeit: Liegt das Foto-Datum innerhalb der Tagesspanne → Foto-Tag behalten; sonst der nächstliegende Tag der Spanne. Widerspruch ohne klare Auflösung → `prüfen`.

**D — Abdeckungs-Check.** Nach der Zuordnung jede Berichts-Tätigkeit ohne ein einziges Foto in der Review ausweisen („Keine Fotos zu: …") — Doku-Lücken sichtbar machen, denn alle Arbeiten des Berichts sollen in der Bild-Doku auftauchen.

### Kein Bericht gefunden — erst fragen, nie still ausweichen
Ist eine `bericht_quelle` konfiguriert (Bericht-Betrieb), ist der Katalog **kein** automatischer Fallback: Fehlt der Bericht zum Projekt + Zeitraum, zuerst fragen — *„Ich finde keinen Bautagesbericht zu ‹Projekt/KW› in ‹Ordner› — liegt er woanders, soll ich auf ihn warten, oder ausnahmsweise ohne Bericht benennen?"* Im unbeaufsichtigten Sammel-Modus: Posten mit tier `prüfen` und dieser Rückfrage als `reason` einreihen (Tätigkeit = `fallback` als sichtbarer Platzhalter) — die Freigabe bleibt ohnehin gesperrt, bis jemand entscheidet. So bekommt nie ein Stapel stillschweigend Katalog-Namen, obwohl die Firma Bericht-Benennung erwartet.

### Ohne Bericht-Betrieb (keine `bericht_quelle` konfiguriert) — Fallback-Reihenfolge
1. Katalog: pick from the firm's configured activity list.
2. Bild lesen (Vision) / fragen.
Nicht zu generisch: „Pflasterarbeiten" für alles ist unzureichend, wenn erkennbar Spezifischeres passiert.

## Target path
Default `_ausgang/bilder`. If the firm mirrors into project folders, use `<base>/<kunde>/<ordner_name>/<bilder_subfolder>` from config.

**KW-Subordner** (`kw_subfolder: an`): unterhalb des Bilder-Ziels je Kalenderwoche ein Unterordner. Schreibweise: **vorhandene Konvention im Zielordner beibehalten** (`KW 19` vs. `KW19` — erst schauen, dann anlegen); für neue Ordner gilt `kw_folder_prefix` (Default `"KW "` mit Leerzeichen). Die Woche ist die **ISO-Woche** (ISO 8601, Montag-Start) aus dem Foto-Datum — bei Unsicherheit per `python3 -c "import datetime; print(datetime.date(J,M,T).isocalendar()[:2])"` prüfen (liefert ISO-Jahr + KW, auch am Jahreswechsel korrekt).

## Lose Dateien im Bilder-Bestand säubern (Modus C)
Auf Zuruf („lose Bilder einsortieren") oder wenn beim Ablegen Dateien direkt im Bilder-Wurzelordner liegen (statt in KW-/Projekt-Subordnern):
1. **Hash-Check gegen die Zielstruktur**: md5 jeder losen Datei gegen alle Dateien der Subordner. Treffer = **Dublette** → als Karte „Dublette — bereits einsortiert unter `<pfad>`" ausweisen, nichts kopieren (Löschen des losen Originals nur auf ausdrücklichen Wunsch).
2. **Unikat** → normaler Posten: Datum aus dem Dateinamen (§Date parsing), KW per ISO-Woche, Vorschlag in den passenden KW-Ordner (anlegen falls fehlend, Konvention s. o.).
3. Alles läuft über die normale Review-Queue — nie unbeaufsichtigt verschieben.

**Helfer-Skript** `${CLAUDE_PLUGIN_ROOT}/skills/photo-sorting/scripts/loose-files.py` (reines Python 3) übernimmt die Mechanik in zwei hart getrennten Stufen:
- `plan --root <bilder-ordner>` — hasht lose Dateien gegen alle Subordner-Dateien und schreibt einen JSON-Plan (Dublette → löschen / Unikat → per ISO-Woche in KW-Ordner verschieben). Bewegt nichts.
- `apply --root <dir> --plan <plan.json> [--dry]` — führt NUR den freigegebenen Plan aus. **Löscht ausschließlich bestätigte Hash-Dubletten, niemals Unikate**; Unikate werden nur verschoben. Vorher explizite Freigabe zeigen (welche gelöscht, welche wohin) + Löschrecht einmalig via `mcp__cowork__allow_cowork_file_delete`. (Die Copy-Engine `apply.py` kann nicht verschieben/löschen — dafür ist dieses Skript da.)

**Temp-Namen-Stage:** Bei Umbenennungen mit Kollisionen/Renumbering immer zweistufig — erst alle Quellen auf `tmp_NN.ext`, dann von Temp auf Zielnamen (sonst sind Tausch-Umbenennungen unmöglich).

**Lokal + Netzwerk parallel:** Existieren parallele Strukturen (lokale Kopie + Netzwerk-Ordner), jede Umbenennung auf **beide** anwenden (konsequente Reihenfolge) und danach verifizieren, dass beide Dateilisten identisch sind.

## Anti-Patterns
- **Vorhandenen Dateinamen blind vertrauen** — auch halbautomatisch erzeugte Namen sind oft falsch (klassischer Fall: „Schalungen_Fundamente" auf Fotos, die in Wahrheit einen Lastplattendruckversuch zeigen). Vor großen Umbenennungen 5–10 Stichproben per Vision lesen.
- **EXIF blind vertrauen** — WhatsApp strippt EXIF; das Datum MUSS dann aus dem Dateinamen kommen.
- **Bericht-Header blind vertrauen** — zeigt der Bericht-Kopf „KW 19", die Tagesdaten innen gehören aber zu KW 20, ist meist der Header der Tippfehler. Tagesdaten gewinnen; als `prüfen` markieren, Dateien nicht vorschnell „korrigieren".
- **Tätigkeit zu generisch** — die spezifische Bericht-Formulierung schlägt den Sammelbegriff.
- **Synonym statt Berichtswort** — „E-Auto Platte verlegt", wenn der Bericht „E-Park Platten verlegt" sagt; „Radstopper **verlegt**", wenn der Bericht „Radstopper **eingebaut**" sagt (echter Fall aus dem Praxistest). Substantiv UND Verb kommen aus dem Bericht — nie ein Wort durch ein vermeintlich passenderes ersetzen.
- **Katalog oder freie Benennung trotz vorhandenem Bericht** — der Katalog gilt nur, wenn zum Stapel kein Bericht existiert.
- **Tätigkeit aus dem Wochentag des Fotos ableiten** — zugeordnet wird über den Bildinhalt (Dominanz-Regel), nie über Datum/Uhrzeit der Datei.
- **Endzustand mit laufender Arbeit verwechseln** — Werkzeug im Einsatz zeigt die Tätigkeit, die gerade passiert (Steinknacker an der Schwelle = zuschneiden, nicht Schwellen-Einbau); nur reine Zustandsbilder bekommen die herstellende Tätigkeit.
- **Nachträgliche Umbenennungen der Firma ignorieren** — sie sind das wertvollste Lernsignal (Nachlauf-Abgleich in `reference/bildwoerterbuch.md`), keine Störung.

## Onboarding (run once per firm)
**Ask per `${CLAUDE_PLUGIN_ROOT}/reference/onboarding-ux.md`** (detect-first, numbered options + ✏️ + ⏭️, path-picker). Collect into `_firma/config/photo-sorting.json`:

1. **Activity catalog** `activities` — options: `1. Bau-Standardset übernehmen` (the generic Tiefbau starter below, editable) · `2. eigene Liste eingeben` · `3. später / frei lassen` · ✏️. A fixed catalog keeps filenames consistent (the model picks from it, not free text).
2. **Naming pattern** `naming_pattern` — default `{datum}_{baustelle}_{taetigkeit}_{lfd}` · ✏️. `lfd` = per day+site+activity running number, zero-padded.
3. **Umlauts** `umlaut_map` — default `ä→ae, ö→oe, ü→ue, ß→ss` (cross-platform) · „Umlaute behalten" · ✏️.
4. **Morning heuristic** `morning_heuristic` — default `an` (a photo taken 07:00–10:59 documents the previous day) · `aus` · ✏️.
5. **Fallback activity** `fallback` — default `Uebersicht` · ✏️.
6. **Zielordner** 🔍 — path-picker; propose a detected `Bauvorhaben`/`Baustellen` folder; capture the per-project pattern `Bauvorhaben ‹Jahr›/‹Kunde›/‹Baustelle›/` (resolve `‹Kunde›`/`‹Baustelle›` per run — match-or-create, never duplicate). Default `_ausgang/bilder`. *(gespeichert als `output_base` + `project_subpath_pattern`)*

7. **Bericht-Quelle** `bericht_quelle` 🔍 — Ordner mit fertigen Bautagesberichten (für den Tätigkeits-Abgleich). Default `_ausgang/berichte` (die eigene daily-report-Ausgabe); zusätzlich per Path-Picker den Berichtsordner der Firma erfassen · ⏭️.
8. **KW-Unterordner** `kw_subfolder` — default `aus` · `an` (+ `kw_folder_prefix`, Default `"KW "` mit Leerzeichen) · ✏️.
9. **Bericht-Scans (Modus B)** `bericht_scans` — „Sollen abfotografierte/gescannte Montage-/Serviceberichte mit umbenannt und archiviert werden?" — default `aus` · `an` → Sub-Onboarding nach `reference/bericht-scans.md` §Onboarding (Zielordner, BV-Kurzformen, Monteur-Schreibweisen → `stammdaten/monteure.json`).

(Sites come from `stammdaten/projekte.json` — propose its entries; offer to create it if absent.)
Then set `photo-sorting` under `cc:processes` to `onboarded`.

## Activity starter catalog (generic Tiefbau — editable per firm)
A neutral construction set the firm can adopt and edit; spaces become `-` in filenames:

Baustelleneinrichtung · Verkehrsabsicherung · Materialanlieferung · Geraete-Maschineneinsatz · Aufraeumen · Oberbodenabtrag · Auskoffern · Aushub-Fundament · Kabelgraben-herstellen · Baugrube-herstellen · Aushub-seitlich-lagern · Schotter-seitlich-lagern · Regenwasserleitung-legen · Kabel-verlegen · Kabel-absanden · Leitungen-verfuellen · Baugrube-anfuellen · Fundament-herstellen · Fundament-setzen · Poller-setzen · Markierungsplatten-legen · Schotter-einbauen · Splitt-einbauen · Sand-einbauen · Planum-herstellen · Splitt-abziehen · Verdichten · Borde-setzen · Pflastern · Einschlaemmen · Anfahrpfosten-anschneiden · Trafolieferung · Trafosetzung · Asphalt-stemmen · Lastplattendruckversuch · Restarbeiten · Feinreinigung · Endzustand

## Confidence-Kalibrierung & Lernschleife (v0.7.0)
- **`sicher`** nur, wenn: Baustelle in `stammdaten/projekte.json` zugeordnet, Datum sicher (Berichtstag der Tätigkeit, EXIF oder eindeutig aus Dateiname), Tätigkeit eindeutig aus der Bericht-Wochenliste (bzw. aus dem Katalog, wenn kein Bericht existiert), Zielordner eindeutig.
- **`prüfen`** sonst — fehlendes EXIF-Datum, unklare Baustelle, mehrdeutige oder erzwungene Zuordnung (`Uebersicht`-Fallback, visuell ähnliche Listen-Tätigkeiten ohne Kontext-Entscheid).
- **Verwechslungspaare** (zwei visuell ähnliche Listen-Tätigkeiten) gelten erst als eindeutig, wenn ein Kontext-Merkmal ODER ein Bildwörterbuch-Eintrag die Unterscheidung belegt — sonst `prüfen`. Serienmitglieder erben das Tier ihres Ankers.
- **Neue Baustelle** (nicht in `projekte.json`): `prüfen` **und** `fact:baustelle-<slug>`-Signal mit `severity:"folgenreich"`. Nach Freigabe Übernahme in Stammdaten anbieten (Lernschleife).
