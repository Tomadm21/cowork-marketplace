import { test, expect, describe } from "bun:test";
import { buildChangeSet } from "../engine/diff/ChangeOverview";
import type { CategorizedTxn, PlannedWrite } from "../engine/types";

function write(p: Partial<PlannedWrite>): PlannedWrite {
  return {
    workbook: "vektonce",
    sheet: "Einnahmen",
    cell: "B5",
    kind: "append",
    oldValue: null,
    newValue: 1,
    bucket: "Einnahmen",
    sourceMemo: "memo",
    ruleId: "r",
    rowKey: "k",
    isNew: true,
    ...p,
  };
}

describe("buildChangeSet", () => {
  test("summary counts appended vs changed vs review", () => {
    const writes = [
      write({ kind: "append", isNew: true, rowKey: "a" }),
      write({ workbook: "liquiditaet", sheet: "Liquiditaet", cell: "C5", kind: "set", isNew: false, rowKey: "b" }),
    ];
    const review = [{ rowKey: "r1", needsReview: true } as CategorizedTxn];
    const cs = buildChangeSet("run1", "2026-06-01T00:00:00Z", writes, review);
    expect(cs.summary.newRowCount).toBe(1);
    expect(cs.summary.changedCount).toBe(1);
    expect(cs.summary.reviewCount).toBe(1);
  });

  test("changesetHash is deterministic and order-independent", () => {
    const a = write({ rowKey: "a", cell: "B5" });
    const b = write({ rowKey: "b", cell: "B6" });
    const cs1 = buildChangeSet("run1", "t", [a, b], []);
    const cs2 = buildChangeSet("run1", "t", [b, a], []);
    expect(cs1.changesetHash).toBe(cs2.changesetHash);
  });

  test("changesetHash changes when a written value changes", () => {
    const cs1 = buildChangeSet("run1", "t", [write({ newValue: 1 })], []);
    const cs2 = buildChangeSet("run1", "t", [write({ newValue: 2 })], []);
    expect(cs1.changesetHash).not.toBe(cs2.changesetHash);
  });
});
