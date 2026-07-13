---
name: cockpit
description: Zeig das Trendfinder-Cockpit als Live Artifact — einen Echtzeit-Snapshot mit allen Niches, aktuellen Trends, Avataren und dem empfohlenen nächsten Schritt. Verwende diesen Skill wenn der Nutzer sagt "zeig das Cockpit", "show cockpit", "trendfinder dashboard", "was trendet", "zeig meine trends", "zeig meine avatare", "übersicht" — oder immer wenn ein zurückkehrender Nutzer seinen Trendfinder-Status auf einen Blick sehen will. Ideal als Startbildschirm für jeden Trendfinder-Workspace.
---

# Cockpit — der Trendfinder-Überblick

Generiere den Workspace-Snapshot als **Cowork Live Artifact**: eine selbst-enthaltene HTML-Seite mit allen Niches, Trend-Clustern, Velocity-Daten, Avataren und dem empfohlenen nächsten Schritt. Stand:-Zeitstempel zeigt den Generierungszeitpunkt — kein Streaming, kein Live-Push.

**Das Cockpit ist der Frontend-Ersatz:** Der Content-Tab zeigt jedes Skript im **Volltext** (Hook, Beats, CTA, Caption, Hashtags, Dreh-Notizen — aufklappbar pro Piece), der Avatare-Tab die **volle DNA** (Profil, Ton, Pillars, Interessen, Origin-Story, System-Prompt — aufklappbar pro Karte). Der Nutzer muss für nichts davon in die Web-App.

---

## Step 0 — Self-verify (route, don't error)

Rufe zuerst `tf_health {}` auf (Tool des `trendfinder`-MCP-Servers, ohne Argumente).

Meldet es einen **Config-Fehler** oder kein `status: 200` → Setup ist noch nicht abgeschlossen. Sag dem Nutzer:

> "Trendfinder ist noch nicht eingerichtet — sollen wir das in 2 Minuten machen?"

Dann biet an:
```
1) Ja, Trendfinder einrichten
2) Abbrechen
```

Bei Option 1: route zum `onboarding` Skill. Generiere das Cockpit **nicht** gegen eine fehlende Konfiguration — das würde nur einen Fehler erzeugen, den der Nutzer nicht selbst beheben kann.

---

## Step 1 — Daten sammeln (tf_request) → Snapshot schreiben → Generator ausführen

Der Generator ist **netzwerkfrei**: er rendert aus einem Snapshot, den du vorher host-seitig über das `tf_request`-Tool zusammenstellst (die Egress-Sperre der Bash-Sandbox spielt dadurch keine Rolle mehr). Dieses Verfahren ist die kanonische Anleitung — andere Skills (onboarding, avatar-studio, scrape-now) verweisen hierauf.

**1. Daten ziehen — alle Aufrufe via `tf_request`, best-effort (einzelne Ausfälle landen als `errors`/`warnings` im Snapshot statt abzubrechen):**

