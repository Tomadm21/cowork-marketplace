import type { CategorizedTxn, DbaMapping, NormalizedTxn } from "../types";
import { sha256Hex } from "../util/hash";
import { evaluateRules } from "./rules";

export function rowKey(txn: NormalizedTxn): string {
  return sha256Hex(`${txn.sourceLine}|${txn.bookingDate}|${txn.amountCents}|${txn.purpose}`).slice(0, 16);
}

export function categorize(mapping: DbaMapping, txns: NormalizedTxn[]): CategorizedTxn[] {
  return txns.map((txn) => {
    const result = evaluateRules(mapping, txn);
    return {
      ...txn,
      bucket: result.bucket,
      ruleId: result.ruleId,
      needsReview: result.ruleId === null,
      rowKey: rowKey(txn),
    };
  });
}
