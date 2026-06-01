declare module "xlsx-populate" {
  export type CellValue = number | string | boolean | Date | null | undefined;

  export interface Cell {
    address(options?: { includeSheetName?: boolean }): string;
    formula(): string | undefined;
    formula(value: string): Cell;
    merged(): boolean;
    style(name: string): unknown;
    value(): CellValue;
    value(value: CellValue): Cell;
  }

  export interface Range {
    forEach(callback: (cell: Cell, rowIndex: number, columnIndex: number, range: Range) => void): Range;
    merged(): boolean;
  }

  export interface Sheet {
    cell(address: string): Cell;
    name(): string;
    range(address: string): Range;
    usedRange(): Range | undefined;
  }

  export interface Workbook {
    addSheet(name: string): Sheet;
    definedName(name: string): unknown;
    definedName(name: string, ref: string): Workbook;
    outputAsync(options?: { type?: "nodebuffer" | "arraybuffer" | "base64" | "binarystring" }): Promise<Buffer>;
    sheet(name: string): Sheet | undefined;
    sheets(): Sheet[];
    toFileAsync(path: string): Promise<void>;
  }

  export interface XlsxPopulateStatic {
    fromBlankAsync(): Promise<Workbook>;
    fromFileAsync(path: string): Promise<Workbook>;
  }

  // xlsx-populate ships without declarations; this shim covers the local usage surface only.
  const XlsxPopulate: XlsxPopulateStatic;
  export default XlsxPopulate;
}
