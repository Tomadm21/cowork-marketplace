# Kalkulations-Assistent — Ziel-Architektur

**Produkt:** SaaS für mittelständische Bauunternehmen: GAEB-LV hochladen → Kalkulationsentwurf
mit Preisvorschlägen aus der eigenen Angebots-/Nachkalkulations-Historie, jeder Vorschlag mit
Quellenverweis → Export nach Excel/GAEB. (Phase-1-Durchstich aus dem SaaS-Plan; Strategiekontext:
`2026-07-24-galant-second-brain-dsgvo.md`.)

**Stand:** 24.07.2026 · Verfasst als Zielbild für den MVP-Bau; MVP-Schnitt in Abschnitt 8.

---

## 1. Architektur-Leitplanken (nicht verhandelbar)

1. **EU-Residenz by design.** Alles läuft in AWS eu-central-1 (Frankfurt): App, Datenbank,
   Dateispeicher, Vektorindex — und die Claude-Aufrufe über **Amazon Bedrock** (Prompts/Outputs
   werden dort nicht gespeichert, nicht trainiert, nicht an den Modellanbieter weitergegeben;
   AVV mit AWS). Das ist das Verkaufsargument gegen jedes US-Tool und erspart die
   Drittland-Diskussion beim Kunden.
2. **Das LLM wählt und begründet — der Code rechnet.** Preisableitungen (Indexierung,
   Mengenstaffeln, Einheitenumrechnung, Summen) laufen ausschließlich in deterministischem Code.
   Claude entscheidet, *welche* Altposition passt, und begründet es — nie, *was* etwas kostet.
   (Bewährtes Command-Center-Prinzip: `compute.ts`-Regel.)
3. **Kein Vorschlag ohne Quelle.** Jeder Preisvorschlag referenziert eine konkrete Altposition
   (ID). Die Engine verifiziert die Referenz (existiert, Einheit kompatibel); ohne gültige Quelle
   wird die Position als „manuell" markiert statt geraten. Das ist der Halluzinations-Schutz und
   zugleich der Vertrauensanker für den Kalkulator (Gilbane/Trunk-Tools-Lektion).
