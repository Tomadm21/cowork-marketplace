# Command Center — Self-Improvement Loop (Design)

> Status: approved (design) · 2026-06-10 · Approach **A** (deterministic signal-log + operator report)
> Plugin: `command-center` (cowork-marketplace) · target version: 0.3.0

## Problem

Galant (Kunde #1) soll das Command Center **jeden Tag** nutzen. Damit das trägt, muss das
Plugin (a) den **vollen Firmenkontext** kennen, damit die KI weiß, woran sie arbeitet,
(b) sich über Monate **sinnvoll verbessern** — ohne dass das tägliche Werkzeug unter den
Nutzern die Form ändert — und (c) Tom einen Weg geben, **vor Ort zu sehen, was sich noch
optimieren lässt**. Heute gibt es zwar `company-context.md` (einmalig geschrieben), den
Aktivitäts-Log und das Dashboard, aber keinen Mechanismus, der Reibung über die Zeit
sammelt, gegen belegte Muster filtert und Tom als Entscheidungsvorlage präsentiert.

## Vision

Ein einheitliches Gesamtbild, das sich leicht anpassen lässt und über die Zeit besser wird:

- **Galant nutzt täglich**, das Werkzeug ist stabil.
- **Der Firmenkontext vertieft sich** mit jeder Nutzung (lebendiges Firmen-Hirn).
- **Verbesserung läuft über einen Operator-Stapel, den nur Tom freigibt** — nichts ändert
  sich am Plugin von selbst, und Vorschläge gründen auf belegten Mustern, nicht Spekulation.
- **Tom zieht alle 2–4 Wochen einen Bericht** und entscheidet, was er baut.

## Core Invariant — Role Boundary

| Rolle | Darf | Darf nicht |
|---|---|---|
| **Galant (täglich)** | Prozesse nutzen, Dateien ablegen, Outputs freigeben, **eigene Firmen-Fakten** bestätigen | Plugin-Logik/Fähigkeiten ändern, neue Automatisierungen anlegen |
| **Tom (Operator, ~alle 2–4 Wochen)** | Bericht ziehen, Plugin in Claude Code bauen/ändern, Beleg-Bibliothek pflegen | — |

**Enforcement (Konvention, nicht Code-Sandbox):** Tages-Skills schreiben **nur** in den
Workspace (`_firma/_state/…`, `company-context.md`, `_ausgang/…`), lesen Plugin-Dateien nur.
Keine Tages-Operation verändert Plugin-Dateien. **Nichts wendet sich selbst an** — der
Bericht ist eine Empfehlung; das Anwenden ist immer ein bewusster Tom-Schritt (Plugin-Edit).

## Components

### 1 · Signal-Erfassung — `_firma/_state/signals.jsonl`

Tages-anfallend, best-effort (gleiche Disziplin wie der Aktivitäts-Log: niemals einen Lauf
blockieren). Jeder Prozess hängt bei Reibung eine Zeile an.

Schema (eine JSON-Zeile pro Signal):

```json
{ "ts": "2026-06-10T08:12:00Z", "process": "receipt-filing", "type": "correction",
  "key": "receipt:unknown-vendor", "detail": "Vendor 'Müller GmbH' nicht erkannt, manuell zugeordnet" }
```

- `ts` — ISO-Zeitstempel.
- `process` — Prozess-Schlüssel (`invoicing`, `receipt-filing`, …).
- `type` — `correction` | `recurring_check` | `observation` | `fact` | `tech_change`.
- `key` — **stabiler Cluster-Schlüssel**, damit Wiederholungen sich aufsummieren
  (z.B. `receipt:unknown-vendor`, `invoicing:spesen-heuristik`). Kein Freitext im `key`.
- `detail` — kurzer Klartext für den Bericht (darf das konkrete Beispiel nennen).

Signal-Typen:

| `type` | ausgelöst wenn… | wird im Bericht… |
|---|---|---|
| `correction` | User ändert einen vorgeschlagenen Wert | als Reibungs-Cluster gezählt |
| `recurring_check` | ein „prüfen" einer bekannten Klasse feuert erneut | als Reibungs-Cluster gezählt |
| `observation` | User/Tom notiert etwas („wäre gut wenn…", „merk dir…") | als Kandidat geführt |
| `fact` | ein Firmen-Fakt wird gelernt, wartet auf Bestätigung | als Kontext-Vertiefung gelistet |
| `tech_change` | geänderter Ordner / geändertes Vorlagen-Format / neues Tool erkannt | als Technik-Hinweis gelistet |

Herkunft der Signale: Die Prozesse zeigen heute schon „prüfen"-Items, und der User
korrigiert sie ohnehin. Jede Prozess-SKILL.md bekommt einen kleinen **„Signal loggen"-Schritt**
(Spiegel des bestehenden „Log the run"-Schritts). `observation` kommt aus natürlicher Sprache
(„merk dir: …" / „notiz: …") — minimal, keine schwere UI.

### 2 · Beleg-Bibliothek — `reference/patterns.md` (Tom-gepflegt)

Katalog **bewährter** Automatisierungs-Muster / Studien. Pro Eintrag:

- **Name** des Musters
- **Reibung**, die es adressiert (mappt auf ein oder mehrere `key`)
- **Beleg** (Studie / etablierte Praxis / interne Erfahrung mit Quelle)
- grober **Aufwand / Impact**

Der Review bildet jeden wiederkehrenden Cluster gegen diese `key`-Mappings ab.
**Kein Treffer → kein Vorschlag** — der Cluster wird still als „unbelegt" geparkt
(sichtbar, damit nichts verloren geht, aber nicht empfohlen). Das ist die **„Beleg"-Hälfte**
des Tors und der Ort, an dem Tom sein Urteil über die Zeit kodiert. Wird mit ein paar
realen, belegten Mustern geseedet (Galant-relevant).

### 3 · Operator-Bericht — `/command-center:review` + `skills/improvement-review/scripts/review.ts`

On-demand gezogen (Tom, ~alle 2–4 Wochen). Deterministischer, dependency-freier Generator
im Stil von `dashboard.ts` (best-effort, crasht nie bei fehlendem/teilweisem State).

Liest: `_firma/_state/signals.jsonl`, `reference/patterns.md`, `company-context.md`,
`reference/workflows.json`, `_firma/_state/activity.jsonl`, `_firma/_state/review-watermark.json`.

Erzeugt einen **Bericht** (Markdown; optional dieselbe HTML-Artefakt-Ausgabe wie das Dashboard)
mit diesen Abschnitten:

1. **Fenster** — „seit letztem Review am <ts>" (Wasserzeichen). Beim ersten Lauf: alles.
2. **Getorter Stapel** — Cluster mit **Wiederholung ≥ Schwelle** (Default 3) **UND** Beleg-Treffer,
   sortiert nach Wiederholung × Impact. Pro Item: Cluster, Häufigkeit, belegtes Muster, Beispiel-Details.
3. **Kontext-Vertiefung** — unbestätigte `fact`-Signale → „bestätige diese Fakten für den Firmenkontext".
4. **Neue-Automatisierung-Kandidaten** — belegte `observation`-Cluster → „Kandidat: bau X" (nur Tom baut). *(Implementierungs-Entscheidung: Kandidaten = bewusste Beobachtungen mit Beleg-Treffer; ein expliziter „kein abdeckender Prozess"-Check gegen `workflows.json` entfällt — Kandidaten-Muster mappen ohnehin nur `observation:*`-Keys.)*
5. **Technik-Hinweise** — `tech_change`-Signale → „Vorlage/Ordner hat sich geändert, Prozess Y anpassen".
6. **Geparkt (unbelegt)** — wiederkehrend, kein Beleg-Treffer — leise gelistet.

**Wasserzeichen:** Das Schreiben des Berichts stempelt `_firma/_state/review-watermark.json`
(letzter Review-Zeitstempel), sodass der nächste Bericht auf die neue Ansammlung fokussiert.
Das Wasserzeichen ist Operator-State; Tages-Nutzung liest/schreibt es nicht.

### 4 · Lebendiger Kontext (eingewoben)

Der `fact`-Signal-Typ + Bestätigungsfluss **ist** die Vertiefung des Firmen-Hirns:
Ein gelernter Fakt (neuer Lieferant, Namens-Eigenheit) wird als `fact`-Signal gelegt; der
Bericht (oder ein inline-Bestätigungsschritt im Prozess) bietet ihn zur Bestätigung an;
bestätigte Fakten wandern **idempotent** in `company-context.md`-Anker bzw. `stammdaten/*.json`
(bestehender firm-config-contract). User-bestätigbar (eigene Daten), ändert nie Plugin-Logik.

## Data Flow

```
Tages-Lauf  ──>  Prozess hängt Signal(e) an  _firma/_state/signals.jsonl
                                   │  (Wochen vergehen, akkumuliert)
                                   ▼
Tom zieht  /command-center:review  ──>  review.ts:
   aggregiert Cluster  ·  zählt Wiederholung (deterministisch)
   mappt gegen reference/patterns.md (Beleg-Tor)
   fenstert seit review-watermark.json
                                   ▼
              Bericht (Stapel · Fakten · Kandidaten · Technik · geparkt)
                                   ▼
   Tom entscheidet  ──>  baut/ändert Plugin in Claude Code  ──>  Wasserzeichen neu
```

## Files Changed

**Neu**
- `reference/patterns.md` — Beleg-Bibliothek (geseedet).
- `reference/signals.md` — Signal-Schema + Logging-Contract (Pendant zu `activity-log.md`).
- `skills/improvement-review/SKILL.md` — der Review-Skill.
- `skills/improvement-review/scripts/review.ts` — deterministischer Generator.
- `commands/review.md` — `/command-center:review`.

**Edit**
- jede Prozess-`SKILL.md` (`invoicing`, `daily-report`, `photo-sorting`, `receipt-filing`,
  `lead-gen`) — neuer „Signal loggen"-Schritt (Spiegel des „Log the run"-Schritts).
