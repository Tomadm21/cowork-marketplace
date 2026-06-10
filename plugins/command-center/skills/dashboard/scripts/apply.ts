#!/usr/bin/env bun
/**
 * Command Center — review queue apply engine (TypeScript port of apply.py, semantics 1:1).
 * Dependency-free. Never crashes on missing/garbled queue files.
 *
 *   bun apply.ts <workspace_root> list
 *   bun apply.ts <workspace_root> approve <runid> <id> [--dry]
 *   bun apply.ts <workspace_root> reject  <runid> <id> [--dry]
 *   bun apply.ts <workspace_root> approve-safe [--dry]
 */

import * as fs from "node:fs";
import * as path from "node:path";

// ── ICON map (mirrors apply.py) ───────────────────────────────────────────────

const ICON: Record<string, [string, string]> = {
  "receipt-filing": ["Belege", "receipt"],
  "invoicing":      ["Rechnung", "invoice"],
  "photo-sorting":  ["Fotos", "photo"],
  "daily-report":   ["Tagesbericht", "doc"],
  "lead-gen":       ["Leads", "leads"],
};

// ── Pure functions (exported for tests) ──────────────────────────────────────

export interface Action {
  id?: number | string;
  tier?: string;
  confidence?: string;
  verb?: string;
  source?: string;
  filename?: string;
  targets?: string[];
  reason?: string;
  values?: {
    lieferant?: string;
    nummer?: string;
    betrag?: string;
    belegtyp?: string;
    entity?: string;
    kategorie?: string;
    [k: string]: unknown;
  };
  [k: string]: unknown;
}

/** Derives display tier: folgenreich → "f"; confidence=="prüfen" → "p"; else "s" */
export function tierOf(a: Action): "f" | "p" | "s" {
  if (a.tier === "folgenreich") return "f";
  if (a.confidence === "prüfen") return "p";
  if (a.tier === "prüfen") return "p";
  return "s";
}

/** Derives cockpit row title from values fields or filename/Posten fallback. */
export function titleOf(a: Action): string {
  const v = a.values ?? {};
  let t: string = (v.lieferant as string) || (a.filename as string) || "Posten";
  if (v.nummer) {
    t += (v.belegtyp === "LF" ? " LF " : " RG ") + v.nummer;
  }
  if (v.betrag) {
    t += " · " + v.betrag;
  } else if (v.belegtyp === "LF") {
    t += " · Lieferschein";
  }
  return t;
}

/** Returns a collision-free copy of `filePath` by appending _2, _3, … */
export function collisionSafe(filePath: string): string {
  if (!fs.existsSync(filePath)) return filePath;
  const ext = path.extname(filePath);
  const base = filePath.slice(0, filePath.length - ext.length);
  let i = 2;
  while (fs.existsSync(`${base}_${i}${ext}`)) i++;
  return `${base}_${i}${ext}`;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

interface Queue {
  runid: string;
  process?: string;
  actions: Action[];
  [k: string]: unknown;
}

/** Reads all *.json files from _review/ (except _erledigt/), silently skips garbled files. */
function runs(revDir: string): Array<[string, Queue]> {
  const out: Array<[string, Queue]> = [];
  let entries: string[];
  try { entries = fs.readdirSync(revDir); } catch { return out; }
  for (const name of entries.sort()) {
    if (!name.endsWith(".json")) continue;
    const fp = path.join(revDir, name);
    try {
      const raw = fs.readFileSync(fp, "utf8");
      const q = JSON.parse(raw) as Queue;
      out.push([fp, q]);
    } catch { /* skip garbled */ }
  }
  return out;
}

function appendJournal(journDir: string, rec: object): void {
  fs.mkdirSync(journDir, { recursive: true });
  const ym = new Date().toISOString().slice(0, 7);
  const fp = path.join(journDir, `${ym}.jsonl`);
  fs.appendFileSync(fp, JSON.stringify(rec, null, 0) + "\n", "utf8");
}

/** Copies source to dest (collision-safe) and journals it. Returns workspace-relative filed path. */
function applyAction(a: Action, wsRoot: string, journDir: string, dry: boolean): string[] {
  const src = path.join(wsRoot, a.source ?? "");
  const filed: string[] = [];
  for (const t of (a.targets ?? [])) {
    const d = path.join(wsRoot, t);
    const dest = collisionSafe(path.join(d, a.filename ?? ""));
    if (!dry) {
      fs.mkdirSync(d, { recursive: true });
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
      } else {
        // apply.py creates an empty file when source does not exist
        fs.writeFileSync(dest, "", "utf8");
      }
      appendJournal(journDir, {
        ts: new Date().toISOString(),
        verb: a.verb ?? "kopieren",
        source: a.source ?? "",
        target: path.relative(wsRoot, dest),
        reversible: true,
      });
    }
    filed.push(path.relative(wsRoot, dest));
  }
  return filed;
}

