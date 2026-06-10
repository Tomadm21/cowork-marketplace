import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { tierOf, titleOf, collisionSafe } from "./apply.ts";

// ── Pure unit tests ──────────────────────────────────────────────────────────

describe("tierOf", () => {
  test("folgenreich tier → f regardless of confidence", () => {
    expect(tierOf({ tier: "folgenreich", confidence: "prüfen" })).toBe("f");
    expect(tierOf({ tier: "folgenreich" })).toBe("f");
  });
  test("sicher tier + confidence prüfen → p", () => {
    expect(tierOf({ tier: "sicher", confidence: "prüfen" })).toBe("p");
  });
  test("prüfen tier (no confidence override) → p", () => {
    expect(tierOf({ tier: "prüfen" })).toBe("p");
  });
  test("sicher tier no confidence → s", () => {
    expect(tierOf({ tier: "sicher" })).toBe("s");
  });
  test("unknown tier, no confidence → s", () => {
    expect(tierOf({})).toBe("s");
  });
});

describe("titleOf", () => {
  test("lieferant + RG nummer + betrag", () => {
    const a = { values: { lieferant: "Acme GmbH", nummer: "12345", belegtyp: "RG", betrag: "100,00 EUR" } };
    expect(titleOf(a)).toBe("Acme GmbH RG 12345 · 100,00 EUR");
  });
  test("lieferant + LF nummer + betrag", () => {
    const a = { values: { lieferant: "Acme GmbH", nummer: "999", belegtyp: "LF", betrag: "200,00 EUR" } };
    expect(titleOf(a)).toBe("Acme GmbH LF 999 · 200,00 EUR");
  });
  test("lieferant + LF nummer + no betrag → · Lieferschein", () => {
    const a = { values: { lieferant: "Acme GmbH", nummer: "999", belegtyp: "LF" } };
    expect(titleOf(a)).toBe("Acme GmbH LF 999 · Lieferschein");
  });
  test("lieferant only, no nummer, no betrag", () => {
    const a = { values: { lieferant: "Acme GmbH" } };
    expect(titleOf(a)).toBe("Acme GmbH");
  });
  test("lieferant only, no nummer, no betrag, no belegtyp", () => {
    const a = { values: { lieferant: "Acme GmbH" } };
    expect(titleOf(a)).toBe("Acme GmbH");
  });
  test("no lieferant, no values → falls back to filename", () => {
    const a = { filename: "receipt.pdf", values: {} };
    expect(titleOf(a)).toBe("receipt.pdf");
  });
  test("no lieferant, no filename → Posten", () => {
    const a = {};
    expect(titleOf(a)).toBe("Posten");
  });
  test("RG belegtyp with no betrag → no Lieferschein fallback", () => {
    const a = { values: { lieferant: "X", nummer: "1", belegtyp: "RG" } };
    expect(titleOf(a)).toBe("X RG 1");
  });
});

// ── Integration tests with tmp workspace ─────────────────────────────────────

let ws: string;
const RUNID_A = "R-2026-06-10-belege-a";
const RUNID_B = "R-2026-06-10-belege-b";

function reviewDir(): string { return path.join(ws, "_firma", "_review"); }
function erledigt(): string { return path.join(reviewDir(), "_erledigt"); }
function journalPath(date: Date = new Date()): string {
  const ym = date.toISOString().slice(0, 7);
  return path.join(ws, "_firma", "_journal", `${ym}.jsonl`);
}

function writeQueue(runid: string, actions: object[], proc = "receipt-filing") {
  const fp = path.join(reviewDir(), `${runid}.json`);
  fs.mkdirSync(path.dirname(fp), { recursive: true });
  fs.writeFileSync(fp, JSON.stringify({ runid, process: proc, created: new Date().toISOString(), actions }, null, 2), "utf8");
  return fp;
}

function seedSourceFile(relPath: string, content = "dummy content"): string {
  const abs = path.join(ws, relPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, "utf8");
  return abs;
}