- `reference/architecture.md` — Loop + Rollen-Grenze dokumentieren.
- Version-Bump 0.2.0 → 0.3.0 (plugin.json, company-context.template.md, dry-run doc).

**Galant-Tagesansicht (Dashboard) bleibt unangetastet** — sauber und stabil.

## Testing

`review.ts` ist deterministisch → Unit-Stil, kein Netzwerk:

- gebautes `signals.jsonl` + `patterns.md` einspeisen, Bericht-Inhalt asserten:
  - **Wiederholungs-Tor:** Cluster < Schwelle erscheint **nicht** im getorten Stapel.
  - **Beleg-Tor:** Cluster ohne `patterns.md`-Treffer landet in „geparkt", **nicht** im Stapel.
  - **Wasserzeichen:** Signale vor dem Watermark werden ausgefenstert.
  - **Ranking:** Wiederholung × Impact richtig sortiert.
- nie-crashen-Disziplin wie `dashboard.ts`: fehlende Dateien, garbled JSONL-Zeilen,
  leerer State → freundlicher Zero-State, kein Fehler.

## Scope / YAGNI

**Drin:** Signal-Log, Beleg-Bibliothek, deterministischer Operator-Bericht, Wasserzeichen,
Fakten-Bestätigung in den Kontext, Rollen-Grenze als Konvention + Doku.

