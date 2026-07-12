---
name: trend-briefing
description: Generiere ein Trend-Briefing als Live Artifact — eine selbst-enthaltene HTML-Seite mit den aktuellen Top-Trends, Velocity-Signalen, Hook-Empfehlungen und aufsteigenden Mustern für eine Nische. Verwende diesen Skill wenn der Nutzer sagt "zeig das Briefing", "Trend-Briefing", "was sind meine aktuellen Trends", "zeig mir die Top-Trends", "Trend-Report", "briefing", oder wenn ein Nutzer einen aufbereiteten Überblick über Trend-Cluster für eine spezifische Nische möchte. Das Briefing fokussiert eine Nische (im Gegensatz zum Cockpit, das alle Niches überblickt) und gibt eine tiefere Auswertung mit Hook-Empfehlungen und Velocity-Analyse.
---

# Trend-Briefing — aufbereitete Nischen-Analyse als Live Artifact

Generiere das Trend-Briefing als **Cowork Live Artifact**: eine selbst-enthaltene HTML-Seite mit Top-Trends, Velocity-Signalen, Hook-Typen, Beispiel-Hooks und aufsteigenden Mustern — alle Daten werden zum Zeitpunkt der Generierung abgerufen und in die HTML-Datei eingebettet. Keine Laufzeit-Requests.

**Wichtig:** Das HTML-Artifact rendert nur die rohen Cluster-Daten. Die inhaltliche **Briefing-Narration** (Interpretation, Handlungsempfehlungen, was das wirklich bedeutet) liefert Claude nativ im Chat — das ist keine Server-Funktion, sondern Claude-Intelligenz angewandt auf die zurückgegebenen Daten.

**Avatar-personalisiert?** Das Briefing ist bewusst Nischen-weit (kein `persona_id`). Wenn der Nutzer Trends für einen bestimmten Avatar oder fertige Skripte in dessen Stimme will → route zur `script-studio`-Skill (matcht Trends nativ an die Avatar-DNA und schreibt Hooks/Skripte).

---

## Step 0 — Self-check (route, don't error)

Rufe zuerst `tf_health {}` auf (Tool des `trendfinder`-MCP-Servers, ohne Argumente).

Meldet es einen **Config-Fehler** oder kein `status: 200` → Setup ist noch nicht abgeschlossen. Sag dem Nutzer:

> "Trendfinder ist noch nicht eingerichtet — sollen wir das in 2 Minuten machen?"

Dann biet an:
```
1) Ja, Trendfinder einrichten
2) Abbrechen
```

Bei Option 1: route zum `onboarding` Skill. Generiere das Briefing **nicht** gegen eine fehlende Konfiguration.

---

## Step 1 — Daten sammeln (tf_request) → Snapshot schreiben → Generator ausführen

Der Generator ist **netzwerkfrei**: er rendert aus einem Snapshot, den du vorher host-seitig über das `tf_request`-Tool zusammenstellst. Die Niche-Auflösung passiert dabei HIER, vor dem Snapshot — nicht mehr im Generator.

**1. Ziel-Nische auflösen (Tenant-Isolation):**

```
tf_request { "method": "GET", "endpoint": "/api/niches/config" }
```

- Hat der Nutzer eine Nische genannt: gegen diese Liste auflösen. Taucht der genannte Slug NICHT in der Liste auf → stopp, zeige die echten verfügbaren Niches (Nummern-Liste) und frag — niemals mit einem nicht-eigenen Slug weitermachen.
- Keine Nische genannt: bei genau einer eigenen Niche diese verwenden; sonst die erste eigene Nische (Default wie bisher) oder bei Unklarheit kurz nummeriert fragen.
- Liefert die Liste **keine** Niches → route zum `onboarding` Skill für die Nische-Anlage. Kein Snapshot.
- Bei `status: 401` → Zugang kaputt: route zu `onboarding`.

**2. Trend-Daten ziehen:**

```
tf_request { "method": "GET", "endpoint": "/api/trends/<niche_id>" }
tf_request { "method": "GET", "endpoint": "/api/trends/<niche_id>/velocity" }
```

Velocity ist optional — schlägt nur dieser Abruf fehl, weiter ohne, mit Hinweis `"Velocity-Daten nicht verfügbar."` in `warnings`. **Kein `persona_id`-Parameter** (das Briefing ist bewusst Nischen-Ebene).

**3. Snapshot schreiben:** `{ "niche": <der aufgelöste Nischen-Eintrag aus /api/niches/config>, "trends": <Response-Body>, "velocity": <Response-Body>, "warnings": [...] }` als JSON nach `{workspace}/.trendfinder/briefing-snapshot.json` (keine Secrets; exakte Form im Kopfkommentar von `briefing.ts`).

**4. Generator ausführen:**

```
if command -v bun >/dev/null 2>&1; then bun ${CLAUDE_PLUGIN_ROOT}/skills/trend-briefing/scripts/briefing.ts --data <snapshot.json> <workspace_root>; else node --experimental-strip-types ${CLAUDE_PLUGIN_ROOT}/skills/trend-briefing/scripts/briefing.ts --data <snapshot.json> <workspace_root>; fi
```

Der Generator inlinet den Snapshot in eine selbst-enthaltene HTML-Datei und gibt als **letzte stdout-Zeile** den absoluten Pfad zur geschriebenen Datei aus (Standard: `<workspace_root>/.trendfinder/briefing.html`).

