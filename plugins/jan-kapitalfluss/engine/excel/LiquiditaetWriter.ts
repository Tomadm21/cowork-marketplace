import type { CategorizedTxn, ExcelMap, PlannedWrite } from "../types";
import { WorkbookWriter } from "./WorkbookWriter";

export function planLiquiditaetWrites(
  categorized: CategorizedTxn[],
  map: ExcelMap,
): PlannedWrite[] {
  const totals = new Map<string, number>();
  for (const txn of categorized) {
    if (txn.needsReview) {
      continue;
    }
    totals.set(txn.bucket, (totals.get(txn.bucket) ?? 0) + txn.amountCents);
  }
  const writes: PlannedWrite[] = [];
  for (const [bucket, target] of Object.entries(map.bucketTargets ?? {})) {
    if (target.mode !== "set") {
      continue;
    }
    if (!target.sheet || !target.cell) {
      throw new Error(`Bucket ${bucket} is configured for set without sheet/cell`);
    }
    writes.push({
      workbook: "liquiditaet",
      sheet: target.sheet,
      cell: target.cell,
      kind: "set",
      oldValue: null,
      newValue: (totals.get(bucket) ?? 0) / 100,
      bucket,
      sourceMemo: `Summe ${bucket}`,
      ruleId: null,
      rowKey: `liquiditaet:${bucket}`,
      isNew: false,
    });
  }
  return writes.sort((left, right) => left.cell.localeCompare(right.cell));
}

export function applyLiquiditaetWrites(writer: WorkbookWriter, writes: PlannedWrite[]): void {
  for (const write of writes) {
    if (write.workbook !== "liquiditaet") {
      continue;
    }
    if (write.kind !== "set") {
      continue;
    }
    write.oldValue = writer.readCell(write.sheet, write.cell);
    writer.setCell(write.sheet, write.cell, write.newValue);
  }
}
