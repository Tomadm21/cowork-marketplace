---
name: cockpit
description: Zeig das Trendfinder-Cockpit als Live Artifact — einen Echtzeit-Snapshot mit allen Niches, aktuellen Trends, Avataren und dem empfohlenen nächsten Schritt. Verwende diesen Skill wenn der Nutzer sagt "zeig das Cockpit", "show cockpit", "trendfinder dashboard", "was trendet", "zeig meine trends", "zeig meine avatare", "übersicht" — oder immer wenn ein zurückkehrender Nutzer seinen Trendfinder-Status auf einen Blick sehen will. Ideal als Startbildschirm für jeden Trendfinder-Workspace.
---

# Cockpit — der Trendfinder-Überblick

Generiere den Workspace-Snapshot als **Cowork Live Artifact**: eine selbst-enthaltene HTML-Seite mit allen Niches, Trend-Clustern, Velocity-Daten, Avataren und dem empfohlenen nächsten Schritt. Stand:-Zeitstempel zeigt den Generierungszeitpunkt — kein Streaming, kein Live-Push.

---

## Step 0 — Self-verify (route, don't error)

Prüfe zuerst, ob `{workspace}/.trendfinder/config.json` existiert.

Wenn die Datei **fehlt** → Setup ist noch nicht abgeschlossen. Sag dem Nutzer:

> "Trendfinder ist noch nicht eingerichtet — sollen wir das in 2 Minuten machen?"

Dann biet an:
```
1) Ja, Trendfinder einrichten
2) Abbrechen
```

Bei Option 1: route zum `onboarding` Skill. Generiere das Cockpit **nicht** gegen eine fehlende Konfiguration — das würde nur einen Fehler erzeugen, den der Nutzer nicht selbst beheben kann.

---

## Step 1 — Generate

Führe den Generator aus:

```
if command -v bun >/dev/null 2>&1; then bun ${CLAUDE_PLUGIN_ROOT}/skills/cockpit/scripts/cockpit.ts <workspace_root>; else node --experimental-strip-types ${CLAUDE_PLUGIN_ROOT}/skills/cockpit/scripts/cockpit.ts <workspace_root>; fi
```

Der Generator liest zum Zeitpunkt der Generierung alle Tenant-Daten via API, inlinet sie in eine selbst-enthaltene HTML-Datei und gibt als **letzte stdout-Zeile** den absoluten Pfad zur geschriebenen Datei aus (Standard: `<workspace_root>/.trendfinder/cockpit.html`).

**Best-effort-Verhalten:** Der Generator bricht nie mit einem Fehler ab, wenn Daten fehlen oder leer sind — ein frischer Tenant ohne Scrape-Daten bekommt einen action-first Cold-Start-Zustand statt eines Fehlers.

**Falls der Generator mit Exit-Code ≠ 0 endet:**
- Lies seine letzte **stderr**-Zeile als einzeilige deutsche Fehlermeldung und gib sie wortgetreu weiter (Fehler gehen nach stderr; stdout bleibt bei Fehlern leer).
- Schlage die passende Lösung vor:
  - Konfigurationsfehler (missing config, invalid key, 401) → `onboarding` Skill erneut ausführen.
  - Backend-Fehler (5xx, Netzwerk-Timeout) → "Versuch es in einem Moment noch einmal" — der Backend-Dienst ist vorübergehend nicht erreichbar.

---

## Step 2 — Present as Live Artifact

Präsentiere die generierte HTML-Datei als **Live Artifact** (persistenter Cowork-Tab, wieder öffenbar und aktualisierbar) — **nicht** nur als Dateipfad.

Gib danach eine 2–3-zeilige In-Chat-Zusammenfassung in der Sprache des Nutzers:

- Wie viele Niches, Trends und Avatare das Cockpit enthält (nur Zahlen, die der Generator tatsächlich geschrieben hat — niemals erfundene Werte).
- Den einen empfohlenen nächsten Schritt (aus dem Cockpit-Inhalt, z. B. "Sag ‚jetzt scrapen'" bei Cold-Start, oder "Niche X hat 3 neue Trends seit gestern — schau sie dir an").
- Den Hinweis: "Sag einfach ‚zeig das Cockpit', um zu aktualisieren."

---

## Honesty rules

- Das Cockpit ist ein regenerierter Snapshot — kein Live-Stream. Der Stand:-Zeitstempel im Artifact zeigt, wann es generiert wurde.
- Leere Zustände benennen die nächste Aktion, nicht einen Fehler: "Noch keine Trends — nach dem ersten Scrape-Run erscheinen sie hier."
- Erfinde keine Trend-Zahlen in der Chat-Zusammenfassung. Berichte ausschließlich, was der Generator in die HTML-Datei geschrieben hat. Wenn der Generator 0 Trends zurückgegeben hat, sag das offen.
- Für eine manuelle Aktualisierung diesen Skill einfach erneut ausführen — das überschreibt `cockpit.html` und präsentiert das neue Artifact.

---

## Abschluss (PFLICHT) — Next-Steps-Auswahlblock

Beende deine Antwort IMMER mit dem interaktiven **Auswahlblock** (die selektierbaren Options-UI-Blöcke, die Cowork rendert) — Spezifikation: `${CLAUDE_PLUGIN_ROOT}/reference/next-steps.md`. Zeige alle im aktuellen Zustand sinnvollen Optionen und markiere **genau eine** als ⭐ Empfehlung, passend zu dem, was du gerade getan hast. Nutze die ⭐-Kontext-Tabelle und die Zustands-Regeln aus dieser Datei.
