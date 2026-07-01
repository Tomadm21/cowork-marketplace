# Baustellen-Doku sortieren — rules & onboarding

Dieser Skill deckt **drei Modi** ab, alle über denselben Cowork-Flow (intake → review-board → apply):

- **Modus A — Baustellen-Fotos:** Handy/WhatsApp-Bilder nach Datum + Tätigkeit aus dem Bautagesbericht → `YYYY-MM-DD_Ort_Tätigkeit_NN.ext`.
- **Modus B — Montagebericht-Scans:** abfotografierte/eingescannte Service-Reports (Höcker-Polytechnik u. a.) → `JJJJ KWnn BV V.Nachname [V.Nachname ...].ext`.
- **Modus C — Lose-Datei-Bereinigung:** herumliegende Bilder im Bilder-Wurzelordner per Hash entdubletten und per ISO-Woche in KW-Ordner einsortieren.

Welcher Modus greift, ergibt sich aus dem Input (siehe SKILL.md). Im Zweifel nachfragen.

---

## Modus A — Baustellen-Fotos

### Date parsing (try in order)
1. **WhatsApp**: `... YYYY-MM-DD at HH.MM.SS` → date + time.
2. **IMG-YYYYMMDD-WA####** → date.
3. **Plain ISO** start `YYYY-MM-DD` / `YYYYMMDD`.
4. Else read the image's visible date or EXIF, or ask.

> **EXIF ist bei WhatsApp gestrippt** — nicht darauf verlassen. Das Datum **muss** aus dem Dateinamen kommen; ein leeres EXIF-Feld heißt nicht "kein Datum". Die Uhrzeit im Dateinamen speist die Tageszeit-Heuristik.

### Tageszeit-Heuristik: welcher Bautag wird dokumentiert?
Das Datum im WhatsApp-Namen ist das Datum **des Versands/der Aufnahme**, nicht immer der gezeigten Arbeit.

- **Morgenbilder (07:00–10:59):** dokumentieren häufig den **Stand des Vortages** (Vorarbeiter fotografiert beim Eintreffen den gestrigen Zustand) → auf den **Vortag** re-datieren. *(configurable on/off — `morning_heuristic`)*
- **Nachmittagsbilder (15:00–19:00):** dokumentieren i. d. R. die **Arbeit DES Tages** (Tagesende-Status) → Datum bleibt.
- **Inhalts-Override:** Zeigt ein Nachmittagsbild eindeutig eine Vortags-Tätigkeit (laut Bautagesbericht), gehört es auf den Vortag — **egal wann fotografiert**. Inhalt schlägt Uhrzeit.

Beispiel: 20 Bilder alle vom `2026-05-12` → 9 von 08:33 morgens → `2026-05-11`; 11 von 16:20 nachmittags → bleiben `2026-05-12`.

### Tätigkeit WÖRTLICH aus dem Bautagesbericht
Die Tätigkeit muss möglichst exakt der Formulierung im Bautagesbericht (PDF/DOCX) entsprechen, damit der Bezug zur Abrechnung/Dokumentation klar bleibt. Lies den Bericht pro Datum und extrahiere die wörtlichen Aktivitäten; bilde daraus Slugs (Leerzeichen → `_`):
- „Pflaster verlegt mit der Pflastermaschine" → `Pflaster_verlegt`
- „Säulen und Dachstützen rundherum eingeschnitten" → `Säulen_eingeschnitten`
- „Lastplattendruckversuch durchgeführt, 50–58 MN/m²" → `Lastplattendruckversuch`
- „Sauberkeitsschicht betoniert" → `Sauberkeitsschicht_betoniert`

Der Katalog unten ist der **Fallback**, wenn kein Bericht vorliegt; liegt ein Bericht vor, ist sein Wortlaut die Quelle der Wahrheit (spezifisch schlägt generisch: `Säulen_eingeschnitten` statt pauschal `Pflasterarbeiten`).

