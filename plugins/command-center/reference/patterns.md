# Evidence library — proven patterns the review maps against

Tom-curated. The operator report (`review.ts`) maps each recurring signal cluster against
the `keys:` of these patterns. **A cluster with no match here is NOT recommended** — it is
parked quietly so nothing is lost. This file is the "evidence" half of the gate: only
patterns backed by an established practice/study live here.

**Format (parsed):** each pattern is a `## ` heading followed by `- field: value` lines.
A block is only treated as a pattern if it has a `- keys:` line. `impact` ∈ hoch|mittel|niedrig.

## Stammdaten-Register statt Wiederholungs-Eingabe
- keys: receipt:unknown-vendor, invoicing:unknown-person, photo:unknown-site
- beleg: Master-Data-Management / Single-Source-of-Truth-Register senken nachweislich wiederholte manuelle Dateneingabe und Fehlerquote (etablierte Datenmanagement-Praxis).
- impact: hoch
- aufwand: niedrig
- empfehlung: Ein `stammdaten/*.json`-Register anlegen oder erweitern, damit der Prozess den Treffer automatisch zuordnet statt jedes Mal nachzufragen.

## Heuristik → explizite Regel
- keys: invoicing:spesen-heuristik, photo:low-confidence-date
- beleg: Sobald eine wiederholt korrigierte Heuristik eine bekannte Regel hat, ersetzt eine explizite Config-Regel die Schätzung (etablierte Praxis: deterministische Regel schlägt wiederholtes Raten).
- impact: mittel
- aufwand: niedrig
- empfehlung: Die Regel in der `reference/rules.md` des Prozesses bzw. in `config/<process>.json` explizit machen.

## Wiederkehrender manueller Schritt → eigener Prozess
- keys: observation:neuer-ablauf, observation:wiederkehrende-handarbeit
- beleg: Automations-ROI-Filter — automatisieren, was häufig UND regelhaft ist (Toms ≥75%-deterministisch-Filter). Häufige, regelbasierte Handarbeit hat den höchsten Automatisierungs-Hebel.
- impact: hoch
- aufwand: mittel
- empfehlung: Kandidat für eine neue Automatisierung — baut nur Tom (neuer Prozess-Skill im Plugin).

## Vorlagen-/Pfad-Drift → Re-Detect statt Neu-Onboarding
- keys: tech:vorlage-geaendert, tech:pfad-geaendert
- beleg: Detect-First-Onboarding (eigenes onboarding-ux-Prinzip): geänderte technische Gegebenheiten werden erkannt und die Config angepasst, statt die Firma neu aufzusetzen.
- impact: mittel
- aufwand: niedrig
- empfehlung: Den betroffenen Prozess re-onboarden (nur die geänderten Felder), nicht das ganze Setup.
