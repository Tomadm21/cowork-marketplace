import type { ApprovalDecision, ChangeSet, PlannedWrite } from "./types";

export class ApprovalGate {
  static async commit<T>(
    changeSet: ChangeSet,
    decision: ApprovalDecision | null | undefined,
    applyFn: (writes: PlannedWrite[]) => Promise<T> | T,
  ): Promise<T> {
    if (!decision) {
      throw new Error("ApprovalDecision is required before writing");
    }
    if (decision.decision !== "approved") {
      throw new Error(`ApprovalDecision is ${decision.decision}, not approved`);
    }
    if (decision.runId !== changeSet.runId) {
      throw new Error("ApprovalDecision runId does not match ChangeSet");
    }
    if (decision.changesetHash !== changeSet.changesetHash) {
      throw new Error("ApprovalDecision changesetHash does not match ChangeSet");
    }
    const excluded = new Set(decision.excludedRowKeys);
    const filteredWrites = changeSet.writes.filter((write) => !excluded.has(write.rowKey));
    return applyFn(filteredWrites);
  }
}
