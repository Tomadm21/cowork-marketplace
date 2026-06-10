#!/usr/bin/env bun
/**
 * Command Center — dashboard generator (deterministic, dependency-free).
 *
 * Emits ONE self-contained HTML cockpit (data inlined as a JS const — never fetch;
 * file:// can't fetch siblings). The HTML is the live artifact:
 *
 *   • First tab: "Überblick" — hero (time saved), process cards, activity feed.
 *   • Per-process tabs: review cockpit (item pager, preview, VORSCHLAG, BEGRÜNDUNG,
 *     Freigeben / Ablehnen buttons calling sendPrompt).
 *
 * Active tab: first workflow tab with open items; if none → Überblick.
 *
 *   bun dashboard.ts <workspace_root> [output.html]
 *
 * Reads (all best-effort — never crashes on missing/partial state):
 *   <ws>/_firma/company-context.md          → firm name
 *   <ws>/_firma/config/<process>.json       → which processes are active
 *   <ws>/_firma/_state/activity.jsonl       → the run log
 *   <ws>/_firma/_review/*.json              → open review queues
 *   <ws>/_eingang/<process>/                → files waiting
 *   <plugin>/reference/workflows.json       → display catalog
 *
 * Writes ONLY inside the given workspace (default <ws>/_firma/dashboard.html).
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { tierOf, titleOf, ICON, runs, type Queue, type Action } from "./apply.ts";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));

// ── tiny helpers ─────────────────────────────────────────────────────────────
export const esc = (s: unknown): string =>
  String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

function readFileSafe(p: string): string | null {
  try { return fs.readFileSync(p, "utf8"); } catch { return null; }
}
function existsSafe(p: string): boolean {
  try { return fs.existsSync(p); } catch { return false; }
}
function listFilesSafe(dir: string): string[] {
  try {
    return fs.readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isFile() && !e.name.startsWith("."))
      .map((e) => e.name);
  } catch { return []; }
}

const deNum = (n: number, dp = 1): string =>
  n.toLocaleString("de-DE", { minimumFractionDigits: dp, maximumFractionDigits: dp });
const deInt = (n: number): string => n.toLocaleString("de-DE");
const floorHours = (min: number): number => Math.floor((min / 60) * 10) / 10;

function deDateTime(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} · ${p(d.getHours())}:${p(d.getMinutes())}`;
}
function deDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return esc(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
}

// ── catalog ──────────────────────────────────────────────────────────────────
interface Proc {
  emoji?: string; title?: string; what?: string; how?: string[];
  needs?: string; gives?: string; trigger?: string;
  unit?: string; unit_plural?: string; minutes_per_item?: number;
  eingang?: string; setup_effort?: string; starter?: boolean;
}
interface Catalog { version?: number; order?: string[]; processes?: Record<string, Proc> }

function loadCatalog(): Catalog {
  const candidates = [
    process.env.CC_WORKFLOWS_JSON,
    path.join(scriptDir, "../../../reference/workflows.json"),
  ].filter(Boolean) as string[];
  for (const c of candidates) {
    const raw = readFileSafe(c);
    if (raw) { try { return JSON.parse(raw) as Catalog; } catch { /* try next */ } }
  }
  return { processes: {} };
}

// ── firm name ────────────────────────────────────────────────────────────────
export function firmName(ws: string): string {
  const md = readFileSafe(path.join(ws, "_firma", "company-context.md"));
  if (md) {
    const h = md.match(/^#\s*(?:Firmenkontext\s*[—–-]\s*)?(.+)\s*$/m);
    if (h && h[1] && !h[1].includes("{{")) return h[1].trim();
    const f = md.match(/Firmenname:\s*(.+)/);
    if (f && f[1] && !f[1].includes("{{")) return f[1].trim();
  }
  return "Dein Betrieb";
}

// ── activity log ─────────────────────────────────────────────────────────────
interface Entry {
  ts?: string; run_id?: string; process?: string;
  summary?: string; items?: number; minutes_saved?: number;
  status?: string; version?: number;
}
export function loadActivity(ws: string): Entry[] {
  const raw = readFileSafe(path.join(ws, "_firma", "_state", "activity.jsonl"));
  if (!raw) return [];
  const byRun = new Map<string, Entry>();
  const anon: Entry[] = [];
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    let e: Entry;
    try { e = JSON.parse(t) as Entry; } catch { continue; }
    if (typeof e !== "object" || !e) continue;
    if (e.run_id) byRun.set(e.run_id, e);
    else anon.push(e);
  }
  return [...byRun.values(), ...anon];
}

// ── queue loading ─────────────────────────────────────────────────────────────
export interface QueueItem {
  id: string | number;
  runid: string;
  tier: "s" | "p" | "f";
  title: string;
  source: string;
  filename: string;
  targets: string[];
  values: Record<string, unknown>;
  reason: string;
  process: string;
}

