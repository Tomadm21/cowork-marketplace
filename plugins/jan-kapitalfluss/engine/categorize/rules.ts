import type { CategorizedTxn, DbaMapping, DbaRule } from "../types";
import { underRoot } from "../util/paths";
import { asRecord, readJsonFile, requireArray, requireNullableString, requireString } from "../util/json";

export async function loadDbaMapping(root: string, stem: string): Promise<DbaMapping> {
  const path = underRoot(root, "config", "dba-mapping", `${stem}.json`);
  const parsed = asRecord(await readJsonFile(path), `DBA mapping ${stem}`);
  const version = requireString(parsed, "version", `DBA mapping ${stem}`);
  const gitHash = requireNullableString(parsed, "gitHash", `DBA mapping ${stem}`);
  const reviewBucket = requireString(parsed, "reviewBucket", `DBA mapping ${stem}`);
  const rawRules = requireArray(parsed.rules, `DBA mapping ${stem}.rules`);
  const rules = rawRules.map((value, index) => validateRule(value, `DBA mapping ${stem}.rules[${index}]`));
  return { version, gitHash, reviewBucket, rules };
}

export function evaluateRules(
  mapping: DbaMapping,
  txn: Pick<CategorizedTxn, "counterparty" | "purpose" | "type" | "amountCents">,
): { bucket: string; ruleId: string | null } {
  const ordered = mapping.rules
    .map((rule, index) => ({ rule, index }))
    .sort((left, right) => {
      const priorityDiff = (left.rule.priority ?? Number.POSITIVE_INFINITY) - (right.rule.priority ?? Number.POSITIVE_INFINITY);
      if (priorityDiff !== 0) {
        return priorityDiff;
      }
      return left.index - right.index;
    });
  for (const { rule } of ordered) {
    if (matchesRule(rule, txn)) {
      return { bucket: rule.bucket, ruleId: rule.id };
    }
  }
  return { bucket: mapping.reviewBucket, ruleId: null };
}

function validateRule(value: unknown, context: string): DbaRule {
  const record = asRecord(value, context);
  const id = requireString(record, "id", context);
  const bucket = requireString(record, "bucket", context);
  const amountSign = validateAmountSign(record.amountSign, context);
  const priority = validatePriority(record.priority, context);
  const matchAny = validateMatchers(record.matchAny, context);
  return { id, bucket, amountSign, priority, matchAny };
}

function validateMatchers(value: unknown, context: string): DbaRule["matchAny"] {
  if (value === undefined) {
    return undefined;
  }
  return requireArray(value, `${context}.matchAny`).map((matcher, index) => {
    const record = asRecord(matcher, `${context}.matchAny[${index}]`);
    const field = record.field;
    if (field !== "counterparty" && field !== "purpose" && field !== "type") {
      throw new Error(`${context}.matchAny[${index}].field has unsupported value`);
    }
    const regex = requireString(record, "regex", `${context}.matchAny[${index}]`);
    try {
      new RegExp(regex, "i");
    } catch (error) {
      throw new Error(`${context}.matchAny[${index}].regex is invalid: ${error instanceof Error ? error.message : String(error)}`);
    }
    return { field, regex };
  });
}

function validateAmountSign(value: unknown, context: string): DbaRule["amountSign"] {
  if (value === undefined) {
    return undefined;
  }
  if (value === "debit" || value === "credit") {
    return value;
  }
  throw new Error(`${context}.amountSign must be debit or credit`);
}

function validatePriority(value: unknown, context: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  throw new Error(`${context}.priority must be a finite number`);
}

function matchesRule(
  rule: DbaRule,
  txn: Pick<CategorizedTxn, "counterparty" | "purpose" | "type" | "amountCents">,
): boolean {
  if (rule.amountSign === "debit" && txn.amountCents >= 0) {
    return false;
  }
  if (rule.amountSign === "credit" && txn.amountCents <= 0) {
    return false;
  }
  if (!rule.matchAny || rule.matchAny.length === 0) {
    return true;
  }
  return rule.matchAny.some((matcher) => new RegExp(matcher.regex, "i").test(txn[matcher.field]));
}
