#!/usr/bin/env bun
/**
 * Command Center — review queue LISTER + shared helpers for dashboard.ts.
 * Dependency-free; never crashes on missing/garbled queue files.
 *
 * v0.10.2: the approve/reject/approve-safe commands were REMOVED. This file
 * used to be a partial port of apply.py and a partial port of an apply engine
 * is more dangerous than none (it lacked the journal guard, md5 idempotency
 * and the missing-source refusal). The one and only engine that applies
 * approvals is the workspace-resident `_firma/apply.py` (pure Python 3).
 *
 *   bun apply.ts <workspace_root> list        # read-only
 */

import * as fs from "node:fs";
import * as path from "node:path";

// ── ICON map (mirrors apply.py) ───────────────────────────────────────────────

export const ICON: Record<string, [string, string]> = {
  "receipt-filing": ["Belege", "receipt"],
  "invoicing":      ["Rechnungen", "invoice"],
  "photo-sorting":  ["Fotos", "photo"],
  "daily-report":   ["Tagesbericht", "doc"],
};

// ── Pure functions (exported for tests) ──────────────────────────────────────

export interface Action {
  id?: number | string;
  tier?: string;
  confidence?: string;
  bestaetigen?: Array<{ feld?: string; wert?: unknown; bestaetigt?: boolean }>;
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

/**
 * Derives display tier: folgenreich → "f"; confidence=="prüfen" → "p";
 * tier=="sicher" → "s"; ANYTHING else (missing/unknown/typo) → "p".
 * Fail-closed on purpose: "sicher" is an earned label, never a default —
 * an action with no tier must never look bulk-approvable. An action with an
 * open Pflicht-Bestätigung is likewise never "s" — mirrors the engine's
 * unresolved_confirms() so this lister's counts match apply.py's.
 */
export function tierOf(a: Action): "f" | "p" | "s" {
  if (a.tier === "folgenreich") return "f";
  if (a.confidence === "prüfen") return "p";
  const open = (a.bestaetigen ?? []).some(
    (c) => c && typeof c === "object" && !c.bestaetigt && (c.wert === undefined || c.wert === null || c.wert === ""),
  );
  if (open) return "p";
  if (a.tier === "sicher") return "s";
  return "p";
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

// ── Time helpers ──────────────────────────────────────────────────────────────

/** Formats a Date as local "YYYY-MM-DD HH:MM" (mirrors apply.py list "Stand" display). */
function localDateTime(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    ` ${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

// ── Internal helpers ──────────────────────────────────────────────────────────

export interface Queue {
  runid: string;
  process?: string;
  headline?: string;
  created?: string;
  actions: Action[];
  [k: string]: unknown;
}

/** Reads queue files (R-*.json only, like apply.py) from _review/, silently skips garbled files. */
export function runs(revDir: string): Array<[string, Queue]> {
  const out: Array<[string, Queue]> = [];
  let entries: string[];
  try { entries = fs.readdirSync(revDir); } catch { return out; }
  for (const name of entries.sort()) {
    if (!name.startsWith("R-") || !name.endsWith(".json")) continue;
    const fp = path.join(revDir, name);
    try {
      // strip a UTF-8 BOM (Windows PowerShell default) — JSON.parse would throw
      // on it and the queue would be silently skipped as garbled
      const raw = fs.readFileSync(fp, "utf8").replace(/^\uFEFF/, "");
      const q = JSON.parse(raw) as Queue;
      out.push([fp, q]);
    } catch { /* skip garbled */ }
  }
  return out;
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
      // Show the full relative target path (not just basename) so traversal like ../../tmp/x
      // is visible to the human reviewer rather than hidden behind a short basename.
      const disp =
        (a.filename ?? "") +
        (tg.length
          ? "  →  " + tg.join(" + ")
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
      ? `Stand: ${localDateTime()} · ${total} offene Posten`
      : "Nichts offen — alles freigegeben.";

  process.stdout.write(
    JSON.stringify({ ok: true, stand, total, ns, np, nf, groups: Object.values(groups) }, null, 0) + "\n",
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

function main(): void {
  const args = process.argv.slice(2).filter((a) => a !== "--dry");

  const wsRoot = args[0] ?? "";
  if (!wsRoot) {
    process.stderr.write("usage: apply.ts <workspace_root> list\n");
    process.exit(1);
  }

  const cmd = args[1] ?? "list";

  if (cmd === "list") {
    doList(path.join(wsRoot, "_firma", "_review"));
  } else {
    // approve/reject/approve-safe were removed in v0.10.2 — the canonical
    // engine _firma/apply.py is the only code path that applies approvals.
    process.stdout.write(
      JSON.stringify(
        {
          ok: false,
          error:
            `"${cmd}" gibt es hier nicht mehr — Freigaben laufen ausschließlich über die ` +
            `kanonische Engine: python3 <workspace>/_firma/apply.py <workspace> ${cmd} …`,
        },
        null,
        0,
      ) + "\n",
    );
    process.exit(1);
  }
}

if (import.meta.main) main();