4. **Harte Mandantentrennung.** `tenant_id` überall, Postgres Row-Level-Security, S3-Präfix je
   Mandant, kein Cross-Tenant-Learning (vertraglich zusicherbar: „eure Preise bleiben eure").
5. **Korrekturen sind Gold.** Jede Kalkulator-Korrektur fließt als Ereignis ins Preisgedächtnis
   zurück — das ist der Lock-in und der Qualitäts-Loop.

## 2. Gesamtbild

```mermaid
flowchart TB
    subgraph Client
        UI["Web-App (Next.js)\nKalkulations-Workbench"]
    end
    subgraph AWS["AWS eu-central-1 (Frankfurt)"]
        API["API (modularer Monolith)\nAuth · Mandanten · Projekte"]
        Q[("Job-Queue\n(pg-boss)")]
        W["Worker\nParser · Indexer · Matching"]
        PG[("PostgreSQL + pgvector\nRLS je Mandant")]
        S3[("S3\nOriginaldateien je Mandant")]
        BR["Claude via Amazon Bedrock\n(eu-central-1)"]
    end
    UI -->|eigener Login| API
    API --> PG
    API --> S3
    API --> Q
    Q --> W
    W --> PG
    W --> S3
    W -->|Matching-Urteile,\nPDF-Extraktion| BR
```

Ein deploybarer Monolith + ein Worker-Prozess. Keine Microservices, kein Kubernetes — zwei
Container (App, Worker) auf ECS Fargate reichen bis weit über 100 Kunden.

## 3. Frontend

- **Next.js** (App Router), gehostet mit der API zusammen (kein Vercel — US-Anbieter würde die
  EU-Story verwässern; CloudFront + Fargate).
- **Login: eigene, anbieterneutrale Authentifizierung** — E-Mail/Passwort + Passkeys, verwaltet
  in der eigenen Postgres (z. B. via Auth.js/better-auth oder selbst gehostetem Keycloak). Keine
  Bindung an einen Identity-Anbieter. SSO wird später als **generische OIDC/SAML-Schnittstelle je
  Mandant** angeboten (Enterprise-Feature) — daran kann ein Kunde Entra ID, Google oder seinen
  eigenen IdP hängen, ohne dass das Produkt davon abhängt.
- **Kern-Screen: die Kalkulations-Workbench.** Eine Tabelle, eine Zeile pro LV-Position:
  | OZ | Kurztext | Menge/Einheit | **Vorschlag (EP)** | **Quelle** | **Stufe** | Aktion |
  - *Quelle* verlinkt die Altposition (Projekt, Jahr, damaliger EP) — ein Klick zeigt den
    Originalkontext.
  - *Stufe*: `sicher` (übernehmen), `prüfen` (Kandidat unklar — Alternativen anzeigen),
    `manuell` (keine belastbare Quelle — leeres Feld statt Ratepreis).
  - Aktionen: übernehmen / Alternativkandidat wählen / eigenen Preis eintragen. Jede Aktion ist
    ein Korrektur-Ereignis (→ Abschnitt 7).
- Fortschritt eines Laufs (Parsen → Matchen → fertig) über Server-Sent Events; ein 500-Positionen-LV
  läuft Minuten, nicht Sekunden — die UI muss asynchron gedacht sein.

## 4. Ingestion — vom LV zum kanonischen Schema

**Kanonisches Positionsschema** (alles wird dahin normalisiert):
`{oz, kurztext, langtext, menge, einheit, gewerk, ep, gp, projekt_id, jahr, quelle_typ}`.

Drei Eingangswege, alle als Queue-Jobs im Worker:

1. **GAEB-XML (X81/X83 Ausschreibung, X84 Angebot):** deterministischer XML-Parser, kein LLM.
   GAEB DA XML 3.2/3.3 zuerst; die alten Formate (`.d81`/`.d83`, GAEB 90/2000) folgen nach
   Bedarf — im Vertrieb abfragen, was die Zielkunden wirklich haben.
2. **PDF-LV (Fallback):** Textextraktion (pdftotext-first, Vision nur für Scans — gelernt im
   Command Center v0.18) → Claude extrahiert in das kanonische Schema (Structured Outputs,
   Schema-erzwungen). Stufe automatisch max. `prüfen`, nie `sicher` — extrahierte Mengen/Preise
   sind unsicherer als geparste.
3. **Historie-Import (das Onboarding, unterschätzt nicht!):** alte X84-Angebote, Excel-Kalkulationen,
   Nachkalkulationen. Realität im Mittelstand: Excel-Wildwuchs. Der Import-Assistent ist deshalb
   **Teil des Produkts**, nicht ein Skript: Datei hochladen → Claude erkennt Spaltenbedeutungen →
   Nutzer bestätigt das Mapping einmal pro Dateityp → Massenimport deterministisch. Ohne gefüllte
   Historie ist das Produkt wertlos — der Import entscheidet über den Time-to-Value.

## 5. Das Preisgedächtnis — Matching-Pipeline (der Kern)

Pro LV-Position läuft eine dreistufige Pipeline:

**Stufe 1 — Kandidaten holen (Retrieval, kein LLM):** Hybrid-Suche über die Historie des
Mandanten: pgvector-Embedding-Ähnlichkeit **plus** Postgres-Volltextsuche **plus** harte Filter
(kompatible Einheit, Gewerk, Mengenband ±). Top 10–20 Kandidaten. Embeddings über ein
Embedding-Modell auf Bedrock (z. B. Titan/Cohere in eu-central-1) — auch hier keine US-Runde.

**Stufe 2 — Urteil (Claude):** Ein Aufruf pro Position mit Structured Output:

```json
{
  "match_quelle_id": "hist_...  | null",
  "stufe": "sicher | pruefen | manuell",
  "begruendung": "1-2 Sätze, für die Workbench-Karte",
  "alternativen": ["hist_...", "hist_..."],
  "anpassungs_hinweise": {"jahr_differenz": true, "mengen_differenz": "groesser"}
}
```

Prompt-Aufbau für maximales Caching (Prefix-Regel!): stabiler System-Prompt + Firmenregeln +
Stammdaten als **gecachter Präfix** (1h-TTL bei Batch-Läufen), die volatile Position + Kandidaten
ans Ende. Kein Zeitstempel, keine IDs im Präfix.

**Stufe 3 — Preis ableiten (Code, deterministisch):** Aus der bestätigten Quelle wird der
Vorschlags-EP errechnet: Baupreisindex-Anpassung (Destatis-Indexreihe je Gewerk, als Stammdaten-
Tabelle gepflegt), optionale Mengenstaffel-Regeln des Mandanten, Einheitenprüfung. Jeder
Rechenschritt wird als Herleitung gespeichert und in der Workbench angezeigt („EP 2023: 41,20 € ×
Index 1,09 = 44,91 €").

**Guards:** referenzierte Quelle muss existieren und einheitenkompatibel sein, sonst → `manuell`;
`sicher` nur bei eindeutigem Kandidaten oberhalb einer Score-Schwelle; das LLM-Urteil kann eine
Stufe nie *heraufsetzen*, nur bestätigen oder senken.

## 6. LLM-Schicht

- **Zugang:** Amazon Bedrock, eu-central-1, über den offiziellen Bedrock-Mantle-Client des
  Anthropic-SDK. Modell-IDs tragen dort das `anthropic.`-Präfix.
- **Modellwahl:** Start mit **Claude Opus** als Standard für die Matching-Urteile — die
  Fehlerkosten einer falschen Zuordnung (falscher Angebotspreis!) rechtfertigen das beste Modell.
  Kostenoptimierung **erst nach Messung**: eindeutige Fälle (ein Kandidat, hoher Score) auf ein
  kleineres Modell stufen, Grenzfälle weiter aufs große — die Pipeline ist dafür schon
  vorbereitet (Stufung ist ein Routing-Feld, kein Umbau). Modellverfügbarkeit neuer Versionen in
  eu-central-1 vor jedem Upgrade prüfen (Bedrock hinkt der First-Party-API teils nach).
- **Structured Outputs** (`output_config.format`, auf Bedrock verfügbar) für alle Urteile —
  keine JSON-Parsing-Fehler, kein Regex-Gefrickel.
- **Eigene Job-Queue statt Batch-API:** Anthropics Batch-API (50 % Rabatt) gibt es **nicht auf
  Bedrock** — das ist der Preis der EU-Residenz. Die pg-boss-Queue mit kontrollierter
  Parallelität (z. B. 5–10 gleichzeitige Positionen) übernimmt diese Rolle. Bewusste
  Entscheidung, im Dokument festgehalten: Residenz schlägt Rabatt.
- **Kosten-Größenordnung** (Opus-Klasse, mit Caching): pro Position ~1.500 unkachebare
  Input-Token + ~300 Output-Token ≈ 1,5–2 ct → ein 500-Positionen-LV ≈ **5–10 €** Token-Kosten.
  Bei 300–800 €/Monat Zielpreis und wenigen LVs/Woche pro Kunde: unkritisch, aber pro Mandant
  ein Token-Budget mitführen (Kostenkontrolle + Missbrauchsschutz).
- **Beobachtbarkeit:** jede LLM-Interaktion als Zeile in einer `llm_runs`-Tabelle (Mandant,
  Position, Modell, Token, Dauer, Stufe) — reicht für den Anfang; ein Tracing-Tool
  (selbst gehostet) erst, wenn es wehtut.

## 7. Feedback-Loop (der Burggraben)

- Jede Workbench-Aktion erzeugt ein Ereignis: `uebernommen`, `alternative_gewaehlt`,
  `preis_geaendert {alt, neu}`, `stufe_falsch`.
- Angenommene/korrigierte Positionen werden als **neue Einträge** ins Preisgedächtnis
  geschrieben (append-only, versioniert) — die Historie wächst mit jedem Angebot, die Trefferquote
  steigt, der Wechsel zu einem Wettbewerber wird jeden Monat teurer.
- **Kein Modell-Training, keine Cross-Tenant-Nutzung.** Später optional: anonymisierter
  Benchmark-Pool („euer Pflaster-EP vs. Marktband") als eigenes, Opt-in-pflichtiges Feature —
  DSGVO-seitig sauber nur mit echter Anonymisierung, nicht im MVP.

## 8. Datenmodell (Kern-Tabellen)

| Tabelle | Inhalt |
|---|---|
| `tenants`, `users` | Mandanten, Nutzer (eigene Konten; optionales SSO-Subject je Mandant), Rollen |
| `projects` | ein LV-Vorgang (Upload → Kalkulation → Export) |
| `lv_positions` | geparste Positionen des aktuellen LV |
| `history_positions` | das Preisgedächtnis (kanonisches Schema + Embedding + Volltext-Spalte) |
| `matches` | Vorschlag je Position: Quelle, Stufe, Begründung, Herleitung, Status |
| `events` | Korrektur-/Freigabe-Ereignisse (append-only) |
| `price_indices` | Baupreisindex-Reihen je Gewerk/Jahr |
| `llm_runs` | Token/Kosten/Latenz je Aufruf |

Alle Mandanten-Tabellen mit `tenant_id` + RLS-Policy; Originaldateien in
`s3://…/{tenant_id}/…` mit Bucket-Policy.

## 9. DSGVO & Betrieb

- **Datenfluss komplett EU:** Fargate, RDS, S3, pgvector, Bedrock — alles eu-central-1.
  LV-Daten sind überwiegend Firmendaten; Personenbezug (Ansprechpartner in LVs, Nutzerkonten)
  bleibt in der EU.
- **Verträge:** AVV mit AWS (deckt Bedrock); eigene AVV-Vorlage für eure Kunden (ihr seid
  Auftragsverarbeiter) — Bausteine aus dem Galant-Papier (Art.-30-Eintrag, TOMs) wiederverwenden.
  Subprozessoren-Liste: AWS. Punkt.
- **Löschkonzept als Feature:** „Mandant löschen" = DB-Zeilen + S3-Präfix + Index-Einträge in
  einem Job, mit Protokoll. Das im Sales-Gespräch zeigen zu können ist Gold wert.
- **Backups:** RDS-Snapshots (EU), S3-Versionierung; Wiederherstellungsprobe vor dem ersten
  zahlenden Kunden.
- **IaC von Tag 1:** Terraform/CDK für die ~10 Ressourcen — reproduzierbare Umgebung,
  Staging = Prod in klein.

## 10. MVP-Schnitt vs. Ausbau

**Im MVP (Monat 1–3):**
Monolith + Worker, eigener Login (E-Mail/Passwort + Passkeys), GAEB-X81/X83-Parser, Historie-Import (X84 + Excel-Assistent),
Matching-Pipeline mit den drei Stufen, Workbench, Excel-Export, Ereignis-Loop, Mandanten-RLS,
Löschjob.

**Bewusst NICHT im MVP:**
GAEB-90-Altformate, X84-*Export* (Excel reicht den Piloten), Projekt-Ampel, Wetter-Widget,
Benchmark-Pool, Self-Service-Registrierung (Piloten werden von Hand angelegt), Modell-Stufung
nach Kosten, SOC-2-artige Zertifizierungs-Härtung.

**Ausbaupfad:** Projekt-Ampel (LLM-Vergleich Neu-LV vs. Nachkalkulation ähnlicher Altprojekte)
läuft auf **demselben** Preisgedächtnis-Index — kein neuer Datentopf, nur eine neue Pipeline.
Danach Wetter/Kran als Widget. Genau die Reihenfolge aus dem SaaS-Plan.

## 11. Bekannte Bordsteinkanten (ehrlich)

1. **GAEB ist ein Dialekt-Sumpf.** X8x-Versionen, Software-Eigenheiten (iTWO, ORCA, California).
   Früh echte Dateien der Design-Partner sammeln; Parser gegen eine Fixture-Sammlung testen
   (Command-Center-Stil: Praxis-Audits als Versionstreiber).
2. **Die Historie ist der Engpass, nicht das Modell** (AEI-Befund gilt auch hier). Der
   Excel-Import-Assistent entscheidet über Erfolg — dort Qualität reinstecken, nicht in Features.
3. **Einheiten-Chaos** (m/m²/m³/St/psch/to): Einheiten-Normalisierungstabelle als Stammdaten,
   inkompatible Einheiten sind ein harter `manuell`-Grund.
4. **Baupreisindex ist eine Näherung.** Herleitung immer anzeigen, nie verstecken — der
   Kalkulator muss der Zahl widersprechen können (und tut es; das ist der Feedback-Loop).
5. **Bedrock-Modellverzug:** neueste Claude-Versionen kommen in eu-central-1 teils später an.
   Modell-ID als Konfiguration je Mandant/Umgebung, nicht hartkodiert.
