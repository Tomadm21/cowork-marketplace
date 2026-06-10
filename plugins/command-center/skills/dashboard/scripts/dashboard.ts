#!/usr/bin/env bun
/**
 * Command Center — dashboard generator (deterministic, dependency-free).
 *
 * Reads the firm's own state and the workflow catalog, and emits ONE
 * self-contained HTML file (data inlined, no external network, no file://
 * fetch — because Cowork Live Artifacts render local HTML and a file:// page
 * cannot fetch a sibling JSON). The HTML is the live artifact.
 *
 *   bun dashboard.ts <workspace_root> [output.html]
 *
 * Reads (all best-effort — never crashes on missing/partial state):
 *   <ws>/_firma/company-context.md      → firm name
 *   <ws>/_firma/config/<process>.json   → which processes are active
 *   <ws>/_firma/_state/activity.jsonl   → the run log ("getane Arbeit")
 *   <ws>/_eingang/<process>/            → files waiting (grounds "Nächster Schritt")
 *   <plugin>/reference/workflows.json   → display catalog + minutes_per_item
 *
 * Writes ONLY inside the given workspace (default <ws>/_firma/dashboard.html).
 * Nothing about any client is hardcoded here.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));

// ── tiny helpers ────────────────────────────────────────────────────────────
const esc = (s: unknown): string =>
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

// German number / date formatting.
const deNum = (n: number, dp = 1): string =>
  n.toLocaleString("de-DE", { minimumFractionDigits: dp, maximumFractionDigits: dp });
const deInt = (n: number): string => n.toLocaleString("de-DE");
// hours under-claimed (floor to 1 decimal) so the estimate never overstates.
const floorHours = (min: number): number => Math.floor((min / 60) * 10) / 10;

function deDateTime(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}, ${p(d.getHours())}:${p(d.getMinutes())}`;
}
function deDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return esc(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
}

// ── catalog ─────────────────────────────────────────────────────────────────
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
  return { processes: {} }; // degraded: render structure with a note, never crash
}

// ── firm name ───────────────────────────────────────────────────────────────
function firmName(ws: string): string {
  const md = readFileSafe(path.join(ws, "_firma", "company-context.md"));
  if (md) {
    const h = md.match(/^#\s*Firmenkontext\s*[—–-]\s*(.+)\s*$/m);
    if (h && h[1] && !h[1].includes("{{")) return h[1].trim();
    const f = md.match(/Firmenname:\s*(.+)/);
    if (f && f[1] && !f[1].includes("{{")) return f[1].trim();
  }
  return "Dein Betrieb";
}

// ── activity log ────────────────────────────────────────────────────────────
interface Entry {
  ts?: string; run_id?: string; process?: string;
  summary?: string; items?: number; minutes_saved?: number;
  status?: string; version?: number;
}
function loadActivity(ws: string): Entry[] {
  const raw = readFileSafe(path.join(ws, "_firma", "_state", "activity.jsonl"));
  if (!raw) return [];
  const byRun = new Map<string, Entry>();
  const anon: Entry[] = [];
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    let e: Entry;
    try { e = JSON.parse(t) as Entry; } catch { continue; } // skip garbled line
    if (typeof e !== "object" || !e) continue;
    if (e.run_id) byRun.set(e.run_id, e);   // dedupe: last write per run_id wins
    else anon.push(e);
  }
  return [...byRun.values(), ...anon];
}

// ── stats ───────────────────────────────────────────────────────────────────
interface Stat { runs: number; doneRuns: number; items: number; minutes: number; last?: string }
function minutesFor(e: Entry, proc?: Proc): number {
  if (typeof e.minutes_saved === "number" && isFinite(e.minutes_saved)) return e.minutes_saved;
  const items = Math.max(0, typeof e.items === "number" && isFinite(e.items) ? e.items : 0);
  const per = proc?.minutes_per_item ?? 0;
  return items * per;
}

function main() {
  const ws = process.argv[2];
  if (!ws) { console.error("usage: dashboard.ts <workspace_root> [output.html]"); process.exit(1); }
  const outPath = process.argv[3] || path.join(ws, "_firma", "dashboard.html");

  const cat = loadCatalog();
  const procs = cat.processes || {};
  const keys = (cat.order && cat.order.length ? cat.order : Object.keys(procs))
    .filter((k) => procs[k]);
  const name = firmName(ws);
  const entries = loadActivity(ws);

  // per-process stats
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

  // waiting files per process (grounds the next-step block)
  const waiting: Record<string, number> = {};
  for (const k of keys) {
    const eingang = procs[k].eingang || k;
    waiting[k] = listFilesSafe(path.join(ws, "_eingang", eingang)).length;
  }

  // ── "Nächster Schritt" — grounded in real state, never generic ────────────
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

  // ── activity feed (last 10, all statuses) ─────────────────────────────────
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
      return `<tr><td class="d">${deDate(e.ts!)}</td><td>${esc(p.emoji || "")} ${esc(p.title || e.process || "—")}</td>
        <td class="sum">${esc(e.summary || "")}</td><td class="r">${right}</td></tr>`;
    }).join("");
  const feedHtml = feed
    ? `<table class="feed"><thead><tr><th>Datum</th><th>Prozess</th><th>Was</th><th></th></tr></thead><tbody>${feed}</tbody></table>`
    : `<p class="empty">Noch keine erledigten Vorgänge — sobald der erste Prozess läuft, erscheint hier, was gemacht wurde.</p>`;

  // ── hero: action-first when nothing is done yet, proof-first afterwards ────
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
    ? `<p class="empty">Der Workflow-Katalog wurde nicht gefunden — die Übersicht zeigt deshalb keine Prozesse. (Plugin-Installation prüfen.)</p>` : "";

  const stand = deDateTime(new Date());
  const html = `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Command Center — ${esc(name)}</title>
<style>
  :root{--bg:#0f1419;--card:#1a212b;--line:#2a3441;--ink:#e7edf3;--mut:#8a98a8;--acc:#5b9dff;--on:#3ecf8e;--off:#5a6675;}
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
  .wrap{max-width:1040px;margin:0 auto;padding:28px 20px 56px}
  header{display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:8px;margin-bottom:20px}
  header .name{font-size:20px;font-weight:700}
  header .name span{color:var(--mut);font-weight:500}
  header .stand{color:var(--mut);font-size:13px}
  .hero{background:linear-gradient(160deg,#1c2733,#161d27);border:1px solid var(--line);border-radius:16px;padding:28px;margin-bottom:24px}
  .bignum{font-size:64px;font-weight:800;line-height:1;letter-spacing:-1px}
  .bignum .unit{font-size:24px;font-weight:600;color:var(--mut);margin-left:8px}
  .biglabel{font-size:18px;color:var(--ink);margin-top:4px}
  .kpis{display:flex;gap:28px;margin:20px 0 16px;flex-wrap:wrap}
  .kpi b{font-size:26px;display:block}
  .kpi span{color:var(--mut);font-size:13px}
  .next{background:#10202e;border-left:3px solid var(--acc);padding:12px 14px;border-radius:8px;color:var(--ink)}
  .next.big{font-size:18px;margin-top:14px}
  .hero.cold .welcome{font-size:26px;font-weight:800}
  .hero.cold .lead{color:var(--mut);max-width:60ch}
  .muted{color:var(--mut);font-weight:400;font-size:.8em}
  h2{font-size:15px;text-transform:uppercase;letter-spacing:.06em;color:var(--mut);margin:28px 0 12px}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px}
  .card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px}
  .card.inactive{opacity:.72}
  .cardhead{display:flex;align-items:center;gap:8px}
  .cardhead .emoji{font-size:22px}
  .cardhead h3{font-size:17px;margin:0;flex:1}
  .badge{font-size:12px;padding:3px 8px;border-radius:20px;white-space:nowrap}
  .badge.on{background:rgba(62,207,142,.15);color:var(--on)}
  .badge.off{background:rgba(90,102,117,.18);color:var(--off)}
  .what{color:var(--ink);margin:10px 0}
  .howbox{background:#141b24;border-radius:10px;padding:10px 12px;margin:10px 0}
  .howlabel{font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:var(--mut);margin-bottom:4px}
  ol.how{margin:0;padding-left:18px}
  ol.how li{margin:3px 0;color:var(--ink)}
  .ng{display:flex;flex-direction:column;gap:4px;font-size:14px;color:var(--mut);margin:8px 0}
  .ng b{color:var(--ink);font-weight:600}
  .say{background:#10202e;border-radius:8px;padding:8px 10px;font-size:14px;margin:8px 0}
  .cardstat{font-size:14px;margin-top:8px}
  .audit{font-size:12.5px;color:var(--mut);margin-top:2px}
  code{background:#0c1117;padding:1px 6px;border-radius:5px;font-size:.9em}
  table.feed{width:100%;border-collapse:collapse;font-size:14px}
  table.feed th{text-align:left;color:var(--mut);font-weight:500;font-size:12px;border-bottom:1px solid var(--line);padding:6px 8px}
  table.feed td{padding:8px;border-bottom:1px solid #222c38;vertical-align:top}
  td.d{color:var(--mut);white-space:nowrap}
  td.sum{color:var(--ink)}
  td.r{text-align:right;white-space:nowrap}
  .saved{color:var(--on)}
  .pending{color:#e0b54a;font-size:13px}
  .empty{color:var(--mut);background:var(--card);border:1px solid var(--line);border-radius:12px;padding:16px}
  footer{color:var(--mut);font-size:13px;margin-top:32px;border-top:1px solid var(--line);padding-top:14px}
</style></head>
<body><div class="wrap">
  <header>
    <div class="name">${esc(name)} <span>· Command Center</span></div>
    <div class="stand">Stand: ${stand}</div>
  </header>
  ${hero}
  ${catNote}
  <h2>Was ich für dich tun kann</h2>
  <div class="grid">${cardHtml}</div>
  <h2>Zuletzt erledigt</h2>
  ${feedHtml}
  <footer>Aktualisieren: sag „<b>zeig das Dashboard</b>". · „Stunden gespart" = pro erledigtem Vorgang eine <b>angenommene</b> manuelle Bearbeitungszeit × Anzahl — bewusst konservativ geschätzt, keine gemessene Zeit. · erstellt von Command Center</footer>
</div></body></html>`;

  try {
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, html, "utf8");
  } catch (e) {
    console.error(`dashboard.ts: could not write ${outPath}: ${(e as Error).message}`);
    process.exit(1);
  }
  console.log(path.resolve(outPath));
}

main();