/** Rewrites the queue file if actions remain, or archives it to _erledigt/. */
function rewriteOrArchive(fp: string, q: Queue, doneDir: string, dry: boolean): void {
  if (q.actions.length > 0) {
    if (!dry) fs.writeFileSync(fp, JSON.stringify(q, null, 2), "utf8");
  } else {
    if (!dry) {
      fs.mkdirSync(doneDir, { recursive: true });
      fs.renameSync(fp, path.join(doneDir, path.basename(fp)));
    }
  }
}

// ── Command implementations ───────────────────────────────────────────────────

function doList(revDir: string): void {
  const groups: Record<string, { group: string; icon: string; items: object[] }> = {};
  let total = 0, ns = 0, np = 0, nf = 0;

  for (const [, q] of runs(revDir)) {
    const proc = (q.process as string) ?? "?";
    const [gname, icon] = ICON[proc] ?? [proc, "receipt"];
    if (!groups[proc]) groups[proc] = { group: gname, icon, items: [] };
    const g = groups[proc];

    for (const a of (q.actions ?? [])) {
      const ti = tierOf(a);
      const tg: string[] = a.targets ?? [];
      const disp =
        (a.filename ?? "") +
        (tg.length
          ? "  →  " +
            tg
              .map((t) => {
                const b = path.basename(t.replace(/\/$/, ""));
                return b || t;
              })
              .join(" + ")
          : "");
      const entity = String((a.values as Record<string, unknown>)?.entity ?? "");
      const kategorie = String((a.values as Record<string, unknown>)?.kategorie ?? "");
      const vals = (entity + " · " + kategorie).replace(/^\s*·\s*$/, "").replace(/\s*·\s*$/, "").replace(/^\s*·\s*/, "");

      g.items.push({
        id: a.id,
        runid: q.runid,
        tier: ti,
        title: titleOf(a),
        target: disp,
        vals: vals,
        why: (a.reason as string) ?? "",
      });
      total++;
      if (ti === "s") ns++;
      else if (ti === "p") np++;
      else nf++;
    }
  }

  const stand =
    total > 0
      ? `Stand: ${new Date().toISOString().replace("T", " ").slice(0, 16)} · ${total} offene Posten`
      : "Nichts offen — alles freigegeben.";

  process.stdout.write(
    JSON.stringify({ ok: true, stand, total, ns, np, nf, groups: Object.values(groups) }, null, 0) + "\n",
  );
}

function doOp(
  op: "approve" | "reject" | "approve-safe",
  wsRoot: string,
  revDir: string,
  doneDir: string,
  journDir: string,
  runid: string | null,
  aid: string | null,
  dry: boolean,
): void {
  const filed: string[] = [];
  let touched = 0;

  for (const [fp, q] of runs(revDir)) {
    if (runid && q.runid !== runid) continue;
    const keep: Action[] = [];
    for (const a of (q.actions ?? [])) {
      const sel =
        (op === "approve-safe" && tierOf(a) === "s") ||
        ((op === "approve" || op === "reject") && String(a.id) === String(aid));
      if (!sel) { keep.push(a); continue; }
      touched++;
      if (op === "approve" || op === "approve-safe") {
        filed.push(...applyAction(a, wsRoot, journDir, dry));
      }
    }
    q.actions = keep;
    rewriteOrArchive(fp, q, doneDir, dry);
  }

  process.stdout.write(
    JSON.stringify({ ok: true, op, touched, filed, dry }, null, 0) + "\n",
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

function main(): void {
  const rawArgs = process.argv.slice(2);
  const dry = rawArgs.includes("--dry");
  const args = rawArgs.filter((a) => a !== "--dry");

  const wsRoot = args[0] ?? "";
  if (!wsRoot) {
    process.stderr.write("usage: apply.ts <workspace_root> list|approve|reject|approve-safe [--dry]\n");
    process.exit(1);
  }

  const revDir  = path.join(wsRoot, "_firma", "_review");
  const doneDir = path.join(revDir, "_erledigt");
  const journDir = path.join(wsRoot, "_firma", "_journal");

  const cmd = args[1] ?? "list";

  if (cmd === "list") {
    doList(revDir);
  } else if (cmd === "approve-safe") {
    doOp("approve-safe", wsRoot, revDir, doneDir, journDir, null, null, dry);
  } else if (cmd === "approve" || cmd === "reject") {
    const runid = args[2] ?? null;
    const aid   = args[3] ?? null;
    doOp(cmd, wsRoot, revDir, doneDir, journDir, runid, aid, dry);
  } else {
    process.stdout.write(JSON.stringify({ ok: false, error: "unknown cmd" }, null, 0) + "\n");
  }
}

if (import.meta.main) main();
