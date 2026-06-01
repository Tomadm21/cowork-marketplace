# Verfahrensdokumentation — Kapitalfluss-Automatisierung

> **GoBD-Pflichtdokument.** Muss für einen sachverständigen Dritten verständlich sein und 10 Jahre aufbewahrt werden. Versioniert; jede Änderung nachvollziehbar.
> **Status:** Skeleton (Phase 1). Konkrete Abschnitte mit ⟦TODO⟧ werden im Kickoff-Workshop mit echten Datei-/Pfad-/Kadenz-Angaben gefüllt und von Steuerberater **Dennis Freudsheim** gegengezeichnet, bevor Go-Live erfolgt.
> **Hinweis:** Informatorische Compliance-Grundlage, keine Rechtsberatung.

---

## 1. Allgemeine Beschreibung

**Zweck.** Automatisierte, **freigabe-gebundene** Übertragung der monatlichen Commerzbank-Geschäftskonto-Bewegungen in (a) die bestehende Vektonce-Kapitalflusstabelle und (b) die McDonald's-Liquiditätsplanung. Jede Ein- und Auszahlung des Kontos wird nach Vorzeichen einsortiert (Gutschrift → Einnahmen, Lastschrift → Ausgaben); die Tabelle ist kontoweit, nicht pro Store. Die manuelle Übertragung wird zur Freigabe-Prüfung. **Es wird nichts gebucht und nichts versendet.**

**Beteiligte.** Betreiber/Verantwortlicher: ⟦TODO: Jan Theobald, Theobald-JCPT-Hospitality⟧. Ersteller der Software: Tom Adomeit (Command Center). Steuerberater (Gegenzeichnung): Dennis Freudsheim.

**Datenarten.** Überwiegend Unternehmens-Finanzdaten (Kontobewegungen, Kapitalfluss, Liquiditäts-P&L). Personenbezug nur in einzelnen Verwendungszweck-Feldern.

**Aufbewahrung.** Jeder Lauf wird revisionssicher archiviert; Aufbewahrung 10 Jahre.

## 2. Anwenderdokumentation

**Monatlicher Ablauf (Skill `liquiditaet-run`):**
1. Commerzbank-CSV im Online-Banking exportieren und in den freigegebenen Ordner legen. ⟦TODO: Ordnerpfad⟧
2. Lauf planen (`plan_run`) — erzeugt die Änderungs-Übersicht, schreibt nichts.
3. Änderungs-Übersicht (Live-Artifact) prüfen: geänderte Werte, neue Zeilen, **„Review nötig"**-Posten.
4. Freigeben (`commit_writes`) oder Verwerfen. Nur bei Freigabe wird geschrieben + archiviert.
5. Ergebnis prüfen; Review-Posten ggf. nacharbeiten.

**Einrichtung (einmalig, Skill `liquiditaet-setup`):** siehe `skills/liquiditaet-setup/SKILL.md`. ⟦TODO: reale Dateinamen, Sheet-/Zell-Maps, Einnahme/Ausgabe-Anker⟧

## 3. Technische Systemdokumentation

**Architektur.** Portabler Engine-Kern (bun + TypeScript, ohne Cowork-Abhängigkeit) + dünner Cowork-Adapter (lokaler MCP-Server + Skills + Live-Artifact + Pre-Write-Hook).

**Datenfluss.** CSV-Ingest (`engine/ingest`) → Kategorisierung nach DBA-Mapping (`engine/categorize`) → geplante Schreibvorgänge (`engine/diff`) → **Freigabe-Gate** (`engine/approval`) → werte-only Schreiben via xlsx-populate, Struktur-Fingerprint-Prüfung (`engine/excel`) → GoBD-Archiv (`engine/archive`).

**Unveränderbarkeit / Nachvollziehbarkeit.** Pro Lauf: Roh-CSV byte-genau + SHA-256, Lauf-ID, Zeitstempel (UTC + Europe/Berlin), Ruleset-Version (semver + git-Hash), vollständiges Vorher/Nachher-Diff, Freigeber-Identität + Freigabe-Zeitstempel, Workbook-Snapshot-Hashes, Flags `no_auto_booking`/`no_auto_send`. Archiv ist **append-only und hash-verkettet**; ein erneuter Lauf mit gleicher Lauf-ID wird abgelehnt.

**Keine Quelldaten-Veränderung.** Die Originaldateien werden nicht überschrieben; geschrieben werden Kopien; die Vektonce-Struktur (Blattnamen + Formelzellen) wird vor/nach jedem Schreiben verglichen und bei Abweichung blockiert.

**Berechtigungskonzept (Kurz).** Bankzugang/Export: Betreiber. Freigabe: ausschließlich Betreiber über das Live-Artifact. Schreibzugriff: nur die freigegebene Engine. Keine externen Sendungen. Zugangsdaten werden nie im Archiv gespeichert. ⟦TODO: konkrete Personen/Rollen⟧

## 4. Betriebsdokumentation

**Betrieb.** Läuft in Claude Cowork (Desktop) im Workspace des Betreibers; Ausführung nur bei laufendem Rechner + geöffneter App (kein unbeaufsichtigter Cloud-Cron). ⟦TODO: Kadenz, z. B. monatlich nach CSV-Export⟧

**Sicherung/Notfall.** Archiv unter `archive/` (WORM-artig, hash-verkettet). ⟦TODO: Backup-Strategie des Archiv-Ordners⟧

**Änderungswesen.** DBA-Mapping und Config sind versioniert (semver + git). Format-Fixes am CSV-Profil bei Bank-Export-Änderung. Jede Änderung der Verfahrensdokumentation wird mit Datum/Grund protokolliert und 10 Jahre aufbewahrt.

**Freigabe.** ⟦TODO: Gegenzeichnung Dennis Freudsheim, Datum⟧ · ⟦TODO: Datenschutz-Sicht (DSGVO/AVV-Stand) bestätigt⟧