export interface ProcessQueue {
  processKey: string;
  label: string;
  items: QueueItem[];
}

/** Load all open queues from <ws>/_firma/_review/, group by process, preserve queue order. */
export function loadQueues(ws: string): ProcessQueue[] {
  const revDir = path.join(ws, "_firma", "_review");
  const allRuns = runs(revDir);

  // Group by process in ICON-defined order
  const order = Object.keys(ICON);
  const byProc = new Map<string, QueueItem[]>();

  for (const [, q] of allRuns) {
    const proc = (q.process as string) ?? "unknown";
    if (!byProc.has(proc)) byProc.set(proc, []);
    const arr = byProc.get(proc)!;
    for (const a of (q.actions ?? [])) {
      arr.push({
        id: a.id ?? 0,
        runid: q.runid,
        tier: tierOf(a),
        title: titleOf(a),
        source: (a.source as string) ?? "",
        filename: (a.filename as string) ?? "",
        targets: (a.targets as string[]) ?? [],
        values: (a.values as Record<string, unknown>) ?? {},
        reason: (a.reason as string) ?? "",
        process: proc,
      });
    }
  }

  const result: ProcessQueue[] = [];
  // First add in ICON order, then any unknown processes
  for (const key of order) {
    const items = byProc.get(key) ?? [];
    const label = ICON[key]?.[0] ?? key;
    result.push({ processKey: key, label, items });
    byProc.delete(key);
  }
  for (const [key, items] of byProc) {
    const label = ICON[key]?.[0] ?? key;
    result.push({ processKey: key, label, items });
  }

  return result;
}

/** Count open items per process key. */
export function countByProcess(queues: ProcessQueue[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const pq of queues) out[pq.processKey] = pq.items.length;
  return out;
}

/**
 * Returns the first processKey that has open items, or "overview" if none.
 * Used to determine the default active tab.
 */
export function defaultTab(queues: ProcessQueue[]): string {
  for (const pq of queues) {
    if (pq.items.length > 0) return pq.processKey;
  }
  return "overview";
}

// ── image inlining (cap ~150 KB) ──────────────────────────────────────────────
const MAX_IMAGE_BYTES = 150 * 1024;
const IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".heic"]);

