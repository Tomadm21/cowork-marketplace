import { readFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import XlsxPopulate, { type CellValue, type Workbook } from "xlsx-populate";
import { sha256Hex } from "../util/hash";

export class WorkbookWriter {
  private workbook: Workbook | null = null;

  static async loadSnapshot(path: string): Promise<{ bytes: Uint8Array; sha256: string }> {
    try {
      const bytes = await readFile(path);
      return { bytes: new Uint8Array(bytes), sha256: sha256Hex(bytes) };
    } catch (error) {
      throw new Error(`Failed to load workbook snapshot ${path}: ${errorMessage(error)}`);
    }
  }

  async open(path: string): Promise<void> {
    try {
      this.workbook = await XlsxPopulate.fromFileAsync(path);
    } catch (error) {
      throw new Error(`Failed to open workbook ${path}: ${errorMessage(error)}`);
    }
  }

  readCell(sheetName: string, a1: string): number | string | null {
    const cell = this.sheet(sheetName).cell(a1);
    const formula = cell.formula();
    if (formula !== undefined) {
      return formula;
    }
    const value = cell.value();
    if (typeof value === "number" || typeof value === "string") {
      return value;
    }
    return null;
  }

  setCell(sheetName: string, a1: string, value: number): void {
    if (!Number.isFinite(value)) {
      throw new Error(`Refusing to write non-finite number to ${sheetName}!${a1}`);
    }
    this.sheet(sheetName).cell(a1).value(value);
  }

  appendRow(sheetName: string, anchorCol: string, startRow: number, columns: string[], values: CellValue[]): string {
    if (columns.length !== values.length) {
      throw new Error(`Append row for ${sheetName} has ${values.length} values but ${columns.length} columns`);
    }
    const sheet = this.sheet(sheetName);
    let row = startRow;
    while (!isBlank(sheet.cell(`${anchorCol}${row}`).value())) {
      row += 1;
      if (row > startRow + 10000) {
        throw new Error(`Could not find an empty append row in ${sheetName} from ${anchorCol}${startRow}`);
      }
    }
    for (let index = 0; index < columns.length; index += 1) {
      const value = values[index];
      if (typeof value === "number" && !Number.isFinite(value)) {
        throw new Error(`Refusing to append non-finite number to ${sheetName}!${columns[index]}${row}`);
      }
      sheet.cell(`${columns[index]}${row}`).value(value);
    }
    return `${anchorCol}${row}`;
  }

  async save(outPath: string): Promise<void> {
    if (!this.workbook) {
      throw new Error("Cannot save workbook before open()");
    }
    try {
      await mkdir(dirname(outPath), { recursive: true });
      await this.workbook.toFileAsync(outPath);
    } catch (error) {
      throw new Error(`Failed to save workbook ${outPath}: ${errorMessage(error)}`);
    }
  }

  private sheet(sheetName: string) {
    if (!this.workbook) {
      throw new Error("Workbook is not open");
    }
    const sheet = this.workbook.sheet(sheetName);
    if (!sheet) {
      throw new Error(`Workbook does not contain sheet "${sheetName}"`);
    }
    return sheet;
  }
}

function isBlank(value: CellValue): boolean {
  return value === undefined || value === null || value === "";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