async function runApply(...args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const scriptPath = path.join(import.meta.dir, "apply.ts");
  const proc = Bun.spawn(["bun", scriptPath, ...args], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { stdout, stderr, exitCode };
}

// collisionSafe uses real fs against tmp dirs
describe("collisionSafe", () => {
  let tmpDir: string;
  beforeEach(() => { tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "apply-test-")); });
  afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  test("free path → returned unchanged", () => {
    const p = path.join(tmpDir, "file.pdf");
    expect(collisionSafe(p)).toBe(p);
  });
  test("occupied path → _2 variant", () => {
    const p = path.join(tmpDir, "file.pdf");
    fs.writeFileSync(p, "x");
    expect(collisionSafe(p)).toBe(path.join(tmpDir, "file_2.pdf"));
  });
  test("occupied + _2 occupied → _3 variant", () => {
    const p = path.join(tmpDir, "file.pdf");
    fs.writeFileSync(p, "x");
    fs.writeFileSync(path.join(tmpDir, "file_2.pdf"), "x");
    expect(collisionSafe(p)).toBe(path.join(tmpDir, "file_3.pdf"));
  });
  test("path with no extension", () => {
    const p = path.join(tmpDir, "noext");
    fs.writeFileSync(p, "x");
    expect(collisionSafe(p)).toBe(path.join(tmpDir, "noext_2"));
  });
});

// ── Integration: CLI commands ─────────────────────────────────────────────────

beforeEach(() => {
  ws = fs.mkdtempSync(path.join(os.tmpdir(), "ws-test-"));
});
afterEach(() => {
  fs.rmSync(ws, { recursive: true, force: true });
});

const SOURCE_REL = "_eingang/receipt-filing/invoice.pdf";
const TARGET_REL = "001 Galant/Buchhaltung";
const FILENAME = "Heinz Wilmers GmbH RG 2605176 von 11.05.2026 - 476,00 EUR.pdf";

function makeActions() {
  return [
    {
      id: 1,
      verb: "kopieren",
      tier: "sicher",
      confidence: "prüfen",   // tier_of → "p"
      reason: "Sicher but needs check",
      source: SOURCE_REL,
      filename: FILENAME,
      targets: [TARGET_REL],
      values: { lieferant: "Heinz Wilmers GmbH", nummer: "2605176", belegtyp: "RG", betrag: "476,00 EUR", entity: "GB", kategorie: "Kfz/Fahrzeug" },
    },
    {
      id: 2,
      verb: "kopieren",
      tier: "folgenreich",   // tier_of → "f"
      reason: "Consequential",
      source: SOURCE_REL,
      filename: FILENAME,
      targets: [TARGET_REL],
      values: {},
    },
  ];
}

test("list: correct total/ns/np/nf and item fields", async () => {
  writeQueue(RUNID_A, makeActions());
  const { stdout } = await runApply(ws, "list");
  const result = JSON.parse(stdout);
  expect(result.ok).toBe(true);
  expect(result.total).toBe(2);
  expect(result.ns).toBe(0);   // confidence prüfen overrides sicher → p
  expect(result.np).toBe(1);
  expect(result.nf).toBe(1);
  expect(result.groups.length).toBe(1);
  const g = result.groups[0];
  expect(g.group).toBe("Belege");
  expect(g.icon).toBe("receipt");
  expect(g.items.length).toBe(2);
  const item = g.items[0];
  expect(item.id).toBe(1);
  expect(item.runid).toBe(RUNID_A);
  expect(item.tier).toBe("p");
  expect(item.title).toBe("Heinz Wilmers GmbH RG 2605176 · 476,00 EUR");
  expect(item.vals).toBe("GB · Kfz/Fahrzeug");
  expect(item.why).toBe("Sicher but needs check");
  expect(item.target).toContain(FILENAME.split(".pdf")[0] + ".pdf");
});

test("list: empty queue dir → ok:true, total:0, Nichts offen", async () => {
  fs.mkdirSync(path.join(ws, "_firma", "_review"), { recursive: true });
  const { stdout } = await runApply(ws, "list");
  const result = JSON.parse(stdout);
  expect(result.ok).toBe(true);
  expect(result.total).toBe(0);
  expect(result.stand).toContain("Nichts offen");
});