function inlineImage(ws: string, relPath: string): string | null {
  if (!relPath) return null;
  const ext = path.extname(relPath).toLowerCase();
  if (!IMAGE_EXTS.has(ext)) return null;
  try {
    const abs = path.resolve(ws, relPath);
    // Safety: must stay inside workspace
    const wsAbs = path.resolve(ws);
    if (!abs.startsWith(wsAbs + path.sep) && abs !== wsAbs) return null;
    const stat = fs.statSync(abs);
    if (stat.size > MAX_IMAGE_BYTES) return null;
    const buf = fs.readFileSync(abs);
    const mime = ext === ".png" ? "image/png"
      : ext === ".gif" ? "image/gif"
      : ext === ".webp" ? "image/webp"
      : "image/jpeg";
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch { return null; }
}

// ── stats helpers ────────────────────────────────────────────────────────────
interface Stat { runs: number; doneRuns: number; items: number; minutes: number; last?: string }

function minutesFor(e: Entry, proc?: Proc): number {
  if (typeof e.minutes_saved === "number" && isFinite(e.minutes_saved)) return e.minutes_saved;
  const items = Math.max(0, typeof e.items === "number" && isFinite(e.items) ? e.items : 0);
  const per = proc?.minutes_per_item ?? 0;
  return items * per;
}

// ── main ──────────────────────────────────────────────────────────────────────
export function buildDashboard(ws: string): string {
  const cat = loadCatalog();
  const procs = cat.processes || {};
  const keys = (cat.order && cat.order.length ? cat.order : Object.keys(procs))
    .filter((k) => procs[k]);
  const name = firmName(ws);
  const entries = loadActivity(ws);
  const queues = loadQueues(ws);
  const counts = countByProcess(queues);
  const activeDefault = defaultTab(queues);
  const stand = deDateTime(new Date());

  // per-process stats (for Überblick)
  const stats: Record<string, Stat> = {};
  for (const k of keys) stats[k] = { runs: 0, doneRuns: 0, items: 0, minutes: 0 };
  for (const e of entries) {
    const k = e.process || "";
    if (!stats[k]) stats[k] = { runs: 0, doneRuns: 0, items: 0, minutes: 0 };
    stats[k].runs += 1;
    const done = (e.status ?? "done") === "done";
    if (done) {
      stats[k].doneRuns += 1;
      stats[k].items += Math.max(0, (typeof e.items === "number" && isFinite(e.items)) ? e.items : 0);
      stats[k].minutes += minutesFor(e, procs[k]);
    }
    if (e.ts && (!stats[k].last || e.ts > stats[k].last!)) stats[k].last = e.ts;
  }

  const active = keys.filter((k) => existsSafe(path.join(ws, "_firma", "config", `${k}.json`)));
  const totalMin = keys.reduce((s, k) => s + (stats[k]?.minutes ?? 0), 0);
  const totalItems = keys.reduce((s, k) => s + (stats[k]?.items ?? 0), 0);
  const totalDoneRuns = keys.reduce((s, k) => s + (stats[k]?.doneRuns ?? 0), 0);
  const totalHours = floorHours(totalMin);

  const waiting: Record<string, number> = {};
  for (const k of keys) {
    const eingang = procs[k].eingang || k;
    waiting[k] = listFilesSafe(path.join(ws, "_eingang", eingang)).length;
  }

  // ── Nächster Schritt ─────────────────────────────────────────────────────
  let nextStep: string;
  const waitingActive = active.filter((k) => waiting[k] > 0);
  const starters = keys.filter((k) => procs[k].starter && !active.includes(k));
  if (active.length === 0) {
    const rec = starters[0] ? procs[starters[0]] : (keys[0] ? procs[keys[0]] : undefined);
    nextStep = rec
      ? `Noch kein Prozess aktiv. Der einfachste Start: <b>${esc(rec.emoji || "")} ${esc(rec.title)}</b>. Sag <code>/command-center:setup</code> — wir richten ihn in 2 Minuten ein.`
      : `Noch kein Prozess aktiv. Sag <code>/command-center:setup</code> und wir richten den ersten ein.`;
  } else if (waitingActive.length > 0) {
    const k = waitingActive.sort((a, b) => waiting[b] - waiting[a])[0];
    const p = procs[k];
    const n = waiting[k];
    nextStep = `${n} ${esc(n === 1 ? (p.unit || "Datei") : (p.unit_plural || "Dateien"))} liegen im Eingang von <b>${esc(p.emoji || "")} ${esc(p.title)}</b>. Sag einfach: „<b>${esc(p.trigger)}</b>".`;
  } else if (starters.length > 0) {
    const p = procs[starters[0]];
    nextStep = `Läuft alles. Wenn du mehr automatisieren willst: <b>${esc(p.emoji || "")} ${esc(p.title)}</b> ist schnell eingerichtet — sag <code>/command-center:setup</code>.`;
  } else {
    nextStep = `Alles erledigt. Leg neue Dateien in den jeweiligen Eingang und sag mir Bescheid — oder warte auf den nächsten geplanten Lauf.`;
  }

  // ── cards ─────────────────────────────────────────────────────────────────
  const cardHtml = keys.map((k) => {
    const p = procs[k];
    const on = active.includes(k);
    const s = stats[k] || { runs: 0, doneRuns: 0, items: 0, minutes: 0 };
    const hrs = floorHours(s.minutes);
    const how = (p.how || []).map((step) => `<li>${esc(step)}</li>`).join("");
    const badge = on
      ? `<span class="badge on">● aktiv</span>`
      : `<span class="badge off">○ noch nicht aktiv</span>`;
    const stat = on && s.doneRuns > 0
      ? `<div class="cardstat"><b>${deNum(hrs)} Std</b> gespart · ${deInt(s.doneRuns)}× gelaufen${s.last ? ` · zuletzt ${deDate(s.last)}` : ""}
           <div class="audit">${deInt(s.items)} ${esc(s.items === 1 ? (p.unit || "") : (p.unit_plural || ""))} × ${deNum(p.minutes_per_item ?? 0, 1)} Min ≈ ${deNum(hrs)} Std <span class="muted">(geschätzt)</span></div></div>`
      : on
        ? `<div class="cardstat muted">Eingerichtet — noch nichts gelaufen.</div>`
        : `<div class="cardstat muted">Einrichten mit <code>/command-center:setup</code></div>`;
    return `
    <div class="card${on ? "" : " inactive"}">
      <div class="cardhead"><span class="emoji">${esc(p.emoji || "•")}</span><h3>${esc(p.title)}</h3>${badge}</div>
      <p class="what">${esc(p.what)}</p>
      <div class="howbox"><div class="howlabel">So funktioniert's</div><ol class="how">${how}</ol></div>
      <div class="ng"><span><b>Du gibst:</b> ${esc(p.needs)}</span><span><b>Du bekommst:</b> ${esc(p.gives)}</span></div>
      <div class="say">Sag einfach: „<b>${esc(p.trigger)}</b>"</div>
      ${stat}
    </div>`;
  }).join("");

  // ── activity feed ─────────────────────────────────────────────────────────
  const feed = entries
    .filter((e) => e.ts)
    .sort((a, b) => (b.ts! > a.ts! ? 1 : -1))
    .slice(0, 10)
    .map((e) => {
      const p = procs[e.process || ""] || {};
      const done = (e.status ?? "done") === "done";
      const min = done ? minutesFor(e, procs[e.process || ""]) : 0;
      const right = done
        ? `<span class="saved">+${deNum(floorHours(min))} Std</span>`
        : `<span class="pending">wartet auf Freigabe</span>`;
      return `<tr><td class="d">${deDate(e.ts!)}</td><td>${esc((p as Proc).emoji || "")} ${esc((p as Proc).title || e.process || "—")}</td>
        <td class="sum">${esc(e.summary || "")}</td><td class="r">${right}</td></tr>`;
    }).join("");
  const feedHtml = feed
    ? `<table class="feed"><thead><tr><th>Datum</th><th>Prozess</th><th>Was</th><th></th></tr></thead><tbody>${feed}</tbody></table>`
    : `<p class="empty">Noch keine erledigten Vorgänge — sobald der erste Prozess läuft, erscheint hier, was gemacht wurde.</p>`;

  // ── hero ──────────────────────────────────────────────────────────────────
  const heroCold = totalDoneRuns === 0;
  const hero = heroCold
    ? `<section class="hero cold">
         <div class="welcome">Willkommen in deinem Command Center</div>
         <p class="lead">Hier siehst du, was deine Helfer für dich tun — und was als Nächstes dran ist. Noch wurde nichts erledigt.</p>
         <div class="next big">→ ${nextStep}</div>
       </section>`
    : `<section class="hero">
         <div class="bignum">${deNum(totalHours)}<span class="unit">Std</span></div>
         <div class="biglabel">schon zurückbekommen <span class="muted">(geschätzt)</span></div>
         <div class="kpis">
           <div class="kpi"><b>${deInt(totalItems)}</b><span>Vorgänge erledigt</span></div>
           <div class="kpi"><b>${deInt(totalDoneRuns)}</b><span>Läufe</span></div>
           <div class="kpi"><b>${active.length}/${keys.length}</b><span>Prozesse aktiv</span></div>
         </div>
         <div class="next">→ ${nextStep}</div>
       </section>`;

  const catNote = keys.length === 0
    ? `<p class="empty">Der Workflow-Katalog wurde nicht gefunden. (Plugin-Installation prüfen.)</p>` : "";

  // ── cockpit data for JS ───────────────────────────────────────────────────
  // Build processes list in ICON order, include all even if empty
  const cockpitProcesses = queues.map((pq) => {
    const items = pq.items.map((it) => {
      // Try to inline preview image from source file
      const dataUri = inlineImage(ws, it.source);
      return {
        id: it.id,
        runid: it.runid,
        tier: it.tier,
        title: it.title,
        source: it.source,
        filename: it.filename,
        targets: it.targets,
        values: it.values,
        reason: it.reason,
        thumb: dataUri ?? null,
      };
    });
    return {
      key: pq.processKey,
      label: pq.label,
      items,
    };
  });

  const dataJson = JSON.stringify({ stand, active: activeDefault, processes: cockpitProcesses });

  // ── Server-side render helpers (mirror JS logic, produces static HTML) ───────
  function pillHtmlSS(tier: string): string {
    if (tier === "p") return `<span class="pill p">prüfen</span>`;
    if (tier === "f") return `<span class="pill f">folgenreich</span>`;
    return `<span class="pill s">sicher</span>`;
  }

  function pagerSS(count: number, idx: number): string {
    if (count === 0) return "";
    const dots = Array.from({ length: count }, (_, j) =>
      `<button class="dot${j === idx ? " on" : ""}" onclick="si(${j})" aria-label="Posten ${j + 1}"></button>`,
    ).join("");
    return `<div class="pager"><div class="dots">${dots}</div><button class="pb" onclick="go(-1)">‹</button><span class="ct">${idx + 1} / ${count}</span><button class="pb" onclick="go(1)">›</button></div>`;
  }

  function renderItemSS(it: (typeof cockpitProcesses)[0]["items"][0], label: string, count: number, idx: number): string {
    const labelJson = JSON.stringify(label);
    let rows = "";
    for (const [k, v] of Object.entries(it.values ?? {})) {
      rows += `<tr><td>${esc(k)}</td><td>${esc(String(v ?? ""))}</td></tr>`;
    }
    const targetsHtml = it.targets?.length
      ? it.targets.map((t) => `<div class="pathblock">${esc(t)}</div>`).join("")
      : `<span style="color:var(--mu)">—</span>`;
    rows += `<tr><td>Ziel</td><td>${targetsHtml}</td></tr>`;
    const previewHtml = it.thumb
      ? `<div class="imgwrap"><img src="${it.thumb}" alt="Vorschau"></div>`
      : `<div class="noprev">Keine Vorschau</div>`;
    return `<div class="itemhead"><h2>${esc(it.title)}</h2>${pillHtmlSS(it.tier)}${pagerSS(count, idx)}</div>
    <div class="itemgrid">
      <div>${previewHtml}</div>
      <div>
        <div class="icard"><p class="ttl">Vorschlag</p><table class="vt"><tbody>${rows}</tbody></table></div>
        <div class="icard"><p class="ttl">Begründung</p><div class="begruendung">${esc(it.reason)}</div>
          <div class="actions">
            <button class="ap" onclick="act('Freigeben','${esc(it.runid)}',${it.id},${labelJson})">Freigeben</button>
            <button class="rj" onclick="act('Ablehnen','${esc(it.runid)}',${it.id},${labelJson})">Ablehnen</button>
          </div>
        </div>
      </div>
    </div>`;
  }

  function renderProcessSS(pq: (typeof cockpitProcesses)[0]): string {
    if (pq.items.length === 0) {
      return `<div class="empty-tab"><h3>Keine offenen Posten · ${esc(pq.label)}</h3><p>Wird hier vorgelegt, sobald der Prozess einen neuen Lauf abschließt.</p></div>`;
    }
    const it = pq.items[0];
    const label = String((it.values as Record<string, unknown>)?.lieferant ?? it.filename ?? pq.label);
    return renderItemSS(it, label, pq.items.length, 0);
  }

  // ── Server-side tab bar ──────────────────────────────────────────────────
  const tabsHtml = [
    `<button class="tab${activeDefault === "overview" ? " on" : ""}" onclick="sp('overview')">Überblick<span class="chip z">—</span></button>`,
    ...cockpitProcesses.map((p) => {
      const cnt = p.items.length;
      const chipCls = `chip${cnt === 0 ? " z" : ""}`;
      const isActive = activeDefault === p.key;
      return `<button class="tab${isActive ? " on" : ""}" onclick="sp('${p.key}')">${esc(p.label)}<span class="${chipCls}">${cnt}</span></button>`;
    }),
  ].join("");

  // ── Initial body content (server-rendered for instant first paint) ───────
  let initialBody: string;
  if (activeDefault === "overview") {
    initialBody = ""; // Überblick content is already in #ueberblick-content, shown by default
  } else {
    const activePQ = cockpitProcesses.find((p) => p.key === activeDefault);
    initialBody = activePQ ? renderProcessSS(activePQ) : "";
  }

  const ueberblickDisplay = activeDefault === "overview" ? "" : "display:none";

  // ── HTML ──────────────────────────────────────────────────────────────────
  return `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Command Center — ${esc(name)}</title>
<style>
:root{color-scheme:light;--tx:#1b1f24;--mu:#6b7280;--bd:#e7e9ed;--ac:#2563cc;--sf:#f7f8fa;--am:#b45309;--amb:#fdf2e3;--amd:#f3d9a6;--gn:#15803d;--bg:#fff}
*{box-sizing:border-box}
body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:var(--tx);background:var(--bg);line-height:1.5;-webkit-font-smoothing:antialiased}
.wrap{max-width:1120px;margin:0 auto;padding:18px 20px 40px}
.hd{display:flex;align-items:center;gap:12px;margin-bottom:16px}
.hd .mark{width:30px;height:30px;border-radius:8px;background:linear-gradient(135deg,#2563cc,#3b82f6);flex-shrink:0}
.hd h1{font-size:19px;font-weight:600;margin:0;letter-spacing:-.01em}
.hd .sub{font-size:12.5px;color:var(--mu)}
.hd .stand{margin-left:auto;font-size:12px;color:var(--mu);white-space:nowrap}
.tabs{display:flex;gap:2px;border-bottom:1px solid var(--bd);margin-bottom:18px;overflow-x:auto}
.tab{appearance:none;border:0;background:none;padding:10px 14px 12px;font:inherit;font-size:13.5px;color:var(--mu);cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-1px;display:flex;align-items:center;gap:8px;white-space:nowrap;flex-shrink:0}
.tab:hover{color:var(--tx)}.tab.on{color:var(--ac);border-bottom-color:var(--ac);font-weight:500}
.chip{font-size:11px;min-width:18px;text-align:center;border-radius:9px;padding:0 6px;background:#eef1f6;color:#576070}
.tab.on .chip{background:#e1ebfc;color:#2152a8}.chip.z{opacity:.45}
.itemhead{display:flex;align-items:center;gap:10px;margin-bottom:14px;flex-wrap:wrap}
.itemhead h2{font-size:16px;font-weight:600;margin:0}
.pill{font-size:11.5px;border-radius:20px;padding:2px 10px;font-weight:500}
.pill.p{background:var(--amb);color:var(--am);border:1px solid var(--amd)}
.pill.f{background:#fde8e8;color:#b42318;border:1px solid #f5bfbb}
.pill.s{background:#eaf6ee;color:var(--gn);border:1px solid #bfe3c9}
.pager{margin-left:auto;display:flex;align-items:center;gap:8px}
.pager .dots{display:flex;gap:5px}
.pager .dot{width:7px;height:7px;border-radius:50%;background:#d4d8de;cursor:pointer;border:0;padding:0}
.pager .dot.on{background:var(--ac)}
.pager .pb{width:30px;height:30px;border-radius:8px;border:1px solid var(--bd);background:#fff;cursor:pointer;font-size:14px;color:#374151}
.pager .pb:hover{background:var(--sf)}
.pager .ct{font-size:12.5px;color:var(--mu);min-width:46px;text-align:center}
.itemgrid{display:grid;grid-template-columns:minmax(0,0.92fr) minmax(0,1fr);gap:18px;align-items:start}
@media(max-width:820px){.itemgrid{grid-template-columns:1fr}}
.imgwrap{border:1px solid var(--bd);border-radius:12px;overflow:hidden;background:var(--sf)}
.imgwrap img{display:block;width:100%;height:auto}
.noprev{border:1px solid var(--bd);border-radius:12px;padding:32px 16px;text-align:center;background:var(--sf);color:var(--mu);font-size:13.5px}
.icard{border:1px solid var(--bd);border-radius:12px;padding:14px 16px;box-shadow:0 1px 3px rgba(16,24,40,.05)}
.icard+.icard{margin-top:12px}
.ttl{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:#8a93a0;margin:0 0 8px}
table.vt{width:100%;border-collapse:collapse;font-size:13px}
table.vt td{padding:5px 0;border-bottom:1px solid #f0f1f4;vertical-align:top}
table.vt tr:last-child td{border-bottom:0}
table.vt td:first-child{color:var(--mu);width:90px;padding-right:10px}
.pathblock{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11.5px;background:var(--sf);border:1px solid var(--bd);border-radius:7px;padding:7px 9px;word-break:break-all;color:var(--tx)}
.begruendung{font-size:13px;color:#3a3f47;line-height:1.55}
.actions{display:flex;gap:10px;margin-top:14px}
.actions button{font:inherit;font-size:13.5px;border-radius:9px;padding:9px 16px;cursor:pointer;border:1px solid transparent}
.ap{background:var(--gn);color:#fff}.ap:hover{background:#136a32}
.rj{background:#fff;color:#b42318;border-color:#eccac6}.rj:hover{background:#fdf3f2}
.empty-tab{border:1px dashed var(--bd);border-radius:14px;padding:40px 28px;text-align:center;background:var(--sf)}
.empty-tab h3{margin:0 0 5px;font-size:15px;font-weight:600}
.empty-tab p{margin:0 auto;max-width:460px;font-size:13px;color:var(--mu)}
.manual{display:none;margin-top:14px;padding:12px 14px;background:#fffbeb;border:1px solid #fcd34d;border-radius:9px;font-size:13px;color:#92400e}
.foot{font-size:12px;color:var(--mu);margin-top:16px;border-top:1px solid var(--bd);padding-top:10px}
.hero{background:linear-gradient(160deg,#f0f5ff,#f8fafb);border:1px solid var(--bd);border-radius:16px;padding:28px;margin-bottom:24px}
.bignum{font-size:64px;font-weight:800;line-height:1;letter-spacing:-1px;color:var(--tx)}
.bignum .unit{font-size:24px;font-weight:600;color:var(--mu);margin-left:8px}
.biglabel{font-size:18px;color:var(--tx);margin-top:4px}
.kpis{display:flex;gap:28px;margin:20px 0 16px;flex-wrap:wrap}
.kpi b{font-size:26px;display:block;color:var(--tx)}
.kpi span{color:var(--mu);font-size:13px}
.next{background:#eef3ff;border-left:3px solid var(--ac);padding:12px 14px;border-radius:8px;color:var(--tx)}
.next.big{font-size:18px;margin-top:14px}
.hero.cold .welcome{font-size:26px;font-weight:800}
.hero.cold .lead{color:var(--mu);max-width:60ch}
.muted{color:var(--mu);font-weight:400;font-size:.8em}
h2.section{font-size:15px;text-transform:uppercase;letter-spacing:.06em;color:var(--mu);margin:28px 0 12px}
.cardgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px}
.card{background:var(--sf);border:1px solid var(--bd);border-radius:14px;padding:16px}
.card.inactive{opacity:.72}
.cardhead{display:flex;align-items:center;gap:8px}
.cardhead .emoji{font-size:22px}
.cardhead h3{font-size:17px;margin:0;flex:1}
.badge{font-size:12px;padding:3px 8px;border-radius:20px;white-space:nowrap}
.badge.on{background:rgba(21,128,61,.12);color:var(--gn)}
.badge.off{background:rgba(107,114,128,.12);color:#6b7280}
.what{color:var(--tx);margin:10px 0}
.howbox{background:#f0f1f4;border-radius:10px;padding:10px 12px;margin:10px 0}
.howlabel{font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:var(--mu);margin-bottom:4px}
ol.how{margin:0;padding-left:18px}
ol.how li{margin:3px 0;color:var(--tx)}
.ng{display:flex;flex-direction:column;gap:4px;font-size:14px;color:var(--mu);margin:8px 0}
.ng b{color:var(--tx);font-weight:600}
.say{background:#eef3ff;border-radius:8px;padding:8px 10px;font-size:14px;margin:8px 0}
.cardstat{font-size:14px;margin-top:8px}
.audit{font-size:12.5px;color:var(--mu);margin-top:2px}
code{background:#f0f1f4;padding:1px 6px;border-radius:5px;font-size:.9em}
table.feed{width:100%;border-collapse:collapse;font-size:14px}
table.feed th{text-align:left;color:var(--mu);font-weight:500;font-size:12px;border-bottom:1px solid var(--bd);padding:6px 8px}
table.feed td{padding:8px;border-bottom:1px solid #f0f1f4;vertical-align:top}
td.d{color:var(--mu);white-space:nowrap}
td.r{text-align:right;white-space:nowrap}
.saved{color:var(--gn)}
.pending{color:#e0b54a;font-size:13px}
p.empty{color:var(--mu);background:var(--sf);border:1px solid var(--bd);border-radius:12px;padding:16px}
</style>
</head>
<body><div class="wrap">
  <div class="hd">
    <div class="mark"></div>
    <div><h1>${esc(name)} · Command Center</h1><div class="sub">Freigaben &amp; Kontrolle</div></div>
    <div class="stand">Stand: ${esc(stand)}</div>
  </div>
  <div class="tabs" id="tabs">${tabsHtml}</div>
  <div id="body">${initialBody}</div>
  <div class="manual" id="manual"></div>
  <div class="foot">Workflow oben wählen · ←→ blättern · F freigeben · R ablehnen · Freigabe legt collision-safe ab — nichts ohne deine Bestätigung.</div>
  <div id="ueberblick-content" style="${ueberblickDisplay}">
    ${hero}
    ${catNote}
    <h2 class="section">Was ich für dich tun kann</h2>
    <div class="cardgrid">${cardHtml}</div>
    <h2 class="section">Zuletzt erledigt</h2>
    ${feedHtml}
    <footer class="foot">Aktualisieren: sag „<b>zeig das Dashboard</b>". · „Stunden gespart" = pro erledigtem Vorgang eine <b>angenommene</b> manuelle Bearbeitungszeit × Anzahl — bewusst konservativ geschätzt, keine gemessene Zeit.</footer>
  </div>
</div>
<script>
var C=${dataJson};
var pi=C.active;
var ii={};

function e(s){return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

function pillHtml(tier){
  if(tier==='p')return '<span class="pill p">prüfen</span>';
  if(tier==='f')return '<span class="pill f">folgenreich</span>';
  return '<span class="pill s">sicher</span>';
}

function pagerHtml(count,idx){
  if(!count)return '';
  var dots=Array.from({length:count},function(_,j){return '<button class="dot'+(j===idx?' on':'')+'" onclick="si('+j+')" aria-label="Posten '+(j+1)+'"></button>';}).join('');
  return '<div class="pager"><div class="dots">'+dots+'</div><button class="pb" onclick="go(-1)">‹</button><span class="ct">'+(idx+1)+' / '+count+'</span><button class="pb" onclick="go(1)">›</button></div>';
}

function renderProcess(proc){
  if(!ii[proc.key]&&ii[proc.key]!==0)ii[proc.key]=0;
  var idx=ii[proc.key]||0;
  if(!proc.items.length){
    return '<div class="empty-tab"><h3>Keine offenen Posten · '+e(proc.label)+'</h3><p>Wird hier vorgelegt, sobald der Prozess einen neuen Lauf abschließt.</p></div>';
  }
  if(idx>=proc.items.length)idx=0;
  var it=proc.items[idx];
  var label=String((it.values&&it.values.lieferant)||it.filename||proc.label);
  var rows='';
  var vkeys=Object.keys(it.values||{});
  for(var ki=0;ki<vkeys.length;ki++){var k=vkeys[ki];rows+='<tr><td>'+e(k)+'</td><td>'+e(String(it.values[k]??''))+'</td></tr>';}
  var targetsHtml=it.targets&&it.targets.length?it.targets.map(function(t){return '<div class="pathblock">'+e(t)+'</div>';}).join(''):'<span style="color:var(--mu)">—</span>';
  rows+='<tr><td>Ziel</td><td>'+targetsHtml+'</td></tr>';
  var prevHtml=it.thumb?'<div class="imgwrap"><img src="'+it.thumb+'" alt="Vorschau"></div>':'<div class="noprev">Keine Vorschau</div>';
  var labelJson=JSON.stringify(label);
  return '<div class="itemhead"><h2>'+e(it.title)+'</h2>'+pillHtml(it.tier)+pagerHtml(proc.items.length,idx)+'</div>'+
    '<div class="itemgrid"><div>'+prevHtml+'</div><div>'+
    '<div class="icard"><p class="ttl">Vorschlag</p><table class="vt"><tbody>'+rows+'</tbody></table></div>'+
    '<div class="icard"><p class="ttl">Begründung</p><div class="begruendung">'+e(it.reason)+'</div>'+
    '<div class="actions">'+
    '<button class="ap" onclick="act(\'Freigeben\',\''+e(it.runid)+'\','+String(it.id)+','+labelJson+')">Freigeben</button>'+
    '<button class="rj" onclick="act(\'Ablehnen\',\''+e(it.runid)+'\','+String(it.id)+','+labelJson+')">Ablehnen</button>'+
    '</div></div></div></div>';
}

function syncTabs(){
  var btns=document.querySelectorAll('#tabs .tab');
  var keys=['overview'].concat(C.processes.map(function(p){return p.key;}));
  btns.forEach(function(btn,i){btn.classList.toggle('on',keys[i]===pi);});
}

function render(){
  syncTabs();
  var b=document.getElementById('body');
  var ub=document.getElementById('ueberblick-content');
  document.getElementById('manual').style.display='none';
  if(pi==='overview'){
    b.innerHTML='';
    ub.style.display='';
    return;
  }
  ub.style.display='none';
  var proc=null;
  for(var i=0;i<C.processes.length;i++){if(C.processes[i].key===pi){proc=C.processes[i];break;}}
  if(!proc){b.innerHTML='<div class="empty-tab"><h3>Unbekannter Tab</h3></div>';return;}
  b.innerHTML=renderProcess(proc);
}

function sp(key){pi=key;render();}

function si(j){
  var proc=null;for(var i=0;i<C.processes.length;i++){if(C.processes[i].key===pi){proc=C.processes[i];break;}}
  if(!proc||!proc.items.length)return;
  ii[pi]=((j%proc.items.length)+proc.items.length)%proc.items.length;
  render();
}

function go(d){
  var proc=null;for(var i=0;i<C.processes.length;i++){if(C.processes[i].key===pi){proc=C.processes[i];break;}}
  if(!proc)return;
  si((ii[pi]||0)+d);
}

function act(verb,runid,id,label){
  var p=(verb==='Freigeben'?'Freigeben: ':'Ablehnen: ')+runid+' Aktion '+id+' ('+label+')';
  try{if(typeof sendPrompt==='function'){sendPrompt(p);return;}}catch(x){}
  try{if(window.cowork&&window.cowork.sendPrompt){window.cowork.sendPrompt(p);return;}}catch(x){}
  var m=document.getElementById('manual');m.style.display='block';
  m.innerHTML='Sag mir: <b>'+e(p)+'</b><br>oder: <code>bun apply.ts _firma '+(verb==='Freigeben'?'approve':'reject')+' '+e(runid)+' '+id+'</code>';
}

document.addEventListener('keydown',function(ev){
  if(pi==='overview')return;
  var proc=null;for(var i=0;i<C.processes.length;i++){if(C.processes[i].key===pi){proc=C.processes[i];break;}}
  if(ev.key==='ArrowRight')go(1);
  else if(ev.key==='ArrowLeft')go(-1);
  else if(ev.key.toLowerCase()==='f'&&proc&&proc.items.length){var it=proc.items[ii[pi]||0];var lbl=String((it.values&&it.values.lieferant)||it.filename||proc.label);act('Freigeben',it.runid,it.id,lbl);}
  else if(ev.key.toLowerCase()==='r'&&proc&&proc.items.length){var it=proc.items[ii[pi]||0];var lbl=String((it.values&&it.values.lieferant)||it.filename||proc.label);act('Ablehnen',it.runid,it.id,lbl);}
});
</script>
</body></html>`;
}

function main() {
  const ws = process.argv[2];
  if (!ws) { console.error("usage: dashboard.ts <workspace_root> [output.html]"); process.exit(1); }
  const outPath = process.argv[3] || path.join(ws, "_firma", "dashboard.html");

  const html = buildDashboard(ws);

  try {
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, html, "utf8");
  } catch (e) {
    console.error(`dashboard.ts: could not write ${outPath}: ${(e as Error).message}`);
    process.exit(1);
  }
  console.log(path.resolve(outPath));
}

if (import.meta.main) main();
