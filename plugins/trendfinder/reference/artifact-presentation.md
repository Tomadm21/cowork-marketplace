# Live Artifact präsentieren — kanonisches Verfahren

Gilt für ALLE Skills, die eine generierte HTML-Datei als Cowork Live Artifact zeigen (cockpit, trend-briefing, und jeder Skill, der das Cockpit regeneriert: onboarding, avatar-studio, scrape-now, journey). Das Artifact-Rendering im Cowork-Client ist nicht 100 % zuverlässig — deshalb ist dieses Verfahren verbindlich, inklusive Fallback.

## 1. Vor dem Präsentieren: Datei verifizieren

- Der Artifact-Pfad ist IMMER die **letzte stdout-Zeile des Generators** — nie ein anderer, geratener oder temporärer Pfad.
- Prüfe, dass die Datei existiert und nicht leer ist (`test -s <pfad>`). Existiert sie nicht → Generator-Fehler behandeln (stderr lesen), NICHT eine leere/alte Datei präsentieren.

## 2. Stabiler Pfad, Überschreiben statt Neuanlegen

- Jedes Artifact hat genau EINEN stabilen Pfad (`.trendfinder/cockpit.html`, `.trendfinder/briefing-<niche_id>.html`). Eine Regeneration überschreibt dieselbe Datei — niemals datierte Kopien oder Varianten anlegen (sonst zeigt der Nutzer-Tab eine veraltete Datei).

## 3. Präsentieren — und nach JEDER Regeneration erneut

- Präsentiere die HTML-Datei als **Live Artifact** (persistenter Cowork-Tab) — nicht nur als Dateipfad im Text.
- Nach jeder Regeneration das Artifact **erneut präsentieren**: Ein bereits offener Tab aktualisiert sich nicht zwingend von selbst. Sag dem Nutzer dazu einen Satz („Cockpit aktualisiert — Stand HH:MM").

## 4. Fallback (PFLICHT) — der Chat trägt die Information, nicht das Panel

Der Nutzer darf NIE vom Artifact-Panel abhängen, um die entscheidungsrelevante Information zu bekommen:

- **Immer** zusätzlich eine In-Chat-Zusammenfassung liefern (die Skills definieren, was rein gehört — z. B. Top-Trends, Anzahl offener Skripte, nächster Schritt).
- Wenn das Artifact nicht präsentiert werden kann, oder der Nutzer meldet, dass das Panel leer bleibt / nicht lädt:
  1. Das ehrlich sagen (nicht so tun, als sei es offen).
  2. Den absoluten Dateipfad nennen mit dem Hinweis, die Datei über das Datei-Panel des Workspaces zu öffnen.
  3. Die Kern-Inhalte direkt im Chat ausgeben (bei Trends: Top-3-Liste mit Scores; bei Skripten: das vollständige Skript als Markdown; bei Avataren: die DNA-Zusammenfassung).
- Meldet der Nutzer wiederholt Render-Probleme → biete an, künftig standardmäßig die Chat-Ausgabe zu liefern und das Artifact nur auf Wunsch zu generieren.

## 5. Niemals

- Niemals behaupten, das Artifact sei sichtbar/aktualisiert, ohne es in diesem Turn präsentiert zu haben.
- Niemals einen anderen Pfad präsentieren als den, den der Generator ausgegeben hat.
- Niemals die Chat-Zusammenfassung weglassen, weil „es ja im Artifact steht".