test("approve: file copied collision-safe to every target, journal appended, action removed", async () => {
  writeQueue(RUNID_A, makeActions());
  seedSourceFile(SOURCE_REL);
  const { stdout } = await runApply(ws, "approve", RUNID_A, "1");
  const result = JSON.parse(stdout);
  expect(result.ok).toBe(true);
  expect(result.op).toBe("approve");
  expect(result.touched).toBe(1);
  expect(result.dry).toBe(false);
  expect(result.filed.length).toBe(1);
  // Verify file was actually copied
  const destDir = path.join(ws, TARGET_REL);
  const destFile = path.join(destDir, FILENAME);
  expect(fs.existsSync(destFile)).toBe(true);
  // Verify journal entry
  const jPath = journalPath();
  expect(fs.existsSync(jPath)).toBe(true);
  const lines = fs.readFileSync(jPath, "utf8").trim().split("\n");
  expect(lines.length).toBe(1);
  const entry = JSON.parse(lines[0]);
  expect(entry.verb).toBe("kopieren");
  expect(entry.reversible).toBe(true);
  expect(typeof entry.ts).toBe("string");
  expect(entry.source).toBe(SOURCE_REL);
  expect(entry.target).toContain(FILENAME);
  // Verify action removed from queue (but other action remains)
  const qPath = path.join(reviewDir(), `${RUNID_A}.json`);
  expect(fs.existsSync(qPath)).toBe(true);
  const q = JSON.parse(fs.readFileSync(qPath, "utf8"));
  expect(q.actions.length).toBe(1);
  expect(q.actions[0].id).toBe(2);
});

test("approve same id again → touched 0", async () => {
  writeQueue(RUNID_A, makeActions());
  seedSourceFile(SOURCE_REL);
  await runApply(ws, "approve", RUNID_A, "1");
  const { stdout } = await runApply(ws, "approve", RUNID_A, "1");
  const result = JSON.parse(stdout);
  expect(result.touched).toBe(0);
});

test("reject: action removed, nothing copied, archive if queue empty", async () => {
  // Queue with only one action to make it archiveable
  writeQueue(RUNID_A, [makeActions()[0]]);
  const before = path.join(reviewDir(), `${RUNID_A}.json`);
  expect(fs.existsSync(before)).toBe(true);
  const { stdout } = await runApply(ws, "reject", RUNID_A, "1");
  const result = JSON.parse(stdout);
  expect(result.ok).toBe(true);
  expect(result.op).toBe("reject");
  expect(result.touched).toBe(1);
  expect(result.filed).toEqual([]);
  // Queue archived
  expect(fs.existsSync(before)).toBe(false);
  const archived = path.join(erledigt(), `${RUNID_A}.json`);
  expect(fs.existsSync(archived)).toBe(true);
  // No file copied to target
  const destFile = path.join(ws, TARGET_REL, FILENAME);
  expect(fs.existsSync(destFile)).toBe(false);
});

test("reject remaining action → queue archived to _erledigt", async () => {
  writeQueue(RUNID_A, makeActions());
  seedSourceFile(SOURCE_REL);
  // Approve action 1 first
  await runApply(ws, "approve", RUNID_A, "1");
  // Reject action 2
  const { stdout } = await runApply(ws, "reject", RUNID_A, "2");
  const result = JSON.parse(stdout);
  expect(result.touched).toBe(1);
  const qPath = path.join(reviewDir(), `${RUNID_A}.json`);
  expect(fs.existsSync(qPath)).toBe(false);
  const archived = path.join(erledigt(), `${RUNID_A}.json`);
  expect(fs.existsSync(archived)).toBe(true);
});

test("--dry: reports filed paths but nothing written", async () => {
  writeQueue(RUNID_A, makeActions());
  seedSourceFile(SOURCE_REL);
  const { stdout } = await runApply(ws, "approve", RUNID_A, "1", "--dry");
  const result = JSON.parse(stdout);
  expect(result.ok).toBe(true);
  expect(result.dry).toBe(true);
  expect(result.filed.length).toBe(1);
  // Nothing actually copied
  const destFile = path.join(ws, TARGET_REL, FILENAME);
  expect(fs.existsSync(destFile)).toBe(false);
  // Journal not written
  const jPath = journalPath();
  expect(fs.existsSync(jPath)).toBe(false);
  // Queue unchanged
  const q = JSON.parse(fs.readFileSync(path.join(reviewDir(), `${RUNID_A}.json`), "utf8"));
  expect(q.actions.length).toBe(2);
});

