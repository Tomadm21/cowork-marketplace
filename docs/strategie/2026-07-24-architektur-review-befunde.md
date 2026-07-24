# Architektur-Review durch das Agenten-Team — Befunde (24.07.2026)

Review der `2026-07-24-kalkulations-assistent-architektur.md` (v1) durch drei Recherche-Agenten
(Kalkulationsprozess, Automatisierung, Techstack) mit je einem unabhängigen Prüf-Agenten
(Vollständigkeit, Quellen-Stichproben per eigener Nachrecherche, Konkretheit). Alle drei
Recherchen bestanden die Prüfung im ersten Durchlauf. Die Befunde sind in Version 2.0 der
Architektur eingearbeitet (siehe Änderungsprotokoll dort).

---

## Dimension: prozess

## VERDICT
ausreichend: True
begruendung: Der Brief deckt die Original-Aufgabe vollstaendig ab: alle geforderten Prozessschritte (Anfrage bis Nachkalkulation inkl. EKT-Bildung, Zuschlags-/Endsummenkalkulation, EFB-Blaetter), die Praxis-Realitaet (Software vs. Excel, GAEB nach Auftraggebertyp, Zeitaufwand, Schmerzpunkte) und die Gewerk-/Groessenunterschiede sind behandelt; die geforderte Pruefung von Abschnitt 2 erfolgte mit 9 Kritikpunkten. Stichprobe von 4 Kernbehauptungen per WebSearch: NU-Anteil 41-43 % (Bauindustrie-Zahlenbild: 43 % 2021, 41 % 2022) bestaetigt; Betriebsstruktur Juni 2025 (81.890 Betriebe, 923.300 Beschaeftigte, 0,4 % ab 200 MA mit 22 % Umsatz, 88 % unter 20 Beschaeftigte) bestaetigt; EFB 221/222/223 ab 50.000 EUR Angebotssumme laut VHB-Bund mit Ausschlussrisiko bestaetigt (kleine Nuance: Blatt 223 nur auf gesondertes Verlangen, im Brief leicht verkuerzt, Kernaussage korrekt); Bitkom 2025 (n=504, 68 % digitale Angebotserstellung, 62 % Rechnungsversand, 85 % mind. ein digitaler Service, 4 % KI) exakt bestaetigt. Die architektur_kritik ist durchgehend konkret: jeder Eintrag nennt Abschnitt/Schritt der Architektur und liefert umsetzbare Empfehlungen (Schemafelder ep_anteile, NU-Kennzeichnung, neue Prozesskarten-Zeilen, Phase-0-Messkriterien); die kritisierten Luecken (fehlende EFB/Urkalkulation, fehlende Kostenzerlegung im Schema Abschnitt 5, fehlende Mengenermittlung in der Karte) existieren im Architekturdokument tatsaechlich. Keine Anzeichen erfundener Fakten oder Quellen: alle geprueften Zahlen stimmen, die Quellen-URLs tauchten unabhaengig in eigenen Suchen auf, und unsichere Angaben (85-%-Excel-Anbieterumfrage, RIB-Eigenangabe, GAEB-Quote nach Auftraggebertyp) sind vorbildlich als 'zu verifizieren' markiert.
maengel: []

## KRITIK (9 Punkte)

### [hoch] Abschnitt 2/Leitplanke 4 behauptet als Faktum, Excel-Kalkulierer ohne AVA seien 'im Mittelstand die Mehrheit' bzw. 'vermutlich das größere Segment' — dafür gibt es keine belastbare Statistik. Bitkom 2025 misst 68 % 'digitale Angebotserstellung' im Handwerk (schließt Branchensoftware ein), PwC 2025 meldet für die Bauindustrie 61 % hohen Digitalisierungsgrad in Planung/Kalkulation, und RIB beansprucht ~80 % der Projekte >1 Mio. € für iTWO. Plausibel ist die Excel-Mehrheit nur für Kleinbetriebe (<20 MA, 88 % der Betriebe) — genau die sind aber nicht die deklarierte Zielgruppe 'mittelständische Bauunternehmen'. Die Annahme trägt Positionierung UND Ausbaupfad-Priorisierung (Zuschlagsmodul) und ist damit die riskanteste unbelegte Stelle der Prozesskarte.
-> EMPFEHLUNG: Die Mehrheits-Behauptung in Abschnitt 2 und Leitplanke 4 explizit als 'Hypothese, zu verifizieren in Phase 0' kennzeichnen und ein Messkriterium definieren (z. B. Anteil der Design-Partner-Kandidaten ohne AVA, nach Betriebsgrößenklasse 10–49 / 50–249 MA getrennt). Zielsegment schärfen: entweder 'gehobenes Handwerk/Kleinbetrieb mit Excel' oder 'Mittelständler mit AVA als Zulieferer-Modell' als primäres Pilotsegment festlegen, statt beide gleichgewichtet zu bedienen.

### [hoch] Das kanonische Positionsschema (Abschnitt 5: oz, kurztext, langtext, menge, einheit, gewerk, ep, gp, …) speichert nur den End-EP ohne Kostenzerlegung (Lohn-/Stoff-/Geräte-/NU-Anteile, Aufwandswert, Zuschlagssätze). Damit kann das Produkt weder die bei öffentlichen Vergaben ab ca. 50.000 € geforderten EFB-Preisblätter 221/222/223 (VHB-Bund, Ausschlussrisiko) bedienen noch eine nachweisfähige Urkalkulation oder Nachtragskalkulation (vorkalkulatorische Fortschreibung) unterstützen — beides steht in der Prozesskarte (Schritt 5/6) nicht einmal als Lücke. Verschärfend: Importierte GAEB-X84-Historien ENTHALTEN die EP-Anteile bereits; der Import wirft diese Information heute weg — ein später kaum reparierbarer Datenverlust im Preisgedächtnis.
-> EMPFEHLUNG: Kanonisches Schema um optionale Felder ep_anteile {lohn, stoff, geraet, nu, sonstiges} plus aufwandswert erweitern und beim GAEB-/AVA-Import von Anfang an mitschreiben (auch wenn V1 sie nur durchreicht). In der Prozesskarte Schritt 5 um 'EFB-Blätter 221/222/223 bei öffentlicher Vergabe' als eigene rote Zelle mit Ausbaupfad 'EFB-Export' ergänzen und in der Positionierung klarstellen, dass V1 für öffentliche Submissionen nur Zulieferer der AVA/des Bietertools ist.

### [hoch] Die Prozesskarte gewichtet den Nachunternehmer-Block falsch: Im Bauhauptgewerbe liegt der NU-Anteil laut Bauindustrie-Verband bei 41–43 % der Bauleistung (bei GU-artigen Mittelständlern oft mehr). Für die deklarierte Kernzielgruppe deckt Schritt 3a (Preise aus eigener Historie) damit strukturell weniger als die Hälfte vieler LV-Summen ab, denn NU-Preise sind tagesaktuell, markt- und kapazitätsgetrieben und aus der eigenen Alt-Historie kaum belastbar vorherzusagen. Die Karte stuft 3b korrekt als 'nicht V1' ein, verschweigt aber diese Konsequenz für die reale Abdeckungsquote des Kernprodukts.
-> EMPFEHLUNG: In Abschnitt 2 eine ehrliche Abdeckungsaussage ergänzen ('bei NU-lastigen LVs deckt V1 nur den Eigenleistungsanteil'). Im Schema eine Kennzeichnung eigenleistung/nu_leistung je Position vorsehen, NU-lastige Positionen defaultmäßig auf 'manuell' bzw. mit Warnhinweis stufen und den Abdeckungsgrad je Pilot messen. Für Rohbau-/GU-Piloten die Priorität des NU-Preisspiegels im Ausbaupfad neu bewerten.

### [mittel] Schritt 3a und 3b werden als Alternativen dargestellt ('der Weg der meisten KMU' vs. Detailkalkulation). In der Praxis sind sie je Position gemischt: Lohnanteil über Aufwandswert × Mittellohn (Standard auch in KMU, gestützt auf Plümecke/SIRADOS/eigene Werte), Materialanteil über tagesaktuelle Lieferantenpreise, Erfahrungspreise für Standardpositionen. Da Materialpreise seit 2021/22 extrem volatil sind, kann 'historischer EP × Baupreisindex je Gewerk' (Abschnitt 6, Stufe 3) bei materiallastigen Positionen deutlich danebenliegen — der Gewerke-Index mittelt Lohn- und Materialentwicklung.
-> EMPFEHLUNG: Zeile 3a/3b in der Karte als Mischform umformulieren ('je Position: Erfahrungspreis, kalkulierter Lohn, angefragtes Material'). In der Preisableitung mindestens eine Positionstyp-Heuristik (lohn- vs. materiallastig, z. B. über Gewerk) einführen und materiallastige Vorschläge mit expliziter Warnung bzw. konservativerer Stufe versehen; die vorhandenen Destatis-Reihen je Leistungsbereich (quartalsweise) dafür korrekt referenzieren.

### [mittel] In der Prozesskarte fehlt die Mengenermittlung/das Aufmaß als eigener Schritt. Bei privaten/gewerblichen Anfragen ohne LV (genau das Excel-/Handwerks-Segment, auf das das Produkt zielt) ist die Mengenermittlung aus Plänen oder vor Ort der erste und oft größte Zeitblock — die Karte setzt implizit voraus, dass Mengen immer mitgeliefert werden ('200 m Bordstein, 350 m² Pflaster'). Der Scope-Ausschluss ('bewusst nie: Mengenermittlung aus Plänen') ist legitim, aber unsichtbar in der Karte, wodurch der adressierbare Anteil der Anfragen im Zielsegment überschätzt wird.
-> EMPFEHLUNG: Eigene Zeile 'Mengenermittlung/Aufmaß' mit roter Markierung und Verweis auf den bewussten Scope-Ausschluss in die Tabelle aufnehmen. Im Intake für formlose Anfragen ohne Mengen einen klaren Zustand 'Menge fehlt — vom Nutzer zu ergänzen' vorsehen, damit solche Anfragen nicht als vollwertige LV-Fälle gezählt werden.

### [niedrig] Schritt 5 endet mit der Abgabe; es fehlen Submission, Aufklärungsgespräch (§ 15 VOB/A) und — bei privaten Auftraggebern der Normalfall — Verhandlungsrunden mit mehrfach überarbeiteten Angebotsständen (Nachlässe, Alternativpositionen, Rev. 1/2/3). Produktrelevant, weil das Datenmodell (projects → ein LV-Vorgang) Angebotsversionen können muss und weil die im Preisgedächtnis gespeicherten 'angebotenen' Preise sonst den unverhandelten Erststand konservieren, nicht den beauftragten Endpreis.
-> EMPFEHLUNG: Zeile 'Verhandlung/Überarbeitung/Vergabegespräch' in der Karte ergänzen (V1: rot). Im Datenmodell Angebotsversionen je Projekt vorsehen und beim Ereignis-Loop festhalten, welcher Stand beauftragt wurde — nur der sollte als 'bestätigter Preis' ins Preisgedächtnis zurückfließen.

