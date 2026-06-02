<!-- company-context.md — Command Center firm-level source of truth.
     Keep every anchor. Update by replacing the block under an anchor (idempotent). Firm-level facts only. -->

# Firmenkontext — {{FIRM_NAME}}

<!-- cc:meta -->
- plugin: command-center v0.1.0
- workspace_root: {{WORKSPACE_ROOT}}
- onboarded: {{DATE}}
- sprache: {{LANGUAGE}}   <!-- de | en | … -->

## Identität
<!-- cc:identity -->
- Firmenname: {{FIRM_NAME}}
- Rechtsform: {{LEGAL_FORM}}
- Verbundene Gesellschaften: {{SIBLING_COMPANIES_OR_—}}
- USt-IdNr / Steuernr: {{TAX_ID_OR_—}}
- Adresse(n): {{ADDRESSES}}
- Inhaber / Geschäftsführung: {{OWNERS}}
- Kontakt: {{CONTACT_OR_—}}

## Geschäftsmodell
<!-- cc:business -->
- Was die Firma macht: {{BUSINESS_ONE_LINER}}
- Branche: {{INDUSTRY}}
- Kundentyp: {{CUSTOMER_TYPE}}
- Standard-MwSt: {{VAT_RATE_OR_—}}

## Standorte / Projekte
<!-- cc:sites -->
{{SITES_SUMMARY_OR_POINTER}}
<!-- e.g. "Siehe _firma/stammdaten/projekte.json" oder eine kurze Liste -->

## Team / Personen
<!-- cc:people -->
{{PEOPLE_SUMMARY_OR_POINTER}}
<!-- e.g. "Siehe _firma/stammdaten/personen.json" oder Rollenliste -->

## Werkzeuge & Systeme
<!-- cc:tools -->
- Buchhaltung: {{ACCOUNTING}}
- Bank: {{BANK_OR_—}}
- Dateiablage: {{FILE_STORAGE}}  (Basis-Pfad: {{STORAGE_BASE_OR_—}})
- E-Mail: {{EMAIL_OR_—}}
- Branchensoftware: {{LOB_SOFTWARE_OR_—}}

## Datei- & Ordnerkonventionen
<!-- cc:conventions -->
- Benennungskonvention: {{NAMING_CONVENTION_OR_—}}
- Ausgabe-Pfade: {{OUTPUT_PATHS_NOTE}}  <!-- Default _ausgang/ oder reale Zielpfade; Details je Prozess in config/<process>.json -->
- Regeln: {{NAMING_RULES_OR_—}}

## Aktive Prozesse
<!-- cc:processes -->
<!-- je Zeile: <process> — status: selected|onboarded|scheduled — config: _firma/config/<process>.json -->
{{ACTIVE_PROCESSES}}

## Glossar
<!-- cc:glossary -->
{{GLOSSARY_OR_—}}

<!-- Optionale Register (nur wenn vorhanden):
_firma/stammdaten/projekte.json     keyed: { "<id>": { "name", "match", "ort", "ordner_name" } }
_firma/stammdaten/personen.json     keyed: { "<id>": { "name", "match", "rolle" } }
_firma/stammdaten/lieferanten.json  keyed: { "<id>": { "name", "match", "firma", "kategorie" } }
-->