test("collision: pre-created dest filename → approve lands _2 variant", async () => {
  writeQueue(RUNID_A, [makeActions()[0]]);
  seedSourceFile(SOURCE_REL);
  // Pre-create the destination file
  const destDir = path.join(ws, TARGET_REL);
  fs.mkdirSync(destDir, { recursive: true });
  fs.writeFileSync(path.join(destDir, FILENAME), "existing");
  const { stdout } = await runApply(ws, "approve", RUNID_A, "1");
  const result = JSON.parse(stdout);
  expect(result.filed[0]).toContain("_2");
  // The _2 variant should exist
  const base = path.basename(FILENAME, ".pdf");
  const collision = path.join(destDir, `${base}_2.pdf`);
  expect(fs.existsSync(collision)).toBe(true);
});

test("approve-safe: approves only tier sicher (not p or f) across all queues", async () => {
  // actions[0] has tier sicher + confidence prüfen → tier_of = "p" → NOT included in approve-safe
  // actions[1] has tier folgenreich → tier_of = "f" → NOT included
  writeQueue(RUNID_A, makeActions());
  seedSourceFile(SOURCE_REL);
  const { stdout } = await runApply(ws, "approve-safe");
  const result = JSON.parse(stdout);
  expect(result.ok).toBe(true);
  expect(result.op).toBe("approve-safe");
  expect(result.touched).toBe(0); // none are tier "s"
});

test("approve-safe: approves plain sicher actions (no confidence override)", async () => {
  const actions = [
    {
      id: 10,
      verb: "kopieren",
      tier: "sicher",
      reason: "Plain sicher",
      source: SOURCE_REL,
      filename: FILENAME,
      targets: [TARGET_REL],
      values: {},
    },
  ];
  writeQueue(RUNID_A, actions);
  seedSourceFile(SOURCE_REL);
  const { stdout } = await runApply(ws, "approve-safe");
  const result = JSON.parse(stdout);
  expect(result.touched).toBe(1);
  const destFile = path.join(ws, TARGET_REL, FILENAME);
  expect(fs.existsSync(destFile)).toBe(true);
});

test("approve-safe across two queue files", async () => {
  const sicherAction = (id: number) => ({
    id, verb: "kopieren", tier: "sicher", reason: "ok",
    source: SOURCE_REL, filename: `file-${id}.pdf`, targets: [TARGET_REL], values: {},
  });
  writeQueue(RUNID_A, [sicherAction(1)]);
  writeQueue(RUNID_B, [sicherAction(2)]);
  seedSourceFile(SOURCE_REL);
  const { stdout } = await runApply(ws, "approve-safe");
  const result = JSON.parse(stdout);
  expect(result.touched).toBe(2);
  expect(result.filed.length).toBe(2);
  // Both queues should be archived
  expect(fs.existsSync(path.join(erledigt(), `${RUNID_A}.json`))).toBe(true);
  expect(fs.existsSync(path.join(erledigt(), `${RUNID_B}.json`))).toBe(true);
});

test("garbled extra queue file → skipped, ops still work", async () => {
  writeQueue(RUNID_A, [makeActions()[0]]);
  // Write a garbled JSON file in the review dir
  fs.writeFileSync(path.join(reviewDir(), "R-garbled.json"), "{not valid json!!!", "utf8");
  seedSourceFile(SOURCE_REL);
  // list should not crash
  const { stdout: listOut } = await runApply(ws, "list");
  const listResult = JSON.parse(listOut);
  expect(listResult.ok).toBe(true);
  expect(listResult.total).toBe(1); // garbled file skipped
  // approve should still work
  const { stdout: approveOut } = await runApply(ws, "approve", RUNID_A, "1");
  const approveResult = JSON.parse(approveOut);
  expect(approveResult.ok).toBe(true);
  expect(approveResult.touched).toBe(1);
});