### [niedrig] Schritt 6 und der Feedback-Loop (Abschnitt 8) überschätzen die Verfügbarkeit von Nachkalkulationsdaten: Praxisquellen beschreiben die systematische Nachkalkulation in KMU als selten und aufwandsgetrieben ('für kleinere Betriebe kaum stemmbar', lästige Excel-Pflege). Viele Piloten werden schlicht keine Soll-Ist-Daten haben, die man importieren könnte — der 'Qualitätssprung gegenüber jeder reinen Angebots-Historie' bleibt dann Theorie.
-> EMPFEHLUNG: Erwartung in Karte und Abschnitt 8 dämpfen ('sofern vorhanden'). Onboarding-Pfad primär auf Angebots-/Auftragshistorie auslegen und als späteren Ausbaupunkt einen niedrigschwelligen Ist-Daten-Import prüfen (Stundenzettel/Zeiterfassung, Eingangsrechnungen je Projekt), der eine Grob-Nachkalkulation erst erzeugt statt sie vorauszusetzen.

### [niedrig] Schritt 1 (Bid/No-Bid) ist qualitativ richtig, aber die Karte unterschätzt das Gewicht: 8–30 Personenstunden je mittlerem öffentlichen Angebot (über 100 h bei komplexen), Trefferquoten von 20–30 %, teils unter 10 %, und Entscheidungen nach Bauchgefühl sind dokumentierte Praxis. Der 'Anfrage-Check' ist damit möglicherweise wertvoller (und schneller beweisbar) als seine Position 3 im Ausbaupfad suggeriert — er nutzt exakt die schon gebaute Intake-Pipeline.
-> EMPFEHLUNG: Aufwands- und Trefferquoten-Zahlen in die Karte aufnehmen und die Ausbaupfad-Reihenfolge nach den Phase-0-Gesprächen erneut prüfen: Wenn Piloten viele Ausschreibungen sichten, den Anfrage-Check (LV-Zusammenfassung, Risiken, Frist) vor das Zuschlagsmodul ziehen — geringes Implementierungsrisiko, reiner LLM-Use-Case auf vorhandenen Daten.

### [mittel] Die GAEB-Einschätzung der Karte (Formatoffenheit, GAEB als bester Fall) ist durch die Recherche gedeckt — öffentlich ist GAEB/X84 seit der eVergabe-Pflicht (18.10.2018) de facto Standard, privat dominieren PDF/Excel. Inkonsistent ist aber Schritt 5: Wer öffentlich bietet, muss als X84 (plus EFB) abgeben; der V1-Excel-Export erzwingt dann einen Medienbruch (Preise zurücktippen in AVA/Bietertool). Für reine AVA-Besitzer ist das als Zulieferer-Modell tragbar, für Excel-Kalkulierer, die öffentlich bieten, fehlt der Abgabeweg komplett. Eine Quantifizierung der GAEB-Quote nach Auftraggebertyp existiert öffentlich nicht (zu verifizieren).
-> EMPFEHLUNG: In Schritt 5 präzisieren, für welches Segment der Excel-Export ausreicht (private Vergabe, AVA-Rückimport) und X84-Export als Bedingung an das Pilotprofil koppeln: Sobald ein Design-Partner überwiegend öffentlich bietet, X84-Export (und mittelfristig EFB) in den MVP-Umfang vorziehen. In Phase 0 je Partner erheben, wie viel Prozent der Anfragen als GAEB vs. PDF/Excel ankommen — das ist zugleich der Test der Formatoffenheits-These.

## BRIEF
# Recherche-Brief: Angebotskalkulation im deutschen Bau-KMU — Prozess und Praxis-Realität

## 1. Der Ende-zu-Ende-Prozess

Die Baubetriebslehre (KLR Bau) kennt Kalkulationsstufen entlang des Projektzyklus: **Angebotskalkulation** (vor Abgabe), **Auftrags-/Vertragskalkulation** (Stand bei Vertragsschluss, ggf. nach Verhandlung geändert), **Arbeitskalkulation** (nach Auftrag, Steuerungs-/Sollkosten-Instrument), **Nachtragskalkulation** (Fortschreibung der Urkalkulation für geänderte/zusätzliche Leistungen) und **Nachkalkulation** (Ist-Kosten und Ist-Aufwandswerte für künftige Angebote) — so u. a. Wikipedia/Bauprofessor.

Konkret läuft es so ab:

1. **Anfrage/Ausschreibung:** Öffentlich seit 18.10.2018 verpflichtend elektronisch (eVergabe, oberhalb der Schwellenwerte); LV kommt als GAEB X83 plus Vergabeunterlagen. Privat/gewerblich: GAEB, Excel, PDF, E-Mail, Ortstermin — sehr gemischt.
2. **Bid/No-Bid:** In KMU meist informell (Bauchgefühl, Auslastung, Stammkunde); Vergabe-Dienstleister beziffern 8–30 Personenstunden je mittlerem öffentlichen Angebot, über 100 h bei komplexen Bauvergaben; Gewinnquoten im europäischen Vergabemarkt 20–30 %, teils unter 10 %.
3. **LV-Sichtung:** Vorbemerkungen/Vertragsbedingungen zuerst — dort stecken die vertragsentscheidenden Klauseln (Vertragsstrafen, Bauzeit, Pauschalierungsklauseln, unzulässige Risikoüberwälzungen wie „Massen eigenverantwortlich prüfen"). Mengenplausibilisierung vor allem bei Pauschalverträgen; beim Einheitspreisvertrag liegt das Mengenrisiko formal beim Auftraggeber (spekulative Bepreisung erkennbarer Mengenfehler ist trotzdem gängige Praxis).
4. **EKT-Bildung:** Lohn = **Aufwandswert × Mittellohn** (Lehrbuchbeispiel: 0,5 h/m² × 56 €/h = 28 €/m²); Aufwandswerte aus eigener Erfahrung oder Tabellenwerken (**Plümecke**, **SIRADOS**, **BKI**). Material über Lieferantenanfragen/Tagespreise/Rabattstaffeln — seit den Preisexplosionen 2021/22 (Holz, Stahl, Dämmstoffe) ein zentrales Kalkulationsrisiko bei Festpreisangeboten. Dazu Geräte und **Nachunternehmer-Anfragen mit Preisspiegel**: Der NU-Anteil im Bauhauptgewerbe liegt laut Hauptverband der Bauindustrie bei **41–43 % der Bauleistung** — bei mittelständischen GU-artigen Betrieben ist die NU-Bepreisung damit oft der größte Block des Angebots.
5. **Gemeinkosten:** **Zuschlagskalkulation mit vorbestimmten Zuschlägen** (BGK, AGK, Wagnis & Gewinn pauschal auf EKT) ist der Standard kleinerer Betriebe; die **Endsummenkalkulation** (projektspezifische BGK-Ermittlung, Umlage über die Angebotsendsumme) ist laut KLR Bau das adäquate Verfahren für größere Vorhaben (Ingenieur-/Tiefbau). Bei öffentlichen Vergaben ab ca. 50.000 € Angebotssumme verlangt das VHB-Bund die **EFB-Preisblätter 221** (Zuschlagskalkulation) **oder 222** (Endsummenkalkulation) **plus 223** (EP-Aufgliederung in Lohn/Stoffe/Geräte/Sonstiges) — Nichtabgabe kann zum Ausschluss führen; die Blätter erzwingen eine nachweisbare Kalkulationsstruktur (Mittellohn, Zuschlagssätze).
6. **Angebotsschluss:** Chef-Durchsicht/strategische Endpreisanpassung, Nachlass/Skonto, Angebotsschreiben; Abgabe öffentlich als **X84 über die Vergabeplattform**, privat als PDF/Excel/Mail. Danach Submission, Aufklärungsgespräche (§ 15 VOB/A) bzw. bei privaten Auftraggebern Verhandlungsrunden mit überarbeiteten Angebotsständen (mehrere Kalkulationsversionen je Projekt sind normal).
7. **Nach Auftrag:** Auftragskalkulation → Arbeitskalkulation → Nachträge (vorkalkulatorische Fortschreibung der Urkalkulation, bei öffentlichen AG wieder mit EFB-Logik) → Nachkalkulation. Letztere gilt in der Praxisliteratur als notorisch vernachlässigt: zeitaufwendig, „lästige Excel-Pflege", für kleinere Betriebe „kaum stemmbar" — viele KMU machen sie gar nicht oder nur anlassbezogen.

## 2. Praxis-Realität: Software, Excel, GAEB

- **Handwerk (Bitkom-Studie 2025, n=504):** 68 % nutzen digitale Angebotserstellung, 62 % digitalen Rechnungsversand; 85 % bieten mindestens einen digitalen Service; KI nutzen erst 4 %. „Digital" heißt hier aber oft Word/Excel/Bürosoftware, nicht AVA-Kalkulation.
- **Excel bleibt allgegenwärtig:** Eine Anbieter-Umfrage (GAEB-Online/Trendkraft) nennt über 85 % regelmäßige Excel-Nutzung in Bauunternehmen und Planungsbüros — als Größenordnung plausibel, als Beleg für „kalkuliert ohne AVA" **zu verifizieren**.
- **Größere Mittelständler:** PwC-Bauindustrie-Studie 2025: 61 % melden hohen Digitalisierungsgrad in Planung/Kalkulation. RIB behauptet, ~80 % aller Projekte über 1 Mio. € Bausumme liefen über iTWO (Eigenangabe, **zu verifizieren**). AVA-/Kalkulationsmarkt: RIB iTWO, Nevaris Build, BRZ 365, ORCA AVA, G&W California.pro, Sidoun, 123erfasst; im Handwerk Branchenpakete (Streit, Sander & Doll, Hero u. a.) mit GAEB-Schnittstelle. **Belastbare Marktanteils- oder „Excel-vs.-AVA"-Quoten nach Betriebsgröße existieren öffentlich nicht** — die Architektur-Annahme „Excel-Mehrheit im Mittelstand" ist damit Hypothese, nicht Faktum.
- **GAEB:** Bei öffentlichen Vergaben de facto Standard (X83 raus, X84 rein; VHB schreibt GAEB-DA-XML vor). Privat/gewerblich gemischt: Architekten mit AVA liefern GAEB, viele GU geben Gewerke-LVs als PDF/Excel weiter; das „Abtippen von PDF-LVs" ist ein dokumentierter Schmerzpunkt. Eine Quantifizierung nach Auftraggebertyp gibt es nicht (**zu verifizieren**, am ehesten über Phase-0-Interviews).
- **Struktur:** Bauhauptgewerbe Juni 2025: 81.890 Betriebe, 923.300 Beschäftigte; **88 % der Betriebe haben unter 20 Beschäftigte**; Betriebe ab 200 MA sind nur 0,4 %, erwirtschaften aber 22 % des Umsatzes. „Mittelständisches Bauunternehmen" ist also ein schmales Band zwischen einer Masse von Kleinbetrieben und wenigen Großen.

## 3. Zeitaufwand und Schmerzpunkte

Einfache Angebote binden 1–4 h, komplexe Ausschreibungen 3–10 Arbeitstage (Schweizer Quelle, Größenordnung auf DE übertragbar); öffentliche Angebote 8–30 h, komplexe >100 h. Größte Schmerzpunkte laut Praxisquellen: PDF-/Papier-LVs manuell übertragen, Vorbemerkungs-/Vertragsrisiken übersehen, Materialpreisvolatilität, NU-/Lieferantenangebote einsammeln und vergleichen, niedrige Trefferquoten bei hohem Angebotsaufwand, fehlende Nachkalkulation (Preise beruhen auf ungeprüften Erfahrungswerten).

## 4. Unterschiede nach Gewerk/Größe

**Bauhauptgewerbe** (Rohbau, Tiefbau): LV-/GAEB-geprägt, öffentliche AG wichtig (Tiefbau besonders), Mittellohn-/Aufwandswert-Kalkulation und Endsummenkalkulation verbreitet, hoher NU-Anteil, eher AVA-Software. **Ausbau/Handwerk** (SHK, Elektro, Maler …): kleinteilig, überwiegend private/gewerbliche AG, Erfahrungs- und Katalogpreise (SIRADOS/Datanorm), Zuschlagskalkulation bzw. Stundenverrechnungssatz, Branchensoftware oder Excel/Word; GAEB nur, wenn an Ausschreibungen teilgenommen wird. Die Architektur-Prozesskarte bildet den Kern richtig ab; die wesentlichen Lücken (EFB/Urkalkulation, NU-Gewicht, Mengenermittlung, Verhandlungsrunden, Mischform aus Historie und Detailkalkulation) stehen in der Kritikliste.

## QUELLEN
https://www.bauprofessor.de/angebotskalkulation/
https://www.bauprofessor.de/endsummenkalkulation/
https://www.bauprofessor.de/einfache-zuschlagskalkulation/
https://de.wikipedia.org/wiki/Baukalkulation
https://www.bauprofessor.de/mittellohn/
https://www.pak-immo.at/aufwandswert-leistungswert-produktivitaet/
https://beckassets.blob.core.windows.net/product/readingsample/14462690/14462690_9783481032470_sample.pdf
https://www.sirados.de/produkte/angebotskalkulation/kalkulationsansaetze
https://www.bauprofessor.de/efb-preis/
https://www.bauprofessor.de/efb-preis-222-bei-endsummenkalkulation/
https://www.nextbau.de/fachwissen/efb-preis/
https://www.gaeb-online.de/gaeb-efb-221-223.html
https://www.vob.de/magazin/efb221/
https://www.wolterskluwer.com/de-de/expert-insights/angebotsabgabe-gaeb-dateien-oeffentliche-bauausschreibungen
https://www.bayika.de/de/aktuelles/meldungen/2018-10-02_E-Vergabe-wird-ab-18.-Oktober-2018-zur-Pflicht.php
https://www.evergabe.de/faq/auftragssuche-angebotsabgaben-bietercockpit/lv-pdf-oder-gaeb-datei
https://sander-doll.com/meisterwissen/gaeb-datei
https://www.bitkom.org/sites/main/files/2026-01/bitkom-studienbericht-handwerk.pdf
https://hero-software.de/blog/news/bitkom-studie-2025-digitalisierung-handwerk
https://www.pwc.de/de/risk-regulatory/risk/capital-projects-and-infrastructure/bauindustrie-unter-druck.html
https://www.planradar.com/de/digitalisierung-baubranche/
https://trendkraft.io/bau/excel-im-bauwesen-mit-gaeb-online-2025-ein-unverzichtbares-werkzeug-40233
https://www.orca-software.com/ava-software-vergleich/
https://www.rib-software.com/de/rib-itwo/baubetrieb-software
https://123erfasst.de/vergleich-kalkulationssoftware/
https://tenderautomation.de/blog/bid-no-bid-entscheidung
https://www.scait.ch/post/go-no-go-bei-bausubmissionen-so-entscheiden-sie-datenbasiert
https://cybershark.ch/blog/wie-ein-schweizer-bauunternehmen-seine-offerten-in-10-minuten-statt-4-stunden-erstellt
https://bidfix.ai/blog/bid-no-bid/die-bidno-bid-entscheidung-wann-sich-eine-bewerbung-auf-ausschreibungen-lohnt
https://bauanalyst.de/blog/leistungsverzeichnis-pruefen
https://www.vob.de/magazin/vorbemerkungen-leistungsverzeichnis/
https://tendermeister.com/blog/vertragsstrafen-ausschreibungen-erkennen-vermeiden-2026/
https://www.bauindustrie.de/zahlen-fakten/publikationen/bauwirtschaft-im-zahlenbild/subunternehmertaetigkeit-im-bauhauptgewerbe
https://www.bauindustrie.de/zahlen-fakten/publikationen/bauwirtschaft-im-zahlenbild/betriebsstruktur-im-bauhauptgewerbe
https://www.destatis.de/DE/Themen/Wirtschaft/Preise/Baupreise-Immobilienpreisindex/Methoden/Erlaeuterungen/baupreisindex.html
https://hero-software.de/blog/ratgeber/nachkalkulation
https://meister.software/ist-eine-nachkalkulation-sinnvoll/
https://bi-medien.de/fachzeitschriften/baumagazin/wirtschaft-politik/kostensteigerung-preisentwicklung-am-bau-beunruhigt-bauunternehmer-b13666
---

## Dimension: automatisierung

## VERDICT
ausreichend: True
begruendung: Der Brief erfuellt alle vier Pruefkriterien. (1) Vollstaendigkeit: Alle Unterpunkte der Aufgabe sind abgedeckt — DACH-Wettbewerber (BauGPT, Kalkulation.KI, Cosuno, plus zusaetzlich GAEB-Online KI-PreisNavigator, BRZ und weitere Nischenanbieter; der nicht auffindbare Anbieter 'epesi' ist transparent als 'zu verifizieren' markiert statt erfunden), internationale Tools (Togal, Handoff, Buildxact, ProEst/Autodesk, STACK, Trunk Tools) mit Ansatz und Genauigkeitsangaben inkl. kritischer Nutzerstimmen, LLM/RAG-Erkenntnisse mit konkreten Trefferquoten (82,96 % Ensemble-NLP, 91 % RoBERTa), Fehlerarten, HITL-Mustern und deterministisch/Retrieval/LLM-Arbeitsteilung, sowie die Gut/Schlecht-Automatisierbarkeits-Analyse mit Begruendungen. (2) Quellenpruefung per Stichprobe (3 Kernbehauptungen selbst nachrecherchiert): GAEB-Online KI-PreisNavigator (lokales ONNX-Modell ~430 MB, Preisprotokolle, eigene Historie) — bestaetigt; Cosuno (~20 % mittlere Prognoseabweichung vs. ±40 % Streuung realer Angebote, >7 Mio. Datenpunkte, Whitepaper 11/2024) — bestaetigt; Togal.AI KU-Studie (76 % schneller, innerhalb ±5 %) — bestaetigt. Alle drei Stichproben decken sich exakt mit dem Brief. (3) Die 14 architektur_kritik-Eintraege sind durchgehend konkret: jeder mit Abschnittsbezug, praezisem Befund am tatsaechlichen Dokumentinhalt (fehlende Positionsarten/Titel-Pfad im Schema, unspezifizierte Score-Schwelle, append-only ohne Dedup und ohne Gewonnen/Verloren-Signal, fehlender Exact-Match-Kurzschluss, fehlende Evaluations-Metriken, Bedrock-Cross-Region-Realitaet vs. 'Frankfurt-only') und umsetzbarer Empfehlung inkl. konkreter Feldnamen, Guard-Regeln und KPI-Vorschlaegen; die explizit geforderten Risiken Kaltstart und Matching bei kleinen Historien sind als eigene Eintraege behandelt. Ich habe alle Kritikpunkte gegen das Architektur-Dokument abgeglichen — sie treffen dessen Inhalt korrekt, keine Allgemeinplaetze, keine Strohmaenner. (4) Keine Anzeichen erfundener Fakten oder Quellen: Die Quellen-URLs der Stichproben existieren, Herstellerangaben sind als solche gekennzeichnet, Unsicheres ist konsequent als 'zu verifizieren' markiert (epesi, Kalkulation.KI-Genauigkeit, Bedrock-Regionslage, Cohere-Embed-v4-Verfuegbarkeit), und der Methodik-Hinweis legt die Proxy-Einschraenkung offen. Kleinere Restunsicherheiten (exaktes Verfuegbarkeitsdatum 01.06.2026 des PreisNavigators, STACK ~3 %-Vergleichstest) sind nachrangig und korrekt attribuiert — kein behebbare-Maengel-Niveau.
maengel: []

## KRITIK (13 Punkte)

### [hoch] Abschnitt 5 (kanonisches Schema): Es fehlen GAEB-Positionsarten und LV-Hierarchie. Das Schema {oz, kurztext, langtext, menge, einheit, gewerk, ep, gp, ...} kennt weder Normal-/Alternativ-(Wahl-)/Bedarfs-(Eventual-)/Zulage-/Stundenlohnpositionen noch den Titel-Pfad (Los/Titel/Untertitel). Eine Zulageposition gegen eine Normalposition gematcht liefert absurde Preise; Alternativ-/Bedarfspositionen dürfen nicht in Summen einfließen; identische Kurztexte bedeuten je Titelkontext (Tiefgarage vs. Gehweg) und Vorbemerkung völlig Verschiedenes — das ist die häufigste Fehlerart beim semantischen LV-Matching.
-> EMPFEHLUNG: Schema um `positionsart` und `titel_pfad` (plus optional Referenz auf zugehörige Vorbemerkung) erweitern. Guards ergänzen: Zulage matcht nur gegen Zulage, Stundenlohnpositionen laufen einen eigenen Pfad, Alternativ-/Bedarfspositionen werden markiert und aus Summen gehalten. Titel-Pfad als Kontext in den Stufe-2-Prompt aufnehmen.

### [hoch] Abschnitte 5/6 (Kaltstart): Es gibt keinen Fallback für Positionen ohne Historien-Treffer. Das Papier erkennt selbst 'ohne gefüllte Historie ist das Produkt wertlos', zieht daraus aber nur die Import-Assistent-Konsequenz. Ein Neukunde mit dünner oder lückiger Historie (z. B. nur 2 Jahre Excel, ein Gewerk) sieht überwiegend 'manuell' — Time-to-Value-Killer im Pilot. Der Markt löst genau das über externe Preisdaten: Cosuno (7 Mio. Preisdatenpunkte), Handoff (Lieferanten-SKUs); in DACH existieren lizenzierbare Standard-Preisdatenbanken (sirAdos, DBD-BauPreise/KostenAnsätze, BKI).
-> EMPFEHLUNG: Entweder eine klar gelabelte vierte Vorschlagsquelle 'Marktpreis (extern)' als optionales, lizenzpflichtiges Add-on einplanen (Datenmodell: `quelle_typ` erweitern — passt ohne Umbau), oder die Entscheidung dagegen explizit im Dokument begründen und im Vertrieb eine Coverage-Erwartung setzen. Zusätzlich beim Onboarding eine 'Historien-Abdeckungsanalyse' anzeigen (welche Gewerke/Zeiträume fehlen), damit der Kaltstart sichtbar statt frustrierend ist.

### [hoch] Abschnitte 6/8 (Evaluation fehlt): Die Architektur definiert Stufen und Guards, aber keine einzige Messgröße für Matching-Qualität — keine Zieltrefferquote, kein Gold-Set, kein Offline-Test vor Prompt-/Modell-Änderungen. Die Literatur zeigt ~83 % Agreement als State of the Art beim automatischen Positions-Zuordnen; die Precision der 'sicher'-Stufe ist die eigentliche Vertrauensmetrik des Produkts (ein einziger falscher 'sicher'-Preis im Angebot beschädigt das Vertrauen dauerhaft).
-> EMPFEHLUNG: Vor dem MVP ein Gold-Set aus echten Design-Partner-LVs mit von Kalkulatoren bestätigten Zuordnungen aufbauen; KPIs definieren (z. B. Precision 'sicher' ≥ 95–98 %, Coverage je Stufe, Alternativen-Trefferquote); Evaluations-Harness, der vor jedem Prompt-/Modell-/Embedding-Wechsel läuft. Die `events`-Tabelle liefert die Labels dafür — der Loop existiert schon, es fehlt nur die Auswertung als Pflichtprozess.

### [mittel] Abschnitt 6 (Guards, Score-Schwelle): '`sicher` nur oberhalb einer Score-Schwelle' ist unterspezifiziert. Embedding-Ähnlichkeitswerte sind nicht kalibriert und je Mandant/Gewerk unterschiedlich verteilt; verbalisierte LLM-Konfidenz ist laut aktueller Forschung systematisch überkonfident. Eine global fixe Schwelle produziert entweder zu viele falsche 'sicher' (Vertrauensschaden) oder zu wenige (Nutzenschaden).
-> EMPFEHLUNG: Mehrere Signale kombinieren: Retrieval-Score, Margin zwischen Kandidat 1 und 2, Übereinstimmung LLM-Wahl vs. Top-Retrieval-Kandidat, Einheiten-/Mengenkompatibilität. Schwellen je Gewerk aus dem Gold-Set kalibrieren. Bis zur Kalibrierung konservativ starten: höchstens 'prüfen', 'sicher' erst nach gemessener Precision freischalten.

### [mittel] Abschnitte 6/7 (fehlender deterministischer Kurzschluss): Jede Position läuft durch einen Claude-Opus-Call — auch exakt wiederkehrende Positionen, die bei Stammkunden-LVs und ausschreibungstext-basierten LVs (STLB) der häufigste Fall sind. Das ist an dieser Stelle überdimensioniert: unnötige Kosten/Latenz und unnötige LLM-Fehlerfläche für Fälle, die ein Hash-Vergleich löst. GAEB-Online und BRZ zeigen, dass ein Großteil der Wiederholpositionen ohne LLM zuordenbar ist.
-> EMPFEHLUNG: Stufe 1.5 einziehen: normalisierter Kurz-/Langtext-Hash bzw. identische STLB-/Katalognummer + gleiche Einheit → deterministisch 'sicher' ohne LLM-Call (mit Kennzeichnung 'Exact Match' in der Herleitung). Sauber als deterministische Ausnahme der Regel 'LLM kann nie heraufstufen' dokumentieren. Nebeneffekt: Die spätere Modell-Stufung nach Kosten wird kleiner, weil die trivialen Fälle gar kein Modell mehr sehen.

### [mittel] Abschnitt 6 (Stufe 3, Preisableitung zu eindimensional): Nur Baupreisindex (Zeit) plus optionale Mengenstaffel-Regeln, die kaum ein KMU gepflegt hat. Region, Marktzyklus und Projektkontext fehlen; die real gemessene Streuung von Angebotspreisen liegt bei ±40 % um den Mittelwert (Cosuno-Daten). Ein indexierter Punkt-EP suggeriert eine Scheingenauigkeit, die der Kalkulator zu Recht anzweifeln wird. Zudem fehlt ein Mengensprung-Guard: Ein EP von 100 m Bordstein wird unverändert auf 10.000 m übertragen — Skaleneffekte machen den Preis unbrauchbar, `anpassungs_hinweise` ist nur ein Hinweisfeld ohne Konsequenz.
-> EMPFEHLUNG: Neben dem Punktwert das Streuband der Top-Kandidaten anzeigen (min/median/max mit Jahren/Projekten) — ehrlicher und für den Kalkulator wertvoller. Mengensprung als harten Guard definieren (z. B. Faktor > 5 zwischen Alt- und Neumenge → maximal 'prüfen'). Eine optionale Regionalfaktor-Stammdatentabelle (Muster: sirAdos-Ortsfaktoren) im Datenmodell vorsehen, auch wenn sie im MVP leer bleibt.

### [mittel] Abschnitt 8 (Preisgedächtnis-Verwässerung): Append-only ohne Deduplizierung erzeugt eine Echo-Kammer: Jeder übernommene Vorschlag wird als neuer Eintrag geschrieben — nach Monaten dominieren Selbstkopien desselben Preises die Top-10-Kandidaten, Alternativen verschwinden aus dem Retrieval, Preise 'versteinern'. Zusätzlich fehlt ein Gewonnen/Verloren-Signal: Preise verlorener Angebote fließen gleichwertig ein wie beauftragte — das System kann systematisch zu hohe (oder zu niedrige) Preise reproduzieren.
-> EMPFEHLUNG: `history_positions` um ein Cluster-/Gruppierungskonzept ergänzen (kanonische Position + Preiszeitreihe statt flacher Eintragsliste); Retrieval liefert je Cluster einen Repräsentanten. Herkunft (`original_import` | `uebernahme` | `nachkalkulation`) und Angebotsstatus (`angeboten` | `beauftragt` | `verloren`) als Felder aufnehmen und im Ranking gewichten — das Statusfeld kostet im MVP fast nichts, ist nachträglich aber kaum rekonstruierbar.

### [mittel] Abschnitt 5 (fehlende arithmetische Intake-Guards): Für PDF-/Excel-Extraktion ist keine deterministische Plausibilisierung spezifiziert. Die häufigsten Extraktionsfehler (Dezimal-/Tausendertrennzeichen, Spaltenverschiebung, zweizeilige Positionen) sind arithmetisch zuverlässig erkennbar: GP = EP × Menge je Zeile, Titelsummen = Summe der Positionen, Einheiten gegen Whitelist. Die Regel 'Extrahiertes ist höchstens prüfen' ist richtig, ersetzt aber keine automatische Fehlerlokalisierung — 500 Positionen manuell gegenzulesen frisst die versprochene Zeitersparnis auf.
-> EMPFEHLUNG: Arithmetik-Konsistenzchecks als Pflicht-Guard im Intake: jede Verletzung markiert die konkrete Position/Zelle in der Workbench (Diff-Anzeige Original vs. Extraktion). Bei Historie-Importen zusätzlich Summenprüfung gegen die Angebotsendsumme als Abnahmekriterium des Imports.

### [mittel] Abschnitt 7 (EU-Residenz-Aussage vs. Bedrock-Realität): 'Alles läuft in eu-central-1' ist für die Claude-Aufrufe möglicherweise nicht wörtlich haltbar. Neuere Claude-Modelle sind auf Bedrock in Europa teils nur über Cross-Region-Inference-Profile verfügbar; das EU-Geo-Profil routet je nach Kapazität über mehrere Regionen, darunter auch London und Zürich (Nicht-EU, aber Angemessenheitsbeschluss). Wer wörtlich 'Frankfurt-only' verkauft, muss das Profil deaktivieren und auf in eu-central-1 nativ verfügbare Modelle beschränken — mit dem im Dokument selbst genannten Verfügbarkeitsverzug als Preis. (Konkrete Modell-/Regionslage zum Bauzeitpunkt: zu verifizieren.)
-> EMPFEHLUNG: Entscheidung explizit machen: entweder (a) eu-central-1-only per Konfiguration/SCP erzwingen und Marketing-Aussage 'Frankfurt' beibehalten, oder (b) EU-/EWR-Geo-Profil nutzen und die Formulierung in AVV/Marketing auf 'EU-Verarbeitung' präzisieren. In Abschnitt 7 als Konfigurationspunkt neben der Modell-ID aufnehmen; vor jedem Modell-Upgrade prüfen.

### [mittel] Abschnitt 6 (Stufe 1, harte Filter vs. kleine Historien): Die harten Retrieval-Filter (kompatible Einheit, Gewerk, Mengenband ±) können bei dünner Historie auf null Kandidaten filtern, obwohl brauchbare Treffer existieren — z. B. gleiche Leistung mit anderer Gewerk-Zuordnung im Alt-LV oder historisch inkonsistent erfasste Einheiten. Gerade in der Pilotphase (kleine Historien!) senkt das die Coverage unnötig und lässt das Produkt schwächer aussehen, als das Matching ist.
-> EMPFEHLUNG: Filter-Kaskade mit Relaxation: erst streng filtern; liefert das weniger als k Kandidaten, Gewerk und Mengenband zu Ranking-Boosts abschwächen und die Position automatisch auf maximal 'prüfen' deckeln. Nur die Einheitenkompatibilität bleibt in Stufe 3 hart. Coverage mit/ohne Relaxation als Metrik mitloggen.

### [niedrig] Abschnitt 5 (Mapping-Drift beim Excel-Import): Gemerkte Spalten-Mappings je Absender/Dateityp laufen deterministisch durch und dürfen 'sicher' erreichen — auch wenn der Absender sein Layout stillschweigend ändert (neue Spalte, getauschte Reihenfolge). Ergebnis wären still falsch importierte Mengen/Preise mit höchster Verlässlichkeitsstufe, also genau der Fehler, den die Stufenlogik verhindern soll.
-> EMPFEHLUNG: Mit jedem bestätigten Mapping einen Struktur-Fingerprint speichern (Hash über Headerzeile/Spaltenzahl/Beispieltypen); weicht die neue Datei ab, Re-Bestätigung erzwingen und bis dahin auf 'prüfen' deckeln. Zusätzlich die Arithmetik-Guards (GP = EP × Menge) als zweite Verteidigungslinie auch auf gemappte Importe anwenden.

### [niedrig] Abschnitt 6 (Embedding-Modellwahl unterspezifiziert): 'z. B. Titan/Cohere in eu-central-1' übergeht, dass deutsche Bau-Fachsprache (Abkürzungen wie psch, St, OK FFB, DN-Angaben, STLB-Formulierungen) der harte Teil des Retrievals ist. Titan ist für Deutsch schwach dokumentiert; Cohere Embed multilingual v3/v4 ist die realistischere Wahl — die konkrete Verfügbarkeit von Embed v4 in eu-central-1 zum Bauzeitpunkt ist zu verifizieren. Eine schlechte Embedding-Wahl deckelt die gesamte Pipeline, egal wie gut Stufe 2 urteilt.
-> EMPFEHLUNG: Embedding-Auswahl als messbare Entscheidung behandeln: Mini-Benchmark aus echten LV-Positionspaaren der Design-Partner (Recall@10/20 der korrekten Altposition) gegen 2–3 Kandidatenmodelle fahren. Vor dem Embedding eine Abkürzungs-/Einheiten-Normalisierung (dieselbe Stammdatentabelle wie in Abschnitt 12.4) anwenden.

### [niedrig] Abschnitte 8/11 (Feedback-Loop lernt im MVP nur Angebots-, nicht Ist-Preise): Der selbst als 'Qualitätssprung' bezeichnete Nachkalkulations-Import ist auf Ausbaustufe 2 verschoben. Im MVP reproduziert das Preisgedächtnis damit ausschließlich, was die Firma früher angeboten hat — inklusive alter Kalkulationsfehler und Margenirrtümer. Das ist als bewusster Schnitt vertretbar, wird im Dokument aber nicht als Risiko benannt.
-> EMPFEHLUNG: Im MVP zumindest den Import-Pfad für Nachkalkulations-Excels mit einem Design-Partner einmal real durchspielen (der Universal-Intake existiert ja) und das Feld `quelle_typ = nachkalkulation` von Anfang an befüllbar halten — so bleibt der 'Ist-Preis-Sprung' ein reiner Datenimport statt eines späteren Schemaumbaus.

## BRIEF
# Recherche-Brief: Automatisierung der Baukalkulation — Stand der Technik 2024–2026

*(Methodik-Hinweis: Direktabrufe der Quellseiten wurden vom Netzwerk-Proxy teils blockiert; Fakten stammen aus Suchergebnis-Auszügen zu den gelisteten URLs. Reine Hersteller-Selbstauskünfte sind als solche markiert.)*

## 1. Wettbewerber DACH

**GAEB-Online 2025 „KI-PreisNavigator"** (verfügbar seit 01.06.2026) ist der nächste Verwandte des geplanten Kerns: Er schlägt Einheitspreise aus der **eigenen Angebotshistorie** (GAEB X83/X84) vor, läuft **100 % lokal** (einmalig geladenes ONNX-Sprachmodell, ~430 MB, keine Cloud) und liefert seit einem Update **„Preisprotokolle"** als nachvollziehbare Herleitung. Beworben werden 30–60 Min. Ersparnis pro Ausschreibung; erste Vorschläge sollen schon „mit wenigen gespeicherten Angeboten" möglich sein (Herstellerangabe). Das validiert zwei Kern-Annahmen der Architektur (eigene Historie + Herleitungspflicht) — bleibt aber Einzelplatz, GAEB-only, ohne Universal-Intake und ohne Team-/SaaS-Modell.

**BRZ 365 / KI-Kalkulationsassistent** (entwickelt mit XITASO): analysiert Alt-Kalkulationen, Lang-/Kurztexte, Synonyme und Wortbeziehungen und arbeitet in **drei Stufen**: (1) Empfehlungen für Schlüsselpositionen, (2) vorstrukturierte Positionen mit Kalkulationsansätzen, (3) vollautomatische Kalkulation inkl. Zuschlägen. Zeigt: etablierte Bausoftware-Häuser besetzen dasselbe Feld — allerdings nur innerhalb der eigenen Suite.

**Cosuno KI** (seit 12/2024): **Marktreferenzpreise** je LV-Position aus laut Anbieter >7 Mio. Preisdatenpunkten (>100 Mrd. € analysiertes Bauvolumen). Wichtigste veröffentlichte Zahl: mittlere Abweichung der Prognose **~20 %**, während reale Angebote **±40 %** um den Mittelwert streuen (Eigenangabe, Whitepaper 11/2024). Anderes Modell als die Architektur (Markt- statt Firmenpreis) — löst aber genau den Kaltstart, den das Architektur-Papier offen lässt.

**Kalkulation.KI (Strabag + Uni Oldenburg, VLBA)**: Forschungskooperation mit Text-Mining-/ML-Methoden (CRISP-DM); Ziel ist, aus elektronisch eingelesenen LVs **automatisch Kalkulationsentwürfe** zu erzeugen und Kalkulatoren bei der Auswahl passender Angebotskomponenten zu unterstützen — exakt das Muster „Projekthistorie als Kalkulationswissen", aber konzernintern. Öffentliche Genauigkeitszahlen: keine gefunden (zu verifizieren).

**BauGPT (Crafthunt)**: KI-gestützte **LV-Erstellung** mit GAEB-X83-Export (Positionen, Mengen, Kurz-/Langtexte strukturiert an AVA-Software übergeben, Meldung 2026). Sitzt eher auf der Ausschreiber-Seite; bei Plänen/Zeichnungen erklärt der Anbieter selbst Grenzen.

**Weitere Nischen**: BAUBOOST (GAEB-Kalkulation auf eigenen Stammdaten → Angebots-PDF/Excel), Vergabescanner (liest LV-PDFs, Vorkalkulation mit Quellenverweis auf die Originalzeile), Tendermeister (GAEB + KI-LV-Analyse), Match Manufacturer/N1 Circular (LV-Position→Produkt-Matching, „bis zu 70 % schnellere LV-Bearbeitung", Eigenangabe), Calcora (AT, Plananalyse, Markteintritt Anfang 2026 angekündigt), DBD-KostenAnsätze (KI-Erstvorschlag je Bauleistung). Zum in der Aufgabenstellung genannten Anbieter **„epesi" war trotz mehrerer Suchvarianten keine belastbare Quelle auffindbar — zu verifizieren** (Name/Schreibweise?).

## 2. International

- **Togal.AI** (Takeoff aus Plänen): Universität-Kansas-Studie: bis zu **76 % schneller** bei Genauigkeit **innerhalb ±5 %** ggü. On-Screen-Takeoff. Kritische Nutzerstimme (Trustpilot 09/2025): für gewerkespezifische Detail-Takeoffs (Bewehrung, Betonvolumen) zu flach — „im Kern ein Flächen-/Längen-Messwerkzeug". Lehre: Flächen/Längen automatisierbar, Gewerketiefe nicht.
- **Handoff** (YC): Instant-Estimates für Remodeler aus **100.000+ abgeschlossenen Estimates** plus **60 Mio.+ Lieferanten-SKUs** (Home Depot/Lowe's) mit ZIP-Code-lokalen Preisen — **Kaltstart über Marktdaten**, danach Personalisierung je Contractor.
- **Buildxact „Blu"**: Takeoff-Assistent, Estimate-Generator (aus „tausenden gewonnenen Estimate-Templates"), **Estimate-Reviewer, der fehlende Positionen flaggt** (übernehmenswertes Muster), Recipe-Assistent.
- **ProEst/Autodesk**: 2021 übernommen, läuft im Preconstruction-Bundle weiter (Export-Funktionen 07/2025); klassische Kostendatenbank-Kalkulation, kaum LLM.
- **STACK**: Floor Plan AI (Räume/Türen/Fenster autodetektiert; Estimator **editiert statt zeichnet**), „STACK Assist" beantwortet Planfragen mit Blattverweis in ~30 s; in einem Vergleichstest Genauigkeit innerhalb ~3 %.
- **Trunk Tools** ($40 M Series B, 07/2025; gesamt $70 M): RAG über Projektdokumente; **Grounding mit Quellenzitaten gilt in der Kategorie als definierende Fähigkeit** gegen Halluzination — bestätigt Leitplanke 3 der Architektur.

Gemeinsamer Nenner: (a) verkauft wird **Zeitersparnis, nie der „richtige" Preis**; (b) kein Anbieter arbeitet vollautomatisch — überall Quellen-Grounding plus menschliche Prüfung; (c) Kaltstart wird über Markt-/Lieferantendaten gelöst.

## 3. LLM/RAG-Matching und Preisvorhersage — belastbare Zahlen

- Ensemble-NLP zur Zuordnung Quantity-Take-off ↔ Kostenindex: **82,96 % Übereinstimmung** mit der Zuordnung durch Quantity Surveyors (Hochhaus-Fallstudie, Int. J. of Construction Management 2025). Selbst gute Systeme lassen also ~17 % Prüffälle — die `sicher/prüfen/manuell`-Dreiteilung ist das richtige Muster.
- Transformer-Klassifikation von BoQ-Komponenten (RoBERTa): **91 % Genauigkeit** (IEOM 2024). LLM-Konzeptschätzung: modulare Chain-of-Thought schlägt Zero-Shot (MDPI Buildings) — aber auf Projekt-, nicht Positionsebene.
- **LLM-Konfidenz ist unzuverlässig**: verbalisierte Confidence ist systematisch überkonfident; Kalibrierung und Diskriminierung müssen separat gemessen werden; Zitat-/Referenztreue ist eine der schwächsten Aufgabenfamilien (~12 % Halluzination in Benchmarks). Konsequenz: Code-seitige Referenz-Verifikation (Leitplanke 3) ist Pflicht; Confidence-Routing (unterhalb Schwelle → Mensch) ist das Standard-HITL-Muster.
- Typische Fehlerarten beim LV-Matching (aus Literatur + Toolanalyse): ähnlicher Text mit **abweichender Randbedingung** (DN-Größe, Bodenklasse, Einbautiefe, „Material bauseits"), Einheiten-/Mengenskalen-Fehler, Kontextverlust ohne Titel-/Vorbemerkungs-Hierarchie, Extraktionsfehler bei hierarchischen PDF-Tabellen (Dezimal-/Spaltenverschiebung).
- Arbeitsteilung, die sich überall durchsetzt: **Parsen und Rechnen deterministisch; Kandidaten per Hybrid-Retrieval; LLM nur für das Urteil in Grenzfällen; Mensch als letzte Instanz** — deckungsgleich mit Abschnitt 6 der Architektur, mit einer Lücke: exakt wiederkehrende Positionen brauchen gar kein LLM.

## 4. Was ist heute gut/schlecht automatisierbar?

**Gut**: GAEB-Parsing (deterministisch, `sicher` erreichbar); Wiederholpositionen per Exact-/Near-Match; Kandidaten-Retrieval; Index-/Einheiten-Arithmetik; Export. **Mittel**: Excel-/PDF-Extraktion (Vision-LLMs stark, aber fehleranfällig bei verschachtelten Tabellen — arithmetische Gegenprüfung nötig); semantisches Matching bei abweichenden Randbedingungen (→ „prüfen"-Stufe). **Schlecht**: Preisbildung ohne Historie (Kaltstart); Mengenermittlung aus Plänen (eigene Produktkategorie, siehe Togal/STACK); NU-/Lieferantenpreise (Mehrparteien-Marktprozess); Zuschlags-/Umlagestrategie (firmenpolitisch, teils spekulativ); Bid/No-Bid (strategisch). Grund: Alles, was undokumentierte firmenindividuelle Entscheidungen oder antwortende Dritte voraussetzt, bleibt beim Menschen — die Architektur schneidet ihren MVP hier grundsätzlich richtig.

## QUELLEN
https://www.gaeb-online.de/gaeb-ki-preisnavigator.html
https://blog.gaeb-online.de/schneller-kalkulieren-mit-ki/
https://www.pressebox.de/pressemitteilung/gaeb-online-ulrike-braun/GAEB-Online-2025-erweitert-den-KI-PreisNavigator-um-nachvollziehbare-Preisprotokolle/boxid/1304331
https://www.pressebox.de/pressemitteilung/gaeb-online-ulrike-braun/gaeb-online-2025-ki-macht-preisvorschlge-fr-angebote/boxid/1299073
https://uol.de/en/vlba/projects/kalkulationki
https://www.kalkulation-ki.com/
https://www.cosuno.com/web/en/cosuno-ki
https://www.handwerk.com/holzhelden/cosuno-transparente-marktpreise-durch-kuenstliche-intelligenz
https://www.handwerksblatt.de/betriebsfuehrung/whitepaper-ki-veraendert-preisgestaltung-im-bauwesen
https://bau.bi/baumagazin/betriebsfuehrung/bausoftware-ki-fuers-baugewerbe-liefert-zuverlaessige-marktpreise-b18888
https://xitaso.com/en/projects/brz-ai-calculation-assistant/
https://www.this-magazin.de/artikel/advertorial-brz-mit-kuenstlicher-intelligenz-effizienter-kalkulieren-und-die-richtigen-auftraege-gewinnen-4010120.html
https://www.brz.eu/de/loesungen/brz365bautechnik
https://www.baunetzwerk.biz/ki-wird-bleiben-baugpt-als-digitaler-helfer-am-bau
https://bau.bi/baumagazin/betriebsfuehrung/ki-am-bau-baugpt-integriert-gaeb-export-fuer-leistungsverzeichnisse-b21837
https://www.baulinks.de/webplugin/2026/0937.php4
https://ki.bauboostconsulting.de/
https://vergabescanner.de/
https://tendermeister.com/gaeb-software/
https://n1circular.com/software/lv-analyse-mit-match-manufacturer
https://www.handwerkundbau.at/betrieb/management/kalkulieren-mit-ki/
https://www.dbd.de/dbd-kostenansaetze/
https://www.sirados.de/
https://www.sirados.de/produkte/angebotskalkulation/ortsfaktoren
https://www.tga-fachplaner.de/projektierung/baupreis-datenbanken-baukosten-sicherer-planen-pruefen-und-kalkulieren
https://www.togal.ai/case-study/ku-study-togal-vs-ost
https://www.togal.ai/case-study/peer-reviewed-study-togal-ai-vs-on-screen-takeoff
https://www.trustpilot.com/review/www.togal.ai
https://www.handoff.ai/
https://www.handoff.ai/instant-ai-estimates
https://www.ycombinator.com/companies/handoff
https://www.buildxact.com/us/news_media/buildxact-ai-estimator-calculator/
https://www.buildxact.com/ca/news_media/buildxact-delivers-breakthroughs/
https://construction.autodesk.com/products/proest/
https://www.autodesk.com/blogs/construction/july-2025-construction-product-release/
https://datadrivenaec.com/tools/stack-construction-tech
https://trunktools.com/resources/company-updates/trunk-tools-closes-40m-series-b-construction-ai-transformation/
https://www.cnbc.com/2025/08/01/trunk-tools-ai-reduce-construction-error-waste.html
https://www.aecfoundry.com/blog/ai-can-t-read-your-drawings---inside-the-race-to-build-aec-s-knowledge-layer
https://www.tandfonline.com/doi/full/10.1080/15623599.2025.2558070
https://ieomsociety.org/proceedings/2024dubai/466.pdf
https://www.mdpi.com/2075-5309/16/2/396
https://www.mdpi.com/2075-5309/16/3/485
https://arxiv.org/pdf/2305.18997
https://redis.io/blog/ai-human-in-the-loop/
https://galileo.ai/blog/human-in-the-loop-agent-oversight
https://www.digitalapplied.com/blog/ai-model-hallucination-rate-benchmarks-2026-study
https://arxiv.org/html/2603.18652v1
https://konfuzio.com/en/how-does-document-extraction-with-llms-work-correctly/
https://aws.amazon.com/blogs/machine-learning/unlocking-ai-flexibility-in-europe-a-guide-to-cross-region-inference-for-eu-data-processing-and-model-access/
https://www.padiso.co/blog/deploying-claude-germany-data-residency-compliance-latency/
https://hidekazu-konishi.com/entry/amazon_bedrock_cross_region_inference_and_data_residency.html
https://aws.amazon.com/about-aws/whats-new/2025/10/coheres-embed-v4-multimodal-embeddings-bedrock
https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-cohere-embed-multilingual.html
https://www.report.at/bau/wie-ki-die-kalkulation-in-der-baubranche-neu-definiert
https://skill-sprinters.de/blog/branchen/ki-im-bauunternehmen-2026-fuenf-use-cases/
---

## Dimension: techstack

## VERDICT
ausreichend: True
begruendung: Der Brief deckt alle sechs Unterpunkte der Original-Aufgabe vollstaendig ab (GAEB-Parser-Landschaft inkl. konkreter Projekte und klarer Antwort auf die Sprachfrage; Excel-/PDF-Intake; Embeddings in Bedrock inkl. Deutsch-Eignung und EU-Alternativen; Claude auf Bedrock mit Modellen, Structured Outputs und Preisen; Vektorsuche mit Skalierungsgrenzen; Next.js/Fargate, Auth-Vergleich, pg-boss vs. SQS, RLS-Best-Practices) und liefert 11 architektur_kritik-Eintraege mit Abschnittsbezug, Schweregrad und konkret umsetzbaren Empfehlungen zu allen geforderten Abschnitten (3, 4, 5, 7, 9, 10 plus 1, 6, 11). Drei per WebSearch geprueften Kernbehauptungen stimmen: (1) pyGAEB (frameIQ) existiert als MIT-Python-Parser fuer GAEB DA XML 2.0-3.3 mit exakt den genannten Phasen; (2) Cohere Embed v4 ist auf Bedrock on-demand in eu-west-1 verfuegbar und aus Frankfurt ueber das EU-Cross-Region-Profil eu.cohere.embed-v4:0 nutzbar (AWS-Ankuendigung 10/2025); (3) Dangl AVACloud ist tatsaechlich self-hosted per Docker (Windows/Linux) mit REST-API betreibbar - die zentrale Empfehlung des Hoch-Befunds traegt also. Auch die Claude-/Bedrock-Angaben (Preise, Mantle-Client mit anthropic.-Praefix, output_config.format, fehlende Batch-API auf Bedrock, Tokenizer-Faktor) stimmen mit autoritativen Referenzdaten ueberein. Unsicheres ist durchgaengig ehrlich als "zu verifizieren" markiert (Titan-Frankfurt, AVACloud-Lizenzkosten, 1h-Cache-TTL auf Mantle, exakte EU-Routing-Regionen), die Quellenliste enthaelt nur real existierende, thematisch passende URLs - keine Anzeichen erfundener Fakten oder Quellen. Einzige, nicht behebungsbeduerftige Randnotiz: Die Preisangaben sind korrekt als First-Party-Listenpreise gekennzeichnet; die tatsaechliche Bedrock-Partnerpreisliste kann geringfuegig abweichen, was der Brief durch den +10-%-EU-Aufschlag-Hinweis und die Groessenordnungs-Einordnung angemessen abfedert.
maengel: []

## KRITIK (11 Punkte)

### [hoch] Abschnitt 5/11: Für GAEB X81/X83/X84 wird ein 'deterministischer Parser' vorausgesetzt, aber keine Bibliothek benannt — und im gewählten Node/TypeScript-Ökosystem existiert kein einziger nativer GAEB-Parser (npm-Suche: nur Dangl-AVACloud-API-Clients). Die reifen Parser sind .NET (Dangl.GAEB, GAEB Toolbox) bzw. jung in Python (pyGAEB, MIT, 15 Stars). Diese Make-or-buy-Entscheidung ist das größte unadressierte Umsetzungsrisiko des MVP.
-> EMPFEHLUNG: Entscheidung ins Dokument aufnehmen: bevorzugt AVACloud (Dangl IT) als self-hosted Docker-Container in der eigenen VPC eu-central-1 + @dangl/avacloud-client-node (deckt GAEB 90/2000/XML ab, EU-Story bleibt intakt; Lizenzkosten anfragen — zu verifizieren). Alternative: Python-Sidecar mit pyGAEB (Dialekt-Abdeckung gegen echte Kundendateien testen). Eigenbau höchstens für X8x-XML, GAEB 90 nie selbst bauen. Ein Sprachwechsel des Gesamtstacks ist NICHT nötig.

### [hoch] Abschnitt 1/10: 'Alles läuft in eu-central-1' stimmt für die Claude-Aufrufe nicht. Für aktuelle Modelle (Opus 4.7+, Sonnet 5, Haiku 4.5, Fable 5) bietet Frankfurt auf Bedrock nur Global- und EU-Geo-Endpunkte, kein 'In-region only' (das gibt es in Europa nur in eu-west-1 Irland und eu-north-1 Stockholm). Der EU-Endpunkt routet über die AWS-EU-Geographie inkl. London (UK) und Zürich (CH) — Drittländer mit Angemessenheitsbeschluss. Das Verkaufsargument 'erspart die Drittland-Diskussion' ist so nicht haltbar; zudem fehlt der +10-%-Preisaufschlag regionaler Endpunkte in der Kalkulation.
-> EMPFEHLUNG: Leitplanke 1 präzisieren: 'EU-Residenz über Bedrock-EU-Endpunkt (+10 % Aufschlag); Verarbeitung innerhalb der AWS-EU-Geographie, ggf. inkl. UK/CH (Angemessenheitsbeschlüsse)' — und genau so in AVV/Kundenkommunikation. Für Kunden mit Single-Region-Pflicht eu-west-1 (Irland, In-region only) als Option dokumentieren. Daten at rest (RDS, S3, pgvector) bleiben nachweislich Frankfurt — das sauber getrennt kommunizieren. Exakte Routing-Zielregionen des EU-Profils zu verifizieren.

### [mittel] Abschnitt 6 (Stufe 1): 'z. B. Titan/Cohere in eu-central-1' ist zu vage und teils fraglich: Titan Text Embeddings V2 war zum Launch nur in us-east-1/us-west-2, eine Frankfurt-Verfügbarkeit ist nicht belegt (zu verifizieren). Belegt ist Cohere Embed v4 via EU-Cross-Region-Profil eu.cohere.embed-v4:0 (on-demand eu-west-1) — also wieder EU-Geo, nicht Frankfurt-only. Für deutsche Bautexte (Komposita, Abkürzungen wie 'psch', 'St') existieren keine Benchmarks; die Modellwahl ist ungeprüft.
-> EMPFEHLUNG: Vor Festlegung einen kleinen Retrieval-Eval mit 200–500 echten LV-Positionen der Design-Partner fahren (Cohere Embed v4 auf Bedrock vs. selbst gehostetes BGE-M3/multilingual-e5 auf eu-central-1). Embedding-Modell-ID wie die Claude-Modell-ID als Konfiguration führen und Dimension/Versionierung in history_positions mitspeichern (Re-Embedding-Pfad einplanen).

### [mittel] Abschnitt 6/9: pgvector ist richtig dimensioniert (Kipp-Punkt laut Benchmarks erst ~10 Mio.+ Vektoren), aber zwei bekannte Fallstricke fehlen: (a) HNSW-Suche mit RLS-/Tenant-Filter (gefilterte ANN-Suche) kann Kandidaten verlieren, wenn die Top-k vor dem Filter aus fremden Mandanten stammen; (b) die Postgres-Volltextsuche 'german' zerlegt keine Komposita — 'Tiefbordstein' matcht 'Bordstein' nicht, was im Bau-Vokabular systematisch Recall kostet.
-> EMPFEHLUNG: pgvector >= 0.8 mit iterativen Index-Scans voraussetzen (RDS-Versionsstand zu verifizieren); bei wachsenden Mandanten Partitionierung nach tenant_id bzw. partielle Indizes je Mandant einplanen. FTS um pg_trgm und eine bau-spezifische Synonym-/Kompositaliste (Stammdaten, wie die Einheiten-Tabelle) ergänzen. Erst bei >10 Mio. Vektoren OpenSearch/Qdrant evaluieren.

### [mittel] Abschnitt 1/9: RLS wird als Leitplanke genannt, aber die bekannten Betriebsfallen fehlen — genau dort passieren Multi-Tenant-Datenlecks: Session-weites SET des Tenant-Kontexts leakt bei Connection-Pooling den Kontext des Vormieters; RLS greift nicht für Tabellen-Owner/Superuser; fehlendes FORCE ROW LEVEL SECURITY.
-> EMPFEHLUNG: In Abschnitt 9 verbindlich festschreiben: Tenant-Kontext nur transaktionsgebunden (set_config(..., true) / SET LOCAL), App-DB-Rolle ist nie Tabellen-Owner, FORCE ROW LEVEL SECURITY auf allen Mandanten-Tabellen, kein BYPASSRLS für App-/Admin-Rollen, Index auf tenant_id überall. Dazu automatisierte Negativ-Tests ('Mandant A sieht nie Zeilen von B') in die CI.

### [niedrig] Abschnitt 7: 'Claude Opus' als Standard ist als Modellname veraltet benannt und die Kostenschätzung ist leicht optimistisch: Auf Bedrock-Mantle stehen Fable 5 ($10/$50), Opus 4.8/4.7 ($5/$25), Sonnet 5 ($2/$10 Intro bis 31.08.2026, dann $3/$15) und Haiku 4.5 ($1/$5). Opus 4.7+ nutzen einen neuen Tokenizer mit ~30 % mehr Token, und der EU-Endpunkt kostet +10 % — aus 1,5–2 ct/Position werden eher 2–2,5 ct (weiter unkritisch).
-> EMPFEHLUNG: Konkret benennen: Start mit Opus 4.8 (anthropic.claude-opus-4-8) via EU-Endpunkt; im Pilot A/B gegen Sonnet 5 messen (Intro-Preis nutzen), Haiku 4.5 als Kandidat für die 'eindeutigen Fälle'. Tokenizer-Faktor (+30 %) und EU-Premium (+10 %) in die Kostenschätzung aufnehmen.

### [niedrig] Abschnitt 7: Die Structured-Outputs-Angabe stimmt (output_config.format, auf Bedrock GA seit 04.02.2026), aber die Schema-Einschränkungen fehlen: keine rekursiven Schemas, keine numerischen/String-Constraints (minimum, minLength …), additionalProperties: false erforderlich, enum nur mit Primitivtypen; erste Anfrage pro Schema zahlt Grammar-Kompilierungs-Latenz (24-h-Cache).
-> EMPFEHLUNG: Match- und Extraktions-Schemas gegen die Einschränkungsliste prüfen (das gezeigte Match-Schema ist konform), Wertebereichs-Validierung (z. B. Mengen > 0) in den deterministischen Code legen und Schemas stabil halten, damit der Grammar-Cache greift.

### [niedrig] Abschnitt 6 (Prompt-Caching): '1h-TTL bei Batch-Läufen' ist auf Bedrock nur teilweise belegt: 1h-TTL ist dort seit 01/2026 GA für Sonnet 4.5/Haiku 4.5/Opus 4.5; für Opus 4.8/Sonnet 5 auf dem neuen Mantle-Endpunkt zu verifizieren. Außerdem kostet der 1h-Write 2x Basispreis (5m: 1,25x) — bei einem durchlaufenden 500-Positionen-Batch (Aufrufe im Sekunden-/Minutentakt) reicht der 5m-Cache und ist günstiger.
-> EMPFEHLUNG: TTL nicht pauschal auf 1h setzen: 5m als Default für Batch-Läufe, 1h nur wenn Messung Lücken > 5 min zwischen Aufrufen zeigt; Verfügbarkeit des 1h-Flags für das konkrete Zielmodell auf Bedrock vor Go-Live prüfen.

### [niedrig] Abschnitt 5 (PDF-Intake): 'Vision nur für Scans' ignoriert eine deterministische Zwischenstufe: Amazon Textract ist in eu-central-1 verfügbar, unterstützt Deutsch und extrahiert Tabellenstrukturen aus Scan-PDFs — als Vorstufe vor der Claude-Extraktion oft robuster und billiger als reine Vision, und es hält die Pipeline in Frankfurt.
-> EMPFEHLUNG: Textract (Tables) als optionale OCR-/Tabellen-Vorstufe für Scan-PDFs in die Intake-Tabelle aufnehmen; Claude bekommt dann Text + Tabellengeometrie statt Pixel. Vision bleibt Fallback für Fotos/Handschrift.

### [niedrig] Abschnitt 4: 'Auth.js/better-auth oder Keycloak' lässt die Entscheidung offen, obwohl die Anforderungen (E-Mail/Passwort + Passkeys + B2B-Mandanten, kein Anbieter-Lock-in) klar für eine Option sprechen: Auth.js/NextAuth ist bei Credentials/Passkeys schwach und gilt 2026 für Neuprojekte als selten richtige Wahl; Keycloak hat keine eingebaute B2B-Mandantenlogik (Realm-Design selbst bauen) und Java-Betriebsaufwand.
-> EMPFEHLUNG: better-auth als Primärempfehlung festschreiben (Organization-Plugin: Orgs/Invites/RBAC; Passkeys und E-Mail/Passwort nativ; Daten in der eigenen Postgres). Generisches OIDC/SAML-SSO je Mandant später via better-auth-SSO-Plugin oder vorgeschaltetem Keycloak nur für Enterprise-Kunden.

### [niedrig] Abschnitt 3/4 (Betrieb): Next.js auf Fargate mit mehreren Replicas bricht den Default-Filesystem-/ISR-Cache (Split-Brain); output: standalone kopiert public/.next/static nicht automatisch; SSE-Streams brauchen ALB-Idle-Timeout-/CloudFront-Konfiguration; und CloudFront terminiert TLS an Edge-Standorten auch außerhalb der EU — ein Detail, das die strenge EU-Erzählung ankratzen kann.
-> EMPFEHLUNG: Für die dynamische Workbench ISR/Static-Caching schlicht nicht nutzen (oder custom cacheHandler auf Redis/ElastiCache); Dockerfile-Standalone-Fallstricke in die IaC-Vorlage; SSE-Timeouts explizit konfigurieren. CloudFront-Rolle bewerten: für eine Login-App genügt ggf. ALB in eu-central-1 — oder CloudFront mit dokumentierter Edge-Begründung (Inhalte werden dort nicht gespeichert).

## BRIEF
# Recherche-Brief: Techstack-Verifikation Kalkulations-Assistent (Stand 24.07.2026)

## 1. GAEB-Parsing — der wunde Punkt des Node-Stacks

Die GAEB-Bibliothekslandschaft ist **.NET-/Java-lastig, das Node-Ökosystem ist leer**: Eine npm-Registry-Suche nach „gaeb" liefert **keinen einzigen nativen Parser**, nur API-Clients für Dangl-IT-Dienste (`@dangl/avacloud-client-node`, v1.32.0, zuletzt 02/2026 — aktiv gepflegt). Die reifen Optionen:

- **Dangl.GAEB / Dangl.AVA (Dangl IT GmbH, .NET):** kommerzielle Referenz-Bibliothek, deckt **GAEB 90, GAEB 2000 und GAEB DA XML** ab. Als **AVACloud** auch als REST-Dienst — entscheidend: **AVACloud ist self-hosted per Docker (Windows/Linux) betreibbar**, also als Container in der eigenen VPC in eu-central-1. Damit bleibt der TS-Stack, und die EU-Story bleibt intakt. Preise (Jahresabo) und On-Prem-Lizenzkonditionen: **zu verifizieren** (Website blockte automatisierten Zugriff).
- **GAEB Toolbox (gaebtoolbox.de):** offizielle, kommerzielle Toolbox; .NET-Assembly (auch .NET Core), keine Node-Variante.
- **pyGAEB (frameIQ/pygaeb, Python, MIT):** parst/validiert/schreibt GAEB DA XML **2.0–3.3, Phasen X31, X50–X52, X80–X89, X93–X97**, Decimal-Arithmetik, Excel/JSON-Export. Aber **jung**: 15 Stars, 66 Commits; **GAEB 90 nur „geplant"**. Für den MVP als Python-Sidecar denkbar, Dialekt-Abdeckung gegen echte Kundendateien **zu verifizieren**.
- **gaeb4linux (Java):** Open-Source-Viewer/-Editor X81–X87; eher Endanwender-Tool als Bibliothek.

**Fazit zur Sprachfrage:** Die Sprachwahl TypeScript ist **kein Grund für einen Stack-Wechsel**, aber sie erzwingt eine bewusste Make-or-Buy-Entscheidung: selbst gehostetes AVACloud (empfohlen), Python-Sidecar mit pyGAEB, oder Eigenbau eines X8x-XML-Parsers (machbar, GAEB DA XML ist normales XML mit offiziellen XSDs von gaeb.de — aber Dialekt-Sumpf; GAEB 90 als Festformat nie selbst bauen).

## 2. Excel-/PDF-Intake

**Excel (Node):** **SheetJS (`xlsx`)** liest praktisch alle Formate (XLSX/XLS/ODS/CSV) — Achtung: `sheet_to_json` löst **verbundene Zellen nicht auf** (Fill-down selbst implementieren); **exceljs** bietet Streaming-Reader und sauberen Merged-Cells-Zugriff. Beide zusammen decken den Mapping-Assistenten ab. **PDF:** pdftotext (Poppler) first ist richtig; für Scans ist neben Claude-Vision **Amazon Textract** eine deterministische Option — **in eu-central-1 verfügbar und mit Deutsch-Support** (Text, Formulare, Tabellen).

## 3. Embeddings in Bedrock eu-central-1

- **Amazon Titan Text Embeddings V2:** zum Launch (04/2024) nur us-east-1/us-west-2; eine Frankfurt-Verfügbarkeit konnte ich **nicht belegen — zu verifizieren** vor Festlegung.
- **Cohere Embed v4** (multimodal, 100+ Sprachen inkl. Deutsch, MTEB ≈ 65,2 — Spitzenwert der API-Modelle): seit 10/2025 auf Bedrock, on-demand in **eu-west-1 (Irland)**, aus Frankfurt über das **EU-Cross-Region-Profil `eu.cohere.embed-v4:0`** nutzbar. Das ist der belastbare Bedrock-EU-Pfad — aber eben EU-Geographie, nicht Frankfurt-only.
- **Deutsche Bautexte:** Es gibt keine öffentlichen Benchmarks für LV-/Bausprache; MTEB misst Deutsch nur generisch. Selbst-Hosting-Alternativen in eu-central-1: **BGE-M3** (dense+sparse+ColBERT, 100+ Sprachen, 8k Kontext) und **multilingual-e5** — beide auf Augenhöhe mit Cohere v3. EU-Anbieter als Alternative: Jina AI (Berlin), Mistral (Paris), Aleph Alpha (Heidelberg) — Details **zu verifizieren**. Empfehlung: kleiner Retrieval-Eval mit echten LV-Positionen (Komposita: „Tiefbordstein", „Betonrückenstütze") vor der Modellwahl.

## 4. Claude auf Bedrock eu-central-1

Es gibt inzwischen **zwei Integrationen**: die neue **„Claude in Amazon Bedrock" (Bedrock-Mantle)** — Messages-API unter `bedrock-mantle.{region}.api.aws/anthropic/v1/messages`, Modell-IDs mit `anthropic.`-Präfix, offizielles SDK `@anthropic-ai/bedrock-sdk` — und die Legacy-Integration (InvokeModel/Converse) für Opus 4.6 und älter. **Auf Mantle offen verfügbar: Claude Fable 5, Opus 4.8, Opus 4.7, Sonnet 5, Haiku 4.5.**

- **Regionen:** eu-central-1 bietet **nur „Global"- und „EU"-Endpunkte, kein „In-region only"** — Frankfurt-only-Routing gibt es für aktuelle Modelle nicht. Der EU-Endpunkt routet innerhalb der AWS-EU-Geographie (Frankfurt, Zürich, Stockholm, Milan, Spanien, Irland, London, Paris) — **inkl. UK und Schweiz** (Drittländer mit Angemessenheitsbeschluss). „In-region only" in Europa: nur **eu-west-1 (Irland)** und **eu-north-1 (Stockholm)**. Regionale/EU-Endpunkte kosten **+10 %**.
- **Structured Outputs:** auf Bedrock **GA seit 04.02.2026**; Parameter heißt aktuell tatsächlich **`output_config.format`**. Einschränkungen: keine rekursiven Schemas, kein `minimum`/`minLength`, `additionalProperties: false` Pflicht — das Match-Schema der Architektur ist konform. Grammar-Cache 24 h → Schema stabil halten.
- **Prompt Caching:** 5m-TTL (Write 1,25×) und **1h-TTL (Write 2×, GA auf Bedrock seit 01/2026** für Sonnet 4.5/Haiku 4.5/Opus 4.5; für Opus 4.8/Sonnet 5 auf Mantle **zu verifizieren**); Cache-Read 0,1×.
- **Preise (First-Party-Listenpreise):** Fable 5 $10/$50, **Opus 4.8/4.7 $5/$25**, Sonnet 5 $2/$10 (Intro bis 31.08.2026, danach $3/$15), Haiku 4.5 $1/$5 pro MTok. Achtung: **Opus 4.7+/Sonnet 5/Fable 5 nutzen einen neuen Tokenizer (~30 % mehr Token)**. Die Kostenschätzung der Architektur (1,5–2 ct/Position) bleibt größenordnungsmäßig richtig (~2–2,5 ct inkl. EU-Premium).
- **Bestätigt:** keine Message-Batches-API auf Bedrock (Feature-Liste), Quota 2 Mio. Input-TPM Standard, Prompts/Outputs werden nicht gespeichert/trainiert.

## 5. Vektorsuche

**pgvector ist für diese Skala die richtige Wahl.** Kipp-Punkt laut Benchmarks 2025/26: erst ab ~10 Mio.+ Vektoren divergiert die Latenz unter Last (Buffer-Pool), ab 50–100 Mio. sind dedizierte Systeme klar besser. Hunderttausende Positionen je Mandant × Pilotkunden = einstellige Millionen — unkritisch. Zwei Fallstricke gehören aber ins Design: (a) **gefilterte ANN-Suche** (HNSW + RLS-/Tenant-Filter) kann Recall verlieren → pgvector ≥ 0.8 mit iterativen Index-Scans bzw. Partitionierung je Mandant; (b) Postgres-FTS `german` zerlegt **keine Komposita** → pg_trgm/Synonym-Wörterbuch ergänzen. OpenSearch (3.0: bis 9,5× schnellere Vektor-Engine) oder Qdrant erst als Ausbaupfad; sie kosten separate Infrastruktur + Sync-Logik.

## 6. Web/App

- **Next.js auf ECS Fargate:** etabliert; Fallstricke: `output: standalone` kopiert `public`/`.next/static` nicht automatisch; **bei >1 Replica bricht der Default-Filesystem-/ISR-Cache** (custom cacheHandler auf Redis oder ISR meiden — für eine dynamische Workbench verzichtbar); SSE braucht ALB-/CloudFront-Timeout-Konfiguration.
- **Auth:** **better-auth** ist 2026 für B2B-Multi-Tenant die stärkste selbst gehostete Option (Organization-Plugin mit Orgs/Invites/RBAC, Passkeys, 2FA, ~29k Stars); Auth.js/NextAuth gilt für Neuprojekte als selten richtige Wahl (schwach bei Credentials/Passkeys); **Keycloak** (~35k Stars, 13 Jahre reif) bringt SAML/OIDC-Enterprise-Features, aber **keine eingebaute B2B-Mandantenlogik** und Java-Betriebsaufwand.
- **Queue:** **pg-boss** (SKIP LOCKED, exactly-once, Retries/Backoff, Cron, DLQ; ~10.000 Jobs in 0,5 s) reicht für Hunderttausende Jobs locker; transaktionales Enqueue mit den DB-Writes ist der eigentliche Vorteil gegenüber SQS. Grenze: Verfügbarkeit = Postgres-Verfügbarkeit.
- **RLS:** Best Practices: Tenant-Kontext **nur transaktionsgebunden** (`set_config(..., true)`/`SET LOCAL` — Session-`SET` + Pooling = Datenleck), App-Rolle ≠ Tabellen-Owner, `FORCE ROW LEVEL SECURITY`, kein `BYPASSRLS` für App-Rollen, Index auf `tenant_id`; korrekt indexiert ist RLS-Overhead messbar null.

## QUELLEN
https://github.com/frameIQ/pygaeb
https://pypi.org/project/pyGAEB/
https://pygaeb.readthedocs.io/en/latest/
https://registry.npmjs.org/-/v1/search?text=gaeb&size=20
https://www.dangl-it.com/products/gaeb-ava-net-library/
https://www.dangl-it.com/products/avacloud-gaeb-saas/
https://www.dangl-it.com/articles/avacloud-clients/
https://github.com/Dangl-IT/avacloud-demo-node
https://gaebtoolbox.de/gaeb-tools/
https://github.com/klaus4772/gaeb4linux
https://www.gaeb.de/en/service/downloads/gaeb-dataexchange/
https://platform.claude.com/docs/en/build-with-claude/claude-in-amazon-bedrock
https://platform.claude.com/docs/en/about-claude/pricing
https://platform.claude.com/docs/en/build-with-claude/structured-outputs
https://aws.amazon.com/about-aws/whats-new/2026/02/structured-outputs-available-amazon-bedrock
https://aws.amazon.com/about-aws/whats-new/2026/01/amazon-bedrock-one-hour-duration-prompt-caching
https://aws.amazon.com/about-aws/whats-new/2025/10/coheres-embed-v4-multimodal-embeddings-bedrock/
https://aws.amazon.com/about-aws/whats-new/2024/04/amazon-titan-text-embeddings-v2-amazon-bedrock/
https://portkey.ai/models/bedrock/eu.cohere.embed-v4:0
https://repost.aws/questions/QU1ZrfdLMMT5CvH6rzYkr1bA/claude-4-availability-in-eu-regions
https://aws.amazon.com/blogs/machine-learning/amazon-textract-now-available-in-asia-pacific-mumbai-and-eu-frankfurt-regions/
https://aws.amazon.com/textract/faqs/
https://milvus.io/blog/choose-embedding-model-rag-2026.md
https://www.bentoml.com/blog/a-guide-to-open-source-embedding-models
https://www.tigerdata.com/blog/pgvector-vs-qdrant
https://encore.dev/articles/pgvector-vs-qdrant
https://github.com/timgit/pg-boss
https://nextjs.org/docs/pages/guides/self-hosting
https://www.sherpa.sh/blog/secrets-of-self-hosting-nextjs-at-scale-in-2025
https://azguards.com/frontend-development/frontend-architecture/the-consistency-gap-unifying-distributed-isr-caching-in-self-hosted-next-js/
https://makerkit.dev/blog/tutorials/better-auth-vs-clerk
https://workos.com/blog/top-nextauth-alternatives-secure-authentication-2026
https://openalternative.co/compare/better-auth/vs/keycloak
https://ricofritzsche.me/mastering-postgresql-row-level-security-rls-for-rock-solid-multi-tenancy/
https://oneuptime.com/blog/post/2026-01-25-row-level-security-postgresql/view
https://docs.sheetjs.com/docs/csf/features/merges/
https://www.npmjs.com/package/exceljs
