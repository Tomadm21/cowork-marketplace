# Galant Second Brain — Strategiekonzepte für einen DSGVO-konformen KI-Ausbau

**Stand:** 24.07.2026 · **Firma:** Galant Bau GmbH (Bauunternehmen, KMU, Microsoft 365) ·
**Ausgangspunkt:** Command-Center-Plugin (Cowork) ist bereits im Echtbetrieb (Belege, Fotos, Berichte, Rechnungen — alles lokal, freigabe-gated, `reference/datenschutz.md` liegt vor).

**Ziel dieses Papiers:** Mehrere belastbare Strategiekonzepte, wie Galant ein „Second Brain"
(zentrale, KI-nutzbare Firmen-Wissensbasis) aufbaut — DSGVO-konform, mit klarer Antwort auf
„Kann man Cloud nutzen?", einem Plan für Datenfundament („Dataverse"/Datenset) und für die
Zusammenarbeit der Kollegen mit Claude.

---

## 1. Faktenbasis (Kurzfassung der Recherche)

### 1.1 Anthropic Economic Index — was die Nutzungsdaten sagen

Der Anthropic Economic Index (AEI) wertet anonymisierte Claude-Nutzung aus und ordnet sie
Berufen/Tätigkeiten zu (Berichte Feb. 2025 – Juni 2026):

- **Bau ist das am wenigsten erschlossene Feld überhaupt.** „Construction & Extraction"-Berufe
  clustern in der beobachteten Nutzung **nahe null** — obwohl theoretisch ~17 % ihrer Tätigkeiten
  KI-geeignet wären. 54 % aller Berufe (überwiegend körperliche) zeigen praktisch keine Nutzung.
- **Das Backoffice ist dagegen Spitzengruppe:** „Office & Administrative Support" erreicht ~34 %
  beobachtete Aufgabenabdeckung; Kundenservice (70 %) und Dateneingabe (67 %) gehören zu den
  meistexponierten Tätigkeiten. Meistautomatisierter API-Anwendungsfall: **Zahlungs- und
  Rechnungsanfragen**.
- **Deutschland nutzt Claude pro Kopf nur etwa halb so intensiv wie die USA** (Usage Index ~1,8
  vs. 3,62). Frühstarter im deutschen Bau-Mittelstand haben also doppelten Vorsprung.
- **Der Engpass ist nicht der Preis, sondern Datenaufbereitung, Integration und
  Kontextbereitstellung** — exakt das, was ein Second Brain löst.
- **Empfohlene Sequenz laut AEI-Logik:** erst iterativ im Chat augmentieren (Lernkurve: erfahrene
  Nutzer haben ~10 % höhere Erfolgsraten), dann klar umrissene, kurze Prozesse (< 1 Std.)
  automatisieren. Aufgaben klein schneiden: Erfolgsraten fallen von 60 % (< 1 Std.) auf 45 %
  (> 5 Std.).

### 1.2 Was andere Baufirmen machen (international + DACH)

| Firma / Tool | Muster | Ergebnis |
|---|---|---|
| **Skanska „Sidekick"** (USA/SE) | Interner Chatbot über Firmen-Wissensbasis, Zugriffsrechte bleiben erhalten; „Safety Sidekick" auf EHS-Handbuch | Konzernweites Second Brain, Prompt-Schulungen |
| **Gilbane + Trunk Tools** (USA) | RAG über 21.000 Projektdokumente (Pläne, RFIs, Verträge), Chat-Fragen der Bauleiter | 20–40 Min. Ersparnis pro Anfrage, **~6,5× ROI**, nationaler Rollout |
| **Strabag** (AT/DE) | Eigene Data-Science-Einheit, „Kalkulation.KI" (LV-/Angebotsautomatisierung mit Uni Oldenburg) | Konzern-Variante des Musters „Projekthistorie als Kalkulationswissen" |
| **Bouygues** (FR) | ChatGPT unternehmensweit, aber **in kontrollierter eigener Cloud-Umgebung** (Azure OpenAI) | Governance-Vorbild: Cloud ja, aber vertraglich/architektonisch eingehegt |
| **Compa / Capmo / BauGPT** (DE) | Mittelstand: KI-Bautagebuch per WhatsApp/Sprache, LV-Erstellung mit GAEB-Export | Erfassung am Entstehungsort → Berichte werden maschinenlesbare Wissensquelle |