**Bewusst draußen:**
- **Agent-Synthese** beim Bericht — das ist Phase 2 / Ansatz C, sinnvoll erst wenn genug
  Signale da sind.
- **Scheduling** — Tom zieht den Bericht on-demand (2–4-Wochen-Kadenz), keine Automatik nötig.
- **Auto-Apply** — niemals; jede Plugin-Änderung ist ein bewusster Tom-Schritt.
- **Schwere Observation-UI** — Start minimal über natürliche Sprache.

## Locked Decisions (2026-06-10)

- **Wiederholungs-Schwelle = 3** (Config-Default, einzeilig änderbar).
- **Bericht-Format = nur Markdown** (kein HTML-Artefakt).
- **Seed von `patterns.md` (operator-gewählt)** — diese vier belegten Muster zuerst:
  1. **Stammdaten-Register statt Wiederholungs-Eingabe** — Reibung: `receipt:unknown-vendor`,
     `invoicing:unknown-person`, `photo:unknown-site` (wiederkehrend). Beleg: Master-Data /
     Single-Source-of-Truth-Register senken wiederholte Hand-Eingabe (etablierte
     Datenmanagement-Praxis). Impact hoch, Aufwand niedrig → `stammdaten/*.json` anlegen/erweitern.
  2. **Heuristik → explizite Regel** — Reibung: ein „prüfen"-Heuristik-Cluster, der wiederholt
     korrigiert wird (z.B. Spesen-Heuristik, Morgen-Datum-Heuristik). Beleg: sobald die Regel
     bekannt ist, Schätzung durch Config ersetzen → Prozess-`reference/rules.md` schärfen.
  3. **Wiederkehrender manueller Schritt → eigener Prozess** — Reibung: `observation`-Cluster zu
     einer wiederholten, regelhaften Handarbeit ohne Abdeckung. Beleg: Automations-ROI-Filter
     (automatisieren, was häufig **und** regelhaft ist — Toms ≥75%-deterministisch-Filter) →
     Neue-Automatisierung-Kandidat (baut nur Tom).
  4. **Vorlagen-/Pfad-Drift → Re-Detect statt Neu-Onboarding** — Reibung: `tech_change`. Beleg:
     Detect-First-Onboarding (eigenes onboarding-ux-Prinzip) → Config anpassen statt neu aufsetzen.