**Best-effort-Verhalten:** Der Generator bricht nie mit einem Fehler ab, wenn Trends fehlen — ein frischer Tenant ohne Scrape-Daten bekommt einen action-first Cold-Start-Zustand.

**Falls der Generator mit Exit-Code ≠ 0 endet:**
- Lies die **stderr-Ausgabe** als deutsche Fehlermeldung und gib sie wortgetreu weiter.
- Ursache ist dann ein Snapshot-Problem (Datei fehlt / kein gültiges JSON / `niche` fehlt) — Snapshot korrigieren und erneut ausführen. Zugangs-/Backend-Fehler werden schon beim `tf_request`-Datenabruf sichtbar (401 → `onboarding`, 5xx/Netzwerk → "Versuch es in einem Moment noch einmal").

---

## Step 2 — Present as Live Artifact

Präsentiere die generierte HTML-Datei als **Live Artifact** nach dem kanonischen Verfahren in `${CLAUDE_PLUGIN_ROOT}/reference/artifact-presentation.md` (Datei verifizieren → stabiler Pfad → präsentieren → **Fallback in den Chat, wenn das Panel nicht lädt**) — **nicht** nur als Dateipfad.

Lies den absoluten Pfad aus der letzten stdout-Zeile des Generators.

Gib danach eine **native Briefing-Narration** im Chat — 3–5 Sätze, in der Sprache des Nutzers:

- **Relevanz zuerst prüfen:** Passen die `dominant_hashtags` der Top-Cluster zum Nischen-Thema / den konfigurierten Hashtags? Wenn die Top-Cluster klar themenfremd sind (z. B. `techtok`/`gaming` bei einer Coaching-Nische, kein Nischen-Tag in den Top-3), **leite mit einer ehrlichen Warnung ein** statt die Fremd-Trends zu präsentieren: „Die gefundenen Trends passen nicht zu deiner Nische — die Hashtags sind vermutlich zu breit/englisch. Empfehlung: verfeinern (deutsch, spezifisch) und neu scrapen." Schlage 5–8 bessere Tags vor. Siehe `${CLAUDE_PLUGIN_ROOT}/reference/niche-hashtags.md`.
- **Was steht oben:** Nenne die Top-1-2-Trends mit Trend-Score und Lifecycle — nur Zahlen, die der Generator tatsächlich geschrieben hat.
- **Velocity-Signal:** Gibt es aktiv beschleunigende Cluster (hoher Score + positive Velocity + Lifecycle-Stage `rising`/`emerging`)? Oder überwiegen sinkende Trends?
- **Hook-Empfehlung:** Wenn Hook-Typen und Hook-Beispiele vorhanden sind, nenne den wirkungsstärksten Hook für den Top-Trend.
- **Nächster Schritt:** eine konkrete Handlungsempfehlung (z. B. "Scrape jetzt für mehr Daten" bei Cold-Start, oder "Trend X ist im Peak — schnell verwerten").
- Den Hinweis: "Sag einfach ‚zeig das Trend-Briefing', um zu aktualisieren."

---

## Honesty rules

- Das Briefing ist ein regenerierter Snapshot — kein Live-Stream. Der Stand:-Zeitstempel im Artifact zeigt, wann es generiert wurde.
- **Die Narration im Chat ist Claude-Intelligenz** — keine Server-Funktion. Das HTML-Artifact rendert die Roh-Daten; Claude interpretiert sie nativ.
- Leere Zustände benennen die nächste Aktion: "Noch keine Trends — starte zuerst einen Scrape."
- Erfinde keine Trend-Zahlen oder Hook-Beispiele. Berichte ausschließlich, was der Generator in die HTML-Datei geschrieben hat.
- Scores und Velocity sind relative Signale innerhalb des Datensatzes dieser Nische — nicht absoluter Wahrheitsanspruch über globale Trends. Sag "im Datensatz" nicht "im Internet".
- Für eine Aktualisierung diesen Skill einfach erneut ausführen — das überschreibt `briefing.html`.

---

## Tenant-isolation rules

- Es werden **ausschließlich eigene Nischen-Slugs** gefetcht — die Auflösung gegen `/api/niches/config` dieses Tenants passiert in Step 1 VOR dem Snapshot; ein nicht-eigener Slug wird dort abgelehnt (echte Liste zeigen), nie durchgereicht.
- **Kein `persona_id`-Parameter** wird übergeben — das Briefing ist bewusst Nischen-Ebene; avatar-personalisierte Auswahl macht `script-studio` (natives DNA-Matching).
- **Keine Brands oder Personas** werden abgerufen oder angezeigt.
- Der Generator selbst macht keine Requests mehr — er rendert nur den Snapshot.

---

## Abschluss (PFLICHT) — Next-Steps-Auswahlblock

Beende deine Antwort IMMER mit dem interaktiven **Auswahlblock** (die selektierbaren Options-UI-Blöcke, die Cowork rendert) — Spezifikation: `${CLAUDE_PLUGIN_ROOT}/reference/next-steps.md`. Zeige alle im aktuellen Zustand sinnvollen Optionen und markiere **genau eine** als ⭐ Empfehlung, passend zu dem, was du gerade getan hast. Nutze die ⭐-Kontext-Tabelle und die Zustands-Regeln aus dieser Datei.