Wiederkehrende Erfolgsfaktoren: (1) Berechtigungen bleiben erhalten, (2) bau-spezifische
Datenaufbereitung statt Rohdaten-Kippen, (3) Antworten **immer mit Quellenverweis**, (4) Erfassung
am Entstehungsort (Sprache/Foto), (5) eigene Projekthistorie als Kalkulations- und
Lessons-Learned-Wissen. Adoption ist noch früh: nur 24 % der Baufirmen weltweit haben KI „at
scale" (KPMG 2025/26) — aber 61 % der US-Baufirmen nutzen oder planen KI, Schwerpunkt **Büro/
Administration (45 %)** und **Kalkulation (23 %)**.

### 1.3 DSGVO-Rahmen — die Rechtslage in Kurzform

- **Cloud-KI ist DSGVO-konform machbar, aber nur auf Vertrags- und Architekturebene:**
  AVV/DPA + SCC, kein Training auf Firmendaten, dokumentierte TOMs, Betroffenenrechte.
- **Anthropic direkt (Team/Enterprise/API):** DPA mit EU-SCC in den Commercial Terms enthalten,
  kein Training auf Kundendaten, API-Logs 7 Tage (Zero-Data-Retention-Addendum möglich),
  ISO 27001 + ISO 42001 + SOC 2. **Aber:** Verarbeitung in den USA, keine EU-Datenresidenz für
  claude.ai/API (Stand Juli 2026).
- **Claude mit EU-Datenresidenz gibt es über AWS Bedrock** (u. a. **Frankfurt eu-central-1**):
  Prompts/Outputs werden nicht gespeichert, nicht trainiert und **nicht an Anthropic
  weitergegeben**; AVV läuft über AWS. Google Vertex bietet EU-Regionen teils nur für ältere
  Modelle; **Microsoft Foundry/Azure hat Claude seit Juli 2026 GA, aber noch keine EU-DataZone.**
- **M365 Copilot** ist EU-Data-Boundary-Dienst — **außer** wenn er Anthropic-Modelle als
  Subprozessor nutzt (für EU-Tenants standardmäßig deaktiviert, Opt-in im Admin Center).
- **Pflichtenpaket für Galant** (unabhängig vom Konzept): AVV; Eintrag ins Verzeichnis von
  Verarbeitungstätigkeiten (Art. 30); Datenschutz-Folgenabschätzung (Art. 35, bei
  Beschäftigten-/Kundendaten dringend empfohlen); KI-Nutzungsrichtlinie; Schulungspflicht
  **Art. 4 EU AI Act** (gilt seit 02.02.2025); Kennzeichnungspflichten Art. 50 ab 02.08.2026;
  bei Betriebsrat Betriebsvereinbarung (§ 87 Abs. 1 Nr. 6 BetrVG).
- **Architektur-Bausteine für „keine sensiblen Daten an Server":** Datenklassifizierung +
  Purview-Labels/DLP (halten markierte Dokumente aus jeder KI-Verarbeitung heraus),
  PII-/Pseudonymisierungs-Gateway (z. B. Microsoft Presidio) vor Cloud-Aufrufen, lokale
  Open-Weight-Modelle (Ollama/vLLM) für das Hochsensible.

### 1.4 Microsoft 365 als Datenfundament

- **Begriffsklärung „Dataverse":** Microsoft Dataverse ist die strukturierte Datenplattform der
  Power Platform (Tabellen, Beziehungen, Row-Level-Security, EU-Rechenzentren). Faustregel:
  **Dokumente → SharePoint, strukturierte Stammdaten → Dataverse** (oder zunächst
  SharePoint-Listen; Dataverse erfordert Power-Apps-Premium-Lizenzen ~20 USD/Nutzer/Monat).
- **Vor jedem KI-Rollout: Berechtigungshygiene.** Jede KI mit delegierten Rechten sieht alles,
  was der Nutzer sieht — jahrelanges „Oversharing" wird per Prompt durchsuchbar. Microsofts
  eigene Copilot-Checkliste (gilt genauso für Claude): Freigabe-Reports, Site Access Reviews,
  Sensitivity Labels, Restricted Content Discovery für Alt-Archive.
