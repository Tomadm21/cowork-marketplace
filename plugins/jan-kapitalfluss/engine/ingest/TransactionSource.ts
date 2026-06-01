import type { CsvProfile, TransactionSource } from "../types";
import { CommerzbankCsvSource } from "./CommerzbankCsvSource";

export type { TransactionSource };

export function makeSource(profile: CsvProfile, csvPath: string): TransactionSource {
  return new CommerzbankCsvSource(profile, csvPath);
}
