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
- keys: invoicing:spesen-heuristik, photo:low-confidence-date, receipt:ambiguous-routing, lead-gen:low-quality-source
- beleg: Sobald eine wiederholt korrigierte Heuristik eine bekannte Regel hat, ersetzt eine explizite Config-Regel die Schätzung (etablierte Praxis: deterministische Regel schlägt wiederholtes Raten). Gilt auch für wiederholt gleich aufgelöste Routing-Mehrdeutigkeit und wiederholt aussortierte Quellen — beides sind fehlende explizite Regeln (Tie-Break bzw. Quellen-Filter).
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

## Immer-bestätigter Prüfhinweis → Regel kalibrieren
- keys: invoicing:capped-day, daily-report:capped-day
- beleg: Alarm-Fatigue (etabliert in Safety-/HCI-Forschung): Warnungen, die praktisch immer unverändert bestätigt werden, stumpfen ab und entwerten die echten Warnungen. Ein "prüfen", das jedes Mal durchgewunken wird, ist eine falsch kalibrierte Regel, kein Schutz.
- impact: mittel
- aufwand: niedrig
- empfehlung: Die Schwelle/Regel kalibrieren oder den wiederkehrenden Fall explizit in der Config erlauben — damit "prüfen" wieder nur bei echten Ausnahmen feuert.

## Daten-Lücke an der Quelle schließen
- keys: daily-report:missing-day
- beleg: Datenqualitäts-Praxis (1-10-100-Regel): Validierung bei der Erfassung ist um Größenordnungen billiger als nachgelagertes Nachfragen und Korrigieren. Eine wiederkehrend fehlende Angabe ist ein Erfassungs-Problem, kein Nachfrage-Problem.
- impact: mittel
- aufwand: niedrig
- empfehlung: Die Lücke an der Quelle schließen — Vorlage/Erfassungsweg so anpassen, dass der fehlende Tag direkt miterfasst wird (z.B. alle 7 Tage im Formular vorgeben), statt jede Woche nachzufragen.
