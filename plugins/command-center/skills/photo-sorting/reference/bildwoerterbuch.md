# Bildwörterbuch — firmenspezifisches Sehen + Lernschleife

Zweck: Die Zuordnung Foto → Bericht-Tätigkeit wird über Wochen **treffsicherer**, weil Entscheidungen der Firma strukturiert gespeichert und beim nächsten Lauf wiederverwendet werden. Kein Modell-Training — das „Lernen" ist eine gepflegte Stammdaten-Datei plus Referenzfotos, die der Skill bei jedem Lauf konsultiert (rules.md §B0).

## Datei: `stammdaten/bildwoerterbuch.json`

```json
{
  "begriffe": [
    {
      "begriff": "Radstopper",
      "merkmale": "kurzes Betonrundelement ~90 cm, einzeln oder paarweise quer am Stellplatzkopf",
      "verwechslung_mit": "Bremsschwelle",
      "unterscheidung": "Bremsschwellen liegen als durchgehende Reihe längs der Fahrgasse; Radstopper stehen einzeln/paarweise am Kopf des Stellplatzes",
      "referenzfotos": ["_ausgang/bilder/KW 24/2026-06-09_Musterstadt_Radstopper eingebaut 2.jpeg"],
      "quelle": "Review-Korrektur 2026-07-20",
      "stand": "2026-07-20"
    }
  ]
}
```

- `begriff` = das Bauteil/Schlüsselwort, nicht die volle Tätigkeits-Formulierung (die wechselt je Bericht; das Bauteil bleibt).
- `referenzfotos` = **workspace-relative** Pfade auf bereits einsortierte Kopien (nie auf `_eingang/`-Quellen — die verschwinden). Max. ~3 je Begriff, die klarsten Beispiele.
- `unterscheidung` in Alltagssprache — sie wird beim nächsten Lauf wörtlich in den Steckbrief übernommen.
- Datei fehlt? Kein Fehler — sie entsteht mit dem ersten gelernten Eintrag (lazy, kein Onboarding-Feld).

## Nutzung beim Zuordnen (Pflicht, wenn Datei existiert)

Beim Steckbrief-Bau (rules.md §B0): Einträge lesen UND die Referenzfotos per Vision ansehen. Firmen-Referenz schlägt generisches Bauwissen. Ein Verwechslungspaar mit gepflegtem `unterscheidung`-Feld darf ohne Rückfrage entschieden werden (tier `sicher`, Begründung zitiert das Merkmal).

## Lernschleife — zwei Quellen, immer über Freigabe

**1. Review-Korrekturen (im Chat oder Board).** Ändert die Firma bei der Freigabe eine Zuordnung (Tätigkeit A → B) oder beantwortet eine prüfen-Rückfrage („die langen Reihen sind Bremsschwellen"):
- Antwort als Wörterbuch-Eintrag formulieren (`begriff`, `unterscheidung`, betroffenes Foto als Referenz) und **in derselben Review als Vorschlag zeigen** („Soll ich mir das so merken?").
- Nach Zustimmung: Eintrag schreiben, `{type:"correction", key:"photo:taetigkeit-korrigiert", detail:"<A → B>"}` in `signals.jsonl` loggen.

**2. Nachlauf-Abgleich (stille Korrekturen erkennen).** Firmen korrigieren oft NICHT im Board, sondern benennen Dateien später direkt im Zielordner um. Deshalb am Anfang jedes photo-sorting-Laufs (best-effort, nie blockierend):
1. Aus dem Journal (`_firma/_journal/*.jsonl`) die zuletzt kopierten Ziele dieses Prozesses ziehen (letzte ~2 Wochen genügen).
2. Je Journal-Ziel prüfen: existiert die Datei noch unter dem journalten Namen? Wenn nicht: im selben Ordner nach der Datei suchen (gleiche Größe/md5).
3. Umbenannt gefunden → die Differenz ist eine **stille Korrektur der Firma**: alten vs. neuen Namen vergleichen, insbesondere den Tätigkeits-Teil. Als `correction`-Signal loggen und — wenn sich daraus eine Unterscheidungsregel ergibt — einen Wörterbuch-Vorschlag in die aktuelle Review legen.
4. **Nie stillschweigend** ins Wörterbuch schreiben und niemals die umbenannte Datei „zurückkorrigieren" — der Firmenname ist der richtige.

## Anti-Patterns

- **Raten statt nachschlagen** — existiert ein Eintrag zum Verwechslungspaar, gilt er; generisches Bauwissen ist nachrangig.
- **Referenzfoto auf `_eingang/`-Pfade** — Quellen werden aufgeräumt; immer auf die einsortierte Kopie zeigen.
- **Wörterbuch ohne Freigabe füllen** — jeder Eintrag geht einmal durch die Review (GoBD-Logik: nachvollziehbar, wer entschieden hat).
- **Korrektur rückgängig machen** — benennt die Firma um, gewinnt die Firma.
