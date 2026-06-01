import XlsxPopulate from "xlsx-populate";

export interface StructureFingerprint {
  sheetNames: string[];
  formulaCells: string[];
}

function numFmtOf(cell: { style(name: string): unknown }): string {
  try {
    const v = cell.style("numberFormat");
    return typeof v === "string" ? v : "";
  } catch {
    return "";
  }
}

/**
 * Fingerprint = sheet names + every FORMULA cell captured as `Sheet!Addr|<formulaText>|<numFmt>`.
 * Scoped to formula cells (a stable set our value-only writes never create or remove), so it has no
 * false positives on appended value cells, yet now catches a changed formula TEXT or numFmt — the
 * structural mutations that would silently break Jan's Kapitalflusstabelle.
 */
export async function structureFingerprint(path: string): Promise<StructureFingerprint> {
  try {
    const workbook = await XlsxPopulate.fromFileAsync(path);
    const sheetNames = workbook.sheets().map((sheet) => sheet.name()).sort();
    const formulaCells: string[] = [];
    for (const sheet of workbook.sheets()) {
      const range = sheet.usedRange();
      if (!range) {
        continue;
      }
      range.forEach((cell) => {
        const formula = cell.formula();
        if (formula !== undefined) {
          formulaCells.push(`${sheet.name()}!${cell.address()}|${formula}|${numFmtOf(cell)}`);
        }
      });
    }
    return { sheetNames, formulaCells: formulaCells.sort() };
  } catch (error) {
    throw new Error(`Failed to fingerprint workbook ${path}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function assertUnchanged(before: StructureFingerprint, after: StructureFingerprint): void {
  assertSameSet("sheetNames", before.sheetNames, after.sheetNames);
  assertSameSet("formulaCells", before.formulaCells, after.formulaCells);
}

function assertSameSet(name: string, before: string[], after: string[]): void {
  const left = [...before].sort();
  const right = [...after].sort();
  if (left.length !== right.length || left.some((value, index) => value !== right[index])) {
    throw new Error(`${name} changed: before=${JSON.stringify(left)} after=${JSON.stringify(right)}`);
  }
}
