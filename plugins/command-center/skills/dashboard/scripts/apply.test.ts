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
  test("unknown/missing tier → p (fail-closed: 'sicher' is earned, never a default)", () => {
    expect(tierOf({})).toBe("p");
    expect(tierOf({ tier: "Sicher" })).toBe("p");   // typo'd tier must not look bulk-approvable
    expect(tierOf({ tier: null as unknown as string })).toBe("p");
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
    const a = { values: { lieferant: "Solo GmbH" } };
    expect(titleOf(a)).toBe("Solo GmbH");
  });
  test("lieferant only, no nummer, no betrag, no belegtyp", () => {
    const a = { values: { lieferant: "Solo GmbH" }, filename: "x.pdf" };
    expect(titleOf(a)).toBe("Solo GmbH");
  });
  test("no lieferant, no values → falls back to filename", () => {
    const a = { filename: "fallback.pdf" };
    expect(titleOf(a)).toBe("fallback.pdf");
  });
  test("no lieferant, no filename → Posten", () => {
    expect(titleOf({})).toBe("Posten");
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
function journalDir(): string { return path.join(ws, "_firma", "_journal"); }

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

/** apply.ts is list-only since v0.10.2 — used for the list-schema tests. */
async function runTsList(...args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const scriptPath = path.join(import.meta.dir, "apply.ts");
  const proc = Bun.spawn(["bun", scriptPath, ...args], { stdout: "pipe", stderr: "pipe" });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { stdout, stderr, exitCode };
}

/** The canonical engine — every mutation test runs against apply.py. */
async function runPy(...args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const scriptPath = path.join(import.meta.dir, "apply.py");
  const proc = Bun.spawn(["python3", scriptPath, ...args], { stdout: "pipe", stderr: "pipe" });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { stdout, stderr, exitCode };
}

const statuses = (result: { results: Array<{ status: string }> }) => result.results.map((r) => r.status);

// collisionSafe uses real fs against tmp dirs
describe("collisionSafe", () => {
  let tmpDir: string;
  beforeEach(() => { tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cs-test-")); });
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
  // TARGET_REL sits outside _ausgang/ — like a grown folder structure in the
  // real world it must be declared as a write root in a config path field
  // (the relative-target allow-list rejects undeclared roots since v0.18)
  const cfgDir = path.join(ws, "_firma", "config");
  fs.mkdirSync(cfgDir, { recursive: true });
  fs.writeFileSync(path.join(cfgDir, "test-roots.json"), JSON.stringify({ output_roots: ["001 Galant/Buchhaltung"] }), "utf8");
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

// ── apply.ts list schema (the lister the dashboard shares helpers with) ──────

describe("apply.ts list (read-only)", () => {
  test("correct total/ns/np/nf and item fields", async () => {
    writeQueue(RUNID_A, makeActions());
    const { stdout } = await runTsList(ws, "list");
    const result = JSON.parse(stdout);
    expect(result.ok).toBe(true);
    expect(result.total).toBe(2);
    expect(result.ns).toBe(0);   // confidence prüfen overrides sicher → p
    expect(result.np).toBe(1);
    expect(result.nf).toBe(1);
    const g = result.groups[0];
    expect(g.group).toBe("Belege");
    expect(g.icon).toBe("receipt");
    const item = g.items[0];
    expect(item.id).toBe(1);
    expect(item.runid).toBe(RUNID_A);
    expect(item.tier).toBe("p");
    expect(item.title).toBe("Heinz Wilmers GmbH RG 2605176 · 476,00 EUR");
    expect(item.vals).toBe("GB · Kfz/Fahrzeug");
    expect(item.why).toBe("Sicher but needs check");
  });

  test("empty queue dir → ok:true, total:0, Nichts offen", async () => {
    fs.mkdirSync(reviewDir(), { recursive: true });
    const { stdout } = await runTsList(ws, "list");
    const result = JSON.parse(stdout);
    expect(result.ok).toBe(true);
    expect(result.total).toBe(0);
    expect(result.stand).toContain("Nichts offen");
  });

  test("non-queue *.json in _review/ is ignored (only R-*.json are queues)", async () => {
    writeQueue(RUNID_A, [makeActions()[0]]);
    fs.writeFileSync(path.join(reviewDir(), "config.json"), JSON.stringify({ some: "config" }), "utf8");
    const { stdout } = await runTsList(ws, "list");
    expect(JSON.parse(stdout).total).toBe(1);
  });

  test("target display: filename + arrows + full relative path", async () => {
    const actions = [{
      id: 1, verb: "kopieren", tier: "sicher", reason: "ok",
      source: "_eingang/file.pdf", filename: "file.pdf",
      targets: ["001 Galant/Buchhaltung/Eingang"],
      values: {},
    }];
    writeQueue(RUNID_A, actions);
    const { stdout } = await runTsList(ws, "list");
    const item = JSON.parse(stdout).groups[0].items[0];
    expect(item.target).toContain("  →  ");
    expect(item.target).toContain("001 Galant/Buchhaltung/Eingang");
  });

  test("vals field: entity · kategorie stripped of padding", async () => {
    const actions = [{
      id: 1, verb: "kopieren", tier: "sicher", reason: "ok",
      source: "_eingang/file.pdf", filename: "file.pdf", targets: [],
      values: { entity: "GB", kategorie: "Kfz" },
    }];
    writeQueue(RUNID_A, actions);
    const { stdout } = await runTsList(ws, "list");
    expect(JSON.parse(stdout).groups[0].items[0].vals).toBe("GB · Kfz");
  });

  test("vals field: only entity present → no trailing ·", async () => {
    const actions = [{
      id: 1, verb: "kopieren", tier: "sicher", reason: "ok",
      source: "_eingang/file.pdf", filename: "file.pdf", targets: [],
      values: { entity: "GB" },
    }];
    writeQueue(RUNID_A, actions);
    const { stdout } = await runTsList(ws, "list");
    expect(JSON.parse(stdout).groups[0].items[0].vals).toBe("GB");
  });

  test("process not in ICON map → process name as group, receipt icon", async () => {
    const actions = [{
      id: 1, verb: "kopieren", tier: "sicher", reason: "ok",
      source: "_eingang/f.pdf", filename: "f.pdf", targets: [], values: {},
    }];
    writeQueue(RUNID_A, actions, "custom-process");
    const { stdout } = await runTsList(ws, "list");
    const g = JSON.parse(stdout).groups[0];
    expect(g.group).toBe("custom-process");
    expect(g.icon).toBe("receipt");
  });

  test("approve/reject/approve-safe were removed → error pointing to apply.py, exit 1", async () => {
    for (const cmd of ["approve", "reject", "approve-safe", "frobnicate"]) {
      const { stdout, exitCode } = await runTsList(ws, cmd, RUNID_A, "1");
      const result = JSON.parse(stdout);
      expect(result.ok).toBe(false);
      expect(result.error).toContain("apply.py");
      expect(exitCode).toBe(1);
    }
  });
});

// ── apply.py — the canonical engine (all mutations) ──────────────────────────

describe("apply.py approve/reject/approve-safe", () => {
  test("approve: copied to target, journal entry carries the guard key, action removed", async () => {
    writeQueue(RUNID_A, makeActions());
    seedSourceFile(SOURCE_REL);
    const { stdout } = await runPy(ws, "approve", RUNID_A, "1");
    const result = JSON.parse(stdout);
    expect(result.ok).toBe(true);
    expect(statuses(result)).toEqual(["copied"]);
    expect(fs.existsSync(path.join(ws, TARGET_REL, FILENAME))).toBe(true);
    // journal entry must carry runid/id/md5/status — that's the replay guard
    const jFiles = fs.readdirSync(journalDir()).filter((f) => f.endsWith(".jsonl"));
    const entry = JSON.parse(fs.readFileSync(path.join(journalDir(), jFiles[0]), "utf8").trim().split("\n")[0]);
    expect(entry.runid).toBe(RUNID_A);
    expect(entry.id).toBe(1);
    expect(typeof entry.md5).toBe("string");
    expect(entry.status).toBe("copied");
    expect(entry.reversible).toBe(true);
    // action removed, sibling action stays
    const q = JSON.parse(fs.readFileSync(path.join(reviewDir(), `${RUNID_A}.json`), "utf8"));
    expect(q.actions.length).toBe(1);
    expect(q.actions[0].id).toBe(2);
  });

  test("approve same id again → ok:false action nicht gefunden (already applied+removed)", async () => {
    writeQueue(RUNID_A, makeActions());
    seedSourceFile(SOURCE_REL);
    await runPy(ws, "approve", RUNID_A, "1");
    const { stdout } = await runPy(ws, "approve", RUNID_A, "1");
    const result = JSON.parse(stdout);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("nicht gefunden");
  });

  test("journal guard: same action re-queued after crash → already-journaled, no _2 clone", async () => {
    writeQueue(RUNID_A, [makeActions()[0]]);
    seedSourceFile(SOURCE_REL);
    await runPy(ws, "approve", RUNID_A, "1");
    // simulate a crash between copy and queue removal: the action re-appears
    writeQueue(RUNID_A, [makeActions()[0]]);
    const { stdout } = await runPy(ws, "approve", RUNID_A, "1");
    const result = JSON.parse(stdout);
    expect(statuses(result)).toEqual(["already-journaled"]);
    const destDir = path.join(ws, TARGET_REL);
    const clones = fs.readdirSync(destDir).filter((f) => f.includes("_2"));
    expect(clones).toEqual([]);
  });

  test("approve missing source → structured error, action stays, nothing written", async () => {
    writeQueue(RUNID_A, [makeActions()[0]]);
    const { stdout } = await runPy(ws, "approve", RUNID_A, "1");
    const result = JSON.parse(stdout);
    expect(result.ok).toBe(false);
    expect(statuses(result)).toEqual(["error"]);
    expect(result.results[0].detail).toContain("source fehlt");
    expect(fs.existsSync(path.join(ws, TARGET_REL, FILENAME))).toBe(false);
    const q = JSON.parse(fs.readFileSync(path.join(reviewDir(), `${RUNID_A}.json`), "utf8"));
    expect(q.actions.length).toBe(1);
  });

  test("reject: action removed, nothing copied, archive if queue empty", async () => {
    writeQueue(RUNID_A, [makeActions()[0]]);
    const { stdout } = await runPy(ws, "reject", RUNID_A, "1");
    const result = JSON.parse(stdout);
    expect(result.ok).toBe(true);
    expect(fs.existsSync(path.join(reviewDir(), `${RUNID_A}.json`))).toBe(false);
    expect(fs.existsSync(path.join(erledigt(), `${RUNID_A}.json`))).toBe(true);
    expect(fs.existsSync(path.join(ws, TARGET_REL, FILENAME))).toBe(false);
  });

  test("reject unknown id → ok:false (no silent success)", async () => {
    writeQueue(RUNID_A, [makeActions()[0]]);
    const { stdout } = await runPy(ws, "reject", RUNID_A, "99");
    const result = JSON.parse(stdout);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("nicht gefunden");
    const q = JSON.parse(fs.readFileSync(path.join(reviewDir(), `${RUNID_A}.json`), "utf8"));
    expect(q.actions.length).toBe(1);
  });

  test("reject with string id in queue still matches numeric argv id", async () => {
    writeQueue(RUNID_A, [{ ...makeActions()[0], id: "1" }]);
    const { stdout } = await runPy(ws, "reject", RUNID_A, "1");
    expect(JSON.parse(stdout).ok).toBe(true);
    expect(fs.existsSync(path.join(erledigt(), `${RUNID_A}.json`))).toBe(true);
  });

  test("--dry: reports would-be statuses, nothing written", async () => {
    writeQueue(RUNID_A, makeActions());
    seedSourceFile(SOURCE_REL);
    const { stdout } = await runPy(ws, "approve", RUNID_A, "1", "--dry");
    const result = JSON.parse(stdout);
    expect(result.ok).toBe(true);
    expect(result.dry).toBe(true);
    expect(statuses(result)[0]).toStartWith("DRY:");
    expect(fs.existsSync(path.join(ws, TARGET_REL, FILENAME))).toBe(false);
    expect(fs.existsSync(journalDir())).toBe(false);
    const q = JSON.parse(fs.readFileSync(path.join(reviewDir(), `${RUNID_A}.json`), "utf8"));
    expect(q.actions.length).toBe(2);
  });

  test("md5 idempotency: identical file already at dest → skipped-identical, no _2", async () => {
    writeQueue(RUNID_A, [makeActions()[0]]);
    seedSourceFile(SOURCE_REL, "same bytes");
    const destDir = path.join(ws, TARGET_REL);
    fs.mkdirSync(destDir, { recursive: true });
    fs.writeFileSync(path.join(destDir, FILENAME), "same bytes");
    const { stdout } = await runPy(ws, "approve", RUNID_A, "1");
    expect(statuses(JSON.parse(stdout))).toEqual(["skipped-identical"]);
    expect(fs.readdirSync(destDir).filter((f) => f.includes("_2"))).toEqual([]);
  });

  test("collision: different file at dest → _2 variant", async () => {
    writeQueue(RUNID_A, [makeActions()[0]]);
    seedSourceFile(SOURCE_REL, "new content");
    const destDir = path.join(ws, TARGET_REL);
    fs.mkdirSync(destDir, { recursive: true });
    fs.writeFileSync(path.join(destDir, FILENAME), "existing other content");
    const { stdout } = await runPy(ws, "approve", RUNID_A, "1");
    const result = JSON.parse(stdout);
    expect(result.results[0].target).toContain("_2");
  });

  test("multiple targets → delivered to every one", async () => {
    const actions = [{
      id: 1, verb: "kopieren", tier: "sicher", reason: "ok",
      source: SOURCE_REL, filename: FILENAME, targets: ["_ausgang/dest-a", "_ausgang/dest-b"], values: {},
    }];
    writeQueue(RUNID_A, actions);
    seedSourceFile(SOURCE_REL);
    const { stdout } = await runPy(ws, "approve", RUNID_A, "1");
    expect(statuses(JSON.parse(stdout))).toEqual(["copied", "copied"]);
    expect(fs.existsSync(path.join(ws, "_ausgang", "dest-a", FILENAME))).toBe(true);
    expect(fs.existsSync(path.join(ws, "_ausgang", "dest-b", FILENAME))).toBe(true);
  });

  test("approve-safe: only plain tier sicher is bulk-approved", async () => {
    writeQueue(RUNID_A, makeActions()); // p + f — none eligible
    seedSourceFile(SOURCE_REL);
    const { stdout } = await runPy(ws, "approve-safe");
    const result = JSON.parse(stdout);
    expect(result.ok).toBe(true);
    expect(result.applied.length).toBe(0);
  });

  test("approve-safe across two queues, both archived", async () => {
    const sicherAction = (id: number) => ({
      id, verb: "kopieren", tier: "sicher", reason: "ok",
      source: SOURCE_REL, filename: `file-${id}.pdf`, targets: [TARGET_REL], values: {},
    });
    writeQueue(RUNID_A, [sicherAction(1)]);
    writeQueue(RUNID_B, [sicherAction(2)]);
    seedSourceFile(SOURCE_REL);
    const { stdout } = await runPy(ws, "approve-safe");
    const result = JSON.parse(stdout);
    expect(result.applied.length).toBe(2);
    expect(fs.existsSync(path.join(erledigt(), `${RUNID_A}.json`))).toBe(true);
    expect(fs.existsSync(path.join(erledigt(), `${RUNID_B}.json`))).toBe(true);
  });

  test("approve-safe --dry reports but does not write", async () => {
    writeQueue(RUNID_A, [{
      id: 1, verb: "kopieren", tier: "sicher", reason: "ok",
      source: SOURCE_REL, filename: FILENAME, targets: [TARGET_REL], values: {},
    }]);
    seedSourceFile(SOURCE_REL);
    const { stdout } = await runPy(ws, "approve-safe", "--dry");
    const result = JSON.parse(stdout);
    expect(result.dry).toBe(true);
    expect(result.applied.length).toBe(1);
    expect(fs.existsSync(path.join(ws, TARGET_REL, FILENAME))).toBe(false);
  });

  test("garbled queue file → surfaced in queue_warnings, ops still work", async () => {
    writeQueue(RUNID_A, [makeActions()[0]]);
    fs.writeFileSync(path.join(reviewDir(), "R-garbled.json"), "{not valid json!!!", "utf8");
    seedSourceFile(SOURCE_REL);
    const { stdout: listOut } = await runPy(ws, "list");
    const listResult = JSON.parse(listOut);
    expect(listResult.ok).toBe(true);
    expect(listResult.total).toBe(1);
    expect(listResult.queue_warnings.length).toBe(1);
    expect(listResult.queue_warnings[0]).toContain("R-garbled.json");
    const { stdout: approveOut } = await runPy(ws, "approve", RUNID_A, "1");
    expect(JSON.parse(approveOut).ok).toBe(true);
  });

  test("cross-queue isolation: approve in queue A leaves queue B untouched", async () => {
    writeQueue(RUNID_A, [{ id: 1, verb: "kopieren", tier: "sicher", reason: "a", source: SOURCE_REL, filename: "file-a.pdf", targets: ["_ausgang/dest-a"], values: {} }]);
    writeQueue(RUNID_B, [{ id: 2, verb: "kopieren", tier: "sicher", reason: "b", source: SOURCE_REL, filename: "file-b.pdf", targets: ["_ausgang/dest-b"], values: {} }]);
    seedSourceFile(SOURCE_REL);
    const { stdout } = await runPy(ws, "approve", RUNID_A, "1");
    expect(JSON.parse(stdout).ok).toBe(true);
    const qB = JSON.parse(fs.readFileSync(path.join(reviewDir(), `${RUNID_B}.json`), "utf8"));
    expect(qB.actions.length).toBe(1);
    expect(fs.existsSync(path.join(ws, "dest-b", "file-b.pdf"))).toBe(false);
  });
});

// ── apply.py — containment (the v0.10.2 security fix) ────────────────────────

describe("apply.py containment", () => {
  test("relative ../ target → skipped-unsafe, nothing copied, action stays, ok:false", async () => {
    const unsafeTarget = "../../../tmp/cc-escape-test";
    writeQueue(RUNID_A, [{
      id: 99, verb: "kopieren", tier: "sicher", reason: "traversal attempt",
      source: SOURCE_REL, filename: FILENAME, targets: [unsafeTarget], values: {},
    }]);
    seedSourceFile(SOURCE_REL);
    const { stdout } = await runPy(ws, "approve", RUNID_A, "99");
    const result = JSON.parse(stdout);
    expect(result.ok).toBe(false);
    expect(statuses(result)).toEqual(["skipped-unsafe"]);
    expect(fs.existsSync(path.resolve(ws, unsafeTarget, FILENAME))).toBe(false);
    const q = JSON.parse(fs.readFileSync(path.join(reviewDir(), `${RUNID_A}.json`), "utf8"));
    expect(q.actions.length).toBe(1); // stays open for the human to see
  });

  test("approve-safe never applies a traversal action", async () => {
    writeQueue(RUNID_A, [{
      id: 1, verb: "kopieren", tier: "sicher", reason: "x",
      source: SOURCE_REL, filename: FILENAME, targets: ["../OUTSIDE/evil"], values: {},
    }]);
    seedSourceFile(SOURCE_REL);
    const { stdout } = await runPy(ws, "approve-safe");
    const result = JSON.parse(stdout);
    expect(result.ok).toBe(false);
    expect(statuses(result.applied[0])).toEqual(["skipped-unsafe"]);
    expect(fs.existsSync(path.resolve(ws, "../OUTSIDE/evil", FILENAME))).toBe(false);
  });

  test("filename with path separators / .. → error, nothing written", async () => {
    for (const fname of ["../../evil.sh", "sub/dir.pdf", ".."]) {
      writeQueue(RUNID_A, [{
        id: 1, verb: "kopieren", tier: "sicher", reason: "x",
        source: SOURCE_REL, filename: fname, targets: [TARGET_REL], values: {},
      }]);
      seedSourceFile(SOURCE_REL);
      const { stdout } = await runPy(ws, "approve", RUNID_A, "1");
      const result = JSON.parse(stdout);
      expect(result.ok).toBe(false);
      expect(result.results[0].detail).toContain("Dateiname");
    }
  });

  test("source outside workspace → error, not copied", async () => {
    const outside = path.join(os.tmpdir(), "cc-outside-source.txt");
    fs.writeFileSync(outside, "secret");
    writeQueue(RUNID_A, [{
      id: 1, verb: "kopieren", tier: "sicher", reason: "x",
      source: outside, filename: "leak.txt", targets: [TARGET_REL], values: {},
    }]);
    const { stdout } = await runPy(ws, "approve", RUNID_A, "1");
    const result = JSON.parse(stdout);
    expect(result.ok).toBe(false);
    expect(result.results[0].detail).toContain("außerhalb");
    fs.rmSync(outside, { force: true });
  });

  test("absolute target NOT configured → falls back to _ausgang/<process>", async () => {
    const absDir = fs.mkdtempSync(path.join(os.tmpdir(), "cc-abs-unconfigured-"));
    writeQueue(RUNID_A, [{
      id: 1, verb: "kopieren", tier: "sicher", reason: "x",
      source: SOURCE_REL, filename: "f.pdf", targets: [absDir], values: {},
    }]);
    seedSourceFile(SOURCE_REL);
    const { stdout } = await runPy(ws, "approve", RUNID_A, "1");
    const result = JSON.parse(stdout);
    expect(result.ok).toBe(true);
    expect(statuses(result)).toEqual(["fallback", "copied"]);
    expect(fs.existsSync(path.join(absDir, "f.pdf"))).toBe(false);
    expect(fs.existsSync(path.join(ws, "_ausgang", "receipt-filing", "f.pdf"))).toBe(true);
    fs.rmSync(absDir, { recursive: true, force: true });
  });

  test("absolute target configured in _firma/config/*.json output_paths → delivered", async () => {
    const absDir = fs.mkdtempSync(path.join(os.tmpdir(), "cc-abs-configured-"));
    const cfgDir = path.join(ws, "_firma", "config");
    fs.mkdirSync(cfgDir, { recursive: true });
    fs.writeFileSync(path.join(cfgDir, "receipt-filing.json"), JSON.stringify({ output_paths: { belege: absDir } }), "utf8");
    writeQueue(RUNID_A, [{
      id: 1, verb: "kopieren", tier: "sicher", reason: "x",
      source: SOURCE_REL, filename: "f.pdf", targets: [absDir], values: {},
    }]);
    seedSourceFile(SOURCE_REL);
    const { stdout } = await runPy(ws, "approve", RUNID_A, "1");
    const result = JSON.parse(stdout);
    expect(result.ok).toBe(true);
    expect(statuses(result)).toEqual(["copied"]);
    expect(fs.existsSync(path.join(absDir, "f.pdf"))).toBe(true);
    fs.rmSync(absDir, { recursive: true, force: true });
  });
});

// ── apply.py — relative target allow-list (the 2026-07-21 root-folder incident:
//    a queue carried config KEYS like "buchhaltung" as targets and the engine
//    silently created those folders in the workspace root) ─────────────────────

describe("apply.py relative target allow-list", () => {
  function writeCfg(name: string, obj: object) {
    const cfgDir = path.join(ws, "_firma", "config");
    fs.mkdirSync(cfgDir, { recursive: true });
    fs.writeFileSync(path.join(cfgDir, name), JSON.stringify(obj), "utf8");
  }

  test("config key as target (root-folder incident) → skipped-unallowed-target, no folder created, action stays", async () => {
    writeCfg("receipt-filing.json", { targets: { buchhaltung: { base_path: "_ausgang/belege" } } });
    writeQueue(RUNID_A, [{
      id: 1, verb: "kopieren", tier: "sicher", reason: "x",
      source: SOURCE_REL, filename: "f.pdf", targets: ["buchhaltung"], values: {},
    }]);
    seedSourceFile(SOURCE_REL);
    const { stdout } = await runPy(ws, "approve", RUNID_A, "1");
    const result = JSON.parse(stdout);
    expect(result.ok).toBe(false);
    expect(statuses(result)).toEqual(["skipped-unallowed-target"]);
    expect(result.results[0].detail).toContain("Config-Schlüssel");
    expect(fs.existsSync(path.join(ws, "buchhaltung"))).toBe(false);
    const q = JSON.parse(fs.readFileSync(path.join(reviewDir(), `${RUNID_A}.json`), "utf8"));
    expect(q.actions.length).toBe(1); // stays open for the human to see
  });

  test("target under _ausgang → allowed without any config", async () => {
    fs.rmSync(path.join(ws, "_firma", "config"), { recursive: true, force: true });
    writeQueue(RUNID_A, [{
      id: 1, verb: "kopieren", tier: "sicher", reason: "x",
      source: SOURCE_REL, filename: "f.pdf", targets: ["_ausgang/belege"], values: {},
    }]);
    seedSourceFile(SOURCE_REL);
    const { stdout } = await runPy(ws, "approve", RUNID_A, "1");
    const result = JSON.parse(stdout);
    expect(result.ok).toBe(true);
    expect(statuses(result)).toEqual(["copied"]);
    expect(fs.existsSync(path.join(ws, "_ausgang", "belege", "f.pdf"))).toBe(true);
  });

  test("relative root declared in a config path field → allowed (grown folder structures)", async () => {
    writeCfg("receipt-filing.json", { targets: { buchhaltung: { base_path: "001 Galant/Buchhaltung" } } });
    writeQueue(RUNID_A, [{
      id: 1, verb: "kopieren", tier: "sicher", reason: "x",
      source: SOURCE_REL, filename: "f.pdf", targets: ["001 Galant/Buchhaltung/2026"], values: {},
    }]);
    seedSourceFile(SOURCE_REL);
    const { stdout } = await runPy(ws, "approve", RUNID_A, "1");
    const result = JSON.parse(stdout);
    expect(result.ok).toBe(true);
    expect(statuses(result)).toEqual(["copied"]);
    expect(fs.existsSync(path.join(ws, "001 Galant", "Buchhaltung", "2026", "f.pdf"))).toBe(true);
  });

  test("_eingang and _firma are never write roots, even when a config lists them", async () => {
    writeCfg("receipt-filing.json", { ablage_ordner: "_eingang", kontrolle: "_firma/evil" });
    for (const target of ["_eingang/receipt-filing", "_firma/evil"]) {
      writeQueue(RUNID_A, [{
        id: 1, verb: "kopieren", tier: "sicher", reason: "x",
        source: SOURCE_REL, filename: "f.pdf", targets: [target], values: {},
      }]);
      seedSourceFile(SOURCE_REL);
      const { stdout } = await runPy(ws, "approve", RUNID_A, "1");
      const result = JSON.parse(stdout);
      expect(result.ok).toBe(false);
      expect(statuses(result)).toEqual(["skipped-unallowed-target"]);
    }
    expect(fs.existsSync(path.join(ws, "_firma", "evil"))).toBe(false);
    expect(fs.existsSync(path.join(ws, "_eingang", "receipt-filing", "f.pdf"))).toBe(false);
  });

  test("approve-safe honors the allow-list too", async () => {
    writeQueue(RUNID_A, [{
      id: 1, verb: "kopieren", tier: "sicher", reason: "x",
      source: SOURCE_REL, filename: "f.pdf", targets: ["lager"], values: {},
    }]);
    seedSourceFile(SOURCE_REL);
    const { stdout } = await runPy(ws, "approve-safe");
    const result = JSON.parse(stdout);
    expect(result.ok).toBe(false);
    expect(statuses(result.applied[0])).toEqual(["skipped-unallowed-target"]);
    expect(fs.existsSync(path.join(ws, "lager"))).toBe(false);
  });
});