test("approve missing source file → creates empty file at dest (apply.py compat)", async () => {
  writeQueue(RUNID_A, [makeActions()[0]]);
  // Do NOT seed the source file — it doesn't exist
  const { stdout } = await runApply(ws, "approve", RUNID_A, "1");
  const result = JSON.parse(stdout);
  expect(result.ok).toBe(true);
  expect(result.touched).toBe(1);
  const destFile = path.join(ws, TARGET_REL, FILENAME);
  expect(fs.existsSync(destFile)).toBe(true);
  // Should be empty (0 bytes)
  expect(fs.statSync(destFile).size).toBe(0);
});

test("unknown cmd → {ok:false, error:'unknown cmd'}", async () => {
  const { stdout } = await runApply(ws, "frobnicate");
  const result = JSON.parse(stdout);
  expect(result.ok).toBe(false);
  expect(result.error).toBe("unknown cmd");
});

test("target display in list: filename + arrows + basename(dirs)", async () => {
  const actions = [{
    id: 1, verb: "kopieren", tier: "sicher", reason: "ok",
    source: "_eingang/file.pdf", filename: "file.pdf",
    targets: ["001 Galant/Buchhaltung"],
    values: {},
  }];
  writeQueue(RUNID_A, actions);
  const { stdout } = await runApply(ws, "list");
  const result = JSON.parse(stdout);
  const item = result.groups[0].items[0];
  expect(item.target).toContain("  →  ");
  expect(item.target).toContain("Buchhaltung");
});

test("vals field: entity · kategorie stripped of padding", async () => {
  const actions = [{
    id: 1, verb: "kopieren", tier: "sicher", reason: "ok",
    source: "_eingang/file.pdf", filename: "file.pdf",
    targets: [],
    values: { entity: "GB", kategorie: "Kfz" },
  }];
  writeQueue(RUNID_A, actions);
  const { stdout } = await runApply(ws, "list");
  const result = JSON.parse(stdout);
  expect(result.groups[0].items[0].vals).toBe("GB · Kfz");
});

test("vals field: only entity present → no trailing ·", async () => {
  const actions = [{
    id: 1, verb: "kopieren", tier: "sicher", reason: "ok",
    source: "_eingang/file.pdf", filename: "file.pdf",
    targets: [],
    values: { entity: "GB" },
  }];
  writeQueue(RUNID_A, actions);
  const { stdout } = await runApply(ws, "list");
  const result = JSON.parse(stdout);
  expect(result.groups[0].items[0].vals).toBe("GB");
});

test("multiple targets → all paths in filed, all files created", async () => {
  const actions = [{
    id: 1, verb: "kopieren", tier: "sicher", reason: "ok",
    source: SOURCE_REL, filename: FILENAME,
    targets: ["dest-a", "dest-b"],
    values: {},
  }];
  writeQueue(RUNID_A, actions);
  seedSourceFile(SOURCE_REL);
  const { stdout } = await runApply(ws, "approve", RUNID_A, "1");
  const result = JSON.parse(stdout);
  expect(result.filed.length).toBe(2);
  expect(fs.existsSync(path.join(ws, "dest-a", FILENAME))).toBe(true);
  expect(fs.existsSync(path.join(ws, "dest-b", FILENAME))).toBe(true);
});

test("approve-safe --dry reports but does not write", async () => {
  const actions = [{
    id: 1, verb: "kopieren", tier: "sicher", reason: "ok",
    source: SOURCE_REL, filename: FILENAME,
    targets: [TARGET_REL],
    values: {},
  }];
  writeQueue(RUNID_A, actions);
  seedSourceFile(SOURCE_REL);
  const { stdout } = await runApply(ws, "approve-safe", "--dry");
  const result = JSON.parse(stdout);
  expect(result.ok).toBe(true);
  expect(result.dry).toBe(true);
  expect(result.touched).toBe(1);
  expect(result.filed.length).toBe(1);
  const destFile = path.join(ws, TARGET_REL, FILENAME);
  expect(fs.existsSync(destFile)).toBe(false);
});