### Inhalt vs. Name verifizieren (Vision-Stichprobe)
Vertraue **nicht blind** auf vorhandene Dateinamen — auch halb-automatisch erzeugte Namen können falsch sein. Lade **5–10 repräsentative Bilder per Read/Vision**, bevor du große Umbenennungen als `sicher` freigibst. Reale Verwechslungen:
- „Schalungen_Fundamente" auf Bildern, die den **Lastplattendruckversuch** zeigen (TerraTest-3000-Gerät auf Schotter sieht oberflächlich wie Pflaster aus).
- Sammelbegriff „Pflasterarbeiten" für Bilder mit sehr spezifischer Tätigkeit (Passstücke, Säulen-Detail).

Widerspricht der Bildinhalt dem Namen/Bericht → `tier: "prüfen"` mit Begründung, nicht still korrigieren.

### Naming convention
Default: `<datum>_<site-slug>_<taetigkeit>_<lfd:02d>.<ext>`. `lfd` = per-day, per-site running number, zero-padded. Collision-safe: bump `lfd` rather than overwrite.

### Site & activity matching
- Site: match filename/image cues against `stammdaten/projekte.json` (`match` keyword → `name` + `ordner_name`). Kein Treffer → fragen (neue Baustelle → Lernschleife unten).
- Activity: aus dem Bautagesbericht (bevorzugt) bzw. aus dem konfigurierten Katalog; passt nichts → fragen.

### Target path
Default `_ausgang/bilder`. Spiegelt die Firma in Projektordner, nutze `<base>/<kunde>/<ordner_name>/<bilder_subfolder>` aus der Config.

---

## Modus B — Montagebericht-Scans

Quelle: abfotografierte/eingescannte handschriftliche Höcker-Polytechnik-Service-Reports (oder andere Montagebericht-Vordrucke), typischerweise mit kryptischen Namen (`IMG-20260518-WA0042.jpg`, `Scan001.pdf`).

### Schema (final 22.05.2026)
```
JJJJ KWnn BV V.Nachname [V.Nachname ...].ext
```
- **`JJJJ`** = vierstelliges Jahr (`2026`).
- **`KWnn`** = Kalenderwoche, **immer zweistellig** (`KW09`, `KW20` — nie `KW9`; sonst falsche Sortierung).
- **`BV`** = Baustelle als **Ort + Kunde**, Kurzform (`Andernach Assyx`, `Hilter Höcker`, `Frankfurt Lufthansa`) — **nicht** der komplette Bosse-String „BV Andernach (Assyx, MultiStar JR 8/8)".
- **`V.Nachname`** = Vornamens-Kürzel + Punkt + Nachname in **exakter Galant-Schreibweise** (Tabelle unten). Mehrere Monteure aus **einem** Bericht mit **einfachem Leerzeichen** trennen — kein Komma, kein Unterstrich.
- **`_Suffix`** (optional) für Sonderberichte: `_Anreise`, `_Heimfahrt`, `_2` — direkt am letzten Namen anhängen.

Beispiele:
```
2026 KW19 Andernach Assyx M.Hamrol R.Hamrol A.Smolarek.jpeg
2026 KW20 Andernach Assyx M.Hamrol P.Drgas.jpeg
2026 KW20 Andernach Assyx P.Drgas P.Hamrol_Anreise.jpeg
```

### Monteur-Schreibweisen (EXAKT übernehmen — `stammdaten/monteure.json`)
| Vorname | Schreibweise im Dateinamen |
|---|---|
| Pawel Hamrol | `P.Hamrol` (kein Leerzeichen) |
| Mateusz Hamrol | `M.Hamrol` (kein Leerzeichen) |
| Robert Hamrol | `R.Hamrol` (kein Leerzeichen) |
| Arthur Smolarek | `A.Smolarek` (kein Leerzeichen) |
| Pawel Drgas | `P. Drgas` (Punkt + Leerzeichen!) |
| Dawid Walkowiak | `D. Walkowiak` (Punkt + Leerzeichen!) |

**Drei Hamrol-Brüder** + **zwei Pawels** (`P.Hamrol` vs. `P. Drgas`) — nicht verwechseln. Bei handschriftlicher Mehrdeutigkeit auf dem Bericht **IMMER per AskUserQuestion nachfragen, nie raten.**

### Ableitung pro Scan (Bild lesen)
1. **Datum-Spalten** im Bericht → Jahr + KW (eine KW endet sonntags; eine Sonntag-Anreise gehört noch zur laufenden KW).
2. **Adresse / Projekt-Kopf** → BV-Name (`Ort Kunde`).
3. **Team-Zeile + Unterschrift** → welche Monteure dabei waren.
4. **Konflikte:** mehrere Berichte zur selben KW+BV+Crew → Suffix `_2` / `_Anreise` / `_Heimfahrt`.

