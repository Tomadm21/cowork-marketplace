import { test, expect, describe } from "bun:test";
import { ApprovalGate } from "../engine/approval";
import type { ApprovalDecision, ChangeSet, PlannedWrite } from "../engine/types";

function write(rowKey: string): PlannedWrite {
  return {
    store: "linde",
    workbook: "vektonce",
    sheet: "Einnahmen",
    cell: "B5",
    kind: "append",
    oldValue: null,
    newValue: 1,
    bucket: "Umsatzerloese",
    sourceMemo: "m",
    ruleId: null,
    rowKey,
    isNew: true,
  };
}

function changeSet(): ChangeSet {
  return {
    runId: "r",
    changesetHash: "h",
    generatedAtUtc: "",
    writes: [write("k1"), write("k2")],
    reviewItems: [],
    summary: { txnCount: 2, changedCount: 0, newRowCount: 2, reviewCount: 0 },
  };
}

function decision(over: Partial<ApprovalDecision>): ApprovalDecision {
  return { runId: "r", changesetHash: "h", approver: "Jan", decision: "approved", approvedAtUtc: "", excludedRowKeys: [], ...over };
}

describe("ApprovalGate — the hard constraint", () => {
  test("blocked without any decision", async () => {
    await expect(ApprovalGate.commit(changeSet(), null, async () => "wrote")).rejects.toThrow();
  });

  test("blocked when the decision is rejected", async () => {
    await expect(ApprovalGate.commit(changeSet(), decision({ decision: "rejected" }), async () => "wrote")).rejects.toThrow();
  });

  test("blocked on changeset-hash mismatch (stale/tampered)", async () => {
    await expect(ApprovalGate.commit(changeSet(), decision({ changesetHash: "tampered" }), async () => "wrote")).rejects.toThrow();
  });

  test("blocked on runId mismatch", async () => {
    await expect(ApprovalGate.commit(changeSet(), decision({ runId: "other" }), async () => "wrote")).rejects.toThrow();
  });

  test("commits on a matching approved decision and passes the writes through", async () => {
    let applied: PlannedWrite[] = [];
    const result = await ApprovalGate.commit(changeSet(), decision({}), async (writes) => {
      applied = writes;
      return "ok";
    });
    expect(result).toBe("ok");
    expect(applied.map((w) => w.rowKey)).toEqual(["k1", "k2"]);
  });

  test("honors per-row exclusions (ignorieren)", async () => {
    let applied: PlannedWrite[] = [];
    await ApprovalGate.commit(changeSet(), decision({ excludedRowKeys: ["k2"] }), async (writes) => {
      applied = writes;
    });
    expect(applied.map((w) => w.rowKey)).toEqual(["k1"]);
  });
});