- `GET /api/niches/config` → Snapshot-Key `niches`. Bei `status: 401` → Zugang kaputt: route zu `onboarding`, keinen Snapshot bauen.
- Pro Niche: `GET /api/trends/<niche_id>` → `trends["<niche_id>"]`; wenn nicht leer, zusätzlich `GET /api/trends/<niche_id>/velocity` → `velocity["<niche_id>"]`. Schlägt der Trend-Abruf einer Niche fehl → `errors["<niche_id>"] = "<einzeilige Meldung>"`.
- `GET /api/brands` → `brands`.
- Pro Marke: `GET /api/brands/<brand_id>/personas` (slim), dann pro Persona `GET /api/personas/<persona_id>` (voll, mit DNA) → `personas["<brand_id>"] = [volle Persona-Objekte]`. Schlägt ein Detail-Abruf fehl, das Slim-Objekt verwenden.
- Pro Persona: `GET /api/personas/<persona_id>/content-pieces?limit=200` → `content_pieces["<persona_id>"]`.
- `GET /api/schedules` → `schedules`.
- Nicht-fatale Ausfälle zusätzlich als Klartext-Hinweis in `warnings` sammeln (z. B. „Zeitpläne konnten nicht geladen werden").

**2. Snapshot schreiben:** das Objekt `{niches, trends, velocity, errors, brands, personas, content_pieces, schedules, warnings}` (rohe Response-Bodies; exakte Form im Kopfkommentar von `cockpit.ts`) als JSON nach `{workspace}/.trendfinder/cockpit-snapshot.json` schreiben — der Snapshot enthält keine Secrets.

**3. Generator ausführen:**

```
if command -v bun >/dev/null 2>&1; then bun ${CLAUDE_PLUGIN_ROOT}/skills/cockpit/scripts/cockpit.ts --data <snapshot.json> <workspace_root>; else node --experimental-strip-types ${CLAUDE_PLUGIN_ROOT}/skills/cockpit/scripts/cockpit.ts --data <snapshot.json> <workspace_root>; fi
```

Der Generator inlinet den Snapshot in eine selbst-enthaltene HTML-Datei und gibt als **letzte stdout-Zeile** den absoluten Pfad zur geschriebenen Datei aus (Standard: `<workspace_root>/Trendfinder-Cockpit.html` — bewusst sichtbar im Workspace-Root, Dot-Ordner sind im Cowork-Dateipanel unsichtbar).

**Best-effort-Verhalten:** Der Generator bricht nie mit einem Fehler ab, wenn Daten fehlen oder leer sind — ein frischer Tenant ohne Scrape-Daten bekommt einen action-first Cold-Start-Zustand statt eines Fehlers.

**Falls der Generator mit Exit-Code ≠ 0 endet:**
- Lies seine letzte **stderr**-Zeile als einzeilige deutsche Fehlermeldung und gib sie wortgetreu weiter (Fehler gehen nach stderr; stdout bleibt bei Fehlern leer).
- Ursache ist dann ein Snapshot-Problem (Datei fehlt / kein gültiges JSON) — Snapshot neu schreiben und erneut ausführen. Verbindungs-/Zugangsfehler tauchen hier nicht mehr auf; die werden schon beim `tf_request`-Datenabruf sichtbar (401 → `onboarding`, 5xx/Netzwerk → "Versuch es in einem Moment noch einmal").

---

## Step 2 — Present as Live Artifact

Präsentiere die generierte HTML-Datei als **Live Artifact** nach dem kanonischen Verfahren in `${CLAUDE_PLUGIN_ROOT}/reference/artifact-presentation.md` (Datei verifizieren → stabiler Pfad → präsentieren → **Fallback in den Chat, wenn das Panel nicht lädt**). Nie nur den Dateipfad nennen.

Gib danach eine In-Chat-Zusammenfassung in der Sprache des Nutzers — sie muss auch dann tragen, wenn das Panel nicht rendert:

- Wie viele Niches, Trends, Avatare und Content-Pieces (davon wie viele Skripte/Freigaben) das Cockpit enthält (nur Zahlen, die der Generator tatsächlich geschrieben hat — niemals erfundene Werte).
- Den einen empfohlenen nächsten Schritt (aus dem Cockpit-Inhalt, z. B. "Sag ‚jetzt scrapen'" bei Cold-Start, oder "Niche X hat 3 neue Trends seit gestern — schau sie dir an").
- Den Hinweis: "Sag einfach ‚zeig das Cockpit', um zu aktualisieren. Skripte und Avatar-DNA stehen im Cockpit im Volltext (aufklappen)."

---

## Honesty rules

- Das Cockpit ist ein regenerierter Snapshot — kein Live-Stream. Der Stand:-Zeitstempel im Artifact zeigt, wann es generiert wurde.
- Leere Zustände benennen die nächste Aktion, nicht einen Fehler: "Noch keine Trends — nach dem ersten Scrape-Run erscheinen sie hier."
- Erfinde keine Trend-Zahlen in der Chat-Zusammenfassung. Berichte ausschließlich, was der Generator in die HTML-Datei geschrieben hat. Wenn der Generator 0 Trends zurückgegeben hat, sag das offen.
- Für eine manuelle Aktualisierung diesen Skill einfach erneut ausführen — das überschreibt `Trendfinder-Cockpit.html` und präsentiert das neue Artifact.

---

## Abschluss (PFLICHT) — Next-Steps-Auswahlblock

Beende deine Antwort IMMER mit dem interaktiven **Auswahlblock** (die selektierbaren Options-UI-Blöcke, die Cowork rendert) — Spezifikation: `${CLAUDE_PLUGIN_ROOT}/reference/next-steps.md`. Zeige alle im aktuellen Zustand sinnvollen Optionen und markiere **genau eine** als ⭐ Empfehlung, passend zu dem, was du gerade getan hast. Nutze die ⭐-Kontext-Tabelle und die Zustands-Regeln aus dieser Datei.