### Schnittstelle zum Rechnungsgenerator (invoicing)
Die hier umbenannten Scans sind die **Eingangs-Belege** für `invoicing`. Konsistente Namen erleichtern die spätere Zuordnung („die 4 Berichte aus KW 20 Andernach"). Das Schema wird von `invoicing` **nicht geparst** — es dient der visuellen Übersicht + Archivsuche.

---

## Modus C — Lose-Datei-Bereinigung (Netzwerk-Wartung)

Liegen Bilder direkt im `7.Bilder`-Wurzelordner (nicht in KW-Subordnern), räume sie auf — über das Helfer-Skript `${CLAUDE_PLUGIN_ROOT}/skills/photo-sorting/scripts/loose-files.py`:

- **`plan`** listet lose Dateien, bildet Inhalts-Hashes, vergleicht gegen die Subordner-Dateien und schlägt je Datei vor: **Duplikat** (gleicher Hash existiert schon → löschen) oder **Unikat** (kein Treffer → per ISO-Woche in KW-Ordner verschieben).
- **`apply`** führt den freigegebenen Plan aus. **Sicherheit: `apply` löscht ausschließlich bestätigte Hash-Duplikate, niemals Unikate.** Unikate werden nur verschoben.

**Freigabe-Gate (hart):** Zeige den Plan (welche gelöscht, welche wohin verschoben) und hole **explizite** Freigabe, bevor `apply` läuft. Modus C nutzt **nicht** die Copy-Engine (die kopiert nur) — Verschieben/Löschen passiert über das Helfer-Skript nach OK. Löschrecht einmalig via `mcp__cowork__allow_cowork_file_delete`.

**Temp-Namen-Stage:** Bei Umbenennungen mit Kollisionen/Renumbering immer zweistufig — erst alle Quellen auf `tmp_NN.ext`, dann von Temp auf Zielnamen (sonst sind Tausch-Umbenennungen unmöglich).

### KW-Ordner-Konvention
Ordnernamen sind im Bestand uneinheitlich: `KW 19` (mit Leerzeichen, Standard) — teils `KW48` (ohne). **Vorhandene Konvention beibehalten**; für **neue** Ordner „mit Leerzeichen" (Mehrheitskonvention).

### Lokal + Netzwerk parallel halten
Existieren parallele Strukturen (Desktop-Kopie + Netzwerk-Ordner), wende jede Umbenennung auf **beide** an (konsequente Reihenfolge) und verifiziere danach, dass beide Dateilisten **identisch** sind.

---

## Naming convention (gemeinsam)
Umlaut-Handling per `umlaut_map` (Default `ä→ae, ö→oe, ü→ue, ß→ss`, cross-platform) — außer die Firma wählt „Umlaute behalten". Modus B nutzt Umlaute im BV-Namen wie geschrieben (`Höcker`), da Zielsystem Windows-Netzlaufwerk.

## Anti-Patterns (häufige Fehler vermeiden)
- **PDF-Header-Tippfehler ≠ falscher Dateiname:** Zeigt ein PDF „Datum: KW 19" im Header, aber die Tagesdaten drin (z. B. 11.05.) gehören zu KW 20, ist der **Header-Tippfehler** falsch, nicht der Dateiname — **nicht** vorschnell PDFs tauschen.
- **EXIF blind vertrauen:** WhatsApp strippt EXIF → Datum aus dem Dateinamen.
- **Aktivität zu generisch:** „Pflasterarbeiten" für alles ist meist unzureichend — nutze den Bericht-Wortlaut (`Säulen_eingeschnitten`, `Passstücke_am_Fundament`).
- **Hash-Check überspringen:** bei losen Dateien immer Hash-Vergleich, sonst werden Duplikate doppelt sortiert.
- **Schreibweise raten (Modus B):** bei mehrdeutiger Team-Zeile (welcher M.H? welcher P.D?) **immer** fragen.
- **Komma statt Leerzeichen (Modus B):** Trenner ist **Leerzeichen** (User-Entscheidung 22.05.2026).

---

## Onboarding (run once per firm)
**Ask per `${CLAUDE_PLUGIN_ROOT}/reference/onboarding-ux.md`** (detect-first, numbered options + ✏️ + ⏭️, path-picker). Collect into `_firma/config/photo-sorting.json`:

1. **Activity catalog** `activities` — `1. Bau-Standardset übernehmen` (Tiefbau-Starter unten, editierbar) · `2. eigene Liste` · `3. später` · ✏️. (Bei vorliegendem Bautagesbericht ist dessen Wortlaut ohnehin die Quelle; der Katalog ist Fallback.)
2. **Naming pattern** `naming_pattern` — default `{datum}_{baustelle}_{taetigkeit}_{lfd}` · ✏️.
3. **Umlauts** `umlaut_map` — default `ä→ae, ö→oe, ü→ue, ß→ss` · „behalten" · ✏️.
4. **Morning heuristic** `morning_heuristic` — default `an` (07:00–10:59 = Vortag) · `aus` · ✏️.
5. **Fallback activity** `fallback` — default `Uebersicht` · ✏️.
6. **Zielordner** 🔍 — path-picker; detektierten `Bauvorhaben`/`Baustellen`-Ordner vorschlagen; Muster `Bauvorhaben ‹Jahr›/‹Kunde›/‹Baustelle›/` (`‹Kunde›`/`‹Baustelle›` per run match-or-create). Default `_ausgang/bilder`. *(`output_base` + `project_subpath_pattern`)*
7. **Montageberichte (Modus B)** — aktivieren? Wenn ja: **Monteur-Liste** `stammdaten/monteure.json` (Galant-Starter oben vorschlagen: die 6 Schreibweisen, editierbar) + **Scan-Zielordner** 🔍 (z. B. `…/Montageberichte ‹BV›/`). *(gespeichert als `montagebericht: {enabled, monteure_ref, scan_output_base}`)*

(Sites aus `stammdaten/projekte.json` — vorschlagen; anlegen anbieten, falls fehlend.)
Then set `photo-sorting` under `cc:processes` to `onboarded`.

## Activity starter catalog (generic Tiefbau — editable per firm)
Neutraler Bau-Satz, den die Firma übernehmen + editieren kann; Leerzeichen → `-` im Dateinamen:

Baustelleneinrichtung · Verkehrsabsicherung · Materialanlieferung · Geraete-Maschineneinsatz · Aufraeumen · Oberbodenabtrag · Auskoffern · Aushub-Fundament · Kabelgraben-herstellen · Baugrube-herstellen · Aushub-seitlich-lagern · Schotter-seitlich-lagern · Regenwasserleitung-legen · Kabel-verlegen · Kabel-absanden · Leitungen-verfuellen · Baugrube-anfuellen · Fundament-herstellen · Fundament-setzen · Poller-setzen · Markierungsplatten-legen · Schotter-einbauen · Splitt-einbauen · Sand-einbauen · Planum-herstellen · Splitt-abziehen · Verdichten · Borde-setzen · Pflastern · Einschlaemmen · Anfahrpfosten-anschneiden · Trafolieferung · Trafosetzung · Asphalt-stemmen · Lastplattendruckversuch · Restarbeiten · Feinreinigung · Endzustand

## Confidence-Kalibrierung & Lernschleife
- **`sicher`** nur, wenn: Baustelle in `stammdaten/projekte.json` (Modus A) bzw. Monteure eindeutig in `stammdaten/monteure.json` (Modus B), Datum/KW sicher, Tätigkeit aus Bericht/Katalog mit hoher Sicherheit, Zielordner eindeutig, Bild-Stichprobe stützt den Namen.
- **`prüfen`** sonst — fehlendes EXIF-Datum, unklare Baustelle, geratene Tätigkeit (`Uebersicht`-Fallback), handschriftliche Monteur-Mehrdeutigkeit, Inhalt-vs-Name-Widerspruch.
- **Neue Baustelle / neuer Monteur** (nicht in Stammdaten): `prüfen` **und** `fact:`-Signal mit `severity:"folgenreich"`. Nach Freigabe Übernahme in Stammdaten anbieten (Lernschleife schließt sich — künftig `sicher`).
