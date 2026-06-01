import { test, expect, describe, beforeAll } from "bun:test";
import ExcelJS from "exceljs";
import { join } from "node:path";
import { WorkbookWriter } from "../engine/excel/WorkbookWriter";
import { structureFingerprint, assertUnchanged } from "../engine/excel/safeguards";
import { ensureFixtures, repoRoot, freshWorkRoot } from "./helpers";

const SALDO_FORMULA = "SUM(Einnahmen!D5:D999)-SUM(Ausgaben!D5:D999)";

describe("xlsx-populate no-alter round-trip (the trust-critical guarantee)", () => {
  beforeAll(async () => {
    await ensureFixtures();
  });

  test("formula, numFmt, merge, named range preserved; only targeted cells change; values numeric", async () => {
    const fixture = join(repoRoot(), "fixtures", "vektonce", "vektonce-linde.fixture.xlsx");
    const out = join(await freshWorkRoot(), "vektonce.xlsx");

    const before = await structureFingerprint(fixture);

    const writer = new WorkbookWriter();
    await writer.open(fixture);
    const cell = writer.appendRow("Einnahmen", "B", 5, ["B", "C", "D", "E"], [
      "2026-05-30",
      "McDonalds Sammelgutschrift",
      8945.12,
      "Umsatzerloese",
    ]);
    expect(cell).toBe("B5");
    writer.appendRow("Ausgaben", "B", 5, ["B", "C", "D", "E"], ["2026-05-28", "HAVI", -12480.55, "Wareneinkauf"]);
    await writer.save(out);

    // structure (sheet names + formula cells) must be unchanged — throws otherwise
    const after = await structureFingerprint(out);
    assertUnchanged(before, after);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(out);
    const saldo = wb.getWorksheet("Saldo")!;
    expect((saldo.getCell("C3").value as { formula?: string }).formula).toBe(SALDO_FORMULA);
    expect(saldo.getCell("C3").numFmt).toBe("#,##0.00 €");
    expect(saldo.model.merges).toContain("B1:D1");
    expect(wb.definedNames.getRanges("SaldoMonat").ranges).toContain("Saldo!$C$3");

    const einnahmen = wb.getWorksheet("Einnahmen")!;
    expect(typeof einnahmen.getCell("D5").value).toBe("number");
    expect(einnahmen.getCell("D5").value).toBe(8945.12);
    // an untouched header cell is intact
    expect(einnahmen.getCell("D4").value).toBe("Betrag");
  });

  test("setCell refuses a non-finite number", async () => {
    const fixture = join(repoRoot(), "fixtures", "vektonce", "vektonce-linde.fixture.xlsx");
    const writer = new WorkbookWriter();
    await writer.open(fixture);
    expect(() => writer.setCell("Einnahmen", "C5", Number.POSITIVE_INFINITY)).toThrow();
  });

  test("assertUnchanged throws when a formula cell disappears", () => {
    expect(() =>
      assertUnchanged(
        { sheetNames: ["A"], formulaCells: ["A!C3|SUM(B1:B2)|#,##0.00 €"] },
        { sheetNames: ["A"], formulaCells: [] },
      ),
    ).toThrow();
  });

  test("assertUnchanged throws when a formula's TEXT changes (not just its address)", () => {
    expect(() =>
      assertUnchanged(
        { sheetNames: ["A"], formulaCells: ["A!C3|SUM(B1:B2)|#,##0.00 €"] },
        { sheetNames: ["A"], formulaCells: ["A!C3|SUM(B1:B9)|#,##0.00 €"] },
      ),
    ).toThrow();
  });

  test("assertUnchanged throws when a formula cell's numFmt changes", () => {
    expect(() =>
      assertUnchanged(
        { sheetNames: ["A"], formulaCells: ["A!C3|SUM(B1:B2)|#,##0.00 €"] },
        { sheetNames: ["A"], formulaCells: ["A!C3|SUM(B1:B2)|General"] },
      ),
    ).toThrow();
  });
});
