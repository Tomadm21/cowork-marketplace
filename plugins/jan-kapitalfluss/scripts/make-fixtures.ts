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
  ws.getCell("B3").value = "Liquiditätsplanung (P&L) — Mai 2026";
  const lines: Array<[string, string]> = [
    ["B5", "Umsatzerlöse"],
    ["B6", "Wareneinkauf"],
    ["B7", "Raumkosten"],
    ["B8", "Personalkosten"],
    ["B9", "Energie"],
  ];
  for (const [labelCell, text] of lines) {
    ws.getCell(labelCell).value = text;
  }
  for (const cell of ["C5", "C6", "C7", "C8", "C9"]) {
    ws.getCell(cell).value = 0;
    ws.getCell(cell).numFmt = EUR_FMT;
  }
  return wb;
}

const BOM = "﻿";
const CSV_HEADER =
  "Buchungstag;Wertstellung;Umsatzart;Buchungstext;Betrag;Währung;IBAN Kontoinhaber;Kategorie";

// Linde — includes a quoted multi-line memo, an unmatched row, and a zero-amount info row.
const LINDE_CSV =
  BOM +
  [
    CSV_HEADER,
    "28.05.2026;28.05.2026;Lastschrift;HAVI Logistics GmbH Warenlieferung KW21 RG-Nr 884201 Filiale Linde;-12.480,55;EUR;DE12500400000123456700;",
    "30.05.2026;31.05.2026;Gutschrift;McDonalds Deutschland LLC Tagesumsatz-Sammelgutschrift 27.05.-29.05. Store 0421;8.945,12;EUR;DE12500400000123456700;Umsatz",
    "03.05.2026;03.05.2026;Dauerauftrag;Miete Immobilien GmbH Objekt Linde Mai;-4.200,00;EUR;DE12500400000123456700;",
    "28.05.2026;28.05.2026;Lastschrift;Lohn und Gehalt SV-Beitrag Mai Personal;-9.870,30;EUR;DE12500400000123456700;",
    "15.05.2026;15.05.2026;Lastschrift;Stadtwerke Energie Strom Linde Mai;-1.250,00;EUR;DE12500400000123456700;",
    '20.05.2026;20.05.2026;Lastschrift;"HAVI Logistics GmbH\nWarenlieferung KW20\nRG-Nr 884100";-5.000,00;EUR;DE12500400000123456700;',
    "01.05.2026;01.05.2026;Entgelt;Kontofuehrungsentgelt Sonderposten XYZ unbekannt;-19,90;EUR;DE12500400000123456700;",
    "01.05.2026;01.05.2026;Hinweis;Information Nutzungsbedingungen geaendert AGB Hinweis;0,00;EUR;DE12500400000123456700;",
  ].join("\r\n") +
  "\r\n";

const MICHENDORF_CSV =
  BOM +
  [
    CSV_HEADER,
    "29.05.2026;29.05.2026;Gutschrift;McDonalds Deutschland LLC Tagesumsatz-Sammelgutschrift Store 0532;7.654,00;EUR;DE12500400000999888700;Umsatz",
    "27.05.2026;27.05.2026;Lastschrift;HAVI Logistics GmbH Warenlieferung KW21 Michendorf;-8.120,40;EUR;DE12500400000999888700;",
    "05.05.2026;05.05.2026;Dauerauftrag;Miete Pacht Objekt Michendorf Mai;-3.500,00;EUR;DE12500400000999888700;",
    "02.05.2026;02.05.2026;Hinweis;AGB Hinweis Info Nutzungsbedingungen;0,00;EUR;DE12500400000999888700;",
    "01.05.2026;01.05.2026;Entgelt;Sonderposten unklar Michendorf nicht zuordenbar;-44,00;EUR;DE12500400000999888700;",
  ].join("\r\n") +
  "\r\n";

export async function generateAll(root: string): Promise<void> {
  await mkdir(underRoot(root, "fixtures", "vektonce"), { recursive: true });
  await mkdir(underRoot(root, "fixtures", "liquiditaet"), { recursive: true });
  await mkdir(underRoot(root, "fixtures", "commerzbank"), { recursive: true });
  await mkdir(underRoot(root, "fixtures", "mapping"), { recursive: true });

  await buildVektonceWorkbook("Linde Mai 2026").xlsx.writeFile(
    join(underRoot(root, "fixtures", "vektonce"), "vektonce-linde.fixture.xlsx"),
  );
  await buildVektonceWorkbook("Michendorf Mai 2026").xlsx.writeFile(
    join(underRoot(root, "fixtures", "vektonce"), "vektonce-michendorf.fixture.xlsx"),
  );
  await buildLiquiditaetWorkbook().xlsx.writeFile(
    join(underRoot(root, "fixtures", "liquiditaet"), "liquiditaet.fixture.xlsx"),
  );

  await writeFile(join(underRoot(root, "fixtures", "commerzbank"), "linde-2026-05.csv"), LINDE_CSV);
  await writeFile(join(underRoot(root, "fixtures", "commerzbank"), "michendorf-2026-05.csv"), MICHENDORF_CSV);

  // a copy of the DBA mapping as a fixture reference
  const mapping = await Bun.file(underRoot(root, "config", "dba-mapping", "mapping.v1.json")).text();
  await writeFile(join(underRoot(root, "fixtures", "mapping"), "dba-mapping.fixture.json"), mapping);
}

if (import.meta.main) {
  const root = resolveRoot(process.argv[2] ?? undefined);
  await generateAll(root);
  console.log(`fixtures generated under ${root}/fixtures`);
}
