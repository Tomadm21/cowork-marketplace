import type { CategorizedTxn, ExcelMap, PlannedWrite } from "../types";
import { WorkbookWriter } from "./WorkbookWriter";

export function planVektonceWrites(
  categorized: CategorizedTxn[],
  map: ExcelMap,
): PlannedWrite[] {
  const bucketTargets = map.bucketTargets ?? {};
  const nextRows: Record<string, number> = {};
  const writes: PlannedWrite[] = [];
  for (const txn of categorized) {
    const target = bucketTargets[txn.bucket];
    if (!target || target.mode === "review") {
      continue;
    }
    if (target.mode !== "append") {
      continue;
    }
    const sheetName = requireSheet(target.sheet, txn.bucket);
    const table = map.sheets[sheetName]?.appendTable;
    if (!table) {
      throw new Error(`Vektonce map lacks appendTable for sheet ${sheetName}`);
    }
    const row = nextRows[sheetName] ?? table.startRow;
    nextRows[sheetName] = row + 1;
    writes.push({
      workbook: "vektonce",
      sheet: sheetName,
      cell: `${table.anchorCol}${row}`,
      kind: "append",
      oldValue: null,
      newValue: txn.amountCents / 100,
      bucket: txn.bucket,
      sourceMemo: `${txn.bookingDate} ${txn.purpose}`,
      ruleId: txn.ruleId,
      rowKey: txn.rowKey,
      isNew: true,
    });
  }
  return writes;
}

export function applyVektonceWrites(writer: WorkbookWriter, writes: PlannedWrite[], map: ExcelMap): void {
  for (const write of writes) {
    if (write.workbook !== "vektonce") {
      continue;
    }
    if (write.kind !== "append") {
      continue;
    }
    const table = map.sheets[write.sheet]?.appendTable;
    if (!table) {
      throw new Error(`Vektonce map lacks appendTable for sheet ${write.sheet}`);
    }
    const date = write.sourceMemo.slice(0, 10);
    const memo = write.sourceMemo.slice(11);
    const anchorCell = writer.appendRow(write.sheet, table.anchorCol, table.startRow, table.columns, [
      date,
      memo,
      write.newValue,
      write.bucket,
    ]);
    write.cell = anchorCell;
    write.oldValue = null;
  }
}

function requireSheet(sheet: string | undefined, bucket: string): string {
  if (sheet) {
    return sheet;
  }
  throw new Error(`Bucket ${bucket} is configured for append without a sheet`);
}
