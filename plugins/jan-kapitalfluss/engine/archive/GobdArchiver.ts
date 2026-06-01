import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, extname } from "node:path";
import type { ApprovalDecision, ArchiveRecord, ChangeSet, DbaMapping, RawArtifact } from "../types";
import { canonicalJson, sha256Hex } from "../util/hash";
import { underRoot } from "../util/paths";

export interface ArchiveRunInput {
  root: string;
  changeSet: ChangeSet;
  rawArtifact: RawArtifact;
  mapping: DbaMapping;
  decision: ApprovalDecision | null;
  snapshotBeforeHash: string;
  snapshotAfterHash: string | null;
  timestampUtc: string;
  timestampBerlin: string;
}

export class GobdArchiver {
  static async archiveRun(input: ArchiveRunInput): Promise<ArchiveRecord> {
    const archiveDir = underRoot(input.root, "archive");
    const rawDir = underRoot(input.root, "archive", "raw");
    const recordsPath = underRoot(input.root, "archive", "records.jsonl");
    await mkdir(rawDir, { recursive: true });

    const existing = await readRecords(recordsPath);
    if (existing.some((record) => record.runId === input.changeSet.runId)) {
      throw new Error(`Archive already contains runId ${input.changeSet.runId}`);
    }

    // Exclusive create ("wx") makes the raw artifact the per-runId lock: a second write for the
    // same runId fails with EEXIST instead of silently overwriting the archived original.
    const rawPath = underRoot(input.root, "archive", "raw", `${input.changeSet.runId}${sourceExt(input.rawArtifact.filename)}`);
    try {
      await writeFile(rawPath, input.rawArtifact.bytes, { flag: "wx" });
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "EEXIST") {
        throw new Error(`Archive raw artifact for runId ${input.changeSet.runId} already exists — refusing to overwrite`);
      }
      throw error;
    }

    const prevHash = existing.at(-1)?.recordHash ?? null;
    const withoutHash = {
      runId: input.changeSet.runId,
      prevHash,
      source: { filename: basename(input.rawArtifact.filename), sha256: input.rawArtifact.sha256 },
      rulesetVersion: input.mapping.version,
      rulesetGitHash: input.mapping.gitHash,
      timestampsUtc: input.timestampUtc,
      timestampsBerlin: input.timestampBerlin,
      diff: input.changeSet.writes,
      approver: input.decision?.approver ?? null,
      decision: input.decision?.decision ?? "pending",
      snapshotBeforeHash: input.snapshotBeforeHash,
      snapshotAfterHash: input.snapshotAfterHash,
      noAutoBooking: true,
      noAutoSend: true,
    } satisfies Omit<ArchiveRecord, "recordHash">;
    const record: ArchiveRecord = {
      ...withoutHash,
      recordHash: sha256Hex(canonicalJson(withoutHash)),
    };
    assertNoSecretMaterial(record);
    await appendFile(recordsPath, `${JSON.stringify(record)}\n`, "utf8");
    return record;
  }
}

async function readRecords(recordsPath: string): Promise<ArchiveRecord[]> {
  try {
    const text = await readFile(recordsPath, "utf8");
    return text
      .split(/\r?\n/)
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line) as ArchiveRecord);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

function sourceExt(filename: string): string {
  const ext = extname(filename);
  return ext.length > 0 ? ext : ".bin";
}

const SECRET_KEY =
  /^(password|passwort|secret|api[_-]?key|client[_-]?secret|access[_-]?token|refresh[_-]?token|credential|private[_-]?key|pin|tan)$/i;
const SECRET_ASSIGNMENT =
  /\b(password|passwort|api[_-]?key|client[_-]?secret|access[_-]?token|secret[_-]?key|private[_-]?key)\s*[:=]\s*\S/i;

/**
 * Guard against leaking credentials into the archive. Scans for credential-shaped KEYS anywhere
 * in the record and for obvious inline credential ASSIGNMENTS — but never substring-matches bare
 * words in free-text values (real memos legitimately contain "tan"/"pin": Konstanz, Pinneberg, ...).
 */
function assertNoSecretMaterial(record: ArchiveRecord): void {
  const stack: unknown[] = [record];
  while (stack.length > 0) {
    const node = stack.pop();
    if (node && typeof node === "object") {
      for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
        if (SECRET_KEY.test(key)) {
          throw new Error(`Archive record contains a secret-like field "${key}"`);
        }
        stack.push(value);
      }
    }
  }
  if (SECRET_ASSIGNMENT.test(JSON.stringify(record))) {
    throw new Error("Archive record contains inline credential material");
  }
}