test("list: process not in ICON map → uses process name as group, receipt as icon", async () => {
  const actions = [{
    id: 1, verb: "kopieren", tier: "sicher", reason: "ok",
    source: "_eingang/f.pdf", filename: "f.pdf",
    targets: [],
    values: {},
  }];
  writeQueue(RUNID_A, actions, "custom-process");
  const { stdout } = await runApply(ws, "list");
  const result = JSON.parse(stdout);
  const g = result.groups[0];
  expect(g.group).toBe("custom-process");
  expect(g.icon).toBe("receipt");
});

// ── Fix 2: workspace containment guard tests ──────────────────────────────────

test("traversal refused: unsafe target not copied, listed in skipped_unsafe", async () => {
  // Use an absolute path that resolves outside the workspace
  const unsafeTarget = "../../../tmp/cc-escape-test";
  const actions = [{
    id: 99,
    verb: "kopieren",
    tier: "sicher",
    reason: "traversal attempt",
    source: SOURCE_REL,
    filename: FILENAME,
    targets: [unsafeTarget],
    values: {},
  }];
  writeQueue(RUNID_A, actions);
  seedSourceFile(SOURCE_REL);

  const { stdout } = await runApply(ws, "approve", RUNID_A, "99");
  const result = JSON.parse(stdout);

  expect(result.ok).toBe(true);
  expect(result.touched).toBe(1);
  // Nothing was filed (all targets were unsafe)
  expect(result.filed).toEqual([]);
  // The unsafe target is reported
  expect(Array.isArray(result.skipped_unsafe)).toBe(true);
  expect(result.skipped_unsafe.length).toBeGreaterThan(0);
  expect(result.skipped_unsafe[0]).toContain("cc-escape-test");
  // No file escaped the workspace
  const escapePath = path.resolve(ws, unsafeTarget, FILENAME);
  expect(fs.existsSync(escapePath)).toBe(false);
});

test("list shows full relative target path, not just basename", async () => {
  const nestedTarget = "001 Galant/Buchhaltung/Eingang";
  const actions = [{
    id: 1, verb: "kopieren", tier: "sicher", reason: "ok",
    source: "_eingang/file.pdf", filename: "file.pdf",
    targets: [nestedTarget],
    values: {},
  }];
  writeQueue(RUNID_A, actions);
  const { stdout } = await runApply(ws, "list");
  const result = JSON.parse(stdout);
  const item = result.groups[0].items[0];
  // Must show the full relative path, not just "Eingang"
  expect(item.target).toContain("001 Galant/Buchhaltung/Eingang");
  expect(item.target).toContain("  →  ");
});

test("cross-queue isolation: approve in queue A leaves queue B untouched", async () => {
  const actionsA = [{
    id: 1, verb: "kopieren", tier: "sicher", reason: "queue A action",
    source: SOURCE_REL, filename: "file-a.pdf",
    targets: ["dest-a"],
    values: {},
  }];
  const actionsB = [{
    id: 2, verb: "kopieren", tier: "sicher", reason: "queue B action",
    source: SOURCE_REL, filename: "file-b.pdf",
    targets: ["dest-b"],
    values: {},
  }];
  writeQueue(RUNID_A, actionsA);
  writeQueue(RUNID_B, actionsB);
  seedSourceFile(SOURCE_REL);

  // Approve action 1 in queue A only
  const { stdout } = await runApply(ws, "approve", RUNID_A, "1");
  const result = JSON.parse(stdout);
  expect(result.touched).toBe(1);

  // Queue B's file must still exist on disk with its action intact
  const qBPath = path.join(reviewDir(), `${RUNID_B}.json`);
  expect(fs.existsSync(qBPath)).toBe(true);
  const qB = JSON.parse(fs.readFileSync(qBPath, "utf8"));
  expect(qB.actions.length).toBe(1);
  expect(qB.actions[0].id).toBe(2);

  // Queue B's destination file must not have been created
  expect(fs.existsSync(path.join(ws, "dest-b", "file-b.pdf"))).toBe(false);

  // Queue B still appears in list
  const { stdout: listOut } = await runApply(ws, "list");
  const listResult = JSON.parse(listOut);
  expect(listResult.total).toBe(1);
  expect(listResult.groups[0].items[0].id).toBe(2);
});