- **Claude ↔ M365 gibt es heute offiziell:** Der Anthropic-**Microsoft-365-Connector**
  (SharePoint, OneDrive, Outlook, Teams) läuft mit delegierter Entra-ID-Anmeldung und
  Permission-Trimming — Claude sieht nur, was der angemeldete Nutzer sehen darf; Zugriffe
  erscheinen im M365-Audit-Log; kein Caching der Inhalte. Admin-Consent erforderlich.
- **Copilot Studio unterstützt Claude-Modelle** — für EU-Tenants aber standardmäßig deaktiviert,
  weil Anthropic-Modelle außerhalb der EU Data Boundary laufen.
- **Cowork/Claude-Agenten arbeiten auf lokalen Ordnern** — OneDrive-/SharePoint-Sync macht
  Cloud-Inhalte lokal nutzbar (betroffene Ordner auf „Immer auf diesem Gerät behalten" stellen).

---

## 2. Die Kernfrage: „Kann man Cloud nutzen?"

**Ja — aber nicht pauschal, sondern pro Datenklasse.** Die DSGVO verbietet Cloud-KI nicht; sie
verlangt Rechtsgrundlage, Vertrag (AVV/SCC), Transparenz und Datenminimierung. Der praktikable
Weg ist eine **Ampel-Datenklassifizierung**, die jedes Konzept unten voraussetzt:

| Klasse | Beispiele bei Galant | Erlaubter KI-Weg |
|---|---|---|
| 🟢 **Grün** — kein Personenbezug / unkritisch | Normen-Wissen (VOB/DIN), Prozessbeschreibungen, Vorlagen, anonymisierte Musterkalkulationen, Marketingtexte | Jede Claude-Oberfläche (mit Firmen-Account) |
| 🟡 **Gelb** — normaler Personenbezug | Bautagesberichte (Namen), Belege, Lieferanten-/Kundendaten, Stundenzettel | Nur über kommerziellen Plan **mit AVV** (Konzept A) oder EU-Residenz/pseudonymisiert (Konzept B); nie über Privat-Accounts |
| 🔴 **Rot** — hochsensibel | Personalakten, Gehälter, Gesundheitsdaten, Abmahnungen, strategische Nachtrags-/Kalkulationstaktik, laufende Rechtsstreite | **Verlässt das Haus nicht**: lokal verarbeiten (Konzept C) oder gar nicht per KI |

Rot wird technisch erzwungen, nicht nur per Richtlinie: eigene Ablagebereiche mit engen
Berechtigungen, Purview-Sensitivity-Label „Vertraulich – keine KI" + DLP-Regel, und diese
Bereiche werden **nie** mit einem Connector oder Sync für KI-Arbeitsordner verbunden.

---

## 3. Strategiekonzepte

Alle vier Konzepte teilen dasselbe Fundament (Abschnitt 4: Datenfundament; Abschnitt 6:
Compliance-Paket). Sie unterscheiden sich darin, **wo die KI rechnet und welche Daten sie sieht.**

### Konzept A — „Cloud mit Vertrag" (Claude Team/Enterprise + M365-Connector)

Der pragmatische Standardweg, den die meisten KMU gehen — und die konsequente Fortsetzung des
heutigen Galant-Setups (das Command Center setzt diesen Plan bereits voraus).

- **Architektur:** Claude Team (später Enterprise) für alle Büro-Kollegen; offizieller
  Microsoft-365-Connector auf die kuratierte Wissensbasis-Site (nicht auf den ganzen Tenant);
  Cowork + Command-Center-Plugin für die Prozessautomation auf lokalen/synchronisierten Ordnern.
- **DSGVO-Stellung:** AVV + SCC + kein Training (Vertragsebene); Datenminimierung über
  Ampel-Klassifizierung und Connector-Scope; Verarbeitung in den USA (Drittlandtransfer über SCC
  abgesichert — im Verzeichnis der Verarbeitungstätigkeiten und in der DSFA dokumentieren).
  Rote Daten sind per Label/DLP und Berechtigungen ausgeschlossen.
- **Stärken:** sofort startbar, geringste Komplexität, volle Claude-Fähigkeiten (Projekte,
  Skills, Cowork, Excel/Word), Team-Kollaboration eingebaut; Enterprise ergänzt SSO, SCIM,
  Audit-Logs, Purview-Compliance-Integration.
- **Schwächen:** keine EU-Datenresidenz; „keine sensiblen Daten an Server" gilt nur für Rot —
  Gelb geht (vertraglich abgesichert) in die USA.
- **Kosten/Aufwand:** ~25–30 USD/Nutzer/Monat (Team); Einrichtung Tage, nicht Monate.
- **Passt, wenn:** Geschwindigkeit und Alltagsnutzen vorgehen und die SCC-Absicherung für gelbe
  Daten als ausreichend bewertet wird (Standard-Marktpraxis; Bouygues-Muster: Cloud, aber
  eingehegt).

### Konzept B — „EU-Festung" (Claude über AWS Bedrock Frankfurt + eigenes Gateway)

Für die Anforderung „Daten bleiben in der EU und gehen nie an den Modellanbieter".

- **Architektur:** Claude-Modelle über **AWS Bedrock eu-central-1 (Frankfurt)**; davor ein
  kleines LLM-Gateway (Datenklassifizierungs-Check, Logging, optional
  **PII-Redaktion mit Microsoft Presidio**); M365-Anbindung über eigene Graph-/MCP-Integration
  statt des Anthropic-Connectors. RAG-Index (Projektarchiv, LV-Historie, Berichte) ebenfalls in
  eu-central-1 (z. B. Bedrock Knowledge Bases / OpenSearch).
- **DSGVO-Stellung:** die stärkste Cloud-Position — Prompts/Outputs werden bei Bedrock nicht
  gespeichert, nicht trainiert, nicht an Anthropic weitergegeben; AVV mit AWS; kein
  US-Transfer der Inhalte im Regelbetrieb. Gelbe Daten können damit ohne Pseudonymisierung
  verarbeitet werden; Presidio ist die Zusatzstufe für Grenzfälle.
- **Stärken:** EU-Datenresidenz, beste Argumentationslage gegenüber Datenschutzbeauftragtem,
  Betriebsrat und Kunden (öffentliche Auftraggeber!); API-first = ideal für die spätere
  Automatisierung (AEI: Unternehmens-API-Nutzung ist zu 77 % Automatisierung).
- **Schwächen:** kein claude.ai-Komfort (keine Team-Oberfläche, kein offizieller
  M365-Connector, Cowork-Features eingeschränkt) — Chat-Oberfläche muss dazugekauft oder gebaut
  werden (z. B. Open-WebUI/LibreChat aufs Gateway); IT-Aufwand deutlich höher; Modell-Neuheiten
  kommen auf Bedrock teils verzögert an.
- **Kosten/Aufwand:** nutzungsbasiert (Token) + Gateway-Betrieb; Einrichtung Wochen; braucht
  einen IT-Partner oder den Operator (Tom) dauerhaft.
- **Passt, wenn:** Datenresidenz ein hartes K.-o.-Kriterium ist (z. B. Vorgabe von Auftraggebern)
  oder wenn Phase 3 (Automatisierung im großen Stil) erreicht ist.

### Konzept C — „Lokal-first Hybrid" (Ausbau des heutigen Command-Center-Ansatzes)

Die Antwort auf „so dass keine sensiblen Daten an Server weitergeleitet werden" — als Architektur
statt als Hoffnung.

- **Architektur:** Wie heute: Cowork läuft auf dem Firmen-PC, alle Dokumente bleiben im lokalen
  Workspace/auf Firmenlaufwerken; Claude sieht nur, was ein Prozess ihm konkret vorlegt
  (Freigabe-Gates bleiben). Neu dazu: (1) die Ampel-Klassifizierung mit technisch abgetrennter
  Rot-Zone; (2) für Rot-Aufgaben ein **lokales Open-Weight-Modell** (Ollama/vLLM auf einer
  Workstation) — z. B. Zusammenfassen von Personalunterlagen; (3) Pseudonymisierungs-Schritt für
  Gelb-Grenzfälle, bevor etwas an Claude geht.
- **DSGVO-Stellung:** Datenminimierung by design — an Anthropic geht nur der jeweils nötige
  Ausschnitt (weiterhin unter AVV via kommerziellem Plan). Rote Daten verlassen das Haus
  nachweislich nie. Deckungsgleich mit der bestehenden `datenschutz.md` des Command Centers.
- **Stärken:** maximale Kontrolle bei minimalem Umbau (Galant arbeitet heute schon so);
  Second-Brain-Aufbau funktioniert komplett lokal (Markdown-Wissensbasis im Workspace);
  Investitionsschutz — jedes spätere Konzept baut darauf auf.
- **Schwächen:** lokales Modell ist spürbar schwächer als Claude (nur für einfache Rot-Aufgaben
  realistisch); Kollaboration hängt an Ordner-Sync statt an einer gemeinsamen Cloud-Oberfläche;
  Skalierung auf viele Nutzer macht mehr Handarbeit.
- **Kosten/Aufwand:** Claude-Plan wie A; einmalig ggf. eine GPU-Workstation (~2–4 T€), Presidio
  ist Open Source; Aufwand niedrig bis mittel.
- **Passt, wenn:** die Rot-Zone groß ist, der Betriebsrat/DSB harte Zusagen braucht, oder als
  **Sicherheitsnetz unter Konzept A** (empfohlen — siehe Abschnitt 5).

### Konzept D — „M365-nativ" (Copilot + Copilot Studio, Claude als Option)

Der Vollständigkeit halber: alles in der Microsoft-Welt lassen.

- **Architektur:** M365 Copilot für alle; eigene Agents in Copilot Studio (die seit 2025 auch
  Claude-Modelle nutzen können); Wissensbasis = SharePoint + Graph-Konnektoren; Stammdaten in
  Dataverse.
- **DSGVO-Stellung:** solide, solange **Microsoft-Modelle** genutzt werden (EU Data Boundary).
  Sobald Claude-Modelle in Copilot aktiviert werden, verlassen die Daten die EU Boundary
  (Opt-in, DSFA nötig) — man erbt also das Drittland-Thema von Konzept A, nur mit weniger
  Kontrolle.
- **Stärken:** kein neues Tool für die Kollegen, IT-Governance komplett im Tenant, Betriebsrat
  kennt Microsoft.
- **Schwächen:** teuerste Variante pro Kopf (Copilot ~30 USD + ggf. Power-Platform-Lizenzen);
  Copilot ist als „Second Brain über eigene Projektarchive" heute schwächer als ein kuratiertes
  Claude-Setup; die bestehende Command-Center-Investition (Cowork-Skills, Freigabe-Engine) passt
  nicht in diese Welt; Agent-Qualität in Copilot Studio erfahrungsgemäß begrenzt.
- **Passt, wenn:** die IT-Strategie „nur Microsoft" vorschreibt. Für Galant **nicht empfohlen**,
  aber als Koexistenz-Baustein denkbar (Copilot für Office-Alltag, Claude für Prozesse/Wissen).

### Vergleich auf einen Blick

| | A · Cloud mit Vertrag | B · EU-Festung | C · Lokal-first Hybrid | D · M365-nativ |
|---|---|---|---|---|
| Daten verlassen die EU | 🟡 Ja (SCC-abgesichert) | 🟢 Nein (Regelbetrieb) | 🟡 Nur minimierter Ausschnitt | 🟡 Bei Claude-Opt-in ja |
| „Rote" Daten geschützt | per Label/DLP | per Label/DLP | **technisch lokal erzwungen** | per Label/DLP |
| Aufwand bis Nutzen | Tage | Wochen–Monate | Tage (läuft schon) | Wochen |
| Kollaborations-Komfort | 🟢 hoch | 🔴 selbst bauen | 🟡 mittel | 🟢 hoch |
| Automatisierungs-Pfad (API) | gut | **am besten** | gut | begrenzt |
| Passt zum bestehenden Command Center | 🟢 | 🟡 (API-Umbau) | 🟢🟢 | 🔴 |

---

## 4. Datenfundament: „Dataverse" und Datenset richtig aufbauen

Der AEI-Kernbefund gilt als Leitplanke: **Nicht das Modell ist der Engpass, sondern der Kontext.**
Das Second Brain ist deshalb zu 80 % ein Daten- und Ordnungsprojekt:

1. **Eine kuratierte Wissensbasis-Site** (SharePoint/Teams „Galant Wissensbasis"), getrennt vom
   Arbeits-Chaos: Prozessbeschreibungen, Vorlagen, Preislisten, FAQ, Lessons Learned,
   Normen-Auszüge. Klare Eigentümerschaft + Review-Rhythmus (z. B. quartalsweise). Nur diese
   Site kommt in den KI-Scope (Connector/Sync) — nicht der ganze Tenant.
2. **Projektarchiv KI-lesbar machen:** flache Struktur (max. 2–3 Ebenen), sprechende Dateinamen
   (`JJJJ KWnn Baustelle Thema` — die photo-sorting-Konvention ist genau das), **OCR-Pflicht für
   Scans** (reine Bild-PDFs sind für KI unsichtbar), zu jedem Projekt eine kurze Kontextdatei
   (`_projekt.md`: Was, wer, Besonderheiten — das CLAUDE.md-Muster).
3. **Stammdaten als Single Source of Truth:** Baustellen, Monteure, Lieferanten, Preise als
   strukturierte Listen. Heute: `_firma/stammdaten/*.json` (Command Center) bzw.
   SharePoint-Listen. **Microsoft Dataverse erst dann**, wenn Power Apps/Flows auf denselben
   Daten arbeiten sollen oder Row-Level-Security nötig wird — vorher ist es Lizenz-Overhead.
4. **Bautagesberichte als Wissensquelle ersten Ranges** (Gilbane-/Compa-Muster): Erfassung am
   Entstehungsort (Sprache/Foto), strukturierte Ablage pro KW — daraus entstehen später
   Lessons-Learned-Recherche und Kalkulationswissen („Was hat der Bordstein-Meter 2025 wirklich
   gekostet?" — das Strabag-Muster in klein).
5. **Berechtigungshygiene vor KI-Anschluss** (Microsofts eigene Copilot-Checkliste):
   Freigabe-Reports, „Jeder"-Links aufräumen, Sensitivity Labels („Vertraulich – keine KI" für
   die Rot-Zone), Alt-Archive per Restricted Content Discovery aus der Suche nehmen.
6. **Antworten immer mit Quellenverweis** (Erfolgsfaktor aller Fallstudien) — im Command Center
   bereits Prinzip (Journal, Begründungen auf Review-Karten); für das Second Brain beibehalten.

## 5. Empfehlung: Stufenplan statt Entweder-oder

Die Konzepte schließen sich nicht aus — **empfohlen ist C als Fundament + A als
Kollaborationsschicht, mit B als Ausbaupfad:**

- **Phase 1 (Monat 1–2) — Ordnung + Vertrag.** Ampel-Klassifizierung beschließen, Rot-Zone
  technisch abtrennen, Claude-Team-Plan mit AVV für die Büro-Kollegen, KI-Richtlinie +
  Art.-4-Schulung (halber Tag, mit Praxisteil), DSFA + Art.-30-Eintrag. Command Center läuft
  unverändert weiter (ist bereits Konzept C).
- **Phase 2 (Monat 2–6) — Second Brain füllen.** Wissensbasis-Site aufbauen, Projektarchiv-
  Konventionen + OCR, Stammdaten konsolidieren, M365-Connector nur auf die Wissensbasis-Site,
  je Abteilung 2–3 Use Cases nach AEI-Ranking: Angebots-/LV-Texte, Zahlungs-/
  Rechnungskommunikation, Berichte/Protokolle, Belegvorbereitung. Champions-Modell: pro Bereich
  ein Kollege, wöchentliche 30-Minuten-Runde „Was hat funktioniert?".
- **Phase 3 (ab Monat 6–9) — Automatisieren.** Wiederkehrende, kurz geschnittene Prozesse per
  API automatisieren (AEI: 77 % der Unternehmens-API-Nutzung ist Automatisierung). Spätestens
  hier Bedrock Frankfurt (Konzept B) als API-Backend evaluieren — dann läuft die Automatisierung
  mit EU-Residenz, während die Kollegen weiter die Claude-Oberfläche nutzen.

Damit ist jede Frage aus dem Auftrag beantwortet: **Cloud ja** (vertraglich eingehegt, per
Datenklasse gesteuert), **sensible Daten bleiben im Haus** (Rot-Zone technisch erzwungen,
Konzept C), **Datenfundament** über Wissensbasis + Stammdaten (Dataverse optional später),
**Zusammenarbeit** über Team-Workspace, Champions und Schulungen.

## 6. Compliance-Checkliste (konzeptunabhängig)

- [ ] AVV/DPA abschließen (Anthropic Commercial Terms bzw. AWS DPA) und ablegen
- [ ] Verzeichnis von Verarbeitungstätigkeiten ergänzen (Baustein in
      `plugins/command-center/reference/datenschutz.md` vorhanden — um Second-Brain-Zwecke erweitern)
- [ ] DSFA durchführen (Beschäftigten- und Kundendaten im KI-Scope)
- [ ] KI-Nutzungsrichtlinie: erlaubte Tools/Accounts (nie Privat-Accounts), Ampel-Klassifizierung,
      Quellenpflicht, menschliche Freigabe vor Außenwirkung
- [ ] Art.-4-AI-Act-Schulung aller KI-nutzenden Beschäftigten, mit Nachweis
- [ ] Kennzeichnung KI-generierter Außenkommunikation ab 02.08.2026 (Art. 50) regeln
- [ ] Bei Betriebsrat: Betriebsvereinbarung (§ 87 Abs. 1 Nr. 6 BetrVG)
- [ ] Purview-Label „Vertraulich – keine KI" + DLP-Regel für die Rot-Zone
- [ ] Löschroutinen der bestehenden `datenschutz.md` auf Second-Brain-Bestände ausweiten
      (RAG-Indizes/Wissensbasis in die Rotation aufnehmen)

## 7. Offene Punkte (zu verifizieren vor Phase 3)

- Aktueller Stand EU-Datenresidenz bei Anthropic direkt (für Microsoft Foundry als „Coming 2026"
  gelistet) und EU-DataZone in Azure/Foundry
- DPF-Zertifizierungsstatus Anthropic (dataprivacyframework.gov) für die Transfer-Bewertung
- Modellverfügbarkeit aktueller Claude-Versionen in Bedrock eu-central-1 zum Umsetzungszeitpunkt
- Purview-Compliance-Integration von Claude Enterprise im Detail (seit Mai 2026, laut Recherche)

---

## Quellen (Auswahl)

**Anthropic Economic Index:** anthropic.com/economic-index · Berichte Feb./Sept. 2025,
Jan./März/Juni 2026 · arxiv.org/abs/2503.04761 · arxiv.org/pdf/2511.15080 ·
huggingface.co/datasets/Anthropic/EconomicIndex

**Baubranche:** constructiondive.com (Skanska Sidekick, Gilbane/Trunk Tools, Safety-KI) ·
work-on-progress.strabag.com · kalkulation-ki.com · hochtief.com (Nexplore) ·
venturebeat.com (Trunk Tools) · kpmg.com Global Construction Survey 2025/26 ·
digitalzentrum-hannover.de · internet-fuer-architekten.de (Compa) · bau.bi (BauGPT/GAEB)

**DSGVO/Recht:** privacy.claude.com (DPA, Zertifizierungen) · trust.anthropic.com ·
aws.amazon.com/bedrock/faqs · docs.aws.amazon.com/bedrock (Data Retention) ·
azure.microsoft.com (Claude in Foundry GA) · datenschutz-berlin.de (DSK-Orientierungshilfe KI,
Fassung 2025) · EDPB Opinion 28/2024 · haufe.de (Art. 4 AI Act) · microsoft.github.io/presidio

**Microsoft 365:** learn.microsoft.com (Dataverse Security/Regions/Licensing, Copilot Data
Foundation, SharePoint Advanced Management, Restricted Content Discovery, Purview DLP für
Copilot, AI-Subprozessoren) · claude.com/connectors/microsoft-365 ·
support.claude.com (M365-Connector Security Guide, Claude für Excel) ·
microsoft.com (Claude in Copilot Studio)
