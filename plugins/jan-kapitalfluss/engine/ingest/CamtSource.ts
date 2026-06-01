import type { NormalizedTxn, RawArtifact, TransactionSource } from "../types";

export class CamtSource implements TransactionSource {
  readonly id = "camt";

  async fetch(): Promise<RawArtifact> {
    throw new Error("not implemented — CAMT Adapter v2");
  }

  parse(_raw: RawArtifact): NormalizedTxn[] {
    throw new Error("not implemented — CAMT Adapter v2");
  }
}
