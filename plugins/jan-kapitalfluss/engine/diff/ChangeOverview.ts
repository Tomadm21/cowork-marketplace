import type { CategorizedTxn, ChangeSet, PlannedWrite } from "../types";
import { canonicalJson, sha256Hex } from "../util/hash";

export function buildChangeSet(
  runId: string,
  generatedAtUtc: string,
  writes: PlannedWrite[],
  reviewItems: CategorizedTxn[],
): ChangeSet {
  const canonicalWrites = [...writes].sort(compareWrites);
  const changesetHash = sha256Hex(canonicalJson(canonicalWrites));
  const changedCount = writes.filter((write) => write.kind === "set").length;
  const newRowCount = writes.filter((write) => write.kind === "append" && write.isNew).length;
  return {
    runId,
    changesetHash,
    generatedAtUtc,
    writes,
    reviewItems,
    summary: {
      txnCount: writes.length + reviewItems.length,
      changedCount,
      newRowCount,
      reviewCount: reviewItems.length,
    },
  };
}

function compareWrites(left: PlannedWrite, right: PlannedWrite): number {
  return (
    left.store.localeCompare(right.store) ||
    left.workbook.localeCompare(right.workbook) ||
    left.sheet.localeCompare(right.sheet) ||
    left.cell.localeCompare(right.cell)
  );
}
