/**
 * Generate SYNTHETIC, format-realistic fixtures. NOT real Jan data.
 * Vektonce workbook is built with exceljs (formulas, numFmt, merge, defined name) so the
 * round-trip test can prove xlsx-populate preserves them. NO chart — exceljs can't author one;
 * chart-preservation is validated against Jan's REAL Vektonce at kickoff.
 */
import ExcelJS from "exceljs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { resolveRoot, underRoot } from "../engine/util/paths";

const SALDO_FORMULA = "SUM(Einnahmen!D5:D999)-SUM(Ausgaben!D5:D999)";
const EUR_FMT = "#,##0.00 €";

function buildVektonceWorkbook(label: string): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  for (const name of ["Einnahmen", "Ausgaben"]) {
    const ws = wb.addWorksheet(name);
    ws.getCell("B4").value = "Datum";
    ws.getCell("C4").value = "Betreff";
    ws.getCell("D4").value = "Betrag";
    ws.getCell("E4").value = "Kategorie";
    // rows 5+ intentionally empty — the append target
  }
  const saldo = wb.addWorksheet("Saldo");
  saldo.mergeCells("B1:D1");
  saldo.getCell("B1").value = `Kapitalfluss-Saldo — ${label}`;
  saldo.getCell("B3").value = "Saldo Monat";
  saldo.getCell("C3").value = { formula: SALDO_FORMULA, result: 0 };
  saldo.getCell("C3").numFmt = EUR_FMT;
  wb.definedNames.add("Saldo!$C$3", "SaldoMonat");
  return wb;
}

function buildLiquiditaetWorkbook(): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Liquiditaet");
  ws.getCell("B3").value = "Liquiditätsplanung — Mai 2026";
  const lines: Array<[string, string]> = [
    ["B5", "Einnahmen (Summe)"],
    ["B6", "Ausgaben (Summe)"],
  ];
  for (const [labelCell, text] of lines) {
    ws.getCell(labelCell).value = text;
  }
  for (const cell of ["C5", "C6"]) {
    ws.getCell(cell).value = 0;
    ws.getCell(cell).numFmt = EUR_FMT;
  }
  return wb;
}

const BOM = "﻿";
const CSV_HEADER =
  "Buchungstag;Wertstellung;Umsatzart;Buchungstext;Betrag;Währung;IBAN Kontoinhaber;Kategorie";

// One Commerzbank business account, one month. A realistic mix of credits (Einnahmen) and debits
// (Ausgaben) — every one of them lands in the Kapitalflusstabelle by sign. Includes a quoted
// multi-line memo (parser test) and a zero-amount info row (the CSV info-row filter drops it).
const COMMERZBANK_CSV =
  BOM +
  [
    CSV_HEADER,
    "30.05.2026;31.05.2026;Gutschrift;McDonalds Deutschland LLC Tagesumsatz-Sammelgutschrift 27.05.-29.05.;8.945,12;EUR;DE12500400000123456700;Umsatz",
    "23.05.2026;24.05.2026;Gutschrift;McDonalds Deutschland LLC Tagesumsatz-Sammelgutschrift 20.05.-22.05.;7.654,00;EUR;DE12500400000123456700;Umsatz",
    "28.05.2026;28.05.2026;Lastschrift;HAVI Logistics GmbH Warenlieferung KW21 RG-Nr 884201;-12.480,55;EUR;DE12500400000123456700;",
    "03.05.2026;03.05.2026;Dauerauftrag;Miete Immobilien GmbH Objekt Mai;-4.200,00;EUR;DE12500400000123456700;",
    "28.05.2026;28.05.2026;Lastschrift;Lohn und Gehalt SV-Beitrag Mai Personal;-9.870,30;EUR;DE12500400000123456700;",
    "15.05.2026;15.05.2026;Lastschrift;Stadtwerke Energie Strom Mai;-1.250,00;EUR;DE12500400000123456700;",
    '20.05.2026;20.05.2026;Lastschrift;"HAVI Logistics GmbH\nWarenlieferung KW20\nRG-Nr 884100";-5.000,00;EUR;DE12500400000123456700;',
    "01.05.2026;01.05.2026;Entgelt;Kontofuehrungsentgelt Mai;-19,90;EUR;DE12500400000123456700;",
    "01.05.2026;01.05.2026;Hinweis;Information Nutzungsbedingungen geaendert AGB Hinweis;0,00;EUR;DE12500400000123456700;",
  ].join("\r\n") +
  "\r\n";

export async function generateAll(root: string): Promise<void> {
  await mkdir(underRoot(root, "fixtures", "vektonce"), { recursive: true });
  await mkdir(underRoot(root, "fixtures", "liquiditaet"), { recursive: true });
  await mkdir(underRoot(root, "fixtures", "commerzbank"), { recursive: true });
  await mkdir(underRoot(root, "fixtures", "mapping"), { recursive: true });

  await buildVektonceWorkbook("Mai 2026").xlsx.writeFile(
    join(underRoot(root, "fixtures", "vektonce"), "vektonce.fixture.xlsx"),
  );
  await buildLiquiditaetWorkbook().xlsx.writeFile(
    join(underRoot(root, "fixtures", "liquiditaet"), "liquiditaet.fixture.xlsx"),
  );

  await writeFile(join(underRoot(root, "fixtures", "commerzbank"), "commerzbank-2026-05.csv"), COMMERZBANK_CSV);

  // a copy of the classification mapping as a fixture reference
  const mapping = await Bun.file(underRoot(root, "config", "dba-mapping", "mapping.v1.json")).text();
  await writeFile(join(underRoot(root, "fixtures", "mapping"), "dba-mapping.fixture.json"), mapping);
}

if (import.meta.main) {
  const root = resolveRoot(process.argv[2] ?? undefined);
  await generateAll(root);
  console.log(`fixtures generated under ${root}/fixtures`);
}
