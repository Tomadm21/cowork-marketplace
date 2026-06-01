import type { NormalizedTxn, RawArtifact, TransactionSource } from "../types";

export class FinTsSource implements TransactionSource {
  readonly id = "fints";

  async fetch(): Promise<RawArtifact> {
    throw new Error("not implemented — FinTS Adapter v3");
  }

  parse(_raw: RawArtifact): NormalizedTxn[] {
    throw new Error("not implemented — FinTS Adapter v3");
  }
}
