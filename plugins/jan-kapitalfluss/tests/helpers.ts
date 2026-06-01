import { resolve, join } from "node:path";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { generateAll } from "../scripts/make-fixtures";

/** tests/ -> plugin root */
export function repoRoot(): string {
  return resolve(import.meta.dir, "..");
}

let fixturesReady = false;
export async function ensureFixtures(): Promise<void> {
  if (fixturesReady) return;
  await generateAll(repoRoot());
  fixturesReady = true;
}

/** Isolated temp dir for out/ + archive/, so tests never pollute the repo or each other. */
export async function freshWorkRoot(): Promise<string> {
  return mkdtemp(join(tmpdir(), "kapitalfluss-"));
}

export function nowFixed(): { utc: string; berlin: string } {
  return { utc: "2026-06-01T10:00:00.000Z", berlin: "2026-06-01T12:00:00.000+02:00" };
}
